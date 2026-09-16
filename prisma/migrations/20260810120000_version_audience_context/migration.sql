-- AlterTable
ALTER TABLE "room_sessions"
ADD COLUMN "audienceContextVersion" INTEGER NOT NULL DEFAULT 0;
