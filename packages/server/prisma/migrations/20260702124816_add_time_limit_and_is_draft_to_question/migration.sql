-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "is_draft" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "time_limit" INTEGER;
