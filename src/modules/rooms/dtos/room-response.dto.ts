import { ApiProperty } from '@nestjs/swagger';
import {
  RoomParticipantRole,
  RoomSessionStatus,
} from '../entities/room.entity';

export class InstantMeetingDto {
  @ApiProperty({ format: 'uuid' })
  roomId: string;

  @ApiProperty({ format: 'uuid' })
  meetingId: string;

  @ApiProperty({ example: 'Reunião instantânea' })
  name: string;

  @ApiProperty({ description: 'Opaque invitation token for this meeting' })
  joinToken: string;

  @ApiProperty({ enum: [RoomSessionStatus.LIVE] })
  status: RoomSessionStatus.LIVE;

  @ApiProperty()
  startedAt: Date;
}

export class RoomDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Reunião de planejamento' })
  name: string;

  @ApiProperty({ format: 'uuid' })
  hostId: string;

  @ApiProperty({ example: 'K7MP2XQ9' })
  inviteCode: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class RoomSummaryDto extends RoomDto {
  @ApiProperty({ example: 'Ana Souza' })
  hostName: string;

  @ApiProperty({ example: 12 })
  memberCount: number;

  @ApiProperty({ enum: RoomParticipantRole, enumName: 'RoomParticipantRole' })
  currentUserRole: RoomParticipantRole;

  @ApiProperty({ nullable: true, format: 'uuid' })
  meetingId: string | null;

  @ApiProperty({
    nullable: true,
    enum: RoomSessionStatus,
    enumName: 'MeetingStatus',
  })
  meetingStatus: RoomSessionStatus | null;

  @ApiProperty({ nullable: true })
  startedAt: Date | null;

  @ApiProperty({ nullable: true })
  endedAt: Date | null;
}

export class RoomMemberDto {
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ example: 'Bruno Lima' })
  name: string;

  @ApiProperty({ example: 'bruno@semantia.app' })
  email: string;

  @ApiProperty({
    enum: [RoomParticipantRole.MODERATOR, RoomParticipantRole.PARTICIPANT],
  })
  role: RoomParticipantRole.MODERATOR | RoomParticipantRole.PARTICIPANT;

  @ApiProperty()
  joinedAt: Date;
}

export class RoomDetailsDto extends RoomDto {
  @ApiProperty({ example: 'Ana Souza' })
  hostName: string;

  @ApiProperty({ enum: RoomParticipantRole, enumName: 'RoomParticipantRole' })
  currentUserRole: RoomParticipantRole;

  @ApiProperty({ type: [RoomMemberDto] })
  members: RoomMemberDto[];
}
