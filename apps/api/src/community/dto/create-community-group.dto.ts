import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

const focusAreas = ['food', 'medical', 'shelter', 'transport', 'rescue', 'community_support', 'other'] as const;

export class CreateCommunityGroupDto {
  @IsString() @MinLength(3) @MaxLength(100)
  name!: string;

  @IsIn(focusAreas)
  focusArea!: typeof focusAreas[number];

  @IsString() @MinLength(10) @MaxLength(1500)
  summary!: string;
}
