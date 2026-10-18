import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';
import { severityLevels } from '../../incidents/dto/create-incident.dto';

export const requestCategories = ['medical', 'rescue', 'evacuation', 'food', 'water', 'shelter', 'other'] as const;
export const requestStatuses = ['open', 'triaged', 'assigned', 'in_progress', 'fulfilled', 'cancelled', 'closed'] as const;

export class CreateRequestDto {
  @IsUUID() incidentId!: string;
  @IsIn(requestCategories) category!: typeof requestCategories[number];
  @IsIn(severityLevels) urgency!: typeof severityLevels[number];
  @IsString() @Length(10, 4000) description!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) peopleCount?: number;
}

export class UpdateRequestStatusDto { @IsIn(requestStatuses) status!: typeof requestStatuses[number]; }
