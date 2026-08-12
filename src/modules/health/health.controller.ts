import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';
import { TranscriptAdaptationRuntimeConfig } from '../transcript-adaptation/config/transcript-adaptation.config';
import { HealthDto } from './health.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transcriptAdaptation: TranscriptAdaptationRuntimeConfig,
  ) {}

  @Get()
  @ApiOperation({ operationId: 'getHealth', summary: 'Liveness + DB ping' })
  @ApiResponse({ status: 200, type: HealthDto })
  async getHealth(): Promise<HealthDto> {
    const db = await this.prisma.isHealthy();
    const adaptation = this.transcriptAdaptation.toPublicState();
    return {
      status: 'ok',
      db,
      transcriptAdaptation: {
        enabled: adaptation.enabled,
        provider: adaptation.provider,
        state: adaptation.state,
        model: adaptation.model,
        promptVersion: adaptation.promptVersion,
      },
    };
  }
}
