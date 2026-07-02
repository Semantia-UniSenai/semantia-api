import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class JoinClassDto {
  @ApiProperty({
    example: 'K7MP2XQ9',
    description: 'Invite code shared by the teacher',
  })
  @IsString()
  @MinLength(4)
  @MaxLength(16)
  inviteCode: string;
}
