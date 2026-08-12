/**
 * One finalized transcription chunk of a live session, ordered by `seq`.
 * Plain class — no Prisma coupling.
 */
export class TranscriptSegment {
  id: string;
  sessionId: string;
  clientSegmentId?: string;
  seq: number;
  text: string;
  cleaningStrategyVersion: string;
  createdAt: Date;

  constructor(props: TranscriptSegment) {
    Object.assign(this, props);
  }
}
