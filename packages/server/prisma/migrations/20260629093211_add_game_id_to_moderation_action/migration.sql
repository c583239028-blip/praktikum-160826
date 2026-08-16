/*
  Warnings:

  - Added the required column `game_id` to the `moderation_actions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "moderation_actions" ADD COLUMN     "game_id" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "moderation_actions_game_id_type_idx" ON "moderation_actions"("game_id", "type");

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
