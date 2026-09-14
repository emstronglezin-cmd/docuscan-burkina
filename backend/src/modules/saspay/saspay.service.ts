import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import {
  SaspayCheckoutCreateRequest,
  SaspayCheckoutSession,
  SaspaySoftpayRequest,
  SaspaySoftpayResponse,
  SaspayTransaction,
} from './saspay.types';

/**
 * Client HTTP pour l'API officielle SasPay (https://docs.saspay.me).
 *
 * IMPORTANT :
 * - La clé secrète SASPAY_API_KEY ne quitte jamais ce service : elle
 *   n'est JAMAIS exposée au frontend Flutter/PWA.
 * - Tous les endpoints utilisés ici correspondent exactement à la
 *   documentation officielle (base URL https://api.saspay.me/api/v1).
 * - Si SASPAY_API_KEY n'est pas configurée (variable vide), le service
 *   lève une erreur explicite plutôt que de simuler un paiement :
 *   ce projet ne doit jamais prétendre qu'un paiement a réussi sans
 *   appel réel à l'API.
 */
@Injectable()
export class SaspayService {
  private readonly logger = new Logger(SaspayService.name);
  private readonly saspayConfig: AppConfig['saspay'];

  constructor(private readonly configService: ConfigService) {
    this.saspayConfig = this.configService.get<AppConfig['saspay']>('saspay')!;
  }

  private assertConfigured() {
    if (!this.saspayConfig.apiKey) {
      throw new InternalServerErrorException(
        'SASPAY_API_KEY non configurée. Renseignez-la dans le fichier .env pour activer les paiements réels Saspay (voir .env.example).',
      );
    }
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    this.assertConfigured();

    const url = `${this.saspayConfig.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.saspayConfig.apiKey}`,
      'Content-Type': 'application/json',
    };
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      this.logger.error(`Erreur réseau vers Saspay (${path}): ${(err as Error).message}`);
      throw new BadGatewayException('Impossible de contacter Saspay. Réessayez plus tard.');
    }

    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      this.logger.warn(`Saspay ${method} ${path} -> ${response.status}: ${JSON.stringify(json)}`);
      const error = json as { message?: string; code?: string };
      throw new BadGatewayException({
        message: error.message ?? 'Erreur Saspay',
        code: error.code ?? 'saspay_error',
        httpStatus: response.status,
      });
    }

    return json as T;
  }

  /** POST /payments/softpay/ — push direct sur le téléphone du client */
  async initiateSoftpay(
    payload: SaspaySoftpayRequest,
    idempotencyKey: string,
  ): Promise<SaspaySoftpayResponse> {
    return this.request<SaspaySoftpayResponse>(
      'POST',
      '/payments/softpay/',
      payload,
      idempotencyKey,
    );
  }

  /** POST /checkout-sessions/ — page de paiement hébergée */
  async createCheckoutSession(
    payload: SaspayCheckoutCreateRequest,
  ): Promise<SaspayCheckoutSession> {
    // NB: Idempotency-Key n'est pas supporté par cet endpoint (doc officielle).
    return this.request<SaspayCheckoutSession>('POST', '/checkout-sessions/', payload);
  }

  /** GET /checkout-sessions/{id}/ */
  async getCheckoutSession(id: string): Promise<SaspayCheckoutSession> {
    return this.request<SaspayCheckoutSession>('GET', `/checkout-sessions/${id}/`);
  }

  /**
   * GET /payments/{payment_id}/verify/ — revérifie toujours l'état réel
   * côté gateway si le statut connu est PENDING. À utiliser pour ne
   * JAMAIS faire confiance au frontend sur le succès d'un paiement.
   */
  async verifyPayment(paymentId: string): Promise<SaspayTransaction> {
    return this.request<SaspayTransaction>('GET', `/payments/${paymentId}/verify/`);
  }

  get defaultCountry() {
    return this.saspayConfig.defaultCountry;
  }

  get defaultCurrency() {
    return this.saspayConfig.defaultCurrency;
  }

  get returnUrl() {
    return this.saspayConfig.returnUrl;
  }

  get webhookSigningSecret() {
    return this.saspayConfig.webhookSigningSecret;
  }
}
