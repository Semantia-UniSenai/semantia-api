import {
  LiveSession,
  LiveSessionDetails,
} from '../entities/live-session.entity';

export interface CreateLiveSessionData {
  title: string;
  teacherId: string;
  classId: string | null;
  joinToken: string;
}

/**
 * LiveSessionRepository — abstract contract for live session persistence.
 * Registered as a DI token (abstract class) so the Prisma implementation can
 * be swapped without touching business logic.
 */
export abstract class LiveSessionRepository {
  abstract create(data: CreateLiveSessionData): Promise<LiveSession>;
  abstract findById(id: string): Promise<LiveSession | null>;
  abstract findDetailsById(id: string): Promise<LiveSessionDetails | null>;
  abstract findByJoinToken(joinToken: string): Promise<LiveSession | null>;
  abstract findByClass(classId: string): Promise<LiveSession[]>;
  abstract end(id: string, endedAt: Date): Promise<LiveSession>;
}
