BEGIN;

CREATE TYPE "CEFR_LEARNING_EVIDENCE_SOURCE" AS ENUM (
    'NORMAL_REVEALED',
    'SRS_AGAIN',
    'SRS_HARD',
    'SRS_GOOD',
    'SRS_EASY'
);

ALTER TABLE "CEFR_LEARNING_PASS_ITEM"
    ADD COLUMN "first_credit_source" "CEFR_LEARNING_EVIDENCE_SOURCE",
    ADD COLUMN "first_credit_event_id" UUID,
    ADD COLUMN "first_credit_session_id" UUID,
    ADD COLUMN "first_credit_accepted_at" TIMESTAMP(3);

ALTER TABLE "LEARNING_SESSION"
    DROP CONSTRAINT "LEARNING_SESSION_pass_scope_check";

ALTER TABLE "LEARNING_SESSION" ADD CONSTRAINT "LEARNING_SESSION_pass_scope_check" CHECK (
    "cefr_learning_pass_id" IS NULL
    OR ("scope" = 'SET' AND "mode" IN ('NORMAL', 'SRS'))
);

DO $$
DECLARE
    conflict RECORD;
BEGIN
    SELECT
        pass."id" AS pass_id,
        session."id" AS session_id,
        session_item."id" AS session_item_id
    INTO conflict
        FROM "LEARNING_SESSION_ITEM" AS session_item
        INNER JOIN "LEARNING_SESSION" AS session
            ON session."id" = session_item."session_id"
        INNER JOIN "CEFR_LEARNING_PASS" AS pass
            ON pass."id" = session."cefr_learning_pass_id"
        LEFT JOIN "CEFR_LEARNING_PASS_ITEM" AS pass_item
            ON pass_item."pass_id" = pass."id"
            AND pass_item."vocabulary_id" = session_item."vocabulary_id"
        WHERE session."cefr_learning_pass_id" IS NOT NULL
          AND session_item."evidence" IS NOT NULL
          AND (
              session."scope" <> 'SET'
              OR session."mode" <> 'NORMAL'
              OR session."user_id" <> pass."user_id"
              OR session."set_id_snapshot" IS DISTINCT FROM pass."set_id_snapshot"
              OR session."vocabulary_set_id" IS DISTINCT FROM pass."vocabulary_set_id"
              OR pass_item."id" IS NULL
              OR session_item."evidence" <> 'NORMAL_REVEALED'
              OR session_item."evidence_event_id" IS NULL
              OR session_item."evidence_at" IS NULL
              OR session_item."evidence_at" < session."created_at"
              OR session_item."evidence_at" >= session."expires_at"
          )
        LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'CEFR V2 backfill rejected inconsistent pass-linked NORMAL evidence (pass %, session %, session item %)',
            conflict.pass_id, conflict.session_id, conflict.session_item_id;
    END IF;

    SELECT session_item."evidence_event_id" AS evidence_event_id
    INTO conflict
        FROM "LEARNING_SESSION_ITEM" AS session_item
        INNER JOIN "LEARNING_SESSION" AS session
            ON session."id" = session_item."session_id"
        WHERE session."cefr_learning_pass_id" IS NOT NULL
          AND session_item."evidence" = 'NORMAL_REVEALED'
        GROUP BY session_item."evidence_event_id"
        HAVING session_item."evidence_event_id" IS NULL OR COUNT(*) > 1
        LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'CEFR V2 backfill rejected missing or ambiguous evidence event identity (event %)',
            conflict.evidence_event_id;
    END IF;

    SELECT pass."id" AS pass_id, pass_item."id" AS pass_item_id
    INTO conflict
        FROM "CEFR_LEARNING_PASS_ITEM" AS pass_item
        INNER JOIN "CEFR_LEARNING_PASS" AS pass
            ON pass."id" = pass_item."pass_id"
        WHERE pass."status" = 'COMPLETED'
          AND NOT EXISTS (
              SELECT 1
              FROM "LEARNING_SESSION_ITEM" AS session_item
              INNER JOIN "LEARNING_SESSION" AS session
                  ON session."id" = session_item."session_id"
              WHERE session."cefr_learning_pass_id" = pass."id"
                AND session."user_id" = pass."user_id"
                AND session."scope" = 'SET'
                AND session."mode" = 'NORMAL'
                AND session."set_id_snapshot" = pass."set_id_snapshot"
                AND session."vocabulary_set_id" IS NOT DISTINCT FROM pass."vocabulary_set_id"
                AND session_item."vocabulary_id" = pass_item."vocabulary_id"
                AND session_item."evidence" = 'NORMAL_REVEALED'
                AND session_item."evidence_event_id" IS NOT NULL
                AND session_item."evidence_at" IS NOT NULL
                AND session_item."evidence_at" >= session."created_at"
                AND session_item."evidence_at" < session."expires_at"
          )
        LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'CEFR V2 backfill rejected completed pass without exact NORMAL evidence (pass %, pass item %)',
            conflict.pass_id, conflict.pass_item_id;
    END IF;
END $$;

WITH valid_candidates AS (
    SELECT
        pass_item."id" AS pass_item_id,
        session_item."evidence_event_id" AS event_id,
        session."id" AS session_id,
        session_item."evidence_at" AS accepted_at,
        ROW_NUMBER() OVER (
            PARTITION BY pass_item."id"
            ORDER BY session_item."evidence_at" ASC, session_item."evidence_event_id" ASC
        ) AS candidate_rank
    FROM "CEFR_LEARNING_PASS_ITEM" AS pass_item
    INNER JOIN "CEFR_LEARNING_PASS" AS pass
        ON pass."id" = pass_item."pass_id"
    INNER JOIN "LEARNING_SESSION" AS session
        ON session."cefr_learning_pass_id" = pass."id"
        AND session."user_id" = pass."user_id"
        AND session."scope" = 'SET'
        AND session."mode" = 'NORMAL'
        AND session."set_id_snapshot" = pass."set_id_snapshot"
        AND session."vocabulary_set_id" IS NOT DISTINCT FROM pass."vocabulary_set_id"
    INNER JOIN "LEARNING_SESSION_ITEM" AS session_item
        ON session_item."session_id" = session."id"
        AND session_item."vocabulary_id" = pass_item."vocabulary_id"
    WHERE session_item."evidence" = 'NORMAL_REVEALED'
      AND session_item."evidence_event_id" IS NOT NULL
      AND session_item."evidence_at" IS NOT NULL
      AND session_item."evidence_at" >= session."created_at"
      AND session_item."evidence_at" < session."expires_at"
), first_candidates AS (
    SELECT pass_item_id, event_id, session_id, accepted_at
    FROM valid_candidates
    WHERE candidate_rank = 1
)
UPDATE "CEFR_LEARNING_PASS_ITEM" AS pass_item
SET
    "first_credit_source" = 'NORMAL_REVEALED',
    "first_credit_event_id" = first_candidate.event_id,
    "first_credit_session_id" = first_candidate.session_id,
    "first_credit_accepted_at" = first_candidate.accepted_at
FROM first_candidates AS first_candidate
WHERE pass_item."id" = first_candidate.pass_item_id;

ALTER TABLE "CEFR_LEARNING_PASS_ITEM" ADD CONSTRAINT "CEFR_LEARNING_PASS_ITEM_first_credit_tuple_check" CHECK (
    (
        "first_credit_source" IS NULL
        AND "first_credit_event_id" IS NULL
        AND "first_credit_session_id" IS NULL
        AND "first_credit_accepted_at" IS NULL
    )
    OR (
        "first_credit_source" IS NOT NULL
        AND "first_credit_event_id" IS NOT NULL
        AND "first_credit_session_id" IS NOT NULL
        AND "first_credit_accepted_at" IS NOT NULL
    )
);

CREATE UNIQUE INDEX "CEFR_LEARNING_PASS_ITEM_first_credit_event_id_key"
    ON "CEFR_LEARNING_PASS_ITEM"("first_credit_event_id");
CREATE INDEX "CEFR_LEARNING_PASS_ITEM_first_credit_session_id_idx"
    ON "CEFR_LEARNING_PASS_ITEM"("first_credit_session_id");

ALTER TABLE "CEFR_LEARNING_PASS_ITEM"
    ADD CONSTRAINT "CEFR_LEARNING_PASS_ITEM_first_credit_session_id_fkey"
    FOREIGN KEY ("first_credit_session_id") REFERENCES "LEARNING_SESSION"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$
DECLARE
    conflict RECORD;
BEGIN
    SELECT pass."id" AS pass_id, pass_item."id" AS pass_item_id
    INTO conflict
        FROM "CEFR_LEARNING_PASS_ITEM" AS pass_item
        INNER JOIN "CEFR_LEARNING_PASS" AS pass
            ON pass."id" = pass_item."pass_id"
        WHERE pass."status" = 'COMPLETED'
          AND pass_item."first_credit_source" IS NULL
        LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'CEFR V2 backfill left a completed pass item without first credit (pass %, pass item %)',
            conflict.pass_id, conflict.pass_item_id;
    END IF;
END $$;

COMMIT;
