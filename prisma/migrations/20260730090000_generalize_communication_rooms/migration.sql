-- Generaliza o domínio educacional preservando salas, sessões, transcripts e chat.

-- Papéis passam a ser contextuais à sala; não existem mais papéis globais de cadastro.
CREATE TYPE "RoomMemberRole" AS ENUM ('MODERATOR', 'PARTICIPANT');
CREATE TYPE "ParticipantRole" AS ENUM ('HOST', 'MODERATOR', 'PARTICIPANT', 'GUEST');
ALTER TYPE "SessionStatus" ADD VALUE IF NOT EXISTS 'PREPARING' BEFORE 'LIVE';

-- Solta relações antigas antes de renomear tabelas e colunas.
ALTER TABLE "classes" DROP CONSTRAINT "classes_teacherId_fkey";
ALTER TABLE "class_members" DROP CONSTRAINT "class_members_classId_fkey";
ALTER TABLE "class_members" DROP CONSTRAINT "class_members_userId_fkey";
ALTER TABLE "live_sessions" DROP CONSTRAINT "live_sessions_teacherId_fkey";
ALTER TABLE "live_sessions" DROP CONSTRAINT "live_sessions_classId_fkey";
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_userId_fkey";

-- SchoolClass -> Room e ClassMember -> RoomMember.
ALTER TABLE "classes" RENAME TO "rooms";
ALTER TABLE "rooms" RENAME COLUMN "teacherId" TO "hostId";
ALTER TABLE "rooms" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "class_members" RENAME TO "room_members";
ALTER TABLE "room_members" RENAME COLUMN "classId" TO "roomId";
ALTER TABLE "room_members" ADD COLUMN "role" "RoomMemberRole" NOT NULL DEFAULT 'PARTICIPANT';

ALTER INDEX "classes_inviteCode_key" RENAME TO "rooms_inviteCode_key";
ALTER INDEX "class_members_classId_userId_key" RENAME TO "room_members_roomId_userId_key";

-- LiveSession -> RoomSession. Sessões avulsas recebem uma sala migrada por anfitrião.
ALTER TABLE "live_sessions" RENAME TO "room_sessions";
ALTER TABLE "room_sessions" ALTER COLUMN "status" SET DEFAULT 'PREPARING';
ALTER TABLE "room_sessions" RENAME COLUMN "classId" TO "roomId";
ALTER TABLE "room_sessions" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "room_sessions" SET "createdAt" = "startedAt";
ALTER TABLE "room_sessions" ALTER COLUMN "startedAt" DROP NOT NULL;

INSERT INTO "rooms" ("id", "name", "hostId", "inviteCode", "createdAt", "updatedAt")
SELECT
  'legacy-room-' || md5("teacherId"),
  'Sala migrada',
  "teacherId",
  'LEGACY-' || upper(substr(md5("teacherId"), 1, 12)),
  min("startedAt"),
  CURRENT_TIMESTAMP
FROM "room_sessions"
WHERE "roomId" IS NULL
GROUP BY "teacherId"
ON CONFLICT ("inviteCode") DO NOTHING;

UPDATE "room_sessions"
SET "roomId" = 'legacy-room-' || md5("teacherId")
WHERE "roomId" IS NULL;

ALTER TABLE "room_sessions" ALTER COLUMN "roomId" SET NOT NULL;
ALTER TABLE "room_sessions" DROP COLUMN "teacherId";
ALTER INDEX "live_sessions_joinToken_key" RENAME TO "room_sessions_joinToken_key";

-- O chat passa a persistir a identidade contextual usada na sessão, inclusive convidados.
ALTER TABLE "chat_messages" RENAME COLUMN "userId" TO "participantId";
ALTER TABLE "chat_messages" ADD COLUMN "participantName" TEXT;
ALTER TABLE "chat_messages" ADD COLUMN "participantRole" "ParticipantRole";

UPDATE "chat_messages" AS message
SET
  "participantName" = account."name",
  "participantRole" = CASE
    WHEN message."participantId" = room."hostId" THEN 'HOST'::"ParticipantRole"
    ELSE 'PARTICIPANT'::"ParticipantRole"
  END
FROM "users" AS account, "room_sessions" AS session, "rooms" AS room
WHERE message."participantId" = account."id"
  AND message."sessionId" = session."id"
  AND session."roomId" = room."id";

ALTER TABLE "chat_messages" ALTER COLUMN "participantName" SET NOT NULL;
ALTER TABLE "chat_messages" ALTER COLUMN "participantRole" SET NOT NULL;

-- Reconstrói relações e índices com o novo vocabulário.
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_hostId_fkey"
  FOREIGN KEY ("hostId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "room_sessions" ADD CONSTRAINT "room_sessions_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "rooms_hostId_createdAt_idx" ON "rooms"("hostId", "createdAt");
CREATE INDEX "room_members_userId_joinedAt_idx" ON "room_members"("userId", "joinedAt");
CREATE INDEX "room_sessions_roomId_createdAt_idx" ON "room_sessions"("roomId", "createdAt");
CREATE UNIQUE INDEX "transcript_segments_sessionId_seq_key" ON "transcript_segments"("sessionId", "seq");

-- Remove o papel global somente depois que os autores históricos do chat foram classificados.
ALTER TABLE "users" DROP COLUMN "role";
DROP TYPE "Role";
