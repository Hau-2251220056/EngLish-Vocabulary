BEGIN;

CREATE TABLE "LEARNING_SESSION_SRS_RECEIPT" (
    "event_id" UUID NOT NULL,
    "session_item_id" UUID NOT NULL,
    "rating" VARCHAR(5) NOT NULL,
    "expected_revision" INTEGER NOT NULL,
    "accepted_revision" INTEGER NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LEARNING_SESSION_SRS_RECEIPT_pkey" PRIMARY KEY ("event_id"),
    CONSTRAINT "LEARNING_SESSION_SRS_RECEIPT_rating_check"
        CHECK ("rating" IN ('AGAIN', 'HARD', 'GOOD', 'EASY')),
    CONSTRAINT "LEARNING_SESSION_SRS_RECEIPT_revision_check"
        CHECK (
            "expected_revision" >= 0
            AND "accepted_revision" >= 0
            AND "accepted_revision" = "expected_revision" + 1
        )
);

CREATE INDEX "LEARNING_SESSION_SRS_RECEIPT_session_item_id_accepted_revision_idx"
    ON "LEARNING_SESSION_SRS_RECEIPT"("session_item_id", "accepted_revision");

ALTER TABLE "LEARNING_SESSION_SRS_RECEIPT"
    ADD CONSTRAINT "LEARNING_SESSION_SRS_RECEIPT_session_item_id_fkey"
    FOREIGN KEY ("session_item_id") REFERENCES "LEARNING_SESSION_ITEM"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
