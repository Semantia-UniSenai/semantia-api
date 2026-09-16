/**
 * One finalized transcription chunk of a live session, ordered by `seq`.
 * Plain class — no Prisma coupling.
 */
export type TranscriptSegmentAdaptation = {
  text: string;
  status: 'succeeded' | 'fallback' | 'bypassed';
  failureCode: string | null;
  automatic: true;
  contextVersion: number;
  promptVersion: string;
  provider: string;
  model: string;
  at: Date;
};

export class TranscriptSegment {
  id: string;
  sessionId: string;
  clientSegmentId?: string;
  seq: number;
  text: string;
  cleaningStrategyVersion: string;
  adaptation?: TranscriptSegmentAdaptation | null;
  createdAt: Date;

  constructor(props: TranscriptSegment) {
    Object.assign(this, props);
  }
}
