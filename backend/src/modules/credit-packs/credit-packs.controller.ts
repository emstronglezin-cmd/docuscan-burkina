import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CreditPacksService } from './credit-packs.service';
import { CreateCreditPackDto, UpdateCreditPackDto } from './dto/credit-pack.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

/**
 * Endpoint PUBLIC : la liste des packs et leurs prix ne sont jamais
 * codés en dur dans le frontend Flutter/PWA, ils sont récupérés ici.
 */
@Controller({ path: 'credit-packs', version: '1' })
export class CreditPacksController {
  constructor(private readonly service: CreditPacksService) {}

  @Get()
  async list() {
    const packs = await this.service.findActive();
    return { packs };
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
@Controller({ path: 'admin/credit-packs', version: '1' })
export class AdminCreditPacksController {
  constructor(private readonly service: CreditPacksService) {}

  @Get()
  async listAll() {
    const packs = await this.service.findAllForAdmin();
    return { packs };
  }

  @Post()
  async create(@Body() dto: CreateCreditPackDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCreditPackDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { success: true };
  }
}
