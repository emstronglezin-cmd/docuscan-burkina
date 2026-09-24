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
  SaspayCheckoutSessionResponse,
  SaspaySoftpayRequest,
  SaspaySoftpayResponse,
  SaspayTransaction,
  SaspayTransactionStatus,
} from './saspay.types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function optionalStringOrNull(value: unknown): string | null | undefined {
  return value === null ? null : optionalString(value);
}

function isTransactionStatus(value: unknown): value is SaspayTransactionStatus {
  return value === 'PENDING' || value === 'SUCCESS' || value === 'FAILED' || value === 'CANCELLED';
}

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
          'Configurez une URL absolue complète (ex: https://votre-pwa.vercel.app/paiement/retour) ' +
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
  private extractSaspayErrorMessage(json: unknown): string {
    if (!isRecord(json)) return 'Erreur Saspay';

    const errorField = json['error'];
    if (typeof errorField === 'string' && errorField) {
      return errorField;
    }

    if (isRecord(errorField)) {
      const parts: string[] = [];
      for (const [field, messages] of Object.entries(errorField)) {
        const text = Array.isArray(messages)
          ? messages.map((message) => String(message)).join(' ')
          : String(messages);
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

  /**
   * Valide l'enveloppe observée en production et renvoie explicitement `data`.
   * Ne jamais typer directement la réponse HTTP complète comme une session :
   * cela ferait lire `response.id` au lieu de `response.data.id`.
   */
  private parseCheckoutSessionResponse(value: unknown): SaspayCheckoutSessionResponse {
    if (!isRecord(value) || value['success'] !== true || !isRecord(value['data'])) {
      this.throwInvalidCheckoutResponse(
        'SASPAY a créé la session checkout mais a renvoyé une enveloppe de réponse invalide',
      );
    }

    const responseData = value['data'];
    const id = responseData['id'];
    if (!isNonEmptyString(id)) {
      this.throwInvalidCheckoutResponse('SASPAY checkout session created but data.id is missing');
    }

    const checkoutUrl = responseData['checkout_url'];
    if (!isNonEmptyString(checkoutUrl)) {
      this.throwInvalidCheckoutResponse(
        'SASPAY checkout session created but data.checkout_url is missing',
      );
    }
    if (!this.isValidAbsoluteUrl(checkoutUrl)) {
      this.throwInvalidCheckoutResponse(
        'SASPAY checkout session created but data.checkout_url is invalid',
      );
    }

    const status = responseData['status'];
    if (!isTransactionStatus(status)) {
      this.throwInvalidCheckoutResponse(
        'SASPAY checkout session created but data.status is missing or invalid',
      );
    }

    const amount = responseData['amount'];
    const currency = responseData['currency'];
    if (!isNonEmptyString(amount) || !isNonEmptyString(currency)) {
      this.throwInvalidCheckoutResponse(
        'SASPAY checkout session created but data.amount or data.currency is missing',
      );
    }

    const code = value['code'];
    if (typeof code !== 'number') {
      this.throwInvalidCheckoutResponse(
        'SASPAY checkout session created but the response code is missing or invalid',
      );
    }

    const metadata = responseData['metadata'];
    const session: SaspayCheckoutSession = {
      id,
      merchant: optionalString(responseData['merchant']),
      created_by_member: optionalStringOrNull(responseData['created_by_member']),
      slug: optionalString(responseData['slug']),
      checkout_url: checkoutUrl,
      amount,
      currency,
      description: optionalString(responseData['description']),
      country: optionalString(responseData['country']),
      customer_email: optionalString(responseData['customer_email']),
      customer_name: optionalString(responseData['customer_name']),
      customer_phone: optionalString(responseData['customer_phone']),
      return_url: optionalString(responseData['return_url']),
      metadata: isRecord(metadata) ? metadata : undefined,
      status,
      expires_at: optionalStringOrNull(responseData['expires_at']),
      transaction: optionalStringOrNull(responseData['transaction']),
      payment_link: optionalStringOrNull(responseData['payment_link']),
      paid_at: optionalStringOrNull(responseData['paid_at']),
      created_at: optionalString(responseData['created_at']),
      updated_at: optionalString(responseData['updated_at']),
    };

    return { success: true, data: session, code };
  }

  private throwInvalidCheckoutResponse(message: string): never {
    this.logger.error(message);
    throw new BadGatewayException(message);
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

    // Ne jamais journaliser le corps : il contient l'email, le téléphone et
    // les métadonnées du client. Les logs gardent uniquement la route et le statut.
    this.logger.log(`Saspay ${method} ${path} -> envoi`);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'erreur réseau inconnue';
      this.logger.error(`Erreur réseau vers Saspay (${path}): ${message}`);
      throw new BadGatewayException('Impossible de contacter Saspay. Réessayez plus tard.');
    }

    const json: unknown = await response.json().catch(() => ({}));
    this.logger.log(`Saspay ${method} ${path} -> HTTP ${response.status}`);

    if (!response.ok) {
      const detailedMessage = this.extractSaspayErrorMessage(json);
      this.logger.warn(`Saspay ${method} ${path} -> HTTP ${response.status}`);
      this.logger.error(`Détail erreur Saspay (${method} ${path}): ${detailedMessage}`);
      const providerCode = isRecord(json) ? json['code'] : undefined;
      throw new BadGatewayException({
        message: detailedMessage,
        code:
          typeof providerCode === 'string' || typeof providerCode === 'number'
            ? providerCode
            : 'saspay_error',
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

  /** POST /checkout-sessions/ — page de paiement hébergée. Retourne `response.data`. */
  async createCheckoutSession(
    payload: SaspayCheckoutCreateRequest,
  ): Promise<SaspayCheckoutSession> {
    // NB: Idempotency-Key n'est pas supporté par cet endpoint (doc officielle).
    const response = await this.request<unknown>('POST', '/checkout-sessions/', payload);
    return this.parseCheckoutSessionResponse(response).data;
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
