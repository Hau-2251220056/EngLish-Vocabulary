import {
  assertIntegratedHistoryVerificationAuthorization,
  catalogDatabaseUrl,
  integratedHistoryDiscoveryPattern,
  verifyHistoricalIntegratedCandidates,
} from "./streak-integrated-safety.js";

let databaseUrl;

try {
  const { targetIdentityForRun } =
    assertIntegratedHistoryVerificationAuthorization(process.env);
  databaseUrl = process.env.TEST_DATABASE_URL;
  const { PrismaClient } = await import("../../src/generated/prisma/client.ts");
  const prisma = new PrismaClient({ datasourceUrl: catalogDatabaseUrl(databaseUrl) });
  let rows;
  try {
    await prisma.$connect();
    const pattern = integratedHistoryDiscoveryPattern(
      targetIdentityForRun.runId,
      targetIdentityForRun.attempt,
    );
    rows = await prisma.$queryRaw`
      SELECT nspname, obj_description(oid, 'pg_namespace') AS marker
        FROM pg_namespace
       WHERE nspname LIKE ${pattern} ESCAPE '\\'
       ORDER BY nspname
    `;
  } finally {
    await prisma.$disconnect();
  }

  const result = verifyHistoricalIntegratedCandidates(rows, targetIdentityForRun);
  if (result.status === "ABSENT") {
    console.log("TASK-249 historical integrated schema verification: ABSENT");
  } else {
    console.log(
      `TASK-249 historical integrated schema verification: OWNED_SCHEMA_PRESENT - ${result.schemaName}`,
    );
  }
} catch (error) {
  process.exitCode = 1;
  const code = typeof error?.code === "string" ? error.code : "VERIFICATION_FAILED";
  console.error(`TASK-249 historical integrated schema verification: ${code}`);
}
