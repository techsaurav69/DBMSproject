import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { UsersController } from './users.controller';

@Module({ imports: [AuthModule, DatabaseModule], controllers: [UsersController] })
export class UsersModule {}
