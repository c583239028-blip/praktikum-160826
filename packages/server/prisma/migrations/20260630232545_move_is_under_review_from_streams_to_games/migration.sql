/*
  Warnings:

  - You are about to drop the column `is_under_review` on the `streams` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "games" ADD COLUMN     "is_under_review" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "streams" DROP COLUMN "is_under_review";
