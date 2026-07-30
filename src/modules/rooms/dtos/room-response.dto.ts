import { ApiProperty } from '@nestjs/swagger';
import { RoomParticipantRole } from '../entities/room.entity';

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
