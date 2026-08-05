import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { RoomParticipantRole } from '../../rooms/entities/room.entity';
import { GuestAccessDto } from '../dtos/guest-access.dto';
import { SessionStatus } from '../entities/live-session.entity';
import { RoomSessionRepository } from '../repositories/live-session.repository';

@Injectable()
export class CreateGuestAccessUseCase {
  constructor(
    private readonly sessions: RoomSessionRepository,
    private readonly jwt: JwtService,
  ) {}

  async execute(
    joinToken: string,
    displayName: string,
  ): Promise<GuestAccessDto> {
    const session = await this.sessions.findByJoinToken(joinToken);
    if (!session || session.status !== SessionStatus.LIVE) {
      throw new NotFoundException('Session is not available for guests');
    }
    const participantId = `guest:${randomUUID()}`;
    const name = displayName.trim();
    return {
      accessToken: await this.jwt.signAsync(
        {
          sub: participantId,
          kind: 'guest',
          sessionId: session.id,
          name,
        },
        { expiresIn: '4h' },
      ),
      sessionId: session.id,
      participant: {
        participantId,
        name,
        role: RoomParticipantRole.GUEST,
      },
    };
  }
}
