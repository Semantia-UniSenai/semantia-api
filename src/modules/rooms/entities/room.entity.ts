export enum RoomParticipantRole {
  HOST = 'HOST',
  MODERATOR = 'MODERATOR',
  PARTICIPANT = 'PARTICIPANT',
  GUEST = 'GUEST',
}

export enum RoomSessionStatus {
  PREPARING = 'PREPARING',
  LIVE = 'LIVE',
  ENDED = 'ENDED',
}

export class Room {
  id: string;
  name: string;
  hostId: string;
  inviteCode: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: Room) {
    Object.assign(this, props);
  }
}

export class RoomSummary extends Room {
  hostName: string;
  memberCount: number;
  currentUserRole: RoomParticipantRole;
  meetingId: string | null;
  meetingStatus: RoomSessionStatus | null;
  startedAt: Date | null;
  endedAt: Date | null;

  constructor(props: RoomSummary) {
    super(props);
    this.hostName = props.hostName;
    this.memberCount = props.memberCount;
    this.currentUserRole = props.currentUserRole;
    this.meetingId = props.meetingId;
    this.meetingStatus = props.meetingStatus;
    this.startedAt = props.startedAt;
    this.endedAt = props.endedAt;
  }
}

export class RoomMemberInfo {
  userId: string;
  name: string;
  email: string;
  role: RoomParticipantRole.MODERATOR | RoomParticipantRole.PARTICIPANT;
  joinedAt: Date;

  constructor(props: RoomMemberInfo) {
    Object.assign(this, props);
  }
}

export class RoomDetails extends Room {
  hostName: string;
  currentUserRole: RoomParticipantRole;
  members: RoomMemberInfo[];

  constructor(props: RoomDetails) {
    super(props);
    this.hostName = props.hostName;
    this.currentUserRole = props.currentUserRole;
    this.members = props.members;
  }
}
