-- TASK-264 lifecycle persistence review artifact only. Activation and database execution are not authorized.
-- This migration creates no policy or journal rows and selects no production timeout values.
BEGIN;

CREATE TABLE "DAILY_GOAL_LIFECYCLE_POLICY" (
    "policy_version" INTEGER NOT NULL,
    "activated_at" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
    "created_at" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DAILY_GOAL_LIFECYCLE_POLICY_pkey" PRIMARY KEY ("policy_version"),
    CONSTRAINT "DAILY_GOAL_LIFECYCLE_POLICY_version_positive" CHECK ("policy_version" > 0)
);

CREATE TABLE "DAILY_GOAL_LIFECYCLE_JOURNAL" (
    "policy_version" INTEGER NOT NULL,
    "scan_eligibility_at" TIMESTAMP(3) WITH TIME ZONE,
    "scan_candidate_kind" VARCHAR(16),
    "scan_stable_id" UUID,
    "pending_descriptors" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "pending_index" INTEGER NOT NULL DEFAULT 0,
    "lease_token" UUID,
    "lease_expires_at" TIMESTAMP(3) WITH TIME ZONE,
    "wrapped_epoch" BIGINT NOT NULL DEFAULT 0,
    "revision" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
    CONSTRAINT "DAILY_GOAL_LIFECYCLE_JOURNAL_pkey" PRIMARY KEY ("policy_version"),
    CONSTRAINT "DAILY_GOAL_LIFECYCLE_JOURNAL_cursor_complete" CHECK (
        ("scan_eligibility_at" IS NULL AND "scan_candidate_kind" IS NULL AND "scan_stable_id" IS NULL)
        OR ("scan_eligibility_at" IS NOT NULL AND "scan_candidate_kind" IS NOT NULL AND "scan_stable_id" IS NOT NULL)
    ),
    CONSTRAINT "DAILY_GOAL_LIFECYCLE_JOURNAL_candidate_kind" CHECK (
        "scan_candidate_kind" IS NULL OR "scan_candidate_kind" IN ('TRACKING', 'MONITOR')
    ),
    CONSTRAINT "DAILY_GOAL_LIFECYCLE_JOURNAL_lease_complete" CHECK (
        ("lease_token" IS NULL AND "lease_expires_at" IS NULL)
        OR ("lease_token" IS NOT NULL AND "lease_expires_at" IS NOT NULL)
    ),
    CONSTRAINT "DAILY_GOAL_LIFECYCLE_JOURNAL_pending_array" CHECK (
        jsonb_typeof("pending_descriptors") = 'array'
    ),
    CONSTRAINT "DAILY_GOAL_LIFECYCLE_JOURNAL_pending_limit" CHECK (
        jsonb_array_length("pending_descriptors") <= 25
    ),
    CONSTRAINT "DAILY_GOAL_LIFECYCLE_JOURNAL_pending_index" CHECK (
        "pending_index" >= 0
        AND "pending_index" <= jsonb_array_length("pending_descriptors")
    ),
    CONSTRAINT "DAILY_GOAL_LIFECYCLE_JOURNAL_wrapped_epoch_non_negative" CHECK ("wrapped_epoch" >= 0),
    CONSTRAINT "DAILY_GOAL_LIFECYCLE_JOURNAL_revision_non_negative" CHECK ("revision" >= 0)
);

ALTER TABLE "DAILY_GOAL_LIFECYCLE_JOURNAL"
    ADD CONSTRAINT "DAILY_GOAL_LIFECYCLE_JOURNAL_policy_version_fkey"
    FOREIGN KEY ("policy_version") REFERENCES "DAILY_GOAL_LIFECYCLE_POLICY"("policy_version")
    ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
