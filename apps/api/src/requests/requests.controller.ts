import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateRequestDto, UpdateRequestStatusDto } from './dto/create-request.dto';
import { RequestsService, type AssistanceRequest } from './requests.service';

@ApiTags('assistance requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('requests')
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}
  @Post() @ApiOperation({ summary: 'Create an assistance request for a reported incident' })
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateRequestDto): Promise<AssistanceRequest> { return this.requests.create(actor, dto); }
  @Patch(':id/status') @UseGuards(RolesGuard) @Roles('administrator', 'coordinator', 'citizen') @ApiOperation({ summary: 'Advance an assistance request through an allowed status transition' })
  updateStatus(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateRequestStatusDto): Promise<AssistanceRequest> { return this.requests.updateStatus(actor, id, dto); }
}
