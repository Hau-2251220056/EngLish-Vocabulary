import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { PrismaClient } from "../../src/generated/prisma/client.ts";
import { createApp } from "../../src/create-app.js";
import { configureTestEnvironment } from "../helpers/test-environment.js";

configureTestEnvironment({ requireReset: true });

const host = "127.0.0.1";
const port = Number(process.env.PERFORMANCE_BACKEND_PORT ?? 5012);
const outputDirectory = resolve(import.meta.dirname, "../../../frontend/test-results/performance");
const outputPath = resolve(outputDirectory, "backend-smoke.json");
const queries = [];
const requests = [];
const prisma = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
let observeQueries = false;

prisma.$on("query", ({ query, duration }) => {
  if (!observeQueries) return;
  queries.push({ order: queries.length + 1, shape: redactQuery(query), duration_ms: duration });
});

const recordsBefore = await countProtectedRecords();
observeQueries = true;
const app = createApp({ prisma });
app.post("/__performance/reset", (_request, response) => {
  requests.length = 0;
  queries.length = 0;
  response.status(204).end();
});
app.get("/__performance/snapshot", async (_request, response, next) => {
  try {
    observeQueries = false;
    const recordsAfter = await countProtectedRecords();
    const snapshot = createSnapshot(recordsAfter);
    await persistSnapshot(snapshot);
    response.status(200).json(snapshot);
  } catch (error) {
    next(error);
  } finally {
    observeQueries = true;
  }
});
const server = app.listen(port, host, () => {
  console.log(`Performance TEST server listening on ${host}:${port}`);
});

server.prependListener("request", (request, response) => {
  const startedAt = performance.now();
  const path = new URL(request.url, `http://${host}:${port}`).pathname;
  response.once("finish", () => {
    requests.push({
      method: request.method,
      path,
      status: response.statusCode,
      server_elapsed_ms: round(performance.now() - startedAt),
      query_count_at_finish: queries.length,
    });
  });
});

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await new Promise((resolvePromise, reject) => {
    server.close((error) => (error ? reject(error) : resolvePromise()));
  });
  observeQueries = false;
  const recordsAfter = await countProtectedRecords();
  await prisma.$disconnect();
  await persistSnapshot(createSnapshot(recordsAfter));
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    void stop().then(() => process.exit(0), (error) => {
      console.error(`Performance server shutdown failed: ${error.message}`);
      process.exit(1);
    });
  });
}

function redactQuery(query) {
  return query.replace(/\s+/g, " ").trim().replace(/\$\d+/g, "?");
}

function round(value) {
  return Number(value.toFixed(3));
}

async function countProtectedRecords() {
  const [users, sessions] = await Promise.all([
    prisma.uSER.count(),
    prisma.aUTH_SESSION.count(),
  ]);
  return { users, sessions };
}

function createSnapshot(recordsAfter) {
  return {
    requests,
    queries,
    preservation: {
      before: recordsBefore,
      after: recordsAfter,
      unchanged: recordsBefore.users === recordsAfter.users
        && recordsBefore.sessions === recordsAfter.sessions,
    },
  };
}

async function persistSnapshot(snapshot) {
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}
