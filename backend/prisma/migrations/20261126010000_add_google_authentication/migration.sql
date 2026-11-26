-- Google-only users intentionally have no password credential.
BEGIN;

ALTER TABLE "USER" ALTER COLUMN "password_hash" DROP NOT NULL;

CREATE TYPE "AUTH_PROVIDER" AS ENUM ('GOOGLE');

CREATE TABLE "AUTH_IDENTITY" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "AUTH_PROVIDER" NOT NULL,
    "provider_subject" VARCHAR(255) NOT NULL,
    "provider_email" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AUTH_IDENTITY_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GOOGLE_AUTH_CHALLENGE" (
    "id" UUID NOT NULL,
    "nonce_hash" CHAR(64) NOT NULL,
    "browser_binding_hash" CHAR(64) NOT NULL,
    "source_key" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "issued_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    CONSTRAINT "GOOGLE_AUTH_CHALLENGE_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AUTH_IDENTITY_provider_provider_subject_key" ON "AUTH_IDENTITY"("provider", "provider_subject");
CREATE UNIQUE INDEX "AUTH_IDENTITY_user_id_provider_key" ON "AUTH_IDENTITY"("user_id", "provider");
CREATE INDEX "AUTH_IDENTITY_user_id_idx" ON "AUTH_IDENTITY"("user_id");
CREATE UNIQUE INDEX "GOOGLE_AUTH_CHALLENGE_nonce_hash_key" ON "GOOGLE_AUTH_CHALLENGE"("nonce_hash");
CREATE INDEX "GOOGLE_AUTH_CHALLENGE_browser_binding_hash_idx" ON "GOOGLE_AUTH_CHALLENGE"("browser_binding_hash");
CREATE INDEX "GOOGLE_AUTH_CHALLENGE_expires_at_idx" ON "GOOGLE_AUTH_CHALLENGE"("expires_at");
CREATE INDEX "GOOGLE_AUTH_CHALLENGE_source_key_issued_at_idx" ON "GOOGLE_AUTH_CHALLENGE"("source_key", "issued_at");

ALTER TABLE "AUTH_IDENTITY" ADD CONSTRAINT "AUTH_IDENTITY_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "USER"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
