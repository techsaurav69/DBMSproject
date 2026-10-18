import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { CommunityModule } from './community/community.module';
import { ConfigModule } from './config/config.module';
import { CoordinationModule } from './coordination/coordination.module';
import { DatabaseModule } from './database/database.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthController } from './health/health.controller';
import { IntegrationsModule } from './integrations/integrations.module';
import { IncidentsModule } from './incidents/incidents.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RequestsModule } from './requests/requests.module';
import { SosModule } from './sos/sos.module';
import { UsersModule } from './users/users.module';
import { CoordinatorUpdatesModule } from './updates/coordinator-updates.module';

@Module({
  imports: [ConfigModule, DatabaseModule, AuthModule, ChatModule, CommunityModule, CoordinatorUpdatesModule, UsersModule, DashboardModule, IntegrationsModule, IncidentsModule, RequestsModule, CoordinationModule, NotificationsModule, SosModule],
  controllers: [HealthController],
})
export class AppModule {}

