import { IsString, Length } from 'class-validator';

export class CreateIncidentMessageDto {
  @IsString() @Length(1, 2000) body!: string;
}
