import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CoordinatorUpdatesService, type CoordinatorUpdate } from './coordinator-updates.service';
import { CreateCoordinatorUpdateDto } from './dto/create-coordinator-update.dto';

@ApiTags('coordinator updates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('coordinator-updates')
export class CoordinatorUpdatesController {
  constructor(private readonly updates: CoordinatorUpdatesService) {}

  @Get(':scope')
  @ApiOperation({ summary: 'Read shared coordinator updates for an operational section' })
  list(@Param('scope') scope: string): Promise<{ items: CoordinatorUpdate[] }> { return this.updates.list(scope); }

  @Post(':scope')
  @Roles('administrator', 'coordinator')
  @ApiOperation({ summary: 'Post a shared update for coordinators and citizens to view' })
  create(@CurrentUser() actor: AuthenticatedUser, @Param('scope') scope: string, @Body() dto: CreateCoordinatorUpdateDto): Promise<CoordinatorUpdate> { return this.updates.create(actor, scope, dto); }
}
