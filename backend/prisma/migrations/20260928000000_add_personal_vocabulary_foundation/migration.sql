-- Add nullable ownership. Existing rows remain canonical because owner_id is NULL.
ALTER TABLE "VOCABULARY"
ADD COLUMN "owner_id" UUID;

-- Create the narrowly scoped create-private-Vocabulary-plus-add operation record.
CREATE TABLE "PRIVATE_VOCABULARY_CREATE_OPERATION" (
    "operation_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "vocabulary_set_id" UUID NOT NULL,
    "vocabulary_id" UUID NOT NULL,
    "request_fingerprint" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PRIVATE_VOCABULARY_CREATE_OPERATION_pkey" PRIMARY KEY ("operation_id")
);

-- Replace global word uniqueness with canonical-only case-insensitive uniqueness.
DROP INDEX "VOCABULARY_word_lower_key";

CREATE UNIQUE INDEX "VOCABULARY_canonical_word_lower_key"
ON "VOCABULARY" (LOWER("word"))
WHERE "owner_id" IS NULL;

-- Search support only: this owner/headword index is deliberately non-unique.
CREATE INDEX "VOCABULARY_private_owner_word_lower_idx"
ON "VOCABULARY" ("owner_id", LOWER("word"))
WHERE "owner_id" IS NOT NULL;

CREATE INDEX "PRIVATE_VOCABULARY_CREATE_OPERATION_owner_id_idx"
ON "PRIVATE_VOCABULARY_CREATE_OPERATION"("owner_id");

CREATE INDEX "PRIVATE_VOCABULARY_CREATE_OPERATION_vocabulary_set_id_idx"
ON "PRIVATE_VOCABULARY_CREATE_OPERATION"("vocabulary_set_id");

CREATE INDEX "PRIVATE_VOCABULARY_CREATE_OPERATION_vocabulary_id_idx"
ON "PRIVATE_VOCABULARY_CREATE_OPERATION"("vocabulary_id");

ALTER TABLE "VOCABULARY"
ADD CONSTRAINT "VOCABULARY_owner_id_fkey"
FOREIGN KEY ("owner_id") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PRIVATE_VOCABULARY_CREATE_OPERATION"
ADD CONSTRAINT "PRIVATE_VOCABULARY_CREATE_OPERATION_owner_id_fkey"
FOREIGN KEY ("owner_id") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PRIVATE_VOCABULARY_CREATE_OPERATION"
ADD CONSTRAINT "PRIVATE_VOCABULARY_CREATE_OPERATION_vocabulary_set_id_fkey"
FOREIGN KEY ("vocabulary_set_id") REFERENCES "VOCABULARY_SET"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PRIVATE_VOCABULARY_CREATE_OPERATION"
ADD CONSTRAINT "PRIVATE_VOCABULARY_CREATE_OPERATION_vocabulary_id_fkey"
FOREIGN KEY ("vocabulary_id") REFERENCES "VOCABULARY"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
