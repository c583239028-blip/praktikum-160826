/*
  Warnings:

  - You are about to drop the column `message_text` on the `chat_messages` table. All the data in the column will be lost.
  - You are about to drop the column `message_type` on the `chat_messages` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `chat_messages` table. All the data in the column will be lost.
  - You are about to drop the column `content` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `read_date` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `send_date` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `is_first_purchase` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `wallet_balance` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `answers_count` on the `view_logs` table. All the data in the column will be lost.
  - You are about to drop the column `participation_percent` on the `view_logs` table. All the data in the column will be lost.
  - You are about to drop the column `started_at` on the `view_logs` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[firebase_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "view_logs" DROP CONSTRAINT IF EXISTS "view_logs_game_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "view_logs_user_id_host_id_duration_idx";

-- AlterTable
ALTER TABLE "chat_messages"
  DROP COLUMN IF EXISTS "message_text",
  DROP COLUMN IF EXISTS "message_type",
  DROP COLUMN IF EXISTS "status";

-- AlterTable
ALTER TABLE "notifications"
  DROP COLUMN IF EXISTS "content",
  DROP COLUMN IF EXISTS "read_date",
  DROP COLUMN IF EXISTS "send_date",
  DROP COLUMN IF EXISTS "type";

-- AlterTable
ALTER TABLE "user_game_activities" ALTER COLUMN "last_viewed_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users"
  DROP COLUMN IF EXISTS "is_first_purchase",
  DROP COLUMN IF EXISTS "wallet_balance",
  ADD COLUMN IF NOT EXISTS "isFirstPurchase" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "walletBalance" DECIMAL(10,2) NOT NULL DEFAULT 1000.00;

-- AlterTable
ALTER TABLE "view_logs"
  DROP COLUMN IF EXISTS "answers_count",
  DROP COLUMN IF EXISTS "participation_percent",
  DROP COLUMN IF EXISTS "started_at",
  ALTER COLUMN "duration" SET DEFAULT 0;

-- DropEnum
DROP TYPE IF EXISTS "MessageStatus";

-- DropEnum
DROP TYPE IF EXISTS "MessageType";

-- DropEnum
DROP TYPE IF EXISTS "NotificationType";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_firebase_id_key" ON "users"("firebase_id");

-- AddForeignKey
ALTER TABLE "view_logs" ADD CONSTRAINT "view_logs_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE SET NULL ON UPDATE CASCADE;
