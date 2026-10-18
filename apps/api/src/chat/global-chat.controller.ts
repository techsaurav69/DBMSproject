import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateGlobalChatMessageDto } from './dto/create-global-chat-message.dto';
import { GlobalChatService, type GlobalChatMessage } from './global-chat.service';

@ApiTags('global chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat/global')
export class GlobalChatController {
  constructor(private readonly chat: GlobalChatService) {}
  @Get() @ApiOperation({ summary: 'Read recent shared local coordination-chat messages' })
  list(@CurrentUser() actor: AuthenticatedUser): Promise<{ items: GlobalChatMessage[] }> { return this.chat.list(actor); }
  @Post() @ApiOperation({ summary: 'Post a message to the shared local coordination chat' })
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateGlobalChatMessageDto): Promise<GlobalChatMessage> { return this.chat.create(actor, dto); }
}
