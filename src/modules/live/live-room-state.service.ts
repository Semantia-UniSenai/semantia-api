import { Injectable } from '@nestjs/common';
import { RoomParticipantRole } from '../rooms/entities/room.entity';
import { SessionStatus } from '../sessions/entities/live-session.entity';

export interface LiveParticipant {
  participantId: string;
  name: string;
  role: RoomParticipantRole;
}

export interface RaisedHand {
  participantId: string;
  name: string;
  at: Date;
}

export interface SessionMeta {
  status: SessionStatus;
}

interface ParticipantEntry {
  participant: LiveParticipant;
  socketIds: Set<string>;
}

interface RoomState {
  meta: SessionMeta;
  participants: Map<string, ParticipantEntry>;
  raisedHands: Map<string, RaisedHand>;
}

@Injectable()
export class LiveRoomStateService {
  private readonly rooms = new Map<string, RoomState>();
  private readonly socketIndex = new Map<
    string,
    { sessionId: string; participantId: string }
  >();

  join(
    sessionId: string,
    participant: LiveParticipant,
    socketId: string,
    meta: SessionMeta,
  ): { firstJoin: boolean } {
    let room = this.rooms.get(sessionId);
    if (!room) {
      room = { meta, participants: new Map(), raisedHands: new Map() };
      this.rooms.set(sessionId, room);
    } else {
      room.meta = meta;
    }
    let entry = room.participants.get(participant.participantId);
    const firstJoin = !entry;
    if (!entry) {
      entry = { participant, socketIds: new Set() };
      room.participants.set(participant.participantId, entry);
    } else {
      entry.participant = participant;
    }
    entry.socketIds.add(socketId);
    this.socketIndex.set(socketId, {
      sessionId,
      participantId: participant.participantId,
    });
    return { firstJoin };
  }

  removeSocket(socketId: string): {
    sessionId: string;
    participant: LiveParticipant;
    lastSocket: boolean;
    hadRaisedHand: boolean;
  } | null {
    const location = this.socketIndex.get(socketId);
    if (!location) return null;
    this.socketIndex.delete(socketId);
    const room = this.rooms.get(location.sessionId);
    const entry = room?.participants.get(location.participantId);
    if (!room || !entry) return null;
    entry.socketIds.delete(socketId);
    const lastSocket = entry.socketIds.size === 0;
    let hadRaisedHand = false;
    if (lastSocket) {
      room.participants.delete(location.participantId);
      hadRaisedHand = room.raisedHands.delete(location.participantId);
      if (room.participants.size === 0) this.rooms.delete(location.sessionId);
    }
    return {
      sessionId: location.sessionId,
      participant: entry.participant,
      lastSocket,
      hadRaisedHand,
    };
  }

  getMeta(sessionId: string): SessionMeta | undefined {
    return this.rooms.get(sessionId)?.meta;
  }

  markEnded(sessionId: string): void {
    const room = this.rooms.get(sessionId);
    if (room) room.meta.status = SessionStatus.ENDED;
  }

  getParticipant(
    sessionId: string,
    participantId: string,
  ): LiveParticipant | undefined {
    return this.rooms.get(sessionId)?.participants.get(participantId)
      ?.participant;
  }

  getParticipants(sessionId: string): LiveParticipant[] {
    const room = this.rooms.get(sessionId);
    return room
      ? [...room.participants.values()].map((entry) => entry.participant)
      : [];
  }

  raiseHand(sessionId: string, participantId: string): RaisedHand | null {
    const room = this.rooms.get(sessionId);
    const entry = room?.participants.get(participantId);
    if (!room || !entry || room.raisedHands.has(participantId)) return null;
    const hand = {
      participantId,
      name: entry.participant.name,
      at: new Date(),
    };
    room.raisedHands.set(participantId, hand);
    return hand;
  }

  lowerHand(sessionId: string, participantId: string): boolean {
    return (
      this.rooms.get(sessionId)?.raisedHands.delete(participantId) ?? false
    );
  }

  getRaisedHands(sessionId: string): RaisedHand[] {
    const room = this.rooms.get(sessionId);
    return room ? [...room.raisedHands.values()] : [];
  }

  closeSession(sessionId: string): string[] {
    const room = this.rooms.get(sessionId);
    if (!room) return [];
    const socketIds: string[] = [];
    for (const entry of room.participants.values()) {
      for (const socketId of entry.socketIds) {
        socketIds.push(socketId);
        this.socketIndex.delete(socketId);
      }
    }
    this.rooms.delete(sessionId);
    return socketIds;
  }
}
