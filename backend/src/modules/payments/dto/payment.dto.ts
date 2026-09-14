import { IsIn, IsOptional, IsPhoneNumber, IsString, IsUUID } from 'class-validator';

export class InitiateSoftpayDto {
  @IsUUID()
  creditPackId: string;

  @IsString()
  @IsIn([
    'moov_bf',
    'orange_bf',
    // Réseaux supplémentaires ouverts pour usage régional futur.
    'mtn_bj',
    'moov_bj',
    'celtiis_bj',
  ])
  network: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}

export class InitiateCheckoutDto {
  @IsUUID()
  creditPackId: string;
}
