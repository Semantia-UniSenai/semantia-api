import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Optional ?token=<joinToken> that grants link-based access to a session. */
export class SessionTokenQueryDto {
  @ApiProperty({
    required: false,
    description: 'Join token from the shared session link',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  token?: string;
}

/** Required ?token=<joinToken> used to resolve a shared link. */
export class ResolveTokenQueryDto {
  @ApiProperty({ description: 'Join token from the shared session link' })
  @IsString()
  @MaxLength(128)
  token: string;
}
