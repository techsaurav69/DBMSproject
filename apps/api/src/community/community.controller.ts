import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommunityService, type CommunityGroup, type CommunityPledge } from './community.service';
import { CreateCommunityGroupDto } from './dto/create-community-group.dto';
import { CreateCommunityPledgeDto } from './dto/create-community-pledge.dto';

@ApiTags('community aid')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('community')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get('overview') @ApiOperation({ summary: 'Read community aid groups and recorded non-payment pledges' })
  overview(@CurrentUser() actor: AuthenticatedUser): Promise<{ groups: CommunityGroup[]; pledges: CommunityPledge[] }> { return this.community.overview(actor); }

  @Post('groups') @ApiOperation({ summary: 'Create a community aid group and join as its founder' })
  createGroup(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateCommunityGroupDto): Promise<CommunityGroup> { return this.community.createGroup(actor, dto); }

  @Post('groups/:id/join') @ApiOperation({ summary: 'Join an open local community aid group' })
  joinGroup(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string): Promise<{ joined: boolean }> { return this.community.joinGroup(actor, id); }

  @Post('groups/:id/pledges') @ApiOperation({ summary: 'Record a non-payment volunteer, supply, transport, or money pledge' })
  createPledge(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreateCommunityPledgeDto): Promise<CommunityPledge> { return this.community.createPledge(actor, id, dto); }
}
