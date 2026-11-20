import { fileURLToPath } from "node:url";
import { configureTestEnvironment } from "../helpers/test-environment.js";

export const BASELINE_FIXTURE = Object.freeze({
  vocabularyId: "10000000-0000-4000-8000-000000000001",
  meaningId: "10000000-0000-4000-8000-000000000002",
  exampleId: "10000000-0000-4000-8000-000000000003",
  word: "pv02-baseline-canonical",
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await seedBaselineFixture();
}

export async function seedBaselineFixture() {
  configureTestEnvironment({ requireReset: true });
  const { PrismaClient } = await import("../../src/generated/prisma/client.ts");
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    const ownerColumn = await prisma.$queryRawUnsafe(
      `SELECT 1
         FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'VOCABULARY'
          AND column_name = 'owner_id'`,
    );
    const mode = ownerColumn.length === 0 ? "CURRENT_BASELINE" : "PV02_ALREADY_APPLIED";

    await prisma.$executeRawUnsafe(
      `INSERT INTO "VOCABULARY" ("id", "word", "created_at", "updated_at")
       VALUES ($1::uuid, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO NOTHING`,
      BASELINE_FIXTURE.vocabularyId,
      BASELINE_FIXTURE.word,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "VOCABULARY_MEANING" ("id", "vocabulary_id", "part_of_speech", "meaning_vi", "created_at", "updated_at")
       VALUES ($1::uuid, $2::uuid, 'noun', 'baseline meaning', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO NOTHING`,
      BASELINE_FIXTURE.meaningId,
      BASELINE_FIXTURE.vocabularyId,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "VOCABULARY_EXAMPLE" ("id", "meaning_id", "example_en", "created_at")
       VALUES ($1::uuid, $2::uuid, 'Baseline example.', CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO NOTHING`,
      BASELINE_FIXTURE.exampleId,
      BASELINE_FIXTURE.meaningId,
    );
    console.log(`Personal Vocabulary baseline fixture ready: ${mode}`);
  } finally {
    await prisma.$disconnect();
  }
}
