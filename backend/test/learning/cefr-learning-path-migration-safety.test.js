import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../prisma/migrations/20261103000000_add_cefr_learning_path_v1/migration.sql",
  import.meta.url,
);

test("CEFR migration remains additive, no-backfill, and preserves SET/GLOBAL constraints", async () => {
  const sql = await readFile(migrationUrl, "utf8");
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
