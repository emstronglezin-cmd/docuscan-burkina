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

  private isValidAbsoluteUrl(value: string | undefined | null): boolean {
    if (!value) return false;
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Renvoie l'URL de retour configurée (SASPAY_RETURN_URL) après avoir
   * vérifié qu'il s'agit bien d'une URL absolue valide (http/https).
   *
   * Échoue explicitement (fail-fast) plutôt que de laisser un champ vide
   * partir vers Saspay : sans cette vérification, `JSON.stringify` omet
   * silencieusement les valeurs `undefined`, Saspay répond alors par un
   * 400 explicite (`{"error":{"return_url":["Saisissez une URL valide."]}}`)
   * qui était ensuite masqué par un 502 générique "Erreur Saspay".
   */
  getValidatedReturnUrl(): string {
    const url = this.saspayConfig.returnUrl;
    if (!this.isValidAbsoluteUrl(url)) {
      this.logger.error(
        `SASPAY_RETURN_URL est absente ou invalide (valeur actuelle: "${url}"). ` +
          "Configurez une URL absolue complète (ex: https://votre-pwa.vercel.app/paiement/retour) " +
          "dans les variables d'environnement du service backend sur Render (variable déclarée avec sync:false, " +
          'elle doit être saisie manuellement dans le dashboard Render).',
      );
      throw new InternalServerErrorException(
        "Configuration serveur invalide : SASPAY_RETURN_URL n'est pas une URL absolue valide (http/https). " +
          "Cette valeur doit être définie dans les variables d'environnement du service backend sur Render.",
      );
    }
    return url;
  }

  /**
   * Extrait un message d'erreur lisible depuis une réponse d'erreur Saspay.
   * Le format réel observé en production est :
   *   { "success": false, "error": { "<champ>": ["<message>"] }, "code": 400 }
   * c'est-à-dire un objet de validation champ -> [messages], PAS un champ
   * plat `message`. L'ancien code supposait `{ message, code }` et tombait
   * donc systématiquement sur le fallback générique "Erreur Saspay",
   * masquant la vraie raison (ex: "return_url: Saisissez une URL valide.").
   */
  private extractSaspayErrorMessage(json: Record<string, unknown>): string {
    const errorField = json['error'];

    if (typeof errorField === 'string' && errorField) {
      return errorField;
    }

    if (errorField && typeof errorField === 'object') {
      const parts: string[] = [];
      for (const [field, messages] of Object.entries(errorField as Record<string, unknown>)) {
        const text = Array.isArray(messages) ? messages.join(' ') : String(messages);
        parts.push(`${field}: ${text}`);
      }
      if (parts.length > 0) return parts.join(' | ');
    }

    const flatMessage = json['message'];
    if (typeof flatMessage === 'string' && flatMessage) {
      return flatMessage;
    }

    return 'Erreur Saspay';
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

    // Log de la requête sortante (jamais l'Authorization/API key, uniquement
    // le corps métier) pour pouvoir diagnostiquer les échecs directement
    // depuis les logs Render sans avoir à reproduire le bug en local.
    this.logger.log(`Saspay ${method} ${path} -> requête: ${JSON.stringify(body ?? {})}`);

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

    this.logger.log(`Saspay ${method} ${path} -> réponse (${response.status}): ${JSON.stringify(json)}`);

    if (!response.ok) {
      const detailedMessage = this.extractSaspayErrorMessage(json);
      this.logger.warn(`Saspay ${method} ${path} -> ${response.status}: ${JSON.stringify(json)}`);
      this.logger.error(`Détail erreur Saspay (${method} ${path}): ${detailedMessage}`);
      const error = json as { code?: string | number };
      throw new BadGatewayException({
        message: detailedMessage,
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
