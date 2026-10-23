-- TASK-254 review artifact only. Do not apply until Gate DG-1 is authorized.
-- Additive only: USER.daily_xp_goal, XP_REWARD, STREAK_DAY, and learning data are untouched.
BEGIN;

CREATE TYPE "DAILY_GOAL_ACTIVITY_TYPE" AS ENUM ('NORMAL', 'SRS', 'QUIZ', 'SPEAKING');
CREATE TYPE "DAILY_GOAL_TRACKING_STATUS" AS ENUM ('ACTIVE', 'PAUSED', 'CLOSED');
CREATE TYPE "DAILY_GOAL_OPERATION_TYPE" AS ENUM (
    'CREATE', 'READY', 'INTERACTION', 'CLAIM', 'RESUME', 'HEARTBEAT',
    'PAUSE', 'CLOSE', 'GOAL_UPDATE', 'REMINDER_PREFERENCE_UPDATE',
    'MONITOR_CREATE', 'MONITOR_CHECK', 'MONITOR_CLOSE'
);
CREATE TYPE "USER_NOTIFICATION_TYPE" AS ENUM ('DAILY_GOAL_COMPLETED', 'DAILY_GOAL_INACTIVITY_REMINDER');

ALTER TABLE "USER"
    ADD COLUMN "daily_goal_minutes" INTEGER,
    ADD COLUMN "daily_goal_reminders_enabled" BOOLEAN,
    ADD COLUMN "daily_goal_reminders_enabled_at" TIMESTAMP(3) WITH TIME ZONE,
    ADD CONSTRAINT "USER_daily_goal_minutes_check" CHECK ("daily_goal_minutes" IS NULL OR "daily_goal_minutes" BETWEEN 10 AND 240);

CREATE TABLE "DAILY_GOAL_DAY" (
    "id" UUID NOT NULL, "user_id" UUID NOT NULL, "activity_date" DATE NOT NULL,
    "active_milliseconds" BIGINT NOT NULL DEFAULT 0,
    "last_credited_at" TIMESTAMP(3) WITH TIME ZONE,
    "last_engagement_at" TIMESTAMP(3) WITH TIME ZONE,
    "last_activity_type" "DAILY_GOAL_ACTIVITY_TYPE",
    "created_at" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
    CONSTRAINT "DAILY_GOAL_DAY_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DAILY_GOAL_DAY_active_milliseconds_non_negative" CHECK ("active_milliseconds" >= 0)
);

CREATE TABLE "DAILY_GOAL_TRACKING_SESSION" (
    "id" UUID NOT NULL, "user_id" UUID NOT NULL,
    "activity_type" "DAILY_GOAL_ACTIVITY_TYPE" NOT NULL,
    "learning_session_id" UUID, "set_id" UUID, "vocabulary_id" UUID,
    "status" "DAILY_GOAL_TRACKING_STATUS" NOT NULL DEFAULT 'ACTIVE',
    "engagement_expires_at" TIMESTAMP(3) WITH TIME ZONE,
    "last_meaningful_at" TIMESTAMP(3) WITH TIME ZONE,
    "created_at" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
    "closed_at" TIMESTAMP(3) WITH TIME ZONE,
    CONSTRAINT "DAILY_GOAL_TRACKING_SESSION_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DAILY_GOAL_TRACKING_SESSION_lifecycle_check" CHECK (
        ("status" = 'CLOSED' AND "closed_at" IS NOT NULL) OR ("status" <> 'CLOSED' AND "closed_at" IS NULL)
    ),
    CONSTRAINT "DAILY_GOAL_TRACKING_SESSION_time_order_check" CHECK (
        ("last_meaningful_at" IS NULL OR "last_meaningful_at" >= "created_at")
        AND ("engagement_expires_at" IS NULL OR "last_meaningful_at" IS NOT NULL)
        AND ("engagement_expires_at" IS NULL OR "engagement_expires_at" > "last_meaningful_at")
        AND ("closed_at" IS NULL OR "closed_at" >= "created_at")
    )
);

CREATE TABLE "DAILY_GOAL_MONITOR_SESSION" (
    "id" UUID NOT NULL, "user_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
    "continuity_started_at" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
    "eligible_baseline_at" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
    "closed_at" TIMESTAMP(3) WITH TIME ZONE,
    CONSTRAINT "DAILY_GOAL_MONITOR_SESSION_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DAILY_GOAL_MONITOR_SESSION_time_order_check" CHECK (
        "last_seen_at" >= "started_at" AND "continuity_started_at" >= "started_at"
        AND "eligible_baseline_at" >= "continuity_started_at"
        AND ("closed_at" IS NULL OR "closed_at" >= "started_at")
    )
);

CREATE TABLE "DAILY_GOAL_OWNER" (
    "user_id" UUID NOT NULL, "tracking_session_id" UUID,
    "generation" BIGINT NOT NULL DEFAULT 0,
    "lease_expires_at" TIMESTAMP(3) WITH TIME ZONE,
    "last_accounted_at" TIMESTAMP(3) WITH TIME ZONE,
    "updated_at" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
    CONSTRAINT "DAILY_GOAL_OWNER_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "DAILY_GOAL_OWNER_generation_non_negative" CHECK ("generation" >= 0)
);

CREATE TABLE "DAILY_GOAL_OPERATION_RECEIPT" (
    "operation_id" UUID NOT NULL, "user_id" UUID NOT NULL,
    "tracking_session_id" UUID, "monitor_session_id" UUID, "generation" BIGINT,
    "operation_type" "DAILY_GOAL_OPERATION_TYPE" NOT NULL,
    "request_fingerprint" TEXT NOT NULL, "credited_milliseconds" BIGINT NOT NULL DEFAULT 0,
    "response_projection" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DAILY_GOAL_OPERATION_RECEIPT_pkey" PRIMARY KEY ("operation_id"),
    CONSTRAINT "DAILY_GOAL_OPERATION_RECEIPT_generation_non_negative" CHECK ("generation" IS NULL OR "generation" >= 0),
    CONSTRAINT "DAILY_GOAL_OPERATION_RECEIPT_credited_milliseconds_non_negative" CHECK ("credited_milliseconds" >= 0),
    CONSTRAINT "DAILY_GOAL_OPERATION_RECEIPT_parent_check" CHECK (NOT ("tracking_session_id" IS NOT NULL AND "monitor_session_id" IS NOT NULL))
);

CREATE TABLE "DAILY_GOAL_REWARD" (
    "id" UUID NOT NULL, "user_id" UUID NOT NULL, "activity_date" DATE NOT NULL,
    "source_operation_id" UUID NOT NULL, "xp_amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DAILY_GOAL_REWARD_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DAILY_GOAL_REWARD_xp_amount_check" CHECK ("xp_amount" = 10)
);

CREATE TABLE "USER_NOTIFICATION" (
    "id" UUID NOT NULL, "user_id" UUID NOT NULL, "type" "USER_NOTIFICATION_TYPE" NOT NULL,
    "application_date" DATE NOT NULL, "title" VARCHAR(160) NOT NULL, "body" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3) WITH TIME ZONE,
    CONSTRAINT "USER_NOTIFICATION_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "USER_NOTIFICATION_read_order_check" CHECK ("read_at" IS NULL OR "read_at" >= "created_at"),
    CONSTRAINT "USER_NOTIFICATION_content_check" CHECK (char_length(btrim("title")) > 0 AND char_length(btrim("body")) > 0)
);

CREATE UNIQUE INDEX "DAILY_GOAL_DAY_user_id_activity_date_key" ON "DAILY_GOAL_DAY"("user_id", "activity_date");
CREATE INDEX "DAILY_GOAL_DAY_user_id_activity_date_idx" ON "DAILY_GOAL_DAY"("user_id", "activity_date" DESC);
CREATE INDEX "DAILY_GOAL_TRACKING_SESSION_user_id_status_updated_at_idx" ON "DAILY_GOAL_TRACKING_SESSION"("user_id", "status", "updated_at");
CREATE INDEX "DAILY_GOAL_TRACKING_SESSION_updated_at_idx" ON "DAILY_GOAL_TRACKING_SESSION"("updated_at");
CREATE INDEX "DAILY_GOAL_TRACKING_SESSION_learning_session_id_idx" ON "DAILY_GOAL_TRACKING_SESSION"("learning_session_id");
CREATE INDEX "DAILY_GOAL_TRACKING_SESSION_set_id_idx" ON "DAILY_GOAL_TRACKING_SESSION"("set_id");
CREATE INDEX "DAILY_GOAL_TRACKING_SESSION_vocabulary_id_idx" ON "DAILY_GOAL_TRACKING_SESSION"("vocabulary_id");
CREATE INDEX "DAILY_GOAL_OWNER_tracking_session_id_idx" ON "DAILY_GOAL_OWNER"("tracking_session_id");
CREATE INDEX "DAILY_GOAL_OPERATION_RECEIPT_user_id_created_at_idx" ON "DAILY_GOAL_OPERATION_RECEIPT"("user_id", "created_at");
CREATE INDEX "DAILY_GOAL_OPERATION_RECEIPT_created_at_idx" ON "DAILY_GOAL_OPERATION_RECEIPT"("created_at");
CREATE INDEX "DAILY_GOAL_OPERATION_RECEIPT_tracking_session_id_idx" ON "DAILY_GOAL_OPERATION_RECEIPT"("tracking_session_id");
CREATE INDEX "DAILY_GOAL_OPERATION_RECEIPT_monitor_session_id_idx" ON "DAILY_GOAL_OPERATION_RECEIPT"("monitor_session_id");
CREATE UNIQUE INDEX "DAILY_GOAL_REWARD_user_id_activity_date_key" ON "DAILY_GOAL_REWARD"("user_id", "activity_date");
CREATE UNIQUE INDEX "DAILY_GOAL_REWARD_user_id_source_operation_id_key" ON "DAILY_GOAL_REWARD"("user_id", "source_operation_id");
CREATE UNIQUE INDEX "USER_NOTIFICATION_user_id_type_application_date_key" ON "USER_NOTIFICATION"("user_id", "type", "application_date");
CREATE INDEX "USER_NOTIFICATION_user_id_read_at_created_at_idx" ON "USER_NOTIFICATION"("user_id", "read_at", "created_at" DESC);
CREATE INDEX "USER_NOTIFICATION_user_id_created_at_idx" ON "USER_NOTIFICATION"("user_id", "created_at" DESC);
CREATE INDEX "DAILY_GOAL_MONITOR_SESSION_user_id_last_seen_at_idx" ON "DAILY_GOAL_MONITOR_SESSION"("user_id", "last_seen_at");
CREATE INDEX "DAILY_GOAL_MONITOR_SESSION_last_seen_at_idx" ON "DAILY_GOAL_MONITOR_SESSION"("last_seen_at");

ALTER TABLE "DAILY_GOAL_DAY" ADD CONSTRAINT "DAILY_GOAL_DAY_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USER"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DAILY_GOAL_TRACKING_SESSION" ADD CONSTRAINT "DAILY_GOAL_TRACKING_SESSION_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USER"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DAILY_GOAL_TRACKING_SESSION" ADD CONSTRAINT "DAILY_GOAL_TRACKING_SESSION_learning_session_id_fkey" FOREIGN KEY ("learning_session_id") REFERENCES "LEARNING_SESSION"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DAILY_GOAL_TRACKING_SESSION" ADD CONSTRAINT "DAILY_GOAL_TRACKING_SESSION_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "VOCABULARY_SET"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DAILY_GOAL_TRACKING_SESSION" ADD CONSTRAINT "DAILY_GOAL_TRACKING_SESSION_vocabulary_id_fkey" FOREIGN KEY ("vocabulary_id") REFERENCES "VOCABULARY"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DAILY_GOAL_MONITOR_SESSION" ADD CONSTRAINT "DAILY_GOAL_MONITOR_SESSION_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USER"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DAILY_GOAL_OWNER" ADD CONSTRAINT "DAILY_GOAL_OWNER_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USER"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DAILY_GOAL_OWNER" ADD CONSTRAINT "DAILY_GOAL_OWNER_tracking_session_id_fkey" FOREIGN KEY ("tracking_session_id") REFERENCES "DAILY_GOAL_TRACKING_SESSION"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DAILY_GOAL_OPERATION_RECEIPT" ADD CONSTRAINT "DAILY_GOAL_OPERATION_RECEIPT_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USER"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DAILY_GOAL_OPERATION_RECEIPT" ADD CONSTRAINT "DAILY_GOAL_OPERATION_RECEIPT_tracking_session_id_fkey" FOREIGN KEY ("tracking_session_id") REFERENCES "DAILY_GOAL_TRACKING_SESSION"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DAILY_GOAL_OPERATION_RECEIPT" ADD CONSTRAINT "DAILY_GOAL_OPERATION_RECEIPT_monitor_session_id_fkey" FOREIGN KEY ("monitor_session_id") REFERENCES "DAILY_GOAL_MONITOR_SESSION"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DAILY_GOAL_REWARD" ADD CONSTRAINT "DAILY_GOAL_REWARD_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USER"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "USER_NOTIFICATION" ADD CONSTRAINT "USER_NOTIFICATION_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USER"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;

-- Rollback/disable strategy:
-- Before any real Daily Goal data exists, a separately reviewed rollback may
-- remove these additive objects in reverse dependency order. After real data
-- exists, preserve aggregates/rewards/notifications and use application disable
-- plus a forward-fix migration; do not destructively drop durable user data.
-- Account lifecycle note: existing core USER relations remain unchanged and
-- restrictive. New Daily Goal rows are account-owned and cascade only when a
-- USER row is actually deleted. Receipt parent FKs remain RESTRICT so cleanup
-- must delete receipts before their tracking/monitor sessions.
