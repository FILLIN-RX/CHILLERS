import { LRUCache } from 'lru-cache';
import { randomUUID } from 'crypto';
import { SubscriptionPlan } from '../../models/SubscriptionPlan';
import { PaymentTransaction, type PaymentStatus } from '../../models/PaymentTransaction';
import { User } from '../../models/User';
import { activateSubscription } from '../../services/subscription-activation';
import {
  BASE_CURRENCY,
  FRONTEND_URL,
  getRateFromXAF,
  isSaspayConfigured,
} from './saspay.config';
import {
  SaspayError,
  saspayConfirmOtp,
  saspayCountries,
  saspayMyRates,
  saspayNetworks,
  saspayRetry,
  saspaySoftpay,
  saspayVerify,
  type SaspayCountry,
  type SaspayNetwork,
  type SaspayRate,
} from './saspay.client';
import { verifyWebhookSignature } from './webhook-signature';

/** Erreur métier renvoyée telle quelle au controller (status HTTP + code stable). */
export class PaymentError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.name = 'PaymentError';
    this.status = status;
    this.code = code;
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ───────────────────── Cache référentiels (SasPay) ───────────────────── */

const countriesCache = new LRUCache<string, SaspayCountry[]>({ max: 1, ttl: 24 * 60 * 60_000 });
const networksCache = new LRUCache<string, SaspayNetwork[]>({ max: 1, ttl: 24 * 60 * 60_000 });
const ratesCache = new LRUCache<string, FlatRate[]>({ max: 1, ttl: 15 * 60_000 });

async function getCountriesCached(): Promise<SaspayCountry[]> {
  const hit = countriesCache.get('all');
  if (hit) return hit;
  const all = await saspayCountries();
  const active = (Array.isArray(all) ? all : []).filter((c) => c?.is_active !== false);
  countriesCache.set('all', active);
  return active;
}

async function getNetworksCached(): Promise<SaspayNetwork[]> {
  const hit = networksCache.get('all');
  if (hit) return hit;
  const all = await saspayNetworks();
  networksCache.set('all', all);
  return all;
}

export interface FlatRate {
  code: string;
  name: string;
  country: string;
  currency: string;
  available: boolean;
  otpRequired: boolean;
  otpInstructions: string;
  feePercent: number;
  feeFixed: number;
  feeFloor: number | null;
  feeCap: number | null;
  feeMode: string;
}

async function getRatesCached(): Promise<FlatRate[]> {
  const hit = ratesCache.get('all');
  if (hit) return hit;
  const raw: SaspayRate[] = await saspayMyRates();
  const flat: FlatRate[] = (Array.isArray(raw) ? raw : [])
    .filter((r) => r?.network_code)
    .map((r) => {
      const tier = r.payin?.tiers?.[0];
      return {
        code: r.network_code,
        name: r.network_name,
        country: r.country_code,
        currency: r.currency,
        available: !!r.payin?.available,
        otpRequired: !!r.payin?.otp_required,
        otpInstructions: r.payin?.otp_instructions || '',
        feePercent: Number(tier?.percent ?? 0),
        feeFixed: Number(tier?.fixed ?? 0),
        // SasPay renvoie parfois floor_amount négatif (-0.01) ⇒ inutilisable
        feeFloor:
          tier?.floor_amount != null && Number(tier.floor_amount) > 0
            ? Number(tier.floor_amount)
            : null,
        feeCap:
          tier?.cap_amount != null && Number(tier.cap_amount) > 0
            ? Number(tier.cap_amount)
            : null,
        feeMode: tier?.fee_charge_mode || '',
      };
    });
  ratesCache.set('all', flat);
  return flat;
}

/* ─────────────────────────── Référentiels (app) ─────────────────────────── */

export async function getPaymentConfig() {
  const base = { configured: isSaspayConfigured(), defaultCurrency: BASE_CURRENCY };
  try {
    const countries = await getCountriesCached();
    const byCurrency = new Map<string, string[]>();
    for (const c of countries) {
      const cur = (c.default_currency || '').toUpperCase();
      if (!cur) continue;
      if (!byCurrency.has(cur)) byCurrency.set(cur, []);
      byCurrency.get(cur)!.push(c.iso_code);
    }
    const currencies = [...byCurrency.entries()]
      .map(([code, isoCountries]) => ({ code, countries: isoCountries }))
      .sort((a, b) => a.code.localeCompare(b.code));
    return { ...base, currencies, countries: countries.map((c) => ({ iso: c.iso_code, name: c.name, currency: c.default_currency })) };
  } catch {
    // SasPay injoignable : l'app retombe sur XOF/XAF (prix de base des plans).
    return { ...base, currencies: [{ code: BASE_CURRENCY, countries: [] }], countries: [] as { iso: string; name: string; currency: string }[] };
  }
}

/** Réseaux d'un pays + les réseaux globaux (carte/crypto toujours disponibles). */
export async function getNetworksForCountry(country?: string) {
  const iso = (country || '').toUpperCase();
  let list: { code: string; name: string; country: string }[] = [
    { code: 'card', name: 'Carte bancaire', country: 'XX' },
    { code: 'crypto', name: 'Crypto / Stablecoin', country: 'XX' },
  ];

  try {
    const [countries, networks] = await Promise.all([getCountriesCached(), getNetworksCached()]);
    const uuidToIso = new Map(countries.map((c) => [c.id, c.iso_code]));
    for (const n of networks) {
      if (n.is_active === false) continue;
      const nIso = uuidToIso.get(n.country) || '';
      if (iso && nIso !== iso) continue;
      list.push({ code: n.code, name: n.name, country: nIso });
    }
  } catch {
    // SasPay injoignable — seule la carte/crypto restera proposable (elles
    // échoueront aussi côté initiate, mais l'UI reste cohérente).
  }
  return { networks: list };
}

export async function getRates() {
  try {
    return { rates: await getRatesCached() };
  } catch {
    return { rates: [] as FlatRate[] };
  }
}

/** Plans actifs avec prix converti dans la devise demandée (si tarifable). */
export async function getPlansWithPrices(currency?: string) {
  const plans = await SubscriptionPlan.find({ isActive: true }).sort({ price: 1 }).lean();
  const code = (currency || BASE_CURRENCY).toUpperCase();
  const rate = await getRateFromXAF(code);

  return {
    currency: rate ? code : BASE_CURRENCY,
    converted: !!rate,
    plans: plans.map((p) => ({
      _id: p._id,
      code: p.code,
      name: p.name,
      durationMonths: p.durationMonths,
      features: p.features,
      originalPrice: p.price, // prix de base XAF
      price: rate ? round2(p.price / rate) : p.price,
      currency: rate ? code : BASE_CURRENCY,
      converted: !!rate,
    })),
  };
}

/* ──────────────────────────── Softpay ──────────────────────────── */

export interface InitiateInput {
  planCode?: string;
  /** Montant libre de don, exprimé dans `currency` (XOF par défaut). > 0 ⇒ mode don. */
  donationAmount?: number;
  currency?: string;
  country?: string;
  network: string;
  phone: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  otp?: string;
}

export interface InitiateResult {
  paymentId: string;
  status: string;
  checkoutUrl?: string;
  instructions?: string;
  amount: number;
  currency: string;
}

export async function initiateSoftpay(userId: string, input: InitiateInput): Promise<InitiateResult> {
  if (!isSaspayConfigured()) {
    throw new PaymentError('Le paiement en ligne est momentanément indisponible.', 503, 'not_configured');
  }

  const donationAmount = Number(input.donationAmount || 0);
  const isDonation = Number.isFinite(donationAmount) && donationAmount > 0;
  const planCode = (input.planCode || '').toLowerCase().trim();
  const network = (input.network || '').trim();
  const phone = (input.phone || '').trim();
  // Carte / crypto → checkout hébergé SasPay : le numéro Mobile Money
  // n'est pas nécessaire (seul le MoMo local l'exige).
  const isGlobalNetwork = network === 'card' || network === 'crypto';
  if ((!isDonation && !planCode) || !network || (!phone && !isGlobalNetwork)) {
    throw new PaymentError('Plan (ou montant de don), réseau et numéro de téléphone sont requis.', 400, 'invalid_request');
  }

  const country = (input.country || (isGlobalNetwork ? 'XX' : '')).toUpperCase().trim();
  if (!isGlobalNetwork && !/^[A-Z]{2}$/.test(country)) {
    throw new PaymentError('Pays invalide pour ce réseau.', 400, 'invalid_country');
  }

  let plan: { name: string; price: number } | null = null;
  if (!isDonation) {
    const found = await SubscriptionPlan.findOne({ code: planCode, isActive: true });
    if (!found) throw new PaymentError('Plan introuvable ou inactif.', 404, 'plan_not_found');
    plan = { name: found.name, price: found.price };
  }

  const user = await User.findById(userId).lean();
  if (!user) throw new PaymentError('Utilisateur introuvable.', 404, 'user_not_found');

  // Conversion du prix de base (XAF) vers la devise choisie.
  const wanted = (input.currency || BASE_CURRENCY).toUpperCase();
  const rate = await getRateFromXAF(wanted);
  const sendCurrency = rate ? wanted : BASE_CURRENCY;

  let amount: number;
  if (isDonation) {
    if (!rate && wanted !== BASE_CURRENCY) {
      throw new PaymentError('Devise non supportée pour les dons.', 400, 'unsupported_currency');
    }
    amount = round2(donationAmount);
    // ~100 XAF minimum (règle anti-spam des gateways)
    const xafEquivalent = sendCurrency === BASE_CURRENCY ? amount : amount * (rate as number);
    if (xafEquivalent < 100) {
      throw new PaymentError('Montant minimum : 100 FCFA.', 400, 'amount_too_small');
    }
  } else {
    // plan est non-null ici : isDonation === false ⇒ findOne ci-dessus
    amount = rate ? round2((plan as { name: string; price: number }).price / rate) : (plan as { name: string; price: number }).price;
  }

  const firstName = (input.firstName || user.username || user.email?.split('@')[0] || 'Client').trim();
  const lastName = (input.lastName || '.').trim();
  const email = (input.email || user.email || '').trim();

  const idempotencyKey = randomUUID();
  const txn = await PaymentTransaction.create({
    userId,
    planCode: isDonation ? 'don' : planCode,
    planName: isDonation ? 'Don' : (plan as { name: string }).name,
    amount,
    currency: sendCurrency,
    country,
    network,
    msisdn: phone,
    status: 'PENDING',
    idempotencyKey,
  });

  // Les dons reviennent sur /support, les abonnements sur /subscribe
  const returnUrl = isDonation
    ? `${FRONTEND_URL}/support?payment=${txn._id}`
    : `${FRONTEND_URL}/subscribe?payment=${txn._id}`;

  try {
    const resp = await saspaySoftpay(
      {
        amount: amount.toFixed(2),
        currency: sendCurrency,
        country,
        network,
        description: isDonation
          ? 'Don CHILLERS'
          : `Abonnement CHILLERS ${(plan as { name: string }).name}`,
        customer: { email, first_name: firstName, last_name: lastName, phone: phone || undefined },
        ...(input.otp ? { otp: input.otp } : {}),
        return_url: returnUrl,
        metadata: { userId, planCode: isDonation ? 'don' : planCode, localId: String(txn._id) },
      },
      idempotencyKey
    );

    const status: PaymentStatus =
      resp.status === 'SUCCESS' ? 'SUCCESS' : resp.status === 'FAILED' ? 'FAILED' : 'PENDING';

    txn.saspayPaymentId = resp.id;
    txn.status = status;
    txn.checkoutUrl = resp.checkout_url || undefined;
    txn.instructions = resp.instructions || undefined;

    if (status === 'SUCCESS' && !isDonation) {
      const result = await activateSubscription(userId, planCode);
      if (result) txn.activatedAt = new Date();
    }
    await txn.save();

    return {
      paymentId: String(txn._id),
      status: txn.status,
      checkoutUrl: txn.checkoutUrl,
      instructions: txn.instructions,
      amount,
      currency: sendCurrency,
    };
  } catch (err: any) {
    txn.status = 'FAILED';
    txn.lastError = err?.message || 'Erreur initiation';
    await txn.save();
    if (err instanceof SaspayError) {
      throw new PaymentError(err.message, err.status || 422, err.code);
    }
    throw new PaymentError('Impossible de démarrer le paiement.', 502, 'saspay_error');
  }
}

/* ───────────── Statut / activation (polling = filet sécurité) ───────────── */

async function applyVerifiedStatus(txn: InstanceType<typeof PaymentTransaction>, verified: { id?: string; reference?: string; status?: string }) {
  if (verified.status === 'SUCCESS') {
    txn.status = 'SUCCESS';
    if (verified.reference) txn.reference = String(verified.reference);
    // Les dons ('don') n'activent aucun abonnement.
    if (!txn.activatedAt && txn.planCode !== 'don') {
      const result = await activateSubscription(String(txn.userId), txn.planCode);
      if (result) txn.activatedAt = new Date();
    }
  } else if (verified.status === 'FAILED') {
    txn.status = 'FAILED';
  } else if (verified.status === 'CANCELLED') {
    txn.status = 'CANCELLED';
  }
  await txn.save();
}

export async function getPaymentStatus(userId: string, id: string) {
  const txn = await PaymentTransaction.findOne({ _id: id, userId });
  if (!txn) throw new PaymentError('Paiement introuvable.', 404, 'not_found');

  // PENDING côté local ⇒ on revérifie TOUJOURS l'état réel côté gateway.
  if (txn.status === 'PENDING' && txn.saspayPaymentId) {
    try {
      const verified = await saspayVerify(txn.saspayPaymentId);
      await applyVerifiedStatus(txn, verified);
    } catch (err: any) {
      // Gateway injoignable : on renvoie l'état connu (le webhook rattrapera).
      if (!(err instanceof SaspayError)) {
        throw new PaymentError('Service de paiement injoignable.', 502, 'verify_unavailable');
      }
    }
  }

  return {
    paymentId: String(txn._id),
    status: txn.status,
    planCode: txn.planCode,
    activated: !!txn.activatedAt,
    reference: txn.reference,
    checkoutUrl: txn.checkoutUrl,
  };
}

export async function confirmOtpForPayment(userId: string, id: string, otp: string) {
  const code = (otp || '').trim();
  if (!code) throw new PaymentError('Code OTP requis.', 400, 'otp_required');

  const txn = await PaymentTransaction.findOne({ _id: id, userId });
  if (!txn) throw new PaymentError('Paiement introuvable.', 404, 'not_found');
  if (!txn.saspayPaymentId) throw new PaymentError('Paiement non initié.', 409, 'no_payment');
  if (txn.status === 'SUCCESS') {
    return { paymentId: String(txn._id), status: txn.status, activated: !!txn.activatedAt };
  }

  try {
    const resp = await saspayConfirmOtp(txn.saspayPaymentId, code);
    await applyVerifiedStatus(txn, { status: resp.status });
    return { paymentId: String(txn._id), status: txn.status, activated: !!txn.activatedAt };
  } catch (err: any) {
    if (err instanceof SaspayError) throw new PaymentError(err.message, err.status || 422, err.code);
    throw new PaymentError('Confirmation OTP impossible.', 502, 'otp_error');
  }
}

export async function retryPayment(userId: string, id: string) {
  const txn = await PaymentTransaction.findOne({ _id: id, userId });
  if (!txn) throw new PaymentError('Paiement introuvable.', 404, 'not_found');
  if (txn.status === 'SUCCESS') throw new PaymentError('Paiement déjà réussi.', 409, 'not_retryable');
  if (!txn.saspayPaymentId) throw new PaymentError('Paiement non initié.', 409, 'no_payment');

  try {
    const resp = await saspayRetry(txn.saspayPaymentId, randomUUID());
    txn.status = 'PENDING';
    txn.checkoutUrl = resp.checkout_url || undefined;
    txn.lastError = undefined;
    await txn.save();
    return { paymentId: String(txn._id), status: txn.status, checkoutUrl: txn.checkoutUrl };
  } catch (err: any) {
    if (err instanceof SaspayError) throw new PaymentError(err.message, err.status || 422, err.code);
    throw new PaymentError('Relance impossible.', 502, 'retry_error');
  }
}

/* ────────────────────────────── Webhook ────────────────────────────── */

export { verifyWebhookSignature };

export async function handleSaspayWebhook(
  rawBody: string | Buffer,
  headers: Record<string, string | undefined>,
  secret: string
): Promise<{ status: number; body: { success: boolean; message?: string } }> {
  const signature = headers['x-webhook-signature'];
  const timestamp = headers['x-webhook-timestamp'];

  if (!secret) {
    return { status: 503, body: { success: false, message: 'Webhook non configuré (SASPAY_SIGNING_SECRET).' } };
  }
  if (!verifyWebhookSignature({ rawBody, signature, timestamp, secret })) {
    return { status: 403, body: { success: false, message: 'Signature invalide.' } };
  }

  let payload: any;
  try {
    payload = JSON.parse(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'));
  } catch {
    return { status: 400, body: { success: false, message: 'Corps JSON invalide.' } };
  }

  const event = String(payload?.event || headers['x-webhook-event'] || '');
  const data = payload?.data || {};

  if (event === 'webhook.test') {
    return { status: 200, body: { success: true, message: 'pong' } };
  }
  if (!event.startsWith('transaction.')) {
    // On acquiesce les autres events pour ne pas déclencher les retries inutiles.
    return { status: 200, body: { success: true, message: `Event ${event || 'inconnu'} ignoré` } };
  }

  const txn = await PaymentTransaction.findOne({
    $or: [
      ...(data.id ? [{ saspayPaymentId: String(data.id) }] : []),
      ...(data.reference ? [{ reference: String(data.reference) }] : []),
    ],
  });

  if (!txn) {
    console.warn(`[SasPay] Webhook ${event} sans transaction locale (id=${data.id}, ref=${data.reference})`);
    return { status: 200, body: { success: true, message: 'Transaction inconnue — acquittée.' } };
  }

  if (event === 'transaction.success') {
    await applyVerifiedStatus(txn, { status: 'SUCCESS', reference: data.reference, id: data.id });
    console.log(`[SasPay] ✓ transaction.success → abonnement ${txn.planCode} user=${txn.userId} (activatedAt=${txn.activatedAt})`);
  } else if (event === 'transaction.failed') {
    if (txn.status !== 'SUCCESS') {
      txn.status = 'FAILED';
      await txn.save();
    }
  } else if (event === 'transaction.cancelled') {
    if (txn.status !== 'SUCCESS') {
      txn.status = 'CANCELLED';
      await txn.save();
    }
  }

  return { status: 200, body: { success: true } };
}
