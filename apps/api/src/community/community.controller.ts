import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommunityService, type CommunityGroup, type CommunityPledge } from './community.service';
import { CreateCommunityGroupDto } from './dto/create-community-group.dto';
import { CreateCommunityPledgeDto } from './dto/create-community-pledge.dto';
import { CommunityAnnouncementDto, CommunityMediaDto, CommunityMessageDto, ReviewCommunityDto } from './dto/community-actions.dto';

@ApiTags('community aid')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('community')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get('overview') @ApiOperation({ summary: 'Read community aid groups and recorded non-payment pledges' })
  overview(@CurrentUser() actor: AuthenticatedUser) { return this.community.overview(actor); }

  @Post('groups') @ApiOperation({ summary: 'Request coordinator approval for a new community' })
  createGroup(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateCommunityGroupDto): Promise<CommunityGroup> { return this.community.createGroup(actor, dto); }

  @Post('groups/:id/join') @ApiOperation({ summary: 'Join an open local community aid group' })
  joinGroup(@CurrentUser() actor: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string): Promise<{ joined: boolean }> { return this.community.joinGroup(actor, id); }

  @Post('groups/:id/pledges') @ApiOperation({ summary: 'Record a non-payment volunteer, supply, transport, or money pledge' })
  createPledge(@CurrentUser() actor: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: CreateCommunityPledgeDto): Promise<CommunityPledge> { return this.community.createPledge(actor, id, dto); }

  @Get('groups/:id')
  group(@CurrentUser() actor: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) { return this.community.group(actor, id); }

  @Patch('groups/:id/review')
  review(@CurrentUser() actor: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ReviewCommunityDto) { return this.community.review(actor, id, dto); }

  @Patch('groups/:id/media')
  media(@CurrentUser() actor: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: CommunityMediaDto) { return this.community.updateMedia(actor, id, dto); }

  @Get('groups/:id/images/:kind')
  image(@CurrentUser() actor: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @Param('kind') kind: string) { return this.community.image(actor, id, kind); }

  @Get('groups/:id/messages')
  messages(@CurrentUser() actor: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @Query('before', new ParseUUIDPipe({ optional: true })) before?: string) { return this.community.messages(actor, id, before); }

  @Post('groups/:id/messages')
  send(@CurrentUser() actor: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: CommunityMessageDto) { return this.community.sendMessage(actor, id, dto.body); }

  @Patch('groups/:id/announcement')
  pin(@CurrentUser() actor: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: CommunityAnnouncementDto) { return this.community.pin(actor, id, dto.body); }
}
