import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService, type NotificationItem } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get() @ApiOperation({ summary: 'Get local in-app operational notifications' })
  list(@CurrentUser() actor: AuthenticatedUser): Promise<{ items: NotificationItem[]; unreadCount: number }> { return this.notifications.list(actor); }
  @Patch(':id/read') @ApiOperation({ summary: 'Mark one local in-app notification as read' })
  async markRead(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string): Promise<{ ok: true }> { await this.notifications.markRead(actor, id); return { ok: true }; }
  @Patch('read-all') @ApiOperation({ summary: 'Mark all current local in-app notifications as read' })
  async markAllRead(@CurrentUser() actor: AuthenticatedUser): Promise<{ ok: true }> { await this.notifications.markAllRead(actor); return { ok: true }; }
}
