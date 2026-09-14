import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class AdminAdjustCreditsDto {
  @IsInt()
  amount: number; // positif = ajout, négatif = retrait

  @IsString()
  @IsNotEmpty()
  reason: string;
}
