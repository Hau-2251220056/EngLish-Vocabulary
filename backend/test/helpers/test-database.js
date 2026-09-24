import { configureTestEnvironment } from "./test-environment.js";

export async function createTestDatabase() {
  configureTestEnvironment({ requireReset: true });
  const { PrismaClient } = await import(
    "../../src/generated/prisma/client.ts"
  );
  const prisma = new PrismaClient();

  await prisma.$connect();

  return {
    prisma,
    async reset() {
      await resetLearningProgressData(prisma);
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
