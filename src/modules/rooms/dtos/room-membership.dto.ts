import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { RoomParticipantRole } from '../entities/room.entity';

export class JoinRoomDto {
  @ApiProperty({ example: 'K7MP2XQ9' })
  @IsString()
  @MinLength(4)
  @MaxLength(64)
  inviteCode: string;
}

export class UpdateRoomMemberRoleDto {
  @ApiProperty({
    enum: [RoomParticipantRole.MODERATOR, RoomParticipantRole.PARTICIPANT],
  })
  @IsEnum([RoomParticipantRole.MODERATOR, RoomParticipantRole.PARTICIPANT])
  role: RoomParticipantRole.MODERATOR | RoomParticipantRole.PARTICIPANT;
}
