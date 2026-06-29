import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';
import { HealthDto } from './health.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ operationId: 'getHealth', summary: 'Liveness + DB ping' })
  @ApiResponse({ status: 200, type: HealthDto })
  async getHealth(): Promise<HealthDto> {
    const db = await this.prisma.isHealthy();
    return { status: 'ok', db };
  }
}
