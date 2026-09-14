import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateCreditPackDto {
  @IsString()
  name: string;

  @IsInt()
  @Min(1)
  credits: number;

  @IsInt()
  @Min(1)
  priceFcfa: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateCreditPackDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  credits?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  priceFcfa?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
