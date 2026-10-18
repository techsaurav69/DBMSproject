import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

const contributionKinds = ['volunteer_time', 'supplies', 'transport', 'money_pledge', 'other'] as const;

export class CreateCommunityPledgeDto {
  @IsIn(contributionKinds)
  contributionKind!: typeof contributionKinds[number];

  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(10_000_000)
  quantity!: number;

  @IsString() @MinLength(1) @MaxLength(50)
  unitLabel!: string;

  @IsString() @MinLength(3) @MaxLength(600)
  details!: string;
}
