import {
  ConflictException,
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import {
  CreditTransaction,
  CreditTransactionType,
} from './entities/credit-transaction.entity';

export interface ApplyCreditChangeParams {
  userId: string;
  amount: number; // positif = crédit, négatif = débit
  type: CreditTransactionType;
  reference: string; // clé unique métier -> garantit l'idempotence
  paymentReference?: string;
  description?: string;
  adjustedByAdminId?: string;
}

/**
 * Service central de gestion des crédits.
 *
 * Garanties fournies :
 * - Atomicité : chaque changement de solde est fait dans une transaction
 *   SQL avec verrouillage pessimiste de la ligne utilisateur
 *   (SELECT ... FOR UPDATE), ce qui empêche toute situation de double
 *   crédit / double débit en cas de requêtes concurrentes.
 * - Idempotence : la colonne `reference` de CreditTransaction porte un
 *   index UNIQUE. Si la même `reference` est soumise deux fois (ex.
 *   webhook Saspay livré deux fois, ou double-clic sur "Exporter"),
 *   la deuxième tentative est détectée et n'entraîne aucune double
 *   opération : on renvoie simplement la transaction déjà existante.
 * - Pas de solde négatif : un débit est refusé si le solde est
 *   insuffisant (vérifié à l'intérieur de la même transaction verrouillée).
 */
@Injectable()
export class CreditsService {
  constructor(private readonly dataSource: DataSource) {}

  async getBalance(userId: string): Promise<number> {
    const user = await this.dataSource
      .getRepository(User)
      .findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user.creditBalance;
  }

  async getHistory(userId: string, limit = 50, offset = 0) {
    return this.dataSource.getRepository(CreditTransaction).find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Applique un changement de solde de façon atomique et idempotente.
   * Retourne la transaction créée (ou l'existante si `reference` était
   * déjà connue).
   */
  async applyCreditChange(params: ApplyCreditChangeParams): Promise<CreditTransaction> {
    const { userId, amount, type, reference } = params;
    if (amount === 0) {
      throw new BadRequestException('Le montant de la transaction ne peut pas être zéro');
    }

    return this.dataSource.transaction(async (manager) => {
      // 1. Idempotence : si cette référence a déjà été traitée, on la renvoie
      //    sans rien recalculer -> empêche tout double crédit/débit.
      const existing = await manager.getRepository(CreditTransaction).findOne({
        where: { reference },
      });
      if (existing) {
        return existing;
      }

      // 2. Verrouillage pessimiste de la ligne utilisateur : toute autre
      //    transaction concurrente touchant ce même utilisateur attend
      //    ici, ce qui garantit qu'aucune lecture de balanceBefore n'est
      //    faite sur une valeur périmée.
      const user = await manager
        .getRepository(User)
        .createQueryBuilder('user')
        .setLock('pessimistic_write')
        .where('user.id = :userId', { userId })
        .getOne();

      if (!user) {
        throw new NotFoundException('Utilisateur introuvable');
      }

      const balanceBefore = user.creditBalance;
      const balanceAfter = balanceBefore + amount;

      if (balanceAfter < 0) {
        throw new ConflictException({
          code: 'insufficient_credits',
          message: `Crédits insuffisants. Solde actuel: ${balanceBefore}, requis: ${Math.abs(amount)}`,
          balance: balanceBefore,
          required: Math.abs(amount),
        });
      }

      user.creditBalance = balanceAfter;
      await manager.getRepository(User).save(user);

      const transaction = manager.getRepository(CreditTransaction).create({
        userId,
        type,
        amount,
        balanceBefore,
        balanceAfter,
        reference,
        paymentReference: params.paymentReference,
        description: params.description,
        adjustedByAdminId: params.adjustedByAdminId,
      });

      try {
        return await manager.getRepository(CreditTransaction).save(transaction);
      } catch (err: unknown) {
        // Contrainte unique violée par une requête concurrente exactement
        // simultanée -> quelqu'un d'autre a gagné la course, on renvoie
        // son résultat plutôt que d'échouer bêtement.
        const pgError = err as { code?: string };
        if (pgError.code === '23505') {
          const winner = await manager.getRepository(CreditTransaction).findOne({
            where: { reference },
          });
          if (winner) return winner;
        }
        throw err;
      }
    });
  }

  /** Débite 1 crédit pour l'export d'un document (idempotent par documentId). */
  async debitForScan(userId: string, documentReference: string, description?: string) {
    return this.applyCreditChange({
      userId,
      amount: -1,
      type: CreditTransactionType.SCAN,
      reference: `scan:${documentReference}`,
      description: description ?? 'Numérisation document',
    });
  }

  /** Crédite des crédits après confirmation Saspay réussie (idempotent par saspayReference). */
  async creditForPurchase(
    userId: string,
    credits: number,
    saspayReference: string,
    description?: string,
  ) {
    return this.applyCreditChange({
      userId,
      amount: credits,
      type: CreditTransactionType.PURCHASE,
      reference: `purchase:${saspayReference}`,
      paymentReference: saspayReference,
      description: description ?? `Achat de ${credits} crédit(s)`,
    });
  }

  /** Ajustement manuel admin, toujours tracé (idempotent par une clé fournie par l'appelant). */
  async adminAdjust(
    userId: string,
    amount: number,
    adminId: string,
    reason: string,
    idempotencyKey: string,
  ) {
    return this.applyCreditChange({
      userId,
      amount,
      type: CreditTransactionType.ADMIN_ADJUSTMENT,
      reference: `admin:${idempotencyKey}`,
      description: reason,
      adjustedByAdminId: adminId,
    });
  }
}
