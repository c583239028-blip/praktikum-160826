-- CreateEnum
CREATE TYPE "ModerationType" AS ENUM ('REPORT', 'MUTE', 'UNMUTE', 'KICK');

-- CreateTable
CREATE TABLE "moderation_actions" (
    "id" TEXT NOT NULL,
    "type" "ModerationType" NOT NULL,
    "reason" TEXT,
    "stream_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "target_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "moderation_actions_stream_id_type_idx" ON "moderation_actions"("stream_id", "type");

-- CreateIndex
CREATE INDEX "moderation_actions_target_user_id_type_idx" ON "moderation_actions"("target_user_id", "type");

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_stream_id_fkey" FOREIGN KEY ("stream_id") REFERENCES "streams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
