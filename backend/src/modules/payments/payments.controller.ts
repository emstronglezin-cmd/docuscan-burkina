import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { InitiateCheckoutDto, InitiateSoftpayDto } from './dto/payment.dto';
import { SaspayService } from '../saspay/saspay.service';
import { isValidSaspayWebhookSignature } from '../saspay/webhook-signature.util';
import { SaspayWebhookEnvelope } from '../saspay/saspay.types';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'payments', version: '1' })
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('softpay')
  async softpay(@CurrentUser() user: CurrentUserPayload, @Body() dto: InitiateSoftpayDto) {
    this.logger.log(
      `POST /payments/softpay userId=${user.userId} creditPackId=${dto.creditPackId} network=${dto.network}`,
    );
    return this.paymentsService.initiateSoftpay(user.userId, dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('checkout')
  async checkout(@CurrentUser() user: CurrentUserPayload, @Body() dto: InitiateCheckoutDto) {
    this.logger.log(
      `POST /payments/checkout userId=${user.userId} creditPackId=${dto.creditPackId}`,
    );
    return this.paymentsService.initiateCheckout(user.userId, dto);
  }

  @Get(':id')
  async get(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.paymentsService.findByIdForUser(user.userId, id);
  }

  /**
   * Le client appelle cet endpoint pour forcer une vérification active
   * du statut réel côté Saspay (utile en complément/fallback du webhook,
   * ex. juste après retour de la page checkout). Ne fait jamais confiance
   * au frontend : revérifie toujours auprès de Saspay.
   */
  @Post(':id/verify')
  async verify(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.paymentsService.verifyAndReconcile(user.userId, id);
  }

  @Get()
  async list(@CurrentUser() user: CurrentUserPayload) {
    const payments = await this.paymentsService.listForUser(user.userId);
    return { payments };
  }
}

/**
 * Endpoint PUBLIC dédié au webhook Saspay. Aucune authentification JWT :
 * la sécurité repose exclusivement sur la vérification de la signature
 * HMAC (X-Webhook-Signature / X-Webhook-Timestamp), conformément à la
 * documentation officielle Saspay.
 */
@Controller({ path: 'webhooks/saspay', version: '1' })
export class SaspayWebhookController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly saspayService: SaspayService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  async handle(@Req() req: Request) {
    const signature = req.headers['x-webhook-signature'] as string | undefined;
    const timestamp = req.headers['x-webhook-timestamp'] as string | undefined;
    const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;

    if (!rawBody) {
      throw new BadRequestException('Corps de requête brut manquant');
    }

    const isValid = isValidSaspayWebhookSignature(
      rawBody,
      signature,
      timestamp,
      this.saspayService.webhookSigningSecret,
    );

    if (!isValid) {
      // Rejeté sans donner d'indice sur la raison précise (anti-oracle).
      throw new BadRequestException('Signature webhook invalide');
    }

    const envelope = JSON.parse(rawBody.toString('utf8')) as SaspayWebhookEnvelope;
    await this.paymentsService.handleWebhookEvent(envelope);

    return { received: true };
  }
}
