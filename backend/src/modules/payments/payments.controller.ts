import type { Request, Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.middleware';
import { SASPAY_SIGNING_SECRET } from './saspay.config';
import {
  PaymentError,
  confirmOtpForPayment,
  getNetworksForCountry,
  getPaymentConfig,
  getPaymentStatus,
  getPlansWithPrices,
  getRates,
  handleSaspayWebhook,
  initiateSoftpay,
  retryPayment,
} from './payments.service';

function sendError(res: Response, err: any) {
  if (err instanceof PaymentError) {
    res.status(err.status).json({ success: false, data: null, message: err.message, code: err.code });
    return;
  }
  console.error('[Payments] Erreur inattendue:', err);
  res.status(500).json({ success: false, data: null, message: 'Erreur serveur paiement' });
}

/* ──────────── Référentiels ──────────── */

export const getConfig = async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await getPaymentConfig(), message: null });
  } catch (err) {
    sendError(res, err);
  }
};

export const getNetworks = async (req: Request, res: Response) => {
  try {
    const country = typeof req.query.country === 'string' ? req.query.country : undefined;
    res.json({ success: true, data: await getNetworksForCountry(country), message: null });
  } catch (err) {
    sendError(res, err);
  }
};

export const getRatesCtrl = async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await getRates(), message: null });
  } catch (err) {
    sendError(res, err);
  }
};

export const getPlans = async (req: Request, res: Response) => {
  try {
    const currency = typeof req.query.currency === 'string' ? req.query.currency : undefined;
    res.json({ success: true, data: await getPlansWithPrices(currency), message: null });
  } catch (err) {
    sendError(res, err);
  }
};

/* ──────────── Paiement ──────────── */

export const startSoftpay = async (req: AuthRequest, res: Response) => {
  try {
    const { planCode, donationAmount, currency, country, network, phone, firstName, lastName, email, otp } = req.body || {};
    const result = await initiateSoftpay(req.user!.id, {
      planCode,
      donationAmount: Number(donationAmount) || 0,
      currency,
      country,
      network,
      phone,
      firstName,
      lastName,
      email,
      otp,
    });
    res.json({ success: true, data: result, message: null });
  } catch (err) {
    sendError(res, err);
  }
};

export const getStatus = async (req: AuthRequest, res: Response) => {
  try {
    res.json({ success: true, data: await getPaymentStatus(req.user!.id, String(req.params.id)), message: null });
  } catch (err) {
    sendError(res, err);
  }
};

export const confirmOtp = async (req: AuthRequest, res: Response) => {
  try {
    const result = await confirmOtpForPayment(req.user!.id, String(req.params.id), String(req.body?.otp || ''));
    res.json({ success: true, data: result, message: null });
  } catch (err) {
    sendError(res, err);
  }
};

export const retry = async (req: AuthRequest, res: Response) => {
  try {
    const result = await retryPayment(req.user!.id, String(req.params.id));
    res.json({ success: true, data: result, message: null });
  } catch (err) {
    sendError(res, err);
  }
};

/* ──────────── Webhook ──────────── */

export const webhook = async (req: Request, res: Response) => {
  try {
    // Le corps BRUT est nécessaire pour la vérification HMAC (express.json le
    // remplit dans req.rawBody via son callback `verify` — voir app.ts).
    const rawBody: Buffer | string =
      (req as any).rawBody ?? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));

    const result = await handleSaspayWebhook(
      rawBody,
      req.headers as Record<string, string | undefined>,
      SASPAY_SIGNING_SECRET
    );
    res.status(result.status).json({ success: result.body.success, data: null, message: result.body.message });
  } catch (err) {
    sendError(res, err);
  }
};
