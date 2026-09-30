-- Personal Vocabulary Sets may be topicless. Public/System Sets must remain categorized.
ALTER TABLE "VOCABULARY_SET"
ALTER COLUMN "topic_id" DROP NOT NULL;

ALTER TABLE "VOCABULARY_SET"
ADD CONSTRAINT "VOCABULARY_SET_public_topic_required"
CHECK (NOT "is_public" OR "topic_id" IS NOT NULL);
