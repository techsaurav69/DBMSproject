import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class DispatchVehicleDto {
  @IsUUID() requestId!: string;
  @IsUUID() vehicleId!: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class ReserveInventoryDto {
  @IsUUID() requestId!: string;
  @IsUUID() inventoryId!: string;
  @IsInt() @Min(1) @Max(100000) quantity!: number;
}

export class ReserveShelterDto {
  @IsUUID() requestId!: string;
  @IsUUID() shelterId!: string;
  @IsInt() @Min(1) @Max(100000) peopleCount!: number;
}

export const assignmentStatuses = ['accepted', 'en_route', 'on_scene', 'completed', 'cancelled', 'failed'] as const;
export class UpdateAssignmentStatusDto { @IsIn(assignmentStatuses) status!: typeof assignmentStatuses[number]; }
