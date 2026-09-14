import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CreditTransaction } from '../../credits/entities/credit-transaction.entity';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPERADMIN = 'SUPERADMIN',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  email: string;

  @Column({ select: false })
  passwordHash: string;

  @Column({ nullable: true })
  fullName?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  /**
   * Solde de crédits de l'utilisateur. Ce champ est une vue en cache
   * de la somme des CreditTransaction ; il est mis à jour de façon
   * atomique (transaction SQL) à chaque opération de crédit/débit,
   * jamais modifié directement par une requête frontend.
   */
  @Column({ type: 'int', default: 0 })
  creditBalance: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true, select: false })
  refreshTokenHash?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => CreditTransaction, (t) => t.user)
  creditTransactions: CreditTransaction[];
}
