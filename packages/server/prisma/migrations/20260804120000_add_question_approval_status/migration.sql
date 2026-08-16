-- CreateEnum
CREATE TYPE "QuestionApprovalStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED');

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "approval_status" "QuestionApprovalStatus" NOT NULL DEFAULT 'APPROVED';
