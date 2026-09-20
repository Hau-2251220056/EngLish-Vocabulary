import { PrismaClient } from "../../src/generated/prisma/client.ts";
import { createApp } from "../../src/create-app.js";
import { configureTestEnvironment } from "../helpers/test-environment.js";

configureTestEnvironment({ requireReset: true });

const host = "127.0.0.1";
const port = 5000;
const prisma = new PrismaClient();
const app = createApp({ prisma });
const server = app.listen(port, host, () => {
  console.log(`Authentication integration server listening on ${host}:${port}`);
});

let stopping = false;

async function stop() {
  if (stopping) return;
  stopping = true;

  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await prisma.$disconnect();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    void stop()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(`Integration server shutdown failed: ${error.message}`);
        process.exit(1);
      });
  });
}
