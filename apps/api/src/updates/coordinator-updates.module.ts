import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { CoordinatorUpdatesController } from './coordinator-updates.controller';
import { CoordinatorUpdatesService } from './coordinator-updates.service';

@Module({ imports: [AuthModule, DatabaseModule], controllers: [CoordinatorUpdatesController], providers: [CoordinatorUpdatesService] })
export class CoordinatorUpdatesModule {}
