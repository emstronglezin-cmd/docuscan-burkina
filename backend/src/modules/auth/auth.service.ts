import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../users/entities/user.entity';
import { AppConfig } from '../../config/configuration';
import { RegisterDto, LoginDto } from './dto/auth.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly jwtConfig: AppConfig['jwt'];

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.jwtConfig = this.configService.get<AppConfig['jwt']>('jwt')!;
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.jwtConfig.accessSecret,
      expiresIn: this.jwtConfig.accessExpiresIn as any,
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.jwtConfig.refreshSecret,
      expiresIn: this.jwtConfig.refreshExpiresIn as any,
    });

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.userRepo.update(user.id, { refreshTokenHash });

    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto): Promise<{ user: Partial<User>; tokens: AuthTokens }> {
    const existing = await this.userRepo.findOne({ where: { email: dto.email.toLowerCase() } });
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet email');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      fullName: dto.fullName,
      phone: dto.phone,
      role: UserRole.USER,
      creditBalance: 0,
    });
    const saved = await this.userRepo.save(user);
    const tokens = await this.issueTokens(saved);

    return { user: this.sanitize(saved), tokens };
  }

  async login(dto: LoginDto): Promise<{ user: Partial<User>; tokens: AuthTokens }> {
    const user = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase() },
      select: ['id', 'email', 'passwordHash', 'role', 'creditBalance', 'fullName', 'phone', 'isActive', 'createdAt', 'updatedAt'],
    });
    if (!user) throw new UnauthorizedException('Email ou mot de passe incorrect');
    if (!user.isActive) throw new UnauthorizedException('Compte désactivé');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Email ou mot de passe incorrect');

    const tokens = await this.issueTokens(user);
    return { user: this.sanitize(user), tokens };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: { sub: string; email: string; role: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.jwtConfig.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalide ou expiré');
    }

    const user = await this.userRepo.findOne({
      where: { id: payload.sub },
      select: ['id', 'email', 'role', 'refreshTokenHash', 'isActive'],
    });
    if (!user || !user.refreshTokenHash || !user.isActive) {
      throw new UnauthorizedException('Session invalide');
    }

    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matches) throw new UnauthorizedException('Session invalide');

    return this.issueTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.userRepo.update(userId, { refreshTokenHash: undefined });
  }

  private sanitize(user: User): Partial<User> {
    const { passwordHash, refreshTokenHash, ...rest } = user;
    return rest;
  }
}
