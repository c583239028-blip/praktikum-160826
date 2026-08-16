-- =============================================
-- Add missing enums
-- =============================================

DO $$ BEGIN
  CREATE TYPE "CurrencyType" AS ENUM ('COIN', 'DIAMOND');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'WINNER_PAYOUT';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'CORRECT_ANSWER';

-- =============================================
-- users: rename camelCase columns to snake_case
-- =============================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='firebaseId') THEN
    ALTER TABLE "users" RENAME COLUMN "firebaseId" TO "firebase_id";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='googleId') THEN
    ALTER TABLE "users" RENAME COLUMN "googleId" TO "google_id";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='facebookId') THEN
    ALTER TABLE "users" RENAME COLUMN "facebookId" TO "facebook_id";
  END IF;
END $$;

-- Recreate unique indexes after rename
DROP INDEX IF EXISTS "users_googleId_key";
DROP INDEX IF EXISTS "users_facebookId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "users_google_id_key" ON "users"("google_id");
CREATE UNIQUE INDEX IF NOT EXISTS "users_facebook_id_key" ON "users"("facebook_id");

-- users: add missing columns
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "apple_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "date_of_birth" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_first_purchase" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_customer_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "followers_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "following_count" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "users_apple_id_key" ON "users"("apple_id");
CREATE UNIQUE INDEX IF NOT EXISTS "users_stripe_customer_id_key" ON "users"("stripe_customer_id");

--=============================================
-- games: add missing column
-- =============================================

ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "is_pinned" BOOLEAN NOT NULL DEFAULT false;

-- =============================================
-- Fix numeric types: INTEGER → DECIMAL
-- =============================================

ALTER TABLE "game_participants" ALTER COLUMN "score" TYPE DECIMAL(10,2) USING "score"::decimal;
ALTER TABLE "user_answers" ALTER COLUMN "wager" TYPE DECIMAL(10,2) USING "wager"::decimal;
ALTER TABLE "user_points" ALTER COLUMN "amount" TYPE DECIMAL(10,2) USING "amount"::decimal;
ALTER TABLE "transactions" ALTER COLUMN "amount" TYPE DECIMAL(10,2) USING "amount"::decimal;

-- =============================================
-- transactions: add missing columns
-- =============================================

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "currency" "CurrencyType" NOT NULL DEFAULT 'COIN';
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "game_id" TEXT;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- =============================================
-- chat_messages: add content column
-- =============================================

ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "content" TEXT;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='message_text') THEN
    UPDATE "chat_messages" SET "content" = "message_text" WHERE "content" IS NULL;
  END IF;
END $$;
ALTER TABLE "chat_messages" ALTER COLUMN "content" SET NOT NULL;

-- =============================================
-- notifications: add missing columns
-- =============================================

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "message" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='content') THEN
    UPDATE "notifications" SET
      "title"      = '',
      "message"    = COALESCE("content", ''),
      "created_at" = COALESCE("send_date", NOW())
    WHERE "title" IS NULL;
  END IF;
END $$;
ALTER TABLE "notifications" ALTER COLUMN "title" SET NOT NULL;
ALTER TABLE "notifications" ALTER COLUMN "message" SET NOT NULL;
ALTER TABLE "notifications" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "notifications" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- =============================================
-- view_logs: make game_id nullable
-- =============================================

ALTER TABLE "view_logs" ALTER COLUMN "game_id" DROP NOT NULL;

-- =============================================
-- Create user_game_activities table
-- =============================================

CREATE TABLE IF NOT EXISTS "user_game_activities" (
    "id"            TEXT NOT NULL,
    "user_id"       TEXT NOT NULL,
    "game_id"       TEXT NOT NULL,
    "relationType"  "UserRole" NOT NULL DEFAULT 'VIEWER',
    "is_pinned"     BOOLEAN NOT NULL DEFAULT false,
    "is_deleted"    BOOLEAN NOT NULL DEFAULT false,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_game_activities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_game_activities_user_id_game_id_key"
    ON "user_game_activities"("user_id", "game_id");

DO $$ BEGIN
  ALTER TABLE "user_game_activities"
    ADD CONSTRAINT "user_game_activities_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_game_activities"
    ADD CONSTRAINT "user_game_activities_game_id_fkey"
    FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
