-- CreateTable
CREATE TABLE "LEARNING_PROGRESS" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vocabulary_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "last_reviewed_at" TIMESTAMP(3),
    "last_event_id" UUID,
    "next_review_at" TIMESTAMP(3),
    "interval_days" INTEGER,
    "ease_factor" DECIMAL(65,30),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LEARNING_PROGRESS_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LEARNING_PROGRESS_status_check" CHECK ("status" IN ('LEARNING', 'LEARNED', 'NEEDS_REVIEW')),
    CONSTRAINT "LEARNING_PROGRESS_review_count_non_negative" CHECK ("review_count" >= 0),
    CONSTRAINT "LEARNING_PROGRESS_revision_non_negative" CHECK ("revision" >= 0),
    CONSTRAINT "LEARNING_PROGRESS_interval_days_positive" CHECK ("interval_days" IS NULL OR "interval_days" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "LEARNING_PROGRESS_user_id_vocabulary_id_key"
ON "LEARNING_PROGRESS"("user_id", "vocabulary_id");

-- AddForeignKey
ALTER TABLE "LEARNING_PROGRESS"
ADD CONSTRAINT "LEARNING_PROGRESS_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LEARNING_PROGRESS"
ADD CONSTRAINT "LEARNING_PROGRESS_vocabulary_id_fkey"
FOREIGN KEY ("vocabulary_id") REFERENCES "VOCABULARY"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
