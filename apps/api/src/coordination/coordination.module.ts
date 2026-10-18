import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { CoordinationController } from './coordination.controller';
import { CoordinationService } from './coordination.service';

@Module({ imports: [AuthModule, DatabaseModule], controllers: [CoordinationController], providers: [CoordinationService] })
export class CoordinationModule {}
