import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum CreditTransactionType {
  PURCHASE = 'PURCHASE', // Achat de crédits (Saspay confirmé)
  SCAN = 'SCAN', // Débit d'1 crédit pour un export PDF
  REFUND = 'REFUND', // Remboursement (ex. erreur technique)
  ADMIN_ADJUSTMENT = 'ADMIN_ADJUSTMENT', // Ajustement manuel admin
}

@Entity('credit_transactions')
export class CreditTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (u) => u.creditTransactions, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @Column({ type: 'enum', enum: CreditTransactionType })
  type: CreditTransactionType;

  /**
   * Positif pour un crédit (achat, remboursement, ajustement +),
   * négatif pour un débit (scan, ajustement -).
   */
  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'int' })
  balanceBefore: number;

  @Column({ type: 'int' })
  balanceAfter: number;

  /**
   * Référence métier unique servant à l'idempotence applicative :
   * - Pour PURCHASE : reference du paiement Saspay (transaction.id)
   * - Pour SCAN : id du document exporté
   * Un index unique empêche tout double traitement (ex. webhook reçu 2 fois).
   */
  @Index({ unique: true })
  @Column()
  reference: string;

  @Column({ nullable: true })
  paymentReference?: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  adjustedByAdminId?: string;

  @CreateDateColumn()
  createdAt: Date;
}
