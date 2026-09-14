import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Pack de crédits configurable depuis l'administration.
 * Les prix ne sont JAMAIS codés en dur dans le frontend :
 * l'app mobile/PWA récupère la liste des packs actifs via l'API
 * publique GET /credit-packs.
 */
@Entity('credit_packs')
export class CreditPack {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'int' })
  credits: number;

  @Column({ type: 'int' })
  priceFcfa: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ default: false })
  isPopular: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
