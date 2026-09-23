import { PrismaService } from '../../../database/prisma.service';
import { AudienceContext } from '../entities/audience-context.entity';
import { PrismaRoomSessionRepository } from './prisma-live-session.repository';

const context: AudienceContext = {
  meetingType: 'empresa',
  ageRange: 'adultos',
  portugueseFamiliarity: 'media',
  domain: 'Segurança operacional',
  simplificationLevel: 'moderada',
};

describe('PrismaRoomSessionRepository', () => {
  it('incrementa a versão do contexto na mesma atualização do JSON', async () => {
    const update = jest.fn().mockResolvedValue({
      id: 'session-1',
      title: 'Reunião semanal',
      roomId: 'room-1',
      joinToken: 'tok_test',
      status: 'LIVE',
      requiresApproval: false,
      audienceContext: context,
      audienceContextVersion: 2,
      createdAt: new Date('2026-08-10T12:00:00Z'),
      startedAt: new Date('2026-08-10T12:00:00Z'),
      endedAt: null,
    });
    const prisma = {
      roomSession: { update },
    } as unknown as PrismaService;
    const repository = new PrismaRoomSessionRepository(prisma);

    const result = await repository.updateAudienceContext('session-1', context);

    expect(update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: {
        audienceContext: { ...context },
        audienceContextVersion: { increment: 1 },
      },
    });
    expect(result.audienceContextVersion).toBe(2);
  });

  it('incrementa a versão quando updateSettings altera o contexto', async () => {
    const update = jest.fn().mockResolvedValue({
      id: 'session-1',
      title: 'Reunião semanal',
      roomId: 'room-1',
      joinToken: 'tok_test',
      status: 'LIVE',
      requiresApproval: true,
      audienceContext: context,
      audienceContextVersion: 3,
      createdAt: new Date('2026-08-10T12:00:00Z'),
      startedAt: new Date('2026-08-10T12:00:00Z'),
      endedAt: null,
    });
    const prisma = {
      roomSession: { update },
    } as unknown as PrismaService;
    const repository = new PrismaRoomSessionRepository(prisma);

    await repository.updateSettings('session-1', {
      audienceContext: context,
      requiresApproval: true,
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: {
        audienceContext: context,
        audienceContextVersion: { increment: 1 },
        requiresApproval: true,
      },
    });
  });

  it('não incrementa a versão quando updateSettings altera apenas admissão', async () => {
    const update = jest.fn().mockResolvedValue({
      id: 'session-1',
      title: 'Reunião semanal',
      roomId: 'room-1',
      joinToken: 'tok_test',
      status: 'LIVE',
      requiresApproval: true,
      audienceContext: null,
      audienceContextVersion: 0,
      createdAt: new Date('2026-08-10T12:00:00Z'),
      startedAt: new Date('2026-08-10T12:00:00Z'),
      endedAt: null,
    });
    const prisma = {
      roomSession: { update },
    } as unknown as PrismaService;
    const repository = new PrismaRoomSessionRepository(prisma);

    await repository.updateSettings('session-1', {
      requiresApproval: true,
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { requiresApproval: true },
    });
  });
});
