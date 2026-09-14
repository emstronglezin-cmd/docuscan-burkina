import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { CreditsService } from './credits.service';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'credits', version: '1' })
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Get('balance')
  async balance(@CurrentUser() user: CurrentUserPayload) {
    const balance = await this.creditsService.getBalance(user.userId);
    return { balance };
  }

  @Get('history')
  async history(
    @CurrentUser() user: CurrentUserPayload,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const transactions = await this.creditsService.getHistory(
      user.userId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
    return { transactions };
  }
}
