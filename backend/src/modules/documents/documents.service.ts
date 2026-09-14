import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentExportLog } from './entities/document-log.entity';
import { CreditsService } from '../credits/credits.service';
import { CreateDocumentLogDto } from './dto/create-document-log.dto';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(DocumentExportLog)
    private readonly logRepo: Repository<DocumentExportLog>,
    private readonly creditsService: CreditsService,
  ) {}

  /**
   * Débite 1 crédit pour l'export d'un document (1 document = 1 crédit,
   * quel que soit le nombre de pages) puis journalise l'export.
   * Idempotent : rejouer avec le même `documentReference` ne débite
   * jamais deux fois (voir CreditsService.debitForScan).
   */
  async recordExportAndDebit(userId: string, dto: CreateDocumentLogDto) {
    const transaction = await this.creditsService.debitForScan(
      userId,
      dto.documentReference,
      `Numérisation: ${dto.fileName ?? 'document'} (${dto.pageCount} page(s))`,
    );

    // Évite de dupliquer le log si la même requête est rejouée après
    // que la transaction de crédit ait déjà été créée par un appel précédent.
    const existingLog = await this.logRepo.findOne({
      where: { creditTransactionId: transaction.id },
    });
    if (existingLog) {
      return { transaction, log: existingLog };
    }

    const log = this.logRepo.create({
      userId,
      fileName: dto.fileName,
      pageCount: dto.pageCount,
      fileSizeBytes: dto.fileSizeBytes,
      creditTransactionId: transaction.id,
      platform: dto.platform ?? 'mobile',
    });
    const saved = await this.logRepo.save(log);
    return { transaction, log: saved };
  }

  async listForUser(userId: string, limit = 50, offset = 0) {
    return this.logRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }
}
