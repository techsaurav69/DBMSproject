import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { CreateIncidentMessageDto } from './dto/create-incident-message.dto';
import { IncidentMessagesService, type IncidentMessage } from './incident-messages.service';
import { IncidentsService, type Incident } from './incidents.service';

@ApiTags('incidents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidents: IncidentsService, private readonly messages: IncidentMessagesService) {}

  @Post()
  @ApiOperation({ summary: 'Report an incident with a validated location' })
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateIncidentDto): Promise<Incident> { return this.incidents.create(actor, dto); }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Read the local coordination messages for an incident' })
  listMessages(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string): Promise<{ items: IncidentMessage[] }> { return this.messages.list(actor, id); }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Post a local coordination message to an incident' })
  createMessage(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreateIncidentMessageDto): Promise<IncidentMessage> { return this.messages.create(actor, id, dto); }
}
