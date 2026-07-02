import { UserRole } from '../../../shared/enums/user-role.enum';
import type { AuthUser } from '../../../shared/guards/jwt-auth.guard';
import { ClassRepository } from '../../classes/repositories/class.repository';
import {
  LiveSession,
  LiveSessionDetails,
  SessionStatus,
} from '../entities/live-session.entity';
import { ChatMessageRepository } from '../repositories/chat-message.repository';
import { LiveSessionRepository } from '../repositories/live-session.repository';
import { TranscriptRepository } from '../repositories/transcript.repository';

/**
 * Shared jest fakes for the sessions module specs. Not production code —
 * only imported from *.spec.ts files.
 */

export const buildSessionRepo = (): jest.Mocked<LiveSessionRepository> => ({
  create: jest.fn(),
  findById: jest.fn(),
  findDetailsById: jest.fn(),
  findByJoinToken: jest.fn(),
  findByClass: jest.fn(),
  end: jest.fn(),
});

export const buildClassRepo = (): jest.Mocked<ClassRepository> => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByInviteCode: jest.fn(),
  findByTeacher: jest.fn(),
  findByMember: jest.fn(),
  findMembers: jest.fn(),
  isMember: jest.fn(),
  addMember: jest.fn(),
  removeMember: jest.fn(),
});

export const buildTranscriptRepo = (): jest.Mocked<TranscriptRepository> => ({
  append: jest.fn(),
  findBySession: jest.fn(),
  findLast: jest.fn(),
});

export const buildChatRepo = (): jest.Mocked<ChatMessageRepository> => ({
  create: jest.fn(),
  findLast: jest.fn(),
});

export const buildSession = (over: Partial<LiveSession> = {}): LiveSession =>
  new LiveSession({
    id: 'session-1',
    title: 'Aula 1',
    teacherId: 'teacher-1',
    classId: null,
    joinToken: 'tok_abc123',
    status: SessionStatus.LIVE,
    startedAt: new Date(),
    endedAt: null,
    ...over,
  });

export const buildSessionDetails = (
  over: Partial<LiveSessionDetails> = {},
): LiveSessionDetails =>
  new LiveSessionDetails({
    ...buildSession(),
    teacherName: 'Carlos Lima',
    className: null,
    ...over,
  });

export const teacherActor: AuthUser = {
  userId: 'teacher-1',
  email: 'prof@semantia.app',
  role: UserRole.PROFESSOR,
};

export const studentActor: AuthUser = {
  userId: 'student-1',
  email: 'aluno@semantia.app',
  role: UserRole.ALUNO,
};
