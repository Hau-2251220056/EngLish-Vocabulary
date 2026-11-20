-- CreateEnum
CREATE TYPE "USER_ROLE" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "USER" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "avatar_url" TEXT,
    "role" "USER_ROLE" NOT NULL DEFAULT 'USER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "total_xp" INTEGER NOT NULL DEFAULT 0,
    "daily_xp_goal" INTEGER NOT NULL DEFAULT 50,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "USER_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AUTH_SESSION" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_identifier_hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AUTH_SESSION_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "USER_email_key" ON "USER"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AUTH_SESSION_session_identifier_hash_key" ON "AUTH_SESSION"("session_identifier_hash");

-- AddForeignKey
ALTER TABLE "AUTH_SESSION" ADD CONSTRAINT "AUTH_SESSION_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
