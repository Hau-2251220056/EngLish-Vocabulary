import assert from "node:assert/strict";
import test from "node:test";
import {
  assertOwnershipMarker,
  assertSafeSchemaName,
  authorizeCefrHarness,
  buildOwnedSchemaName,
  buildOwnership,
  encodeOwnershipMarker,
  schemaDatabaseUrl,
} from "./cefr-learning-path-migration-harness.js";

const safe = Object.freeze({
  NODE_ENV: "test",
  CEFR_TEST_DATABASE_ALLOW_OPERATION: "true",
  CEFR_TEST_DATABASE_EXCLUSIVE: "true",
  CEFR_TEST_RUN_ID: "run42",
  CEFR_TEST_RUN_ATTEMPT: "attempt1",
  CEFR_TEST_DATABASE_EXPECTED_HOST: "cefr-test.invalid",
  CEFR_TEST_DATABASE_EXPECTED_PORT: "5432",
  CEFR_TEST_DATABASE_EXPECTED_NAME: "elvocab_cefr_disposable",
  TEST_DATABASE_URL: "postgresql://redacted:redacted@cefr-test.invalid:5432/elvocab_cefr_disposable",
});

test("CEFR harness denies execution unless every independent guard is present", () => {
  for (const key of Object.keys(safe)) {
    const environment = { ...safe }; delete environment[key];
    assert.throws(() => authorizeCefrHarness(environment));
  }
  assert.doesNotThrow(() => authorizeCefrHarness(safe));
});

test("CEFR harness rejects fallback, identity mismatch, shared targets, and preselected schemas", () => {
  assert.throws(() => authorizeCefrHarness({ ...safe, TEST_DATABASE_URL: undefined, DATABASE_URL: safe.TEST_DATABASE_URL }));
  assert.throws(() => authorizeCefrHarness({ ...safe, CEFR_TEST_DATABASE_EXPECTED_HOST: "other.invalid" }));
  assert.throws(() => authorizeCefrHarness({ ...safe, CEFR_TEST_DATABASE_EXPECTED_NAME: "shared_test", TEST_DATABASE_URL: "postgresql://x:x@cefr-test.invalid:5432/shared_test" }));
  assert.throws(() => authorizeCefrHarness({ ...safe, TEST_DATABASE_URL: `${safe.TEST_DATABASE_URL}?schema=public` }));
});

test("run-owned schema names and markers are exact and cleanup-safe", () => {
  const identity = authorizeCefrHarness(safe);
  const schema = buildOwnedSchemaName("upgrade", identity, "deadbeef");
  assertSafeSchemaName(schema);
  assert.throws(() => assertSafeSchemaName("public"));
  const ownership = buildOwnership(identity, schema);
  const marker = encodeOwnershipMarker(ownership);
  assert.deepEqual(assertOwnershipMarker(marker, ownership), ownership);
  assert.throws(() => assertOwnershipMarker(marker, { ...ownership, run_id: "other" }));
  assert.equal(new URL(schemaDatabaseUrl(identity.url, schema)).searchParams.get("schema"), schema);
});
