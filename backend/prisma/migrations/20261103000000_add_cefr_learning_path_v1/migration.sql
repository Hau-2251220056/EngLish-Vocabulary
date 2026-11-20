BEGIN;

CREATE TYPE "LEARNING_SESSION_SCOPE" AS ENUM ('SET', 'GLOBAL');
CREATE TYPE "CEFR_LEARNING_PASS_STATUS" AS ENUM ('ACTIVE', 'INVALIDATED', 'COMPLETED');

CREATE TABLE "CEFR_LEARNING_PASS" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vocabulary_set_id" UUID,
    "set_id_snapshot" UUID NOT NULL,
    "status" "CEFR_LEARNING_PASS_STATUS" NOT NULL DEFAULT 'ACTIVE',
    "create_operation_id" UUID NOT NULL,
    "snapshot_size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    "completed_at" TIMESTAMP(3),
    "completion_event_id" UUID,
    "invalidated_at" TIMESTAMP(3),
    CONSTRAINT "CEFR_LEARNING_PASS_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CEFR_LEARNING_PASS_snapshot_size_check" CHECK ("snapshot_size" > 0),
    CONSTRAINT "CEFR_LEARNING_PASS_lifecycle_check" CHECK (
        ("status" = 'ACTIVE' AND "completed_at" IS NULL AND "completion_event_id" IS NULL AND "invalidated_at" IS NULL)
        OR ("status" = 'INVALIDATED' AND "completed_at" IS NULL AND "completion_event_id" IS NULL AND "invalidated_at" IS NOT NULL)
        OR ("status" = 'COMPLETED' AND "completed_at" IS NOT NULL AND "completion_event_id" IS NOT NULL AND "invalidated_at" IS NULL AND "created_at" <= "completed_at")
    )
);

CREATE TABLE "CEFR_LEARNING_PASS_ITEM" (
    "id" UUID NOT NULL,
    "pass_id" UUID NOT NULL,
    "vocabulary_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "CEFR_LEARNING_PASS_ITEM_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CEFR_LEARNING_PASS_ITEM_position_check" CHECK ("position" >= 0)
);

CREATE TABLE "CEFR_LEARNING_PATH_STATE" (
    "user_id" UUID NOT NULL,
    "highest_unlocked_level" TEXT NOT NULL DEFAULT 'A1',
    "path_completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CEFR_LEARNING_PATH_STATE_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "CEFR_LEARNING_PATH_STATE_level_check" CHECK ("highest_unlocked_level" IN ('A1', 'A2', 'B1', 'B2', 'C1'))
);

ALTER TABLE "LEARNING_SESSION"
    ADD COLUMN "scope" "LEARNING_SESSION_SCOPE" NOT NULL DEFAULT 'SET',
    ADD COLUMN "cefr_learning_pass_id" UUID,
    ALTER COLUMN "set_id_snapshot" DROP NOT NULL;

ALTER TABLE "LEARNING_SESSION" ADD CONSTRAINT "LEARNING_SESSION_scope_check" CHECK (
    ("scope" = 'SET' AND "set_id_snapshot" IS NOT NULL)
    OR ("scope" = 'GLOBAL' AND "mode" = 'SRS' AND "vocabulary_set_id" IS NULL AND "set_id_snapshot" IS NULL AND "cefr_learning_pass_id" IS NULL)
);
ALTER TABLE "LEARNING_SESSION" ADD CONSTRAINT "LEARNING_SESSION_pass_scope_check" CHECK (
    "cefr_learning_pass_id" IS NULL OR ("scope" = 'SET' AND "mode" = 'NORMAL')
);

CREATE UNIQUE INDEX "CEFR_LEARNING_PASS_user_id_create_operation_id_key" ON "CEFR_LEARNING_PASS"("user_id", "create_operation_id");
CREATE UNIQUE INDEX "CEFR_LEARNING_PASS_user_id_completion_event_id_key" ON "CEFR_LEARNING_PASS"("user_id", "completion_event_id");
CREATE UNIQUE INDEX "CEFR_LEARNING_PASS_active_user_set_key" ON "CEFR_LEARNING_PASS"("user_id", "set_id_snapshot") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "CEFR_LEARNING_PASS_completed_user_set_key" ON "CEFR_LEARNING_PASS"("user_id", "set_id_snapshot") WHERE "status" = 'COMPLETED';
CREATE INDEX "CEFR_LEARNING_PASS_user_id_status_idx" ON "CEFR_LEARNING_PASS"("user_id", "status");
CREATE INDEX "CEFR_LEARNING_PASS_vocabulary_set_id_idx" ON "CEFR_LEARNING_PASS"("vocabulary_set_id");
CREATE INDEX "CEFR_LEARNING_PASS_set_id_snapshot_idx" ON "CEFR_LEARNING_PASS"("set_id_snapshot");
CREATE UNIQUE INDEX "CEFR_LEARNING_PASS_ITEM_pass_id_vocabulary_id_key" ON "CEFR_LEARNING_PASS_ITEM"("pass_id", "vocabulary_id");
CREATE UNIQUE INDEX "CEFR_LEARNING_PASS_ITEM_pass_id_position_key" ON "CEFR_LEARNING_PASS_ITEM"("pass_id", "position");
CREATE INDEX "LEARNING_SESSION_cefr_learning_pass_id_idx" ON "LEARNING_SESSION"("cefr_learning_pass_id");

ALTER TABLE "CEFR_LEARNING_PASS" ADD CONSTRAINT "CEFR_LEARNING_PASS_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CEFR_LEARNING_PASS" ADD CONSTRAINT "CEFR_LEARNING_PASS_vocabulary_set_id_fkey" FOREIGN KEY ("vocabulary_set_id") REFERENCES "VOCABULARY_SET"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CEFR_LEARNING_PASS_ITEM" ADD CONSTRAINT "CEFR_LEARNING_PASS_ITEM_pass_id_fkey" FOREIGN KEY ("pass_id") REFERENCES "CEFR_LEARNING_PASS"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CEFR_LEARNING_PATH_STATE" ADD CONSTRAINT "CEFR_LEARNING_PATH_STATE_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LEARNING_SESSION" ADD CONSTRAINT "LEARNING_SESSION_cefr_learning_pass_id_fkey" FOREIGN KEY ("cefr_learning_pass_id") REFERENCES "CEFR_LEARNING_PASS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
