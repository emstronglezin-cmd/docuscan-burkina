import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from './modules/users/entities/user.entity';
import { CreditPacksService } from './modules/credit-packs/credit-packs.service';
import { AppConfig } from './config/configuration';

/**
 * Initialisation au démarrage :
 * - Garantit l'existence des packs de crédits par défaut.
 * - Crée un compte SUPERADMIN si ADMIN_BOOTSTRAP_EMAIL/PASSWORD sont
 *   fournis dans l'environnement et qu'aucun admin n'existe encore.
 */
@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly creditPacksService: CreditPacksService,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    try {
      await this.creditPacksService.ensureDefaults();
    } catch (err) {
      this.logger.warn(`Impossible d'initialiser les packs par défaut: ${(err as Error).message}`);
    }

    try {
      await this.ensureAdmin();
    } catch (err) {
      this.logger.warn(`Impossible d'initialiser le compte admin: ${(err as Error).message}`);
    }
  }

  private async ensureAdmin() {
    const admin = this.configService.get<AppConfig['admin']>('admin')!;
    if (!admin.bootstrapEmail || !admin.bootstrapPassword) return;

    const existing = await this.userRepo.findOne({ where: { email: admin.bootstrapEmail } });
    if (existing) return;

    const passwordHash = await bcrypt.hash(admin.bootstrapPassword, 10);
    const user = this.userRepo.create({
      email: admin.bootstrapEmail.toLowerCase(),
      passwordHash,
      role: UserRole.SUPERADMIN,
      fullName: 'Super Administrateur',
      creditBalance: 0,
      isActive: true,
    });
    await this.userRepo.save(user);
    this.logger.log(`Compte SUPERADMIN créé: ${admin.bootstrapEmail}`);
  }
}
