ALTER TABLE "transcript_segments"
ADD COLUMN "cleaningStrategyVersion" TEXT NOT NULL DEFAULT 'legacy-unversioned';
