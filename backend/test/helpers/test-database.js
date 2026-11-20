import { configureTestEnvironment } from "./test-environment.js";

export async function createTestDatabase({ expectedSchema, expectedSchemaMarker } = {}) {
  configureTestEnvironment({ requireReset: true });
  if ((expectedSchema === undefined) !== (expectedSchemaMarker === undefined)) {
    throw new Error("Owned test schema and marker must be provided together.");
  }
  const { PrismaClient } = await import(
    "../../src/generated/prisma/client.ts"
  );
  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
  } catch (error) {
    await prisma.$disconnect().catch(() => {});
    throw error;
  }

  return {
    prisma,
    async reset() {
      if (expectedSchema) {
        await assertOwnedTestSchema(prisma, expectedSchema, expectedSchemaMarker);
      }
      await resetStreakData(prisma);
      await resetXpRewardData(prisma);
      await resetLearningProgressData(prisma);
      await resetPrivateVocabularyCreateOperationData(prisma);
      await resetVocabularySetData(prisma);
      await resetVocabularyData(prisma);
      await resetTopicData(prisma);
      await resetAuthenticationData(prisma);
    },
    async disconnect() {
      await prisma.$disconnect();
    },
  };
}

export async function assertOwnedTestSchema(prisma, expectedSchema, expectedMarker) {
  const [row] = await prisma.$queryRawUnsafe(
    `SELECT current_schema() AS current_schema,
            obj_description(n.oid, 'pg_namespace') AS marker
       FROM pg_namespace n
      WHERE n.nspname = current_schema()`,
  );
  if (row?.current_schema !== expectedSchema || row?.marker !== expectedMarker) {
    throw new Error("Owned test schema verification failed; refusing fixture reset.");
  }
  return row;
}

export async function resetStreakData(prisma) {
  configureTestEnvironment({ requireReset: true });
  await prisma.sTREAK_DAY.deleteMany();
  await prisma.lEARNING_SESSION_ITEM.deleteMany();
  await prisma.lEARNING_SESSION.deleteMany();
}

export async function resetXpRewardData(prisma) {
  configureTestEnvironment({ requireReset: true });
  await prisma.xP_REWARD.deleteMany();
}

export async function resetPrivateVocabularyCreateOperationData(prisma) {
  configureTestEnvironment({ requireReset: true });
  await prisma.pRIVATE_VOCABULARY_CREATE_OPERATION.deleteMany();
}

export async function resetLearningProgressData(prisma) {
  configureTestEnvironment({ requireReset: true });
  await prisma.lEARNING_PROGRESS.deleteMany();
}

export async function resetVocabularySetData(prisma) {
  configureTestEnvironment({ requireReset: true });
  await prisma.vOCABULARY_SET_ITEM.deleteMany();
  await prisma.vOCABULARY_SET.deleteMany();
}

export async function resetVocabularyData(prisma) {
  configureTestEnvironment({ requireReset: true });
  await prisma.vOCABULARY.deleteMany();
}

export async function resetTopicData(prisma) {
  configureTestEnvironment({ requireReset: true });
  await prisma.tOPIC.deleteMany();
}

export async function resetAuthenticationData(prisma) {
  configureTestEnvironment({ requireReset: true });
  await prisma.aUTH_SESSION.deleteMany();
  await prisma.uSER.deleteMany();
}
