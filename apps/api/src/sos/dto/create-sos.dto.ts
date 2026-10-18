import { Type } from 'class-transformer';
import { IsIn, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, Length, Min } from 'class-validator';
import { emergencyTypes, severityLevels } from '../../incidents/dto/create-incident.dto';
import { requestCategories } from '../../requests/dto/create-request.dto';

export class CreateSosDto {
  @IsIn(emergencyTypes) emergencyType!: typeof emergencyTypes[number];
  @IsIn(severityLevels) severity!: typeof severityLevels[number];
  @IsIn(requestCategories) category!: typeof requestCategories[number];
  @IsString() @Length(10, 4000) description!: string;
  @IsString() @Length(2, 180) locationLabel!: string;
  @Type(() => Number) @IsLatitude() latitude!: number;
  @Type(() => Number) @IsLongitude() longitude!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) peopleCount?: number;
  @IsOptional() @IsString() @Length(2, 1000) addressText?: string;
}
