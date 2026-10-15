import { LRUCache } from 'lru-cache';

/**
 * Configuration SasPay — passerelle de paiement (mobile money / carte,
 * Afrique de l'Ouest et du Centre).
 *
 * Doc: https://docs.saspay.me/api-reference/payments
 * Base: https://api.saspay.me/api/v1 — auth `Authorization: Bearer sk_...`
 * UNIQUEMENT côté serveur (jamais exposée au navigateur).
 */

export const SASPAY_BASE_URL = (
  process.env.SASPAY_BASE_URL || 'https://api.saspay.me/api/v1'
).replace(/\/$/, '');

export const SASPAY_API_KEY = (process.env.SASPAY_API_KEY || '').trim();
export const SASPAY_SIGNING_SECRET = (process.env.SASPAY_SIGNING_SECRET || '').trim();

/** URL publique du frontend — utilisée pour le return_url des paiements carte/crypto. */
export const FRONTEND_URL = (
  process.env.FRONTEND_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://chillers.site' : 'http://localhost:3000')
).replace(/\/$/, '');

/** Disponibilité du paiement en ligne (false ⇒ l'app affiche « paiement indisponible »). */
export function isSaspayConfigured(): boolean {
  return SASPAY_API_KEY.length > 0;
}

/**
 * Taux de conversion **depuis** la devise de base des plans (XAF).
 * `rateFromXAF` = combien d'XAF pour 1 unité de la devise.
 *   montantCible = prixXAF / rateFromXAF
 * Ex: prix 1000 XAF, EUR rate 655.957 → 1000 / 655.957 ≈ 1.52 EUR.
 *
 * Ce sont des valeurs plan approximatives : la collection `CurrencyRate`
 * (éditable sans redéployer) les surcharge dès qu'un document existe.
 * Devise absente de la table ⇒ le paiement part en XOF et SasPay convertit
 * automatiquement côté gateway.
 */
export const FALLBACK_RATES: Record<string, number> = {
  XAF: 1,
  XOF: 1,
  // Équivalents approximatifs vs XAF (mis à jour tardivement — ajustables en DB)
  USD: 600,
  EUR: 655.957,
  GBP: 760,
  GHS: 45,
  NGN: 0.4,
  KES: 2.8,
  TZS: 0.24,
  UGX: 0.16,
  RWF: 0.47,
  ZMW: 21,
  MWK: 0.35,
  GNF: 0.07,
  BIF: 0.2,
  CDF: 0.23,
  MZN: 9.4,
  AOA: 0.67,
  MAD: 55,
  DZD: 4.6,
  EGP: 12.5,
  TND: 190,
  MRU: 15,
  CVE: 5.5,
  ZAR: 33,
};

/** Devise de repli (la même valeur numérique que le prix XAF des plans). */
export const BASE_CURRENCY = 'XOF';

const ratesCache = new LRUCache<string, Record<string, number>>({ max: 5, ttl: 10 * 60_000 });

/**
 * Taux pour une devise (DB d'abord, fallback statique).
 * Retourne `null` si la devise n'est pas tarifable → le paiement sera
 * initié en XOF et SasPay se chargera de la conversion.
 */
export async function getRateFromXAF(currency: string): Promise<number | null> {
  const code = (currency || '').toUpperCase();
  if (!code) return null;

  const cached = ratesCache.get('rates');
  if (cached) return cached[code] ?? null;

  let fromDb: Record<string, number> = {};
  try {
    const { CurrencyRate } = await import('../../models/CurrencyRate');
    const docs = (await CurrencyRate.find({}).lean()) as unknown as { currency: string; rateFromXAF: number }[];
    if (docs.length > 0) {
      for (const d of docs) fromDb[String(d.currency).toUpperCase()] = Number(d.rateFromXAF);
    }
  } catch {
    // DB indisponible → on repose sur le fallback statique
  }

  const merged = { ...FALLBACK_RATES, ...fromDb };
  ratesCache.set('rates', merged);
  return merged[code] ?? null;
}

/** Purge le cache des taux (appelé après édition admin). */
export function invalidateRatesCache(): void {
  ratesCache.delete('rates');
}
