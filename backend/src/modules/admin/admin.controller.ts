import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { AdminAdjustCreditsDto } from './dto/admin.dto';
import { SaspayPaymentStatus } from '../payments/entities/saspay-payment.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  async dashboard() {
    return this.adminService.dashboard();
  }

  @Get('users')
  async listUsers(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.listUsers(
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
      search,
    );
  }

  @Get('users/:id')
  async userDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Patch('users/:id/activate')
  async activate(@Param('id') id: string, @CurrentUser() admin: CurrentUserPayload) {
    return this.adminService.setUserActive(id, true, admin.userId, admin.email);
  }

  @Patch('users/:id/deactivate')
  async deactivate(@Param('id') id: string, @CurrentUser() admin: CurrentUserPayload) {
    return this.adminService.setUserActive(id, false, admin.userId, admin.email);
  }

  @Post('users/:id/adjust-credits')
  async adjustCredits(
    @Param('id') id: string,
    @Body() dto: AdminAdjustCreditsDto,
    @CurrentUser() admin: CurrentUserPayload,
  ) {
    return this.adminService.adjustCredits(id, dto.amount, dto.reason, admin.userId, admin.email);
  }

  @Get('payments')
  async payments(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: SaspayPaymentStatus,
  ) {
    return this.adminService.listPayments(
      limit ? parseInt(limit, 10) : 100,
      offset ? parseInt(offset, 10) : 0,
      status,
    );
  }

  @Get('payments/failed')
  async failedPayments() {
    return this.adminService.listFailedPayments();
  }

  @Get('audit-logs')
  async auditLogs() {
    return this.adminService.listAuditLogs();
  }
}
