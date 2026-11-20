import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "../../../backend/src/generated/prisma/client.ts";
import { configureTestEnvironment } from "../../../backend/test/helpers/test-environment.js";
import { loadDiscoveryCatalog } from "../../src/topics/discovery-catalog.js";
import { FIXTURE_PATH } from "./fixture.js";

configureTestEnvironment({ requireReset: true });

const prisma = new PrismaClient();
const createdTopicIds = [];
const createdSetIds = [];

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await prisma.$connect();
  const fixture = JSON.parse(await readFile(FIXTURE_PATH, "utf8"));
  const suffix = randomUUID();
  for (let index = 0; index < 2; index += 1) {
    const topic = await prisma.tOPIC.create({
      data: {
        name: `DISCOVERY-V1-${suffix}-${index + 1}`,
        description: "Run-owned Discovery composition measurement Topic",
      },
    });
    const set = await prisma.vOCABULARY_SET.create({
      data: {
        owner_id: fixture.admin_id,
        topic_id: topic.id,
        name: `DISCOVERY-V1-${suffix}-Set-${index + 1}`,
        description: "Run-owned Discovery composition measurement Set",
        is_public: true,
        items: {
          create: [{ vocabulary_id: fixture.vocabulary_ids[index], position: 1 }],
        },
      },
    });
    createdTopicIds.push(topic.id);
    createdSetIds.push(set.id);
  }
});

test.afterAll(async () => {
  try {
    await prisma.vOCABULARY_SET.deleteMany({ where: { id: { in: createdSetIds } } });
    await prisma.tOPIC.deleteMany({ where: { id: { in: createdTopicIds } } });
  } finally {
    await prisma.$disconnect();
  }
});

test("TASK-129 measures current-API Discovery composition without a sequential waterfall", async ({ request }, testInfo) => {
  const currentTopics = await getData(await request.get("/api/topics"));
  expect(currentTopics.length).toBeGreaterThanOrEqual(3);

  const singleTopic = await measureCondition(request, { measuredRuns: 5, topicLimit: 1 });
  const currentDataset = await measureCondition(request, { measuredRuns: 5 });
  const evidence = {
    measured_at: new Date().toISOString(),
    methodology: {
      warmup_runs: 1,
      measured_runs: 5,
      readiness: "complete catalog returned after Topics and every required Topic Set response",
      catalog_requests_exclude: ["authentication", "assets", "browser bootstrap"],
    },
    single_topic: summarize(singleTopic),
    current_dataset: summarize(currentDataset),
  };

  assertCondition(evidence.single_topic, 1);
  assertCondition(evidence.current_dataset, currentTopics.length);
  expect(evidence.current_dataset.max_active_set_requests_min).toBeGreaterThan(1);

  await testInfo.attach("discovery-composition-evidence", {
    body: JSON.stringify(evidence, null, 2),
    contentType: "application/json",
  });
  console.log(`DISCOVERY_COMPOSITION_EVIDENCE ${JSON.stringify(evidence)}`);
});

async function measureCondition(request, { measuredRuns, topicLimit }) {
  await measureOnce(request, topicLimit);
  const samples = [];
  for (let run = 0; run < measuredRuns; run += 1) {
    samples.push(await measureOnce(request, topicLimit));
  }
  return samples;
}

async function measureOnce(request, topicLimit) {
  let activeSetRequests = 0;
  let maxActiveSetRequests = 0;
  let requestCount = 0;
  const startedAt = performance.now();
  const catalog = await loadDiscoveryCatalog({
    async listTopics() {
      requestCount += 1;
      const topics = await getData(await request.get("/api/topics"));
      return topicLimit === undefined ? topics : topics.slice(0, topicLimit);
    },
    async listPublicSystemSets(topicId) {
      requestCount += 1;
      activeSetRequests += 1;
      maxActiveSetRequests = Math.max(maxActiveSetRequests, activeSetRequests);
      try {
        return await getData(await request.get(`/api/topics/${encodeURIComponent(topicId)}/vocabulary-sets`));
      } finally {
        activeSetRequests -= 1;
      }
    },
  });
  return {
    readiness_ms: round(performance.now() - startedAt),
    topic_count: catalog.topics.length,
    set_count: catalog.sets.length,
    request_count: requestCount,
    max_active_set_requests: maxActiveSetRequests,
  };
}

function summarize(samples) {
  const readiness = samples.map(({ readiness_ms }) => readiness_ms).sort((left, right) => left - right);
  return {
    topic_count: samples[0].topic_count,
    expected_request_count: 1 + samples[0].topic_count,
    actual_request_counts: samples.map(({ request_count }) => request_count),
    max_active_set_requests_min: Math.min(...samples.map(({ max_active_set_requests }) => max_active_set_requests)),
    set_counts: samples.map(({ set_count }) => set_count),
    readiness_samples_ms: samples.map(({ readiness_ms }) => readiness_ms),
    readiness_median_ms: readiness[Math.floor(readiness.length / 2)],
    readiness_min_ms: readiness[0],
    readiness_max_ms: readiness.at(-1),
  };
}

function assertCondition(result, topicCount) {
  expect(result.topic_count).toBe(topicCount);
  expect(result.actual_request_counts).toEqual(Array(5).fill(1 + topicCount));
  expect(new Set(result.set_counts).size).toBe(1);
}

async function getData(response) {
  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body.success).toBe(true);
  expect(Array.isArray(body.data)).toBe(true);
  return body.data;
}

function round(value) {
  return Number(value.toFixed(3));
}
