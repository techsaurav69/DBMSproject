import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSosDto } from './dto/create-sos.dto';
import { SosService, type SosSubmission } from './sos.service';

@ApiTags('SOS reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sos')
export class SosController {
  constructor(private readonly sos: SosService) {}
  @Post()
  @ApiOperation({ summary: 'Create a linked local incident and assistance request in one transaction' })
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateSosDto): Promise<SosSubmission> { return this.sos.create(actor, dto); }
}
