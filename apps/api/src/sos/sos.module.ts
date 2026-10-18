import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { SosController } from './sos.controller';
import { SosService } from './sos.service';

@Module({ imports: [AuthModule, DatabaseModule], controllers: [SosController], providers: [SosService] })
export class SosModule {}
