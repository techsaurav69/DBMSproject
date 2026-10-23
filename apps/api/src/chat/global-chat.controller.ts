import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateGlobalChatMessageDto } from './dto/create-global-chat-message.dto';
import { GlobalChatService, type GlobalChatMessage } from './global-chat.service';

@ApiTags('global chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('chat/global')
export class GlobalChatController {
  constructor(private readonly chat: GlobalChatService) {}
  @Get() @ApiOperation({ summary: 'Read recent shared local coordination-chat messages' })
  list(@CurrentUser() actor: AuthenticatedUser): Promise<{ items: GlobalChatMessage[] }> { return this.chat.list(actor); }
  @Post() @ApiOperation({ summary: 'Post a message to the shared local coordination chat' })
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateGlobalChatMessageDto): Promise<GlobalChatMessage> { return this.chat.create(actor, dto); }

  @Delete() @Roles('administrator', 'coordinator') @ApiOperation({ summary: 'Clear all shared local coordination-chat messages' })
  clear(@CurrentUser() actor: AuthenticatedUser): Promise<{ deleted: number }> { return this.chat.clear(actor); }
}
