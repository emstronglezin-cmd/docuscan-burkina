import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { User } from './entities/user.entity';
import { NotFoundException } from '@nestjs/common';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(@InjectRepository(User) private readonly userRepo: Repository<User>) {}

  @Get('me')
  async me(@CurrentUser() currentUser: CurrentUserPayload) {
    const user = await this.userRepo.findOne({ where: { id: currentUser.userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    const { passwordHash, refreshTokenHash, ...safe } = user;
    return safe;
  }
}
