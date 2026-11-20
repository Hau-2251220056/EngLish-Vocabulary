import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { inspectCefrV2Migration } from "./cefr-learning-path-migration-harness.js";

const v1MigrationUrl = new URL(
  "../../prisma/migrations/20261103000000_add_cefr_learning_path_v1/migration.sql",
  import.meta.url,
);
const v2MigrationUrl = new URL(
  "../../prisma/migrations/20261112000000_add_cefr_learning_progress_v2/migration.sql",
  import.meta.url,
);
const schemaUrl = new URL("../../prisma/schema.prisma", import.meta.url);
const V1_MIGRATION_SHA256 = "b7c9b258193a9b42249627c6a5c237fddfda99b09f84b1d1e26c06b56dbb8b1d";

test("CEFR migration remains additive, no-backfill, and preserves SET/GLOBAL constraints", async () => {
  const sql = await readFile(v1MigrationUrl, "utf8");
  for (const marker of [
    'CREATE TABLE "CEFR_LEARNING_PASS"',
    'CREATE TABLE "CEFR_LEARNING_PASS_ITEM"',
    'CREATE TABLE "CEFR_LEARNING_PATH_STATE"',
    'ADD COLUMN "scope" "LEARNING_SESSION_SCOPE" NOT NULL DEFAULT \'SET\'',
    '"scope" = \'GLOBAL\' AND "mode" = \'SRS\'',
    '"cefr_learning_pass_id" IS NULL OR ("scope" = \'SET\' AND "mode" = \'NORMAL\')',
    'CEFR_LEARNING_PASS_active_user_set_key',
    'CEFR_LEARNING_PASS_completed_user_set_key',
  ]) assert.ok(sql.includes(marker), `missing migration marker: ${marker}`);

  assert.doesNotMatch(sql, /INSERT\s+INTO\s+"(?:CEFR_LEARNING_PASS|CEFR_LEARNING_PATH_STATE)"/i);
  assert.doesNotMatch(sql, /UPDATE\s+"(?:LEARNING_PROGRESS|CEFR_LEARNING_PASS|CEFR_LEARNING_PATH_STATE)"/i);
  assert.doesNotMatch(sql, /ALTER\s+TABLE\s+"(?:LEARNING_PROGRESS|XP_REWARD|STREAK_DAY)"/i);
});

test("approved CEFR V1 migration remains byte-for-byte unchanged", async () => {
  const sql = await readFile(v1MigrationUrl);
  assert.equal(createHash("sha256").update(sql).digest("hex"), V1_MIGRATION_SHA256);
});

test("CEFR V2 migration adds exact first-credit evidence without completion or entitlement writes", async () => {
  const sql = await readFile(v2MigrationUrl, "utf8");
  const inspection = inspectCefrV2Migration(sql);

  assert.deepEqual(inspection.evidenceSources, [
    "NORMAL_REVEALED",
    "SRS_AGAIN",
    "SRS_HARD",
    "SRS_GOOD",
    "SRS_EASY",
  ]);
  assert.deepEqual(inspection.updateTargets, ["CEFR_LEARNING_PASS_ITEM"]);

  for (const field of [
    "first_credit_source",
    "first_credit_event_id",
    "first_credit_session_id",
    "first_credit_accepted_at",
  ]) assert.match(sql, new RegExp(`ADD COLUMN "${field}"`));

  for (const identity of [
    'session."user_id" = pass."user_id"',
    'session."cefr_learning_pass_id" = pass."id"',
    'session."set_id_snapshot" = pass."set_id_snapshot"',
    'session_item."vocabulary_id" = pass_item."vocabulary_id"',
  ]) assert.ok(sql.includes(identity), `missing exact backfill identity: ${identity}`);

  assert.match(sql, /ORDER BY session_item\."evidence_at" ASC, session_item\."evidence_event_id" ASC/);
  assert.match(sql, /pass\."status" = 'COMPLETED'[\s\S]*RAISE EXCEPTION 'CEFR V2 backfill rejected completed pass without exact NORMAL evidence \(pass %, pass item %\)'/);
  assert.match(sql, /pass\."status" = 'COMPLETED'[\s\S]*RAISE EXCEPTION 'CEFR V2 backfill left a completed pass item without first credit \(pass %, pass item %\)'/);
});

test("Prisma schema exposes the approved CEFR first-credit tuple and source session relation", async () => {
  const schema = await readFile(schemaUrl, "utf8");
  const enumBlock = schema.match(/enum CEFR_LEARNING_EVIDENCE_SOURCE \{([\s\S]*?)\}/)?.[1];
  assert.ok(enumBlock, "CEFR evidence source enum is missing.");
  assert.deepEqual(enumBlock.trim().split(/\s+/), [
    "NORMAL_REVEALED",
    "SRS_AGAIN",
    "SRS_HARD",
    "SRS_GOOD",
    "SRS_EASY",
  ]);

  const itemBlock = schema.match(/model CEFR_LEARNING_PASS_ITEM \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(itemBlock, "CEFR pass item model is missing.");
  assert.match(itemBlock, /first_credit_source\s+CEFR_LEARNING_EVIDENCE_SOURCE\?/);
  assert.match(itemBlock, /first_credit_event_id\s+String\?\s+@unique\s+@db\.Uuid/);
  assert.match(itemBlock, /first_credit_session_id\s+String\?\s+@db\.Uuid/);
  assert.match(itemBlock, /first_credit_accepted_at\s+DateTime\?\s+@db\.Timestamp\(3\)/);
  assert.match(itemBlock, /@relation\("CefrPassItemFirstCreditSession"[\s\S]*onDelete: Restrict/);
  assert.match(itemBlock, /@@index\(\[first_credit_session_id\]\)/);
  assert.equal(
    schema.match(/cefr_first_credit_items\s+CEFR_LEARNING_PASS_ITEM\[\]\s+@relation\("CefrPassItemFirstCreditSession"\)/g)?.length,
    1,
  );
});
