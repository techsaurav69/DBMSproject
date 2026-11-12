import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CommunityMediaDto {
  @IsOptional() @IsString() @MaxLength(700000)
  logo?: string | null;

  @IsOptional() @IsString() @MaxLength(700000)
  qr?: string | null;

  @IsOptional() @IsString() @MaxLength(240)
  qrCaption?: string;
}

export class ReviewCommunityDto {
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';

  @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}

export class CommunityMessageDto {
  @IsString() @MinLength(1) @MaxLength(2000)
  body!: string;
}

export class CommunityAnnouncementDto {
  @IsString() @MaxLength(1000)
  body!: string;
}
