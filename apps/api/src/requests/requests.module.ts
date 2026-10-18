import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
@Module({ imports: [AuthModule, DatabaseModule], controllers: [RequestsController], providers: [RequestsService] })
export class RequestsModule {}
