import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CreditPack } from '../../credit-packs/entities/credit-pack.entity';

export enum SaspayPaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum SaspayPaymentMethod {
  SOFTPAY = 'SOFTPAY',
  CHECKOUT = 'CHECKOUT',
}

/**
 * Représente une intention d'achat de crédits initiée auprès de Saspay.
 * Le crédit du compte utilisateur n'est JAMAIS déclenché par le frontend :
 * uniquement par confirmation serveur (webhook signé OU vérification
 * active via GET /payments/{id}/verify).
 */
@Entity('saspay_payments')
export class SaspayPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => CreditPack, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn()
  creditPack?: CreditPack;

  @Column({ nullable: true })
  creditPackId?: string;

  @Column({ type: 'int' })
  creditsRequested: number;

  @Column({ type: 'int' })
  amountFcfa: number;

  @Column({ type: 'enum', enum: SaspayPaymentMethod })
  method: SaspayPaymentMethod;

  /**
   * ID de la transaction ou de la session checkout renvoyé par Saspay.
   * Unique : empêche la création de deux enregistrements pour le même
   * paiement Saspay (protection anti double-traitement webhook).
   */
  @Index({ unique: true, where: '"saspayReference" IS NOT NULL' })
  @Column({ nullable: true })
  saspayReference?: string;

  @Column({ nullable: true })
  checkoutUrl?: string;

  @Column({ type: 'enum', enum: SaspayPaymentStatus, default: SaspayPaymentStatus.PENDING })
  status: SaspayPaymentStatus;

  @Column({ nullable: true })
  network?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ default: false })
  creditsApplied: boolean;

  @Column({ type: 'jsonb', nullable: true })
  rawResponse?: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  lastWebhookPayload?: Record<string, unknown>;

  @Column({ nullable: true })
  idempotencyKey?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
