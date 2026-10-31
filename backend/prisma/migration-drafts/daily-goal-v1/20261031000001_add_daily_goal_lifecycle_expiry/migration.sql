-- TASK-264 lifecycle review artifact only. Activation and database execution are not authorized.
-- Additive nullable fields only; no lifecycle row is backfilled or transitioned here.
BEGIN;

ALTER TABLE "DAILY_GOAL_TRACKING_SESSION"
    ADD COLUMN "paused_at" TIMESTAMP(3) WITH TIME ZONE,
    ADD COLUMN "expired_at" TIMESTAMP(3) WITH TIME ZONE;

ALTER TABLE "DAILY_GOAL_MONITOR_SESSION"
    ADD COLUMN "expired_at" TIMESTAMP(3) WITH TIME ZONE;

ALTER TABLE "DAILY_GOAL_TRACKING_SESSION"
    DROP CONSTRAINT "DAILY_GOAL_TRACKING_SESSION_lifecycle_check",
    DROP CONSTRAINT "DAILY_GOAL_TRACKING_SESSION_time_order_check",
    ADD CONSTRAINT "DAILY_GOAL_TRACKING_SESSION_lifecycle_check" CHECK (
        ("status" = 'CLOSED' AND "closed_at" IS NOT NULL AND "expired_at" IS NULL)
        OR ("status" = 'EXPIRED' AND "expired_at" IS NOT NULL AND "closed_at" IS NULL)
        OR ("status" IN ('ACTIVE', 'PAUSED') AND "closed_at" IS NULL AND "expired_at" IS NULL)
    ),
    ADD CONSTRAINT "DAILY_GOAL_TRACKING_SESSION_pause_state_check" CHECK (
        "status" = 'PAUSED' OR "paused_at" IS NULL
    ),
    ADD CONSTRAINT "DAILY_GOAL_TRACKING_SESSION_time_order_check" CHECK (
        ("last_meaningful_at" IS NULL OR "last_meaningful_at" >= "created_at")
        AND ("engagement_expires_at" IS NULL OR "last_meaningful_at" IS NOT NULL)
        AND ("engagement_expires_at" IS NULL OR "engagement_expires_at" > "last_meaningful_at")
        AND ("paused_at" IS NULL OR "paused_at" >= "created_at")
        AND ("expired_at" IS NULL OR "expired_at" >= "created_at")
        AND ("closed_at" IS NULL OR "closed_at" >= "created_at")
    );

ALTER TABLE "DAILY_GOAL_MONITOR_SESSION"
    DROP CONSTRAINT "DAILY_GOAL_MONITOR_SESSION_time_order_check",
    ADD CONSTRAINT "DAILY_GOAL_MONITOR_SESSION_terminal_check" CHECK (
        NOT ("closed_at" IS NOT NULL AND "expired_at" IS NOT NULL)
    ),
    ADD CONSTRAINT "DAILY_GOAL_MONITOR_SESSION_time_order_check" CHECK (
        "last_seen_at" >= "started_at" AND "continuity_started_at" >= "started_at"
        AND "eligible_baseline_at" >= "continuity_started_at"
        AND ("expired_at" IS NULL OR "expired_at" >= "started_at")
        AND ("closed_at" IS NULL OR "closed_at" >= "started_at")
    );

CREATE INDEX "DAILY_GOAL_TRACKING_SESSION_status_created_at_id_idx"
    ON "DAILY_GOAL_TRACKING_SESSION"("status", "created_at", "id");
CREATE INDEX "DAILY_GOAL_TRACKING_SESSION_status_engagement_expires_at_id_idx"
    ON "DAILY_GOAL_TRACKING_SESSION"("status", "engagement_expires_at", "id");
CREATE INDEX "DAILY_GOAL_TRACKING_SESSION_status_paused_at_id_idx"
    ON "DAILY_GOAL_TRACKING_SESSION"("status", "paused_at", "id");
CREATE INDEX "DAILY_GOAL_TRACKING_SESSION_expired_at_id_idx"
    ON "DAILY_GOAL_TRACKING_SESSION"("expired_at", "id");
CREATE INDEX "DG_MONITOR_closed_expired_seen_id_idx"
    ON "DAILY_GOAL_MONITOR_SESSION"("closed_at", "expired_at", "last_seen_at", "id");
CREATE INDEX "DAILY_GOAL_MONITOR_SESSION_expired_at_id_idx"
    ON "DAILY_GOAL_MONITOR_SESSION"("expired_at", "id");

COMMIT;
