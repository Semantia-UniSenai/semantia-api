export enum SessionStatus {
  PREPARING = 'PREPARING',
  LIVE = 'LIVE',
  ENDED = 'ENDED',
}

export class RoomSession {
  id: string;
  title: string;
  roomId: string;
  joinToken: string;
  status: SessionStatus;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;

  constructor(props: RoomSession) {
    Object.assign(this, props);
  }
}

export class RoomSessionDetails extends RoomSession {
  roomName: string;
  hostId: string;
  hostName: string;

  constructor(props: RoomSessionDetails) {
    super(props);
    this.roomName = props.roomName;
    this.hostId = props.hostId;
    this.hostName = props.hostName;
  }
}
