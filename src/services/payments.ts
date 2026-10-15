// SasPay — paiements (mobile money / carte) via le backend CHILLERS.
// Doc : https://docs.saspay.me/api-reference/payments
import { httpJson } from "./http";

interface Envelope<T> {
  success: boolean;
  data?: T;
  message?: string | null;
  code?: string;
}

export interface PaymentsConfig {
  configured: boolean;
  defaultCurrency: string;
  currencies: { code: string; countries: string[] }[];
  countries: { iso: string; name: string; currency: string }[];
}

export interface PaymentNetwork {
  code: string;
  name: string;
  country: string;
}

export interface PaymentRate {
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

export interface PaymentPlan {
  _id: string;
  code: string;
  name: string;
  durationMonths: number;
  features: {
    maxResolution: string;
    maxDevices: number;
    hasContinueWatching: boolean;
    hasWatchHistory: boolean;
    hasDownloads: boolean;
  };
  originalPrice: number;
  price: number;
  currency: string;
  converted: boolean;
}

export interface SoftpayBody {
  planCode?: string;
  /** Montant libre de don (XOF par défaut) — si fourni, pas d'abonnement activé. */
  donationAmount?: number;
  currency?: string;
  country?: string;
  network: string;
  /** Requis pour Mobile Money — optionnel pour carte/crypto (checkout hébergé). */
  phone?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  otp?: string;
}

export interface SoftpayResult {
  paymentId: string;
  status: "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED";
  checkoutUrl?: string;
  instructions?: string;
  amount: number;
  currency: string;
}

export interface PaymentStatusResult {
  paymentId: string;
  status: "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED";
  planCode: string;
  activated: boolean;
  reference?: string;
  checkoutUrl?: string;
}

async function unwrap<T>(path: string, options?: Parameters<typeof httpJson>[1]): Promise<T> {
  const res = await httpJson<Envelope<T> | T>(path, options);
  const env = res as Envelope<T>;
  if (env && typeof env === "object" && "success" in env) {
    if (!env.success) throw new Error(env.message || "Erreur de paiement");
    return env.data as T;
  }
  return res as T;
}

export const paymentsService = {
  config: () => unwrap<PaymentsConfig>("/payments/config"),

  networks: (country?: string) =>
    unwrap<{ networks: PaymentNetwork[] }>(
      `/payments/networks${country ? `?country=${encodeURIComponent(country)}` : ""}`
    ),

  rates: () => unwrap<{ rates: PaymentRate[] }>("/payments/rates"),

  plans: (currency?: string) =>
    unwrap<{ currency: string; converted: boolean; plans: PaymentPlan[] }>(
      `/payments/plans${currency ? `?currency=${encodeURIComponent(currency)}` : ""}`
    ),

  softpay: (body: SoftpayBody) =>
    unwrap<SoftpayResult>("/payments/softpay", { method: "POST", body, timeoutMs: 30_000 }),

  status: (id: string) => unwrap<PaymentStatusResult>(`/payments/${id}`, { timeoutMs: 20_000 }),

  confirmOtp: (id: string, otp: string) =>
    unwrap<{ paymentId: string; status: string; activated: boolean }>(
      `/payments/${id}/confirm-otp`,
      { method: "POST", body: { otp } }
    ),

  retry: (id: string) =>
    unwrap<{ paymentId: string; status: string; checkoutUrl?: string }>(`/payments/${id}/retry`, {
      method: "POST",
      timeoutMs: 30_000,
    }),
};
