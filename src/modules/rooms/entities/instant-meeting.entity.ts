import { RoomSessionStatus } from './room.entity';

export class InstantMeeting {
  roomId: string;
  meetingId: string;
  name: string;
  joinToken: string;
  status: RoomSessionStatus.LIVE;
  startedAt: Date;

  constructor(props: InstantMeeting) {
    Object.assign(this, props);
  }
}
