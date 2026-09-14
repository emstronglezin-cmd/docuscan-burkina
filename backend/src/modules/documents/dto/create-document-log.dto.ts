import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * DTO utilisé lorsque le client (mobile/PWA) confirme un export PDF
 * terminé LOCALEMENT et demande le débit du crédit correspondant.
 * Aucun fichier n'est envoyé : uniquement des métadonnées.
 */
export class CreateDocumentLogDto {
  @IsString()
  documentReference: string; // UUID généré côté client, unique par export -> idempotence

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsInt()
  @Min(1)
  pageCount: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  fileSizeBytes?: number;

  @IsOptional()
  @IsIn(['mobile', 'web'])
  platform?: string;
}
