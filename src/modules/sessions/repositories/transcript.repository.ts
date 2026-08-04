import { TranscriptSegment } from '../entities/transcript-segment.entity';

export interface AppendTranscriptResult {
  segment: TranscriptSegment;
  created: boolean;
}

/**
 * TranscriptRepository — abstract contract for transcript segment
 * persistence. `append` allocates the next per-session `seq` atomically so
 * segments always replay in the order the teacher spoke them.
 */
export abstract class TranscriptRepository {
  abstract append(
    sessionId: string,
    text: string,
    clientSegmentId: string,
  ): Promise<AppendTranscriptResult>;
  abstract findByClientSegmentId(
    sessionId: string,
    clientSegmentId: string,
  ): Promise<TranscriptSegment | null>;
  abstract findBySession(sessionId: string): Promise<TranscriptSegment[]>;
  abstract findLast(
    sessionId: string,
    limit: number,
  ): Promise<TranscriptSegment[]>;
}
