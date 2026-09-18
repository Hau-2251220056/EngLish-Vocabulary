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
      await resetAuthenticationData(prisma);
    },
    async disconnect() {
      await prisma.$disconnect();
    },
  };
}

export async function resetAuthenticationData(prisma) {
  configureTestEnvironment({ requireReset: true });
  await prisma.aUTH_SESSION.deleteMany();
  await prisma.uSER.deleteMany();
}
