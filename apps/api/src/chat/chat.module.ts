import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { GlobalChatController } from './global-chat.controller';
import { GlobalChatService } from './global-chat.service';

@Module({ imports: [AuthModule, DatabaseModule], controllers: [GlobalChatController], providers: [GlobalChatService] })
export class ChatModule {}
