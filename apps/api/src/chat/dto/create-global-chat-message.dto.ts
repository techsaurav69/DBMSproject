import { IsString, Length } from 'class-validator';

export class CreateGlobalChatMessageDto {
  @IsString() @Length(1, 1000) body!: string;
}
