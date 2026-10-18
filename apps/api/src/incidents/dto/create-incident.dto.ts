import { Type } from 'class-transformer';
import { IsIn, IsLatitude, IsLongitude, IsOptional, IsString, Length } from 'class-validator';

export const emergencyTypes = ['flood', 'earthquake', 'cyclone', 'landslide', 'wildfire', 'building_fire', 'road_accident', 'medical_emergency', 'other'] as const;
export const severityLevels = ['low', 'medium', 'high', 'critical'] as const;

export class CreateIncidentDto {
  @IsIn(emergencyTypes) emergencyType!: typeof emergencyTypes[number];
  @IsIn(severityLevels) severity!: typeof severityLevels[number];
  @IsString() @Length(10, 4000) description!: string;
  @IsString() @Length(2, 180) locationLabel!: string;
  @Type(() => Number) @IsLatitude() latitude!: number;
  @Type(() => Number) @IsLongitude() longitude!: number;
  @IsOptional() @IsString() @Length(2, 1000) addressText?: string;
}
