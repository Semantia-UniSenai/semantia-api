import type { AuthUser } from '../../../shared/guards/jwt-auth.guard';
import { RoomParticipantRole } from '../../rooms/entities/room.entity';
import { RoomRepository } from '../../rooms/repositories/room.repository';
import {
  RoomSession,
  RoomSessionDetails,
  SessionStatus,
} from '../entities/live-session.entity';
import { ChatMessageRepository } from '../repositories/chat-message.repository';
import { RoomSessionRepository } from '../repositories/live-session.repository';
import { TranscriptRepository } from '../repositories/transcript.repository';

export const buildSessionRepo = (): jest.Mocked<RoomSessionRepository> => ({
  create: jest.fn(),
  findById: jest.fn(),
  findDetailsById: jest.fn(),
  findByJoinToken: jest.fn(),
  findByRoom: jest.fn(),
  start: jest.fn(),
  end: jest.fn(),
  updateAudienceContext: jest.fn(),
  updateSettings: jest.fn(),
});

export const buildRoomRepo = (): jest.Mocked<RoomRepository> => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByInviteCode: jest.fn(),
  listAccessible: jest.fn(),
  findMembers: jest.fn(),
  getParticipantRole: jest.fn(),
  addMember: jest.fn(),
  updateName: jest.fn(),
  updateMemberRole: jest.fn(),
  removeMember: jest.fn(),
});

export const buildTranscriptRepo = (): jest.Mocked<TranscriptRepository> => ({
  append: jest.fn(),
  findByClientSegmentId: jest.fn(),
  findBySession: jest.fn(),
  findLast: jest.fn(),
});

export const buildChatRepo = (): jest.Mocked<ChatMessageRepository> => ({
  create: jest.fn(),
  findLast: jest.fn(),
});

export const buildSession = (over: Partial<RoomSession> = {}): RoomSession =>
  new RoomSession({
    id: 'session-1',
    title: 'Reunião semanal',
    roomId: 'room-1',
    joinToken: 'tok_abc1234567890',
    status: SessionStatus.PREPARING,
    requiresApproval: false,
    audienceContext: null,
    createdAt: new Date('2026-07-30T12:00:00Z'),
    startedAt: null,
    endedAt: null,
    ...over,
  });

export const buildSessionDetails = (
  over: Partial<RoomSessionDetails> = {},
): RoomSessionDetails =>
  new RoomSessionDetails({
    ...buildSession(),
    roomName: 'Planejamento',
    hostId: 'host-1',
    hostName: 'Ana Souza',
    ...over,
  });

export const hostActor: AuthUser = {
  userId: 'host-1',
  email: 'host@semantia.app',
};

export const participantActor: AuthUser = {
  userId: 'participant-1',
  email: 'participant@semantia.app',
};

export const managerRoles = [
  RoomParticipantRole.HOST,
  RoomParticipantRole.MODERATOR,
];
