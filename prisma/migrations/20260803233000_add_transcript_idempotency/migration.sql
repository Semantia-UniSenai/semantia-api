ALTER TABLE "transcript_segments"
ADD COLUMN "clientSegmentId" TEXT;

UPDATE "transcript_segments"
SET "clientSegmentId" = 'legacy-' || "id";

ALTER TABLE "transcript_segments"
ALTER COLUMN "clientSegmentId" SET NOT NULL;

CREATE UNIQUE INDEX "transcript_segments_sessionId_clientSegmentId_key"
ON "transcript_segments"("sessionId", "clientSegmentId");
