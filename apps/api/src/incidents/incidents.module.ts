import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { IncidentsController } from './incidents.controller';
import { IncidentMessagesService } from './incident-messages.service';
import { IncidentsService } from './incidents.service';

@Module({ imports: [AuthModule, DatabaseModule], controllers: [IncidentsController], providers: [IncidentsService, IncidentMessagesService] })
export class IncidentsModule {}
