CREATE TABLE "LOGIN_ABUSE_STATE" (
    "identifier_key" CHAR(64) NOT NULL,
    "source_key" CHAR(64) NOT NULL,
    "failure_count" INTEGER NOT NULL,
    "last_failed_at" TIMESTAMP(3) NOT NULL,
    "blocked_until" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LOGIN_ABUSE_STATE_pkey" PRIMARY KEY ("identifier_key", "source_key"),
    CONSTRAINT "LOGIN_ABUSE_STATE_failure_count_check" CHECK ("failure_count" >= 1 AND "failure_count" <= 5)
);

CREATE INDEX "LOGIN_ABUSE_STATE_updated_at_idx" ON "LOGIN_ABUSE_STATE"("updated_at");
