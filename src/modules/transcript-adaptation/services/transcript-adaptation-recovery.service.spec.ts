import { TranscriptAdaptationRepository } from '../repositories/transcript-adaptation.repository';
import { TranscriptAdaptationRecoveryService } from './transcript-adaptation-recovery.service';

describe('TranscriptAdaptationRecoveryService', () => {
  it('marca pendências anteriores ao bootstrap como interrompidas', async () => {
    const repository = {
      markStalePendingAsFallback: jest.fn().mockResolvedValue(4),
    } as unknown as jest.Mocked<TranscriptAdaptationRepository>;
    const now = new Date('2026-08-10T12:00:00Z');
    const service = new TranscriptAdaptationRecoveryService(
      repository,
      () => now,
    );

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();

    expect(repository.markStalePendingAsFallback).toHaveBeenCalledWith(now);
    expect(repository.markStalePendingAsFallback).toHaveBeenCalledTimes(1);
  });
});
