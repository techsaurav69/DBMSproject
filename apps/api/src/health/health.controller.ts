import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DatabaseService } from '../database/database.service';

type HealthResponse = { database: 'reachable'; service: string; status: 'ok' };

@ApiTags('system')
@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  @ApiOperation({ summary: 'Check API and database availability' })
  async getHealth(): Promise<HealthResponse> {
    await this.database.query('SELECT 1');
    return { status: 'ok', service: 'crisisgrid-api', database: 'reachable' };
  }
}

