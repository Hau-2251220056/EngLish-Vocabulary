BEGIN;

CREATE TYPE "LEARNING_SESSION_MODE" AS ENUM ('NORMAL', 'SRS', 'QUIZ');

CREATE TYPE "LEARNING_SESSION_STATUS" AS ENUM ('ACTIVE', 'COMPLETED');

CREATE TYPE "SESSION_ITEM_EVIDENCE" AS ENUM (
    'NORMAL_REVEALED',
    'SRS_HARD',
    'SRS_GOOD',
    'SRS_EASY',
    'QUIZ_CORRECT',
    'QUIZ_INCORRECT'
);

CREATE TABLE "LEARNING_SESSION" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vocabulary_set_id" UUID,
    "set_id_snapshot" UUID NOT NULL,
    "mode" "LEARNING_SESSION_MODE" NOT NULL,
    "status" "LEARNING_SESSION_STATUS" NOT NULL DEFAULT 'ACTIVE',
    "create_operation_id" UUID NOT NULL,
    "snapshot_size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL
        DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "completion_event_id" UUID,

    CONSTRAINT "LEARNING_SESSION_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LEARNING_SESSION_snapshot_size_check"
        CHECK ("snapshot_size" BETWEEN 1 AND 10),
    CONSTRAINT "LEARNING_SESSION_exact_expiry_check"
        CHECK ("expires_at" = "created_at" + INTERVAL '7 days'),
    CONSTRAINT "LEARNING_SESSION_lifecycle_check"
        CHECK (
            (
                "status" = 'ACTIVE'
                AND "completed_at" IS NULL
                AND "completion_event_id" IS NULL
            )
            OR
            (
                "status" = 'COMPLETED'
                AND "completed_at" IS NOT NULL
                AND "completion_event_id" IS NOT NULL
                AND "created_at" <= "completed_at"
                AND "completed_at" < "expires_at"
            )
        )
);

CREATE TABLE "LEARNING_SESSION_ITEM" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "vocabulary_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "evidence" "SESSION_ITEM_EVIDENCE",
    "evidence_event_id" UUID,
    "evidence_at" TIMESTAMP(3),

    CONSTRAINT "LEARNING_SESSION_ITEM_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LEARNING_SESSION_ITEM_position_check"
        CHECK ("position" BETWEEN 0 AND 9),
    CONSTRAINT "LEARNING_SESSION_ITEM_evidence_consistency_check"
        CHECK (
            (
                "evidence" IS NULL
                AND "evidence_event_id" IS NULL
                AND "evidence_at" IS NULL
            )
            OR
            (
                "evidence" IS NOT NULL
                AND "evidence_event_id" IS NOT NULL
                AND "evidence_at" IS NOT NULL
            )
        )
);

CREATE TABLE "STREAK_DAY" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "activity_date" DATE NOT NULL,
    "first_session_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL
        DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),

    CONSTRAINT "STREAK_DAY_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LEARNING_SESSION_user_id_create_operation_id_key"
    ON "LEARNING_SESSION"("user_id", "create_operation_id");

CREATE UNIQUE INDEX "LEARNING_SESSION_user_id_completion_event_id_key"
    ON "LEARNING_SESSION"("user_id", "completion_event_id");

CREATE INDEX "LEARNING_SESSION_user_id_status_expires_at_idx"
    ON "LEARNING_SESSION"("user_id", "status", "expires_at");

CREATE INDEX "LEARNING_SESSION_vocabulary_set_id_idx"
    ON "LEARNING_SESSION"("vocabulary_set_id");

CREATE UNIQUE INDEX "LEARNING_SESSION_ITEM_evidence_event_id_key"
    ON "LEARNING_SESSION_ITEM"("evidence_event_id");

CREATE UNIQUE INDEX "LEARNING_SESSION_ITEM_session_id_vocabulary_id_key"
    ON "LEARNING_SESSION_ITEM"("session_id", "vocabulary_id");

CREATE UNIQUE INDEX "LEARNING_SESSION_ITEM_session_id_position_key"
    ON "LEARNING_SESSION_ITEM"("session_id", "position");

CREATE UNIQUE INDEX "STREAK_DAY_user_id_activity_date_key"
    ON "STREAK_DAY"("user_id", "activity_date");

ALTER TABLE "LEARNING_SESSION"
    ADD CONSTRAINT "LEARNING_SESSION_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "USER"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LEARNING_SESSION"
    ADD CONSTRAINT "LEARNING_SESSION_vocabulary_set_id_fkey"
    FOREIGN KEY ("vocabulary_set_id") REFERENCES "VOCABULARY_SET"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LEARNING_SESSION_ITEM"
    ADD CONSTRAINT "LEARNING_SESSION_ITEM_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "LEARNING_SESSION"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "STREAK_DAY"
    ADD CONSTRAINT "STREAK_DAY_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "USER"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "STREAK_DAY"
    ADD CONSTRAINT "STREAK_DAY_first_session_id_fkey"
    FOREIGN KEY ("first_session_id") REFERENCES "LEARNING_SESSION"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
