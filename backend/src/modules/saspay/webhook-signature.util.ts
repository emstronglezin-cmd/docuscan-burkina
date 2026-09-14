import * as crypto from 'crypto';

const TOLERANCE_SECONDS = 300;

/**
 * Vérifie la signature HMAC-SHA256 d'un webhook Saspay, exactement
 * selon la méthode documentée : https://docs.saspay.me/api-reference/webhooks
 *
 *   signed = `${timestamp}.${rawBody}`
 *   signature = HMAC_SHA256(signingSecret, signed) en hex minuscules
 *
 * Deux contrôles obligatoires :
 * 1. L'âge du timestamp (tolérance 5 minutes) pour empêcher le replay.
 * 2. La comparaison en temps constant de la signature calculée sur le
 *    corps BRUT reçu (jamais une re-sérialisation du JSON parsé).
 */
export function isValidSaspayWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  timestampHeader: string | undefined,
  signingSecret: string,
): boolean {
  if (!signatureHeader || !timestampHeader || !signingSecret) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > TOLERANCE_SECONDS) {
    return false;
  }

  const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
  const signedPayload = Buffer.concat([Buffer.from(`${timestampHeader}.`), bodyBuffer]);

  const expected = crypto
    .createHmac('sha256', signingSecret)
    .update(signedPayload)
    .digest('hex');

  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);

  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
