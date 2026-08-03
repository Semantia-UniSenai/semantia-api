import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { RoomParticipantRole } from '../../rooms/entities/room.entity';

export class CreateGuestAccessDto {
  @ApiProperty({ description: 'Session join token from the invite link' })
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  joinToken: string;

  @ApiProperty({ example: 'Bruno Lima' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName: string;
}

export class GuestParticipantDto {
  @ApiProperty()
  participantId: string;

  @ApiProperty({ example: 'Bruno Lima' })
  name: string;

  @ApiProperty({ enum: [RoomParticipantRole.GUEST] })
  role: RoomParticipantRole.GUEST;
}

export class GuestAccessDto {
  @ApiProperty({ description: 'Short-lived token restricted to one session' })
  accessToken: string;

  @ApiProperty({ format: 'uuid' })
  sessionId: string;

  @ApiProperty({ type: GuestParticipantDto })
  participant: GuestParticipantDto;
}
