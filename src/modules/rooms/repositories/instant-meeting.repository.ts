import { InstantMeeting } from '../entities/instant-meeting.entity';

export interface CreateInstantMeetingData {
  name: string;
  hostId: string;
  inviteCode: string;
  joinToken: string;
  startedAt: Date;
}

export abstract class InstantMeetingRepository {
  abstract create(data: CreateInstantMeetingData): Promise<InstantMeeting>;
}
