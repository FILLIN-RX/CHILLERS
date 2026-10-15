import crypto from 'crypto';

/**
 * Vérification de signature des webhooks SasPay.
 *
 * Headers reçus :
 *   X-Webhook-Signature : hex sha256 HMAC, minuscules
 *   X-Webhook-Timestamp : horodatage Unix (secondes), régénéré à chaque tentative
 *   X-Webhook-Event     : type d'événement (ex: "transaction.success")
 *
 * Signature = HMAC_SHA256(signing_secret, `${timestamp}.${corps_brut}`).
 *
 * Deux contrôles :
 *   1. l'âge du timestamp (± tolérance) — sans lui, un webhook intercepté
 *      reste rejouable indéfiniment ;
 *   2. la signature elle-même, recalculée sur le corps BRUT reçu (jamais sur
 *      un JSON re-sérialisé), comparée en temps constant.
 */
export const WEBHOOK_TOLERANCE_SECONDS = 300;

export function verifyWebhookSignature(opts: {
  rawBody: string | Buffer;
  signature?: string | null;
  timestamp?: string | null;
  secret: string;
  toleranceSeconds?: number;
  nowSeconds?: number;
}): boolean {
  const { rawBody, signature, timestamp, secret, toleranceSeconds = WEBHOOK_TOLERANCE_SECONDS } = opts;
  const nowSeconds = opts.nowSeconds ?? Math.floor(Date.now() / 1000);

  if (!secret || !signature || !timestamp) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(nowSeconds - ts) > toleranceSeconds) return false;

  const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

  const a = Buffer.from(signature, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
