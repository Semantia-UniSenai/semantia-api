import {
  RoomSession,
  RoomSessionDetails,
} from '../entities/live-session.entity';

export interface CreateRoomSessionData {
  title: string;
  roomId: string;
  joinToken: string;
}

export abstract class RoomSessionRepository {
  abstract create(data: CreateRoomSessionData): Promise<RoomSession>;
  abstract findById(id: string): Promise<RoomSession | null>;
  abstract findDetailsById(id: string): Promise<RoomSessionDetails | null>;
  abstract findByJoinToken(joinToken: string): Promise<RoomSession | null>;
  abstract findByRoom(roomId: string): Promise<RoomSession[]>;
  abstract start(id: string, startedAt: Date): Promise<RoomSession>;
  abstract end(id: string, endedAt: Date): Promise<RoomSession>;
}
