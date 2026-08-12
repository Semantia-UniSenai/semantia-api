import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RoomParticipantRole } from '../../rooms/entities/room.entity';
import { RoomPermissionService } from '../../rooms/room-permission.service';
import { AudienceContext } from '../entities/audience-context.entity';
import { SessionStatus } from '../entities/live-session.entity';
import {
  buildRoomRepo,
  buildSession,
  buildSessionRepo,
} from '../testing/session-test.helpers';
import { UpdateSessionContextUseCase } from './update-session-context.usecase';

const context: AudienceContext = {
  meetingType: 'escola',
  ageRange: 'adolescentes',
  portugueseFamiliarity: 'media',
  domain: 'Matemática — equações do 2º grau',
  simplificationLevel: 'moderada',
};

describe('UpdateSessionContextUseCase', () => {
  const permissions = new RoomPermissionService();

  function buildUseCase() {
    const sessions = buildSessionRepo();
    const rooms = buildRoomRepo();
    const useCase = new UpdateSessionContextUseCase(
      sessions,
      rooms,
      permissions,
    );
    return { useCase, sessions, rooms };
  }

  it('atualiza o contexto quando o anfitrião age em sessão PREPARING', async () => {
    const { useCase, sessions, rooms } = buildUseCase();
    const session = buildSession({ status: SessionStatus.PREPARING });
    const updated = buildSession({
      status: SessionStatus.PREPARING,
      audienceContext: context,
    });
    sessions.findById.mockResolvedValue(session);
    rooms.getParticipantRole.mockResolvedValue(RoomParticipantRole.HOST);
    sessions.updateAudienceContext.mockResolvedValue(updated);

    const result = await useCase.execute('host-1', session.id, context);

    expect(sessions.updateAudienceContext).toHaveBeenCalledWith(
      session.id,
      context,
    );
    expect(result.audienceContext).toEqual(context);
  });

  it('rejeita quando a sessão não existe', async () => {
    const { useCase, sessions, rooms } = buildUseCase();
    sessions.findById.mockResolvedValue(null);
    rooms.getParticipantRole.mockResolvedValue(RoomParticipantRole.HOST);

    await expect(
      useCase.execute('host-1', 'nonexistent', context),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejeita quando o ator não é anfitrião nem moderador', async () => {
    const { useCase, sessions, rooms } = buildUseCase();
    sessions.findById.mockResolvedValue(buildSession());
    rooms.getParticipantRole.mockResolvedValue(RoomParticipantRole.PARTICIPANT);

    await expect(
      useCase.execute('participant-1', 'session-1', context),
    ).rejects.toThrow(ForbiddenException);
  });

  it('atualiza o contexto em sessão LIVE e retorna a nova versão', async () => {
    const { useCase, sessions, rooms } = buildUseCase();
    const session = buildSession({
      status: SessionStatus.LIVE,
      audienceContextVersion: 1,
    });
    const updated = buildSession({
      status: SessionStatus.LIVE,
      audienceContext: context,
      audienceContextVersion: 2,
    });
    sessions.findById.mockResolvedValue(session);
    rooms.getParticipantRole.mockResolvedValue(RoomParticipantRole.HOST);
    sessions.updateAudienceContext.mockResolvedValue(updated);

    const result = await useCase.execute('host-1', session.id, context);

    expect(sessions.updateAudienceContext).toHaveBeenCalledWith(
      session.id,
      context,
    );
    expect(result.audienceContext).toEqual(context);
    expect(result.audienceContextVersion).toBe(2);
  });

  it('rejeita quando a sessão já está ENDED', async () => {
    const { useCase, sessions, rooms } = buildUseCase();
    sessions.findById.mockResolvedValue(
      buildSession({ status: SessionStatus.ENDED, endedAt: new Date() }),
    );
    rooms.getParticipantRole.mockResolvedValue(RoomParticipantRole.HOST);

    await expect(
      useCase.execute('host-1', 'session-1', context),
    ).rejects.toThrow(ConflictException);
  });
});
