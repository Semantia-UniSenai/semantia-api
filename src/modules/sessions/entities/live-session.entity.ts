/**
 * SessionStatus — domain-level enum, mirrored by the Prisma `SessionStatus`.
 */
export enum SessionStatus {
  LIVE = 'LIVE',
  ENDED = 'ENDED',
}

/**
 * Domain representation of a live class session. Plain class — no Prisma
 * coupling. `classId === null` means an ad-hoc session (aula avulsa) joined
 * only via its joinToken/link.
 */
export class LiveSession {
  id: string;
  title: string;
  teacherId: string;
  classId: string | null;
  joinToken: string;
  status: SessionStatus;
  startedAt: Date;
  endedAt: Date | null;

  constructor(props: LiveSession) {
    Object.assign(this, props);
  }
}

/** Session enriched with display names for the session info screen. */
export class LiveSessionDetails extends LiveSession {
  teacherName: string;
  className: string | null;

  constructor(props: LiveSessionDetails) {
    super(props);
    this.teacherName = props.teacherName;
    this.className = props.className;
  }
}
