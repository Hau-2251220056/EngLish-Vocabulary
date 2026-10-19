import assert from "node:assert/strict";
import process from "node:process";
import { PrismaClient } from "../../../backend/src/generated/prisma/client.ts";
import {
  assertIntegratedSchemaOwnership,
  assertIntegratedScopedEnvironment,
} from "../../../backend/test/streak/streak-integrated-safety.js";

export default async function streakGlobalSetup() {
  const environment = process.env;
  assert.equal(environment.CI, "true");
  assert.equal(environment.GITHUB_ACTIONS, "true");
  assert.equal(environment.NODE_ENV, "test");
  assert.equal(environment.TEST_DATABASE_ALLOW_RESET, "true");
  assert.equal(environment.STREAK_INTEGRATED_HARNESS_ALLOW, "true");
  assert.match(environment.GITHUB_REPOSITORY ?? "", /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
  assert.match(environment.GITHUB_RUN_ID ?? "", /^[0-9]+$/);
  assert.match(environment.GITHUB_RUN_ATTEMPT ?? "", /^[0-9]+$/);

  const target = environment.CI_TEST_DATABASE_IDENTITY ?? "";
  const approved = environment.STREAK_MIGRATION_APPROVED_TARGET_IDENTITY ?? "";
  assert.match(target, /^[A-Za-z0-9][A-Za-z0-9_.:/-]{2,127}$/);
  assert.equal(target, approved);

  const parsed = new URL(environment.TEST_DATABASE_URL ?? "");
  assert.equal(parsed.protocol.startsWith("postgres"), true);
  assert.equal(`${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`, target);

  const context = assertIntegratedScopedEnvironment(environment);
  const prisma = new PrismaClient({ datasourceUrl: environment.TEST_DATABASE_URL });
  try {
    await prisma.$connect();
    const [row] = await prisma.$queryRaw`
      SELECT current_schema() AS current_schema,
             obj_description(n.oid, 'pg_namespace') AS marker
        FROM pg_namespace n
       WHERE n.nspname = current_schema()
    `;
    assertIntegratedSchemaOwnership({
      schemaName: context.schemaName,
      currentSchema: row?.current_schema,
      marker: row?.marker,
      ownership: context.ownership,
    });
  } finally {
    await prisma.$disconnect();
  }
}
