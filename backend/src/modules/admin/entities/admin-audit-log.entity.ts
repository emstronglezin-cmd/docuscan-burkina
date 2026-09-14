import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Traçabilité de toutes les actions administratives sensibles
 * (ajustement manuel de crédits, activation/désactivation utilisateur,
 * modification des packs, etc.)
 */
@Entity('admin_audit_logs')
export class AdminAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  adminId: string;

  @Column()
  adminEmail: string;

  @Column()
  action: string;

  @Column({ nullable: true })
  targetUserId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}
