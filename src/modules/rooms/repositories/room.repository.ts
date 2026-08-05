import {
  Room,
  RoomMemberInfo,
  RoomParticipantRole,
  RoomSummary,
} from '../entities/room.entity';

export interface CreateRoomData {
  name: string;
  hostId: string;
  inviteCode: string;
}

export abstract class RoomRepository {
  abstract create(data: CreateRoomData): Promise<Room>;
  abstract findById(id: string): Promise<Room | null>;
  abstract findByInviteCode(inviteCode: string): Promise<Room | null>;
  abstract listAccessible(userId: string): Promise<RoomSummary[]>;
  abstract findMembers(roomId: string): Promise<RoomMemberInfo[]>;
  abstract getParticipantRole(
    roomId: string,
    userId: string,
  ): Promise<RoomParticipantRole | null>;
  abstract addMember(roomId: string, userId: string): Promise<void>;
  abstract updateName(roomId: string, name: string): Promise<Room>;
  abstract updateMemberRole(
    roomId: string,
    userId: string,
    role: RoomParticipantRole.MODERATOR | RoomParticipantRole.PARTICIPANT,
  ): Promise<void>;
  abstract removeMember(roomId: string, userId: string): Promise<boolean>;
}
