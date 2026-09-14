import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditPack } from './entities/credit-pack.entity';

@Injectable()
export class CreditPacksService {
  constructor(
    @InjectRepository(CreditPack) private readonly packRepo: Repository<CreditPack>,
  ) {}

  async findActive(): Promise<CreditPack[]> {
    return this.packRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }

  async findAllForAdmin(): Promise<CreditPack[]> {
    return this.packRepo.find({ order: { sortOrder: 'ASC' } });
  }

  async findOne(id: string): Promise<CreditPack> {
    const pack = await this.packRepo.findOne({ where: { id } });
    if (!pack) throw new NotFoundException('Pack de crédits introuvable');
    return pack;
  }

  async create(data: Partial<CreditPack>): Promise<CreditPack> {
    const pack = this.packRepo.create(data);
    return this.packRepo.save(pack);
  }

  async update(id: string, data: Partial<CreditPack>): Promise<CreditPack> {
    await this.findOne(id);
    await this.packRepo.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.packRepo.delete(id);
  }

  /** Utilisé au démarrage pour garantir qu'au moins les packs par défaut existent. */
  async ensureDefaults(): Promise<void> {
    const count = await this.packRepo.count();
    if (count > 0) return;

    const defaults: Partial<CreditPack>[] = [
      { name: '1 crédit', credits: 1, priceFcfa: 50, sortOrder: 1 },
      { name: '5 crédits', credits: 5, priceFcfa: 250, sortOrder: 2 },
      { name: '10 crédits', credits: 10, priceFcfa: 500, sortOrder: 3, isPopular: true },
      { name: '20 crédits', credits: 20, priceFcfa: 1000, sortOrder: 4 },
    ];
    await this.packRepo.save(this.packRepo.create(defaults));
  }
}
