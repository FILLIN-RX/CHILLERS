import axios, { AxiosInstance } from 'axios';
import { SASPAY_API_KEY, SASPAY_BASE_URL, isSaspayConfigured } from './saspay.config';

/**
 * Client HTTP SasPay.
 *
 * Enveloppe de réponse SasPay :
 *   succcès → { success: true, data: {...}, code: 200 }
 *   erreur  → { success: false, error: { message, code }, code: 422 }
 * Certains endpoints (vérification, référentiels) renvoient un corps « plat »
 * sans enveloppe : `unwrap` gère les deux formes.
 */

export class SaspayError extends Error {
  code?: string;
  status: number;

  constructor(message: string, code?: string, status = 422) {
    super(message);
    this.name = 'SaspayError';
    this.code = code;
    this.status = status;
  }
}

let client: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (!isSaspayConfigured()) {
    throw new SaspayError('Paiement en ligne non configuré (SASPAY_API_KEY manquante).', 'not_configured', 503);
  }
  if (!client) {
    client = axios.create({
      baseURL: SASPAY_BASE_URL,
      timeout: 20_000,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SASPAY_API_KEY}` },
    });
  }
  return client;
}

function unwrap<T>(body: any): T {
  if (body && typeof body === 'object' && body.success === false) {
    const msg = body.error?.message || body.message || 'Erreur SasPay';
    throw new SaspayError(msg, body.error?.code, Number(body.code) || 422);
  }
  if (body && typeof body === 'object' && body.success === true && 'data' in body) {
    return body.data as T;
  }
  return body as T;
}

async function request<T>(
  method: 'GET' | 'POST',
  url: string,
  payload?: unknown,
  opts: { idempotencyKey?: string; timeoutMs?: number } = {}
): Promise<T> {
  try {
    const res = await getClient().request({
      method,
      url,
      data: payload,
      timeout: opts.timeoutMs ?? 20_000,
      headers: opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : undefined,
    });
    return unwrap<T>(res.data);
  } catch (err: any) {
    if (err instanceof SaspayError) throw err;
    if (err?.response) {
      // Erreur HTTP avec corps exploitable
      const body = err.response.data;
      if (body && body.success === false) {
        throw new SaspayError(
          body.error?.message || body.message || 'Erreur SasPay',
          body.error?.code,
          err.response.status
        );
      }
      const msg =
        (typeof body === 'string' && body.slice(0, 200)) ||
        body?.message ||
        err.message ||
        'Erreur SasPay';
      throw new SaspayError(msg, undefined, err.response.status);
    }
    // Timeout / coupure réseau — jamais la preuve que la requête a échoué.
    const e = new SaspayError(err?.message || 'Réseau SasPay injoignable', 'network_error', 504);
    e.name = 'SaspayNetworkError';
    throw e;
  }
}

/* ───────────────────────── Types de réponse ───────────────────────── */

export interface SoftpayResponse {
  message?: string;
  id: string;
  status: string;
  /** NON vide ⇒ page hébergée : rediriger le client dessus sinon aucun paiement. */
  checkout_url?: string;
  instructions?: string;
}

export interface VerifyResponse {
  id: string;
  reference?: string;
  status: string;
  currency?: string;
  requested_amount?: string;
  net_amount?: string;
  network?: string;
  msisdn?: string;
  [k: string]: unknown;
}

export interface SaspayNetwork {
  id: string;
  country: string; // UUID pays
  code: string;
  name: string;
  is_active: boolean;
}

export interface SaspayCountry {
  id: string;
  iso_code: string;
  name: string;
  default_currency: string;
  is_active: boolean;
}

export interface RateTier {
  min_amount?: string;
  max_amount?: string;
  percent?: string;
  fixed?: string;
  floor_amount?: string | null;
  cap_amount?: string | null;
  fee_charge_mode?: string;
}

export interface SaspayRate {
  country_code: string;
  country_name: string;
  currency: string;
  network_code: string;
  network_name: string;
  payin?: {
    available: boolean;
    otp_required?: boolean;
    otp_instructions?: string;
    tiers?: RateTier[];
  };
}

/* ───────────────────────── Appels ───────────────────────── */

export interface SoftpayPayload {
  amount: string;
  currency: string;
  country: string;
  network: string;
  description: string;
  customer: { email: string; first_name: string; last_name: string; phone?: string };
  otp?: string;
  return_url?: string;
  metadata?: Record<string, string>;
}

/**
 * Initie un paiement softpay. `idempotencyKey` est OBLIGATOIRE en pratique :
 * un retry réseau sans clé crée un second débit réel. Sur timeout/coupure on
 * rejoue UNE fois avec la MÊME clé (réponse d'origine renvoyée par SasPay).
 */
export async function saspaySoftpay(payload: SoftpayPayload, idempotencyKey: string): Promise<SoftpayResponse> {
  try {
    return await request<SoftpayResponse>('POST', '/payments/softpay/', payload, { idempotencyKey });
  } catch (err: any) {
    if (err?.name === 'SaspayNetworkError') {
      return await request<SoftpayResponse>('POST', '/payments/softpay/', payload, { idempotencyKey });
    }
    throw err;
  }
}

/** Revérifie l'état réel côté gateway (jamais confiance à un statut mémorisé). */
export function saspayVerify(paymentId: string): Promise<VerifyResponse> {
  return request<VerifyResponse>('GET', `/payments/${paymentId}/verify/`, undefined, { timeoutMs: 15_000 });
}

/** Confirme un paiement par OTP reçu APRÈS le push (Wizall SN, Coris BJ...). */
export function saspayConfirmOtp(paymentId: string, otp: string): Promise<{ message?: string; id: string; status: string }> {
  return request('POST', `/payments/${paymentId}/confirm-otp/`, { otp });
}

/** Rejoue un paiement échoué (même transaction, aucun nouveau débit). */
export function saspayRetry(paymentId: string, idempotencyKey: string): Promise<{ message?: string; id: string; checkout_url?: string }> {
  return request('POST', `/payments/${paymentId}/retry/`, undefined, { idempotencyKey });
}

/** Tous les réseaux actifs (paginés, page_size max 100). */
export async function saspayNetworks(): Promise<SaspayNetwork[]> {
  const all: SaspayNetwork[] = [];
  let next: string | null = '/networks/?page=1&page_size=100';
  for (let page = 0; next && page < 5; page++) {
    const res: any = await request('GET', next, undefined, { timeoutMs: 15_000 });
    const results = res?.results || res?.data || [];
    all.push(...results);
    if (res?.next) {
      const u = new URL(res.next);
      // `next` est une URL absolue vers /api/v1/... — on la ramène en chemin relatif
      // au client (baseURL déjà préfixée par /api/v1).
      const path = u.pathname.replace(/^\/api\/v1/, '') || '/';
      next = `${path}${u.search}`;
    } else {
      next = null;
    }
  }
  return all;
}

/** Catalogue pays (public côté SasPay, mais on passe par notre clé — cache 24h côté service). */
export function saspayCountries(): Promise<SaspayCountry[]> {
  return request<SaspayCountry[]>('GET', '/countries/', undefined, { timeoutMs: 15_000 });
}

/** Tarifs réels par (pays, réseau) + flags OTP pré-paiement. */
export function saspayMyRates(): Promise<SaspayRate[]> {
  return request<SaspayRate[]>('GET', '/pricing/my-rates/', undefined, { timeoutMs: 15_000 });
}
