import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Journal léger des exports de documents, à des fins statistiques et
 * d'administration UNIQUEMENT. Conformément à la priorité de
 * confidentialité du projet, le CONTENU du document (images, PDF)
 * n'est JAMAIS stocké ni transmis au backend : tout le traitement
 * (scan, recadrage, génération PDF) se fait localement sur l'appareil.
 * Seules des métadonnées non sensibles sont journalisées ici.
 */
@Entity('document_export_logs')
export class DocumentExportLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @Column({ nullable: true })
  fileName?: string;

  @Column({ type: 'int' })
  pageCount: number;

  @Column({ type: 'int', nullable: true })
  fileSizeBytes?: number;

  @Column()
  creditTransactionId: string;

  @Column({ default: 'mobile' })
  platform: string;

  @CreateDateColumn()
  createdAt: Date;
}
