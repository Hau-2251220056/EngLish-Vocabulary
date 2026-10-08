-- Add nullable Vocabulary Set metadata without rewriting historical rows.
ALTER TABLE "VOCABULARY_SET"
ADD COLUMN "cefr_level" TEXT,
ADD COLUMN "cover_image_url" VARCHAR(2048),
ADD COLUMN "cover_storage_key" VARCHAR(512);

ALTER TABLE "VOCABULARY_SET"
ADD CONSTRAINT "VOCABULARY_SET_cefr_level_check"
CHECK ("cefr_level" IS NULL OR "cefr_level" IN ('A1', 'A2', 'B1', 'B2', 'C1'));

ALTER TABLE "VOCABULARY_SET"
ADD CONSTRAINT "VOCABULARY_SET_cover_pair_check"
CHECK ("cover_storage_key" IS NULL OR "cover_image_url" IS NOT NULL);
