import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

/**
 * Petit wrapper autour du repository User pour éviter une dépendance
 * circulaire directe entre PaymentsModule et UsersModule.
 */
@Injectable()
export class UsersRepositoryLite {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }
}
