-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('USER', 'STAFF', 'ADMIN');

-- AlterTable
ALTER TABLE "streams" ADD COLUMN     "is_under_review" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "SystemRole" NOT NULL DEFAULT 'USER';
