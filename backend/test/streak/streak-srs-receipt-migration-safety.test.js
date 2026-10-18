import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const schemaPath = fileURLToPath(new URL("../../prisma/schema.prisma", import.meta.url));
const baselinePath = fileURLToPath(new URL(
  "../../prisma/migrations/20261017000000_add_streak_v1/migration.sql",
  import.meta.url,
));
const receiptPath = fileURLToPath(new URL(
  "../../prisma/migrations/20261018000000_add_streak_srs_receipt/migration.sql",
  import.meta.url,
));
const harnessPath = fileURLToPath(new URL(
  "./streak-migration-harness.js",
  import.meta.url,
));

test("receipt schema and additive SQL retain the approved narrow identity contract", async () => {
  const [schema, baseline, receipt] = await Promise.all([
    readFile(schemaPath, "utf8"),
    readFile(baselinePath, "utf8"),
    readFile(receiptPath, "utf8"),
  ]);

  assert.match(schema, /model LEARNING_SESSION_SRS_RECEIPT \{/);
  assert.match(schema, /event_id\s+String\s+@id @db\.Uuid/);
  assert.match(schema, /session_item_id\s+String\s+@db\.Uuid/);
  assert.match(schema, /rating\s+String\s+@db\.VarChar\(5\)/);
  assert.match(schema, /expected_revision\s+Int/);
  assert.match(schema, /accepted_revision\s+Int/);
  assert.match(schema, /accepted_at\s+DateTime\s+@db\.Timestamp\(3\)/);
  assert.match(schema, /@@index\(\[session_item_id, accepted_revision\]\)/);

  assert.doesNotMatch(baseline, /LEARNING_SESSION_SRS_RECEIPT/);
  assert.match(receipt, /CREATE TABLE "LEARNING_SESSION_SRS_RECEIPT"/);
  assert.match(receipt, /CONSTRAINT "LEARNING_SESSION_SRS_RECEIPT_pkey" PRIMARY KEY \("event_id"\)/);
  assert.match(receipt, /CHECK \("rating" IN \('AGAIN', 'HARD', 'GOOD', 'EASY'\)\)/);
  assert.match(receipt, /"accepted_revision" = "expected_revision" \+ 1/);
  assert.match(receipt, /ON DELETE CASCADE ON UPDATE CASCADE/);
  assert.match(receipt, /LEARNING_SESSION_SRS_RECEIPT_session_item_id_accepted_revision_idx/);
  assert.doesNotMatch(receipt, /INSERT\s+INTO/i);
  assert.doesNotMatch(receipt, /ALTER\s+TABLE\s+"(?:USER|LEARNING_PROGRESS|XP_REWARD)"/i);
});

test("receipt migration is a separate forward transaction and baseline remains byte-independent", async () => {
  const receipt = await readFile(receiptPath, "utf8");
  assert.equal(receipt.match(/^BEGIN;$/gm)?.length, 1);
  assert.equal(receipt.match(/^COMMIT;$/gm)?.length, 1);
  assert.doesNotMatch(receipt, /DROP\s+(?:TABLE|TYPE|SCHEMA)/i);
});

test("guarded migration harness applies and verifies the receipt delta after the baseline", async () => {
  const harness = await readFile(harnessPath, "utf8");
  assert.match(harness, /const SRS_RECEIPT_MIGRATION = "20261018000000_add_streak_srs_receipt"/);
  assert.match(harness, /prepareMigrationCopy\("streak-baseline", \{[\s\S]*?includeStreak: true,[\s\S]*?includeReceipt: false/);
  assert.match(harness, /prepareMigrationCopy\("complete", \{[\s\S]*?includeStreak: true,[\s\S]*?includeReceipt: true/);
  assert.match(harness, /seedExistingStreakFixture\(schemaName, fixture\)/);
  assert.match(harness, /const beforeReceipt = await readPreReceiptSnapshot\(schemaName\)/);
  assert.match(harness, /assert\.deepEqual\(await readPreReceiptSnapshot\(schemaName\), beforeReceipt\)/);
  assert.match(harness, /information_schema\.columns WHERE table_schema = current_schema\(\) AND table_name = 'LEARNING_SESSION_SRS_RECEIPT'/);
  assert.match(harness, /LEARNING_SESSION_SRS_RECEIPT_rating_check/);
  assert.match(harness, /LEARNING_SESSION_SRS_RECEIPT_revision_check/);
  assert.match(harness, /LEARNING_SESSION_SRS_RECEIPT_session_item_id_fkey/);
  assert.match(harness, /LEARNING_SESSION_SRS_RECEIPT_session_item_id_accepted_revision_idx/);
  assert.match(harness, /SELECT COUNT\(\*\) FROM "LEARNING_SESSION_SRS_RECEIPT"/);
  assert.match(harness, /await insertSrsReceipt/);
  assert.match(harness, /DELETE FROM "LEARNING_SESSION_ITEM"/);
});

test("guarded harness injects failure into the receipt delta and preserves existing Streak data", async () => {
  const harness = await readFile(harnessPath, "utf8");
  assert.match(harness, /prepareMigrationCopy\("receipt-rollback", \{[\s\S]*?includeReceipt: true,[\s\S]*?injectReceiptFailure: true/);
  assert.match(harness, /if \(injectReceiptFailure\) \{[\s\S]*?const injectedSql = copiedReceiptSql\.replace/);
  assert.match(harness, /if \(injectStreakFailure\) \{[\s\S]*?const injectedSql = copiedSql\.replace/);
  assert.match(harness, /await assertReceiptObjectsAbsent\(schemaName\)/);
  assert.match(harness, /migration_name = '\$\{STREAK_MIGRATION\}' AND finished_at IS NOT NULL`[\s\S]*?\),[\s\S]*?1/);
  assert.match(harness, /migration_name = '\$\{SRS_RECEIPT_MIGRATION\}' AND finished_at IS NOT NULL`[\s\S]*?\),[\s\S]*?0/);
  assert.match(harness, /prepareMigrationCopy\("streak-rollback", \{[\s\S]*?includeReceipt: false,[\s\S]*?injectStreakFailure: true/);
  assert.match(harness, /await verifyBaselineStreakRollback/);
  assert.match(harness, /await assertStreakObjectsAbsent\(schemaName\)/);
});
