-- Prisma Migrate 6 does not wrap PostgreSQL migration files in a transaction by
-- default. Keep the preflight and every XP-related DDL statement atomic.
BEGIN;

-- This read-only preflight runs before the nonnegative XP constraint or any XP
-- reward DDL. It stops migration without modifying existing balances.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "USER" WHERE "total_xp" < 0) THEN
        RAISE EXCEPTION 'XP & Level V1 migration blocked: negative USER.total_xp exists; HUMAN review required.';
    END IF;
END
$$;

-- AddConstraint
ALTER TABLE "USER"
ADD CONSTRAINT "USER_total_xp_non_negative"
CHECK ("total_xp" >= 0);

-- CreateEnum
CREATE TYPE "XP_REWARD_TYPE" AS ENUM (
    'SRS_INITIAL',
    'QUIZ_FIRST_CORRECT',
    'SRS_DUE_REVIEW'
);

-- CreateTable
CREATE TABLE "XP_REWARD" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vocabulary_id" UUID NOT NULL,
    "reward_type" "XP_REWARD_TYPE" NOT NULL,
    "reward_cycle" INTEGER NOT NULL,
    "source_event_id" UUID NOT NULL,
    "xp_amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XP_REWARD_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "XP_REWARD_xp_amount_positive" CHECK ("xp_amount" > 0),
    CONSTRAINT "XP_REWARD_reward_cycle_non_negative" CHECK ("reward_cycle" >= 0),
    CONSTRAINT "XP_REWARD_type_cycle_amount_check" CHECK (
        ("reward_type" IN ('SRS_INITIAL', 'QUIZ_FIRST_CORRECT') AND "reward_cycle" = 0 AND "xp_amount" = 3)
        OR
        ("reward_type" = 'SRS_DUE_REVIEW' AND "reward_cycle" > 0 AND "xp_amount" = 1)
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "XP_REWARD_user_id_vocabulary_id_reward_type_reward_cycle_key"
ON "XP_REWARD"("user_id", "vocabulary_id", "reward_type", "reward_cycle");

-- CreateIndex
CREATE UNIQUE INDEX "XP_REWARD_user_id_source_event_id_key"
ON "XP_REWARD"("user_id", "source_event_id");

-- CreateIndex
CREATE INDEX "XP_REWARD_vocabulary_id_idx"
ON "XP_REWARD"("vocabulary_id");

-- AddForeignKey
ALTER TABLE "XP_REWARD"
ADD CONSTRAINT "XP_REWARD_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XP_REWARD"
ADD CONSTRAINT "XP_REWARD_vocabulary_id_fkey"
FOREIGN KEY ("vocabulary_id") REFERENCES "VOCABULARY"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
