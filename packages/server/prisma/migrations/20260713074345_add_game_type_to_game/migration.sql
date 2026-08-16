-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('CLOSE_UP', 'REMOTE');

-- AlterTable
-- WHY DEFAULT: without it this fails on any non-empty `games` table (P3009 in prod,
-- 2026-07-16). Matches schema.prisma's `@default(CLOSE_UP)`.
ALTER TABLE "games" ADD COLUMN     "game_type" "GameType" NOT NULL DEFAULT 'CLOSE_UP';
