-- CreateEnum
CREATE TYPE "TranscriptAdaptationStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FALLBACK', 'BYPASSED');

-- CreateEnum
CREATE TYPE "TranscriptAdaptationFailureCode" AS ENUM (
  'DISABLED',
  'MISCONFIGURED',
  'NO_CONTEXT',
  'HIGH_RISK',
  'QUEUE_FULL',
  'CIRCUIT_OPEN',
  'TIMEOUT',
  'RATE_LIMIT',
  'CAPACITY',
  'PROVIDER_ERROR',
  'INVALID_RESPONSE',
  'PRESERVATION_FAILED',
  'PROCESS_INTERRUPTED'
);

-- CreateTable
CREATE TABLE "transcript_adaptations" (
  "id" TEXT NOT NULL,
  "transcriptSegmentId" TEXT NOT NULL,
  "text" TEXT,
  "status" "TranscriptAdaptationStatus" NOT NULL DEFAULT 'PENDING',
  "failureCode" "TranscriptAdaptationFailureCode",
  "contextVersion" INTEGER NOT NULL,
  "contextSnapshot" JSONB NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "latencyMs" INTEGER,
  "inputTokens" INTEGER,
  "cachedInputTokens" INTEGER,
  "outputTokens" INTEGER,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "transcript_adaptations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transcript_adaptations_transcriptSegmentId_key"
ON "transcript_adaptations"("transcriptSegmentId");

-- CreateIndex
CREATE INDEX "transcript_adaptations_status_createdAt_idx"
ON "transcript_adaptations"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "transcript_adaptations"
ADD CONSTRAINT "transcript_adaptations_transcriptSegmentId_fkey"
FOREIGN KEY ("transcriptSegmentId") REFERENCES "transcript_segments"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
