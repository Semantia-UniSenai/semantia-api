/** Domain representation of a game score. Plain class — no Prisma coupling. */
export class Score {
  id: string;
  userId: string;
  gameKey: string;
  points: number;
  accuracy: number | null;
  durationMs: number | null;
  createdAt: Date;

  constructor(props: Score) {
    Object.assign(this, props);
  }
}

/** A single ranking row: a user's best score for a game. */
export class RankingEntry {
  rank: number;
  userId: string;
  name: string;
  points: number;
}
