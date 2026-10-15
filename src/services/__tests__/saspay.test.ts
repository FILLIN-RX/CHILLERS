/**
 * Tests du module paiements SasPay :
 *  - vérification de signature webhook (HMAC + tolérance de temps)
 *  - conversion XAF → devise cible (fallback statique + surcharge DB)
 */

import crypto from 'crypto';

// Le module config importe CurrencyRate dynamiquement ; on le mock pour
// contrôler la couche DB sans connexion mongoose.
jest.mock('../../../backend/src/models/CurrencyRate', () => ({
  CurrencyRate: {
    find: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })),
  },
}));

import { verifyWebhookSignature } from '../../../backend/src/modules/payments/webhook-signature';
import {
  FALLBACK_RATES,
  getRateFromXAF,
  invalidateRatesCache,
} from '../../../backend/src/modules/payments/saspay.config';
import { CurrencyRate } from '../../../backend/src/models/CurrencyRate';

const SECRET = 'whsec_test_secret';
const NOW = 1_800_000_000;

function sign(timestamp: string, body: string, secret = SECRET): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

describe('verifyWebhookSignature (SasPay)', () => {
  const body = JSON.stringify({ event: 'transaction.success', data: { id: 'txn_1' } });

  it('accepte une signature valide dans la fenêtre de tolérance', () => {
    const ts = String(NOW - 10);
    expect(
      verifyWebhookSignature({ rawBody: body, signature: sign(ts, body), timestamp: ts, secret: SECRET, nowSeconds: NOW })
    ).toBe(true);
  });

  it('accepte un corps transmis en Buffer (rawBody express)', () => {
    const ts = String(NOW);
    expect(
      verifyWebhookSignature({
        rawBody: Buffer.from(body, 'utf8'),
        signature: sign(ts, body),
        timestamp: ts,
        secret: SECRET,
        nowSeconds: NOW,
      })
    ).toBe(true);
  });

  it('rejette un corps modifié (signature recalcule sur le brut)', () => {
    const ts = String(NOW);
    const tampered = body.replace('txn_1', 'txn_2');
    expect(
      verifyWebhookSignature({ rawBody: tampered, signature: sign(ts, body), timestamp: ts, secret: SECRET, nowSeconds: NOW })
    ).toBe(false);
  });

  it('rejette un secret incorrect', () => {
    const ts = String(NOW);
    expect(
      verifyWebhookSignature({ rawBody: body, signature: sign(ts, body, 'wrong_secret'), timestamp: ts, secret: SECRET, nowSeconds: NOW })
    ).toBe(false);
  });

  it('rejette un timestamp hors tolérance (ancien et futur)', () => {
    const tooOld = String(NOW - 301);
    const tooNew = String(NOW + 301);
    expect(
      verifyWebhookSignature({ rawBody: body, signature: sign(tooOld, body), timestamp: tooOld, secret: SECRET, nowSeconds: NOW })
    ).toBe(false);
    expect(
      verifyWebhookSignature({ rawBody: body, signature: sign(tooNew, body), timestamp: tooNew, secret: SECRET, nowSeconds: NOW })
    ).toBe(false);
  });

  it('accepte la frontière exacte de tolérance (±300 s)', () => {
    const edge = String(NOW - 300);
    expect(
      verifyWebhookSignature({ rawBody: body, signature: sign(edge, body), timestamp: edge, secret: SECRET, nowSeconds: NOW })
    ).toBe(true);
  });

  it('rejette header manquant, vide ou non numérique', () => {
    const ts = String(NOW);
    expect(verifyWebhookSignature({ rawBody: body, signature: null, timestamp: ts, secret: SECRET, nowSeconds: NOW })).toBe(false);
    expect(verifyWebhookSignature({ rawBody: body, signature: sign(ts, body), timestamp: '', secret: SECRET, nowSeconds: NOW })).toBe(false);
    expect(verifyWebhookSignature({ rawBody: body, signature: sign(ts, body), timestamp: 'abc', secret: SECRET, nowSeconds: NOW })).toBe(false);
    expect(verifyWebhookSignature({ rawBody: body, signature: sign(ts, body), timestamp: ts, secret: '', nowSeconds: NOW })).toBe(false);
  });

  it('rejette une signature de longueur différente sans throw', () => {
    const ts = String(NOW);
    expect(
      verifyWebhookSignature({ rawBody: body, signature: 'deadbeef', timestamp: ts, secret: SECRET, nowSeconds: NOW })
    ).toBe(false);
  });
});

describe('getRateFromXAF (conversion)', () => {
  beforeEach(() => {
    invalidateRatesCache();
    (CurrencyRate.find as jest.Mock).mockImplementation(() => ({
      lean: jest.fn().mockResolvedValue([]),
    }));
  });

  it('retourne 1 pour XOF et XAF (devise de base, pas de conversion)', async () => {
    await expect(getRateFromXAF('XOF')).resolves.toBe(1);
    invalidateRatesCache();
    await expect(getRateFromXAF('xaf')).resolves.toBe(1);
  });

  it("utilise le taux de repli statique quand la DB est vide", async () => {
    await expect(getRateFromXAF('USD')).resolves.toBe(FALLBACK_RATES.USD);
    invalidateRatesCache();
    await expect(getRateFromXAF('EUR')).resolves.toBe(FALLBACK_RATES.EUR);
  });

  it('surchge le taux DB par-dessus le fallback', async () => {
    (CurrencyRate.find as jest.Mock).mockImplementation(() => ({
      lean: jest.fn().mockResolvedValue([{ currency: 'USD', rateFromXAF: 500 }]),
    }));
    await expect(getRateFromXAF('USD')).resolves.toBe(500);
    invalidateRatesCache();
    // Les autres devises restent sur le fallback
    await expect(getRateFromXAF('EUR')).resolves.toBe(FALLBACK_RATES.EUR);
  });

  it("retourne null pour une devise inconnue (→ paiement envoyé en XOF)", async () => {
    await expect(getRateFromXAF('XXX')).resolves.toBeNull();
    await expect(getRateFromXAF('')).resolves.toBeNull();
  });

  it('la conversion prixXAF / rate est bien formée (1000 XAF → 1.52 EUR)', async () => {
    const rate = await getRateFromXAF('EUR');
    expect(rate).not.toBeNull();
    expect(1000 / (rate as number)).toBeCloseTo(1.52, 2);
  });
});
