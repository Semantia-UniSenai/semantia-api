import { Injectable } from '@nestjs/common';
import { UserRole } from '../../shared/enums/user-role.enum';
import { SessionStatus } from '../sessions/entities/live-session.entity';

/** A user present in a session room (deduped across tabs/sockets). */
export interface LiveParticipant {
  userId: string;
  name: string;
  role: UserRole;
}

/** A raised hand, ordered by when it went up. */
export interface RaisedHand {
  userId: string;
  name: string;
  at: Date;
}

/** Cached session facts the gateway checks without hitting the database. */
export interface SessionMeta {
  teacherId: string;
  status: SessionStatus;
}

export interface JoinResult {
  /** True when this user was not yet present (first socket). */
  firstJoin: boolean;
}

export interface LeaveResult {
  sessionId: string;
  participant: LiveParticipant;
  /** True when the user has no sockets left in the room. */
  lastSocket: boolean;
  /** True when the (fully departed) user had a raised hand. */
  hadRaisedHand: boolean;
}

interface ParticipantEntry {
  participant: LiveParticipant;
  socketIds: Set<string>;
}

interface RoomState {
  meta: SessionMeta;
  /** userId -> entry. */
  participants: Map<string, ParticipantEntry>;
  /** userId -> hand; Map preserves raise order. */
  raisedHands: Map<string, RaisedHand>;
}

/**
 * LiveRoomStateService — in-memory presence/hand state for live rooms.
 *
 * MVP trade-off: state lives in this single process (fine for one Render
 * instance). Reconnections and multiple tabs are handled by keying
 * participants by userId and tracking every socket they own — a user only
 * "joins"/"leaves" when their first socket arrives / last socket departs.
 */
@Injectable()
export class LiveRoomStateService {
  private readonly rooms = new Map<string, RoomState>();
  /** socketId -> where that socket lives, for O(1) disconnect handling. */
  private readonly socketIndex = new Map<
    string,
    { sessionId: string; userId: string }
  >();

  join(
    sessionId: string,
    participant: LiveParticipant,
    socketId: string,
    meta: SessionMeta,
  ): JoinResult {
    let room = this.rooms.get(sessionId);
    if (!room) {
      room = { meta, participants: new Map(), raisedHands: new Map() };
      this.rooms.set(sessionId, room);
    } else {
      room.meta = meta;
    }

    let entry = room.participants.get(participant.userId);
    const firstJoin = !entry;
    if (!entry) {
      entry = { participant, socketIds: new Set() };
      room.participants.set(participant.userId, entry);
    } else {
      entry.participant = participant; // refresh name/role on reconnect
    }
    entry.socketIds.add(socketId);
    this.socketIndex.set(socketId, { sessionId, userId: participant.userId });

    return { firstJoin };
  }

  /** Removes one socket (leave or disconnect). Null if it was in no room. */
  removeSocket(socketId: string): LeaveResult | null {
    const location = this.socketIndex.get(socketId);
    if (!location) return null;
    this.socketIndex.delete(socketId);

    const room = this.rooms.get(location.sessionId);
    const entry = room?.participants.get(location.userId);
    if (!room || !entry) return null;

    entry.socketIds.delete(socketId);
    const lastSocket = entry.socketIds.size === 0;
    let hadRaisedHand = false;

    if (lastSocket) {
      room.participants.delete(location.userId);
      hadRaisedHand = room.raisedHands.delete(location.userId);
      if (room.participants.size === 0) {
        this.rooms.delete(location.sessionId);
      }
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
    userId: string,
  ): LiveParticipant | undefined {
    return this.rooms.get(sessionId)?.participants.get(userId)?.participant;
  }

  getParticipants(sessionId: string): LiveParticipant[] {
    const room = this.rooms.get(sessionId);
    if (!room) return [];
    return [...room.participants.values()].map((e) => e.participant);
  }

  /** Raises a hand. Null when not a participant or already raised (no-op). */
  raiseHand(sessionId: string, userId: string): RaisedHand | null {
    const room = this.rooms.get(sessionId);
    const entry = room?.participants.get(userId);
    if (!room || !entry) return null;
    if (room.raisedHands.has(userId)) return null;

    const hand: RaisedHand = {
      userId,
      name: entry.participant.name,
      at: new Date(),
    };
    room.raisedHands.set(userId, hand);
    return hand;
  }

  /** Lowers a hand. False when it was not raised (no-op). */
  lowerHand(sessionId: string, userId: string): boolean {
    return this.rooms.get(sessionId)?.raisedHands.delete(userId) ?? false;
  }

  /** Raised hands in the order they went up. */
  getRaisedHands(sessionId: string): RaisedHand[] {
    const room = this.rooms.get(sessionId);
    return room ? [...room.raisedHands.values()] : [];
  }

  /** Drops all room state (session ended). Returns the affected socket ids. */
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
