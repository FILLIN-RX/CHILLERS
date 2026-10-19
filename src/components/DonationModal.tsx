"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Heart, X, WarningCircle, Spinner, ShieldCheck, Check, ArrowLeft, CaretRight, CreditCard, CurrencyCircleDollar } from "@phosphor-icons/react";
import { HttpError } from "@/services/http";
import {
  paymentsService,
  type PaymentNetwork,
  type PaymentsConfig,
  type PaymentRate,
} from "@/services/payments";
import { acquireModalScrollLock, releaseModalScrollLock } from "@/lib/modalScrollLock";
import PaymentStepIndicator, { type WizardStep } from "@/components/PaymentStepIndicator";

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Id de transaction à suivre (retour de la page de paiement hébergée). */
  initialPaymentId?: string | null;
}

const PRESETS = [500, 1000, 2500, 5000];

const COUNTRY_DIAL: Record<string, string> = {
  CM: "+237", CI: "+225", BJ: "+229", SN: "+221", BF: "+226", ML: "+223",
  NE: "+227", TG: "+228", GH: "+233", NG: "+234", KE: "+254", CD: "+243",
  RW: "+250", TZ: "+255", UG: "+256", ZM: "+260", MW: "+265", GN: "+224",
};

const formatAmount = (n: number) =>
  Number.isInteger(n) ? n.toLocaleString("fr-FR") : n.toFixed(2).replace(/\.00$/, "");

type ModalView = "form" | "processing" | "success";
type PaymentPhase = "idle" | "pending" | "success" | "failed";

export default function DonationModal({ isOpen, onClose, initialPaymentId }: DonationModalProps) {
  const [config, setConfig] = useState<PaymentsConfig | null>(null);
  const [rates, setRates] = useState<PaymentRate[]>([]);
  const [country, setCountry] = useState("CM");
  const [networks, setNetworks] = useState<PaymentNetwork[]>([]);
  const [network, setNetwork] = useState("");
  const [phone, setPhone] = useState("");
  const [preOtp, setPreOtp] = useState("");
  const [amount, setAmount] = useState<number>(PRESETS[1]);
  const [customAmount, setCustomAmount] = useState("");

  const [view, setView] = useState<ModalView>("form");
  const [step, setStep] = useState<WizardStep>(1);
  const [phase, setPhase] = useState<PaymentPhase>("idle");
  const [activePayment, setActivePayment] = useState<{ id: string; instructions?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [postOtpVisible, setPostOtpVisible] = useState(false);
  const [postOtp, setPostOtp] = useState("");
  const [postOtpBusy, setPostOtpBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  /* Scroll lock + reset à l'ouverture */
  useEffect(() => {
    if (!isOpen) return;
    acquireModalScrollLock();
    return () => releaseModalScrollLock();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const resetForm = useCallback(() => {
    setView("form");
    setStep(1);
    setPhase("idle");
    setActivePayment(null);
    setErrorMessage(null);
    setPhone("");
    setPreOtp("");
    setPostOtp("");
    setPostOtpVisible(false);
    setCustomAmount("");
    setAmount(PRESETS[1]);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    // Reset différé (lint : pas de setState synchrone dans un effet)
    const resetTimer = setTimeout(resetForm, 0);
    let alive = true;
    (async () => {
      try {
        const cfg = await paymentsService.config();
        if (!alive) return;
        setConfig(cfg);
        // Pays par défaut : TOUJOURS le Cameroun s'il est disponible.
        const available = cfg.countries || [];
        const iso = available.some((c) => c.iso === "CM")
          ? "CM"
          : available.find((c) => c.currency?.toUpperCase() === "XOF")?.iso || "CM";
        setCountry(iso);
        const [ratesRes, netsRes] = await Promise.allSettled([
          paymentsService.rates(),
          paymentsService.networks(iso),
        ]);
        if (!alive) return;
        if (ratesRes.status === "fulfilled") setRates(ratesRes.value.rates);
        if (netsRes.status === "fulfilled") {
          setNetworks(netsRes.value.networks);
          setNetwork(netsRes.value.networks[0]?.code || "");
        }
      } catch (err) {
        console.error("[Don] chargement impossible:", err);
      }
    })();
    return () => {
      alive = false;
      clearTimeout(resetTimer);
    };
  }, [isOpen, resetForm]);

  /* Retour de la page de paiement hébergée (carte, Wave…) */
  useEffect(() => {
    if (!isOpen || !initialPaymentId) return;
    const t = setTimeout(() => {
      setActivePayment({ id: initialPaymentId });
      setView("processing");
      setPhase("pending");
      pollStartRef.current = Date.now();
    }, 0);
    return () => clearTimeout(t);
  }, [isOpen, initialPaymentId]);

  /* Réseaux du pays */
  useEffect(() => {
    if (!isOpen || view !== "form") return;
    let alive = true;
    paymentsService
      .networks(country)
      .then((res) => {
        if (!alive) return;
        setNetworks(res.networks);
        setNetwork((prev) =>
          res.networks.some((n) => n.code === prev) ? prev : res.networks[0]?.code || ""
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [isOpen, country, view]);

  const activeRate = rates.find((r) => r.code === network);

  /* Polling du statut */
  const startPolling = useCallback((id: string) => {
    stopPolling();
    pollStartRef.current = Date.now();
    pollRef.current = setInterval(async () => {
      try {
        const res = await paymentsService.status(id);
        if (res.status === "SUCCESS") {
          stopPolling();
          setPhase("success");
        } else if (res.status === "FAILED" || res.status === "CANCELLED") {
          stopPolling();
          setPhase("failed");
          setErrorMessage(
            res.status === "CANCELLED"
              ? "Le don a été annulé."
              : "Le don a échoué. Vérifiez votre solde et réessayez."
          );
        } else if (Date.now() - pollStartRef.current > 12_000) {
          setPostOtpVisible(true);
        }
      } catch {
        /* erreur transitoire */
      }
    }, 3_500);
  }, [stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  useEffect(() => {
    if (phase === "pending" && activePayment?.id) startPolling(activePayment.id);
  }, [phase, activePayment?.id, startPolling]);

  const effectiveAmount = customAmount ? Number(customAmount) : amount;
  const needsPhone = network !== "card" && network !== "crypto";

  /* ── Wizard : navigation entre les 3 étapes ── */
  const goFromMethod = () => {
    setErrorMessage(null);
    if (!network) return;
    if (!Number.isFinite(effectiveAmount) || effectiveAmount < 100) {
      setErrorMessage("Montant minimum : 100 FCFA.");
      return;
    }
    // Carte / crypto → checkout hébergé : pas d'étape « numéro », direct confirmation.
    setStep(needsPhone ? 2 : 3);
  };

  const goFromPhone = () => {
    setErrorMessage(null);
    if (!phone.trim() || phone.replace(/\D/g, "").length < 6) {
      setErrorMessage("Entrez un numéro de téléphone valide.");
      return;
    }
    if (activeRate?.otpRequired && !preOtp.trim()) {
      setErrorMessage("Ce réseau exige un code obtenu avant le paiement (voir consignes).");
      return;
    }
    setStep(3);
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!network) return;
    if (!Number.isFinite(effectiveAmount) || effectiveAmount < 100) {
      setErrorMessage("Montant minimum : 100 FCFA.");
      return;
    }
    // Carte / crypto → checkout hébergé : pas de numéro Mobile Money à saisir.
    const needsPhone = network !== "card" && network !== "crypto";
    if (needsPhone && (!phone.trim() || phone.replace(/\D/g, "").length < 6)) {
      setErrorMessage("Entrez un numéro de téléphone valide.");
      return;
    }
    if (activeRate?.otpRequired && !preOtp.trim()) {
      setErrorMessage("Ce réseau exige un code obtenu avant le paiement (voir consignes).");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await paymentsService.softpay({
        donationAmount: effectiveAmount,
        currency: "XOF",
        country: needsPhone ? country : undefined,
        network,
        phone: needsPhone ? phone.trim() : undefined,
        otp: activeRate?.otpRequired ? preOtp.trim() : undefined,
      });

      if (result.checkoutUrl) {
        sessionStorage.setItem("chillers_pending_payment", result.paymentId);
        window.location.href = result.checkoutUrl;
        return;
      }

      setActivePayment({ id: result.paymentId, instructions: result.instructions });
      if (result.status === "SUCCESS") {
        setPhase("success");
      } else {
        setPostOtpVisible(false);
        setPhase("pending");
      }
    } catch (err) {
      if (err instanceof HttpError && err.body.includes("not_configured")) {
        setErrorMessage("Le paiement en ligne est indisponible pour le moment.");
      } else if (err instanceof HttpError && err.body.includes("amount_too_small")) {
        setErrorMessage("Montant minimum : 100 FCFA.");
      } else {
        setErrorMessage(
          err instanceof HttpError
            ? err.body || err.message
            : err instanceof Error
            ? err.message
            : "Impossible de démarrer le paiement."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmOtp = async () => {
    if (!activePayment || !postOtp.trim()) return;
    setPostOtpBusy(true);
    setErrorMessage(null);
    try {
      const res = await paymentsService.confirmOtp(activePayment.id, postOtp.trim());
      if (res.status === "SUCCESS") {
        stopPolling();
        setPhase("success");
      } else if (res.status === "FAILED" || res.status === "CANCELLED") {
        stopPolling();
        setPhase("failed");
        setErrorMessage("Le code était incorrect ou le paiement a échoué.");
      } else {
        setErrorMessage("Code accepté — finalisation en cours…");
        setPostOtpVisible(false);
      }
    } catch (err) {
      const bodyText = err instanceof HttpError ? err.body : err instanceof Error ? err.message : "";
      if (bodyText.includes("otp_not_applicable")) {
        setPostOtpVisible(false);
        setErrorMessage("Ce réseau n'a pas besoin de code — validez sur votre téléphone.");
      } else {
        setErrorMessage("Code incorrect, réessayez.");
      }
    } finally {
      setPostOtpBusy(false);
    }
  };

  const handleRetry = async () => {
    if (!activePayment) return;
    setRetrying(true);
    setErrorMessage(null);
    try {
      const res = await paymentsService.retry(activePayment.id);
      setPhase(res.status === "SUCCESS" ? "success" : "pending");
      if (res.status !== "SUCCESS") setPostOtpVisible(false);
      if (res.checkoutUrl) {
        sessionStorage.setItem("chillers_pending_payment", activePayment.id);
        window.location.href = res.checkoutUrl;
        return;
      }
    } catch (err) {
      setErrorMessage(
        err instanceof HttpError
          ? err.body || err.message
          : err instanceof Error
          ? err.message
          : "Relance impossible."
      );
    } finally {
      setRetrying(false);
    }
  };

  if (!isOpen) return null;

  const configured = config?.configured ?? false;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Faire un don"
        className="w-full sm:max-w-sm glass-modal border-t sm:border border-brand-border rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl relative my-0 sm:my-4 animate-fade-in"
      >
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-4 sm:hidden" />

        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors z-10"
        >
          <X className="h-4 w-4" />
        </button>

        {/* ── Succès ── */}
        {phase === "success" ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-14 h-14 rounded-full bg-brand-primary/15 flex items-center justify-center mx-auto">
              <Heart className="h-7 w-7 text-brand-primary" fill="currentColor" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Merci pour ton soutien !</h3>
              <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                Ton don de <strong className="text-white">{formatAmount(effectiveAmount)} FCFA</strong>{" "}
                aide à maintenir CHILLERS gratuit et sans pub.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-[5px] bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-all cursor-pointer"
            >
              Fermer
            </button>
          </div>
        ) : view === "processing" || phase === "pending" || phase === "failed" ? (
          /* ── En attente / échec ── */
          <div className="space-y-4">
            <div className="text-center space-y-1 pt-1">
              <span className="text-[10px] font-bold text-brand-primary uppercase tracking-widest block">
                Don en cours
              </span>
              <h3 className="text-lg font-black text-white">{formatAmount(effectiveAmount)} FCFA</h3>
            </div>

            {phase !== "failed" && (
              <div className="text-center py-2 space-y-3">
                <Spinner className="w-8 h-8 animate-spin text-brand-primary mx-auto" />
                <p className="text-zinc-200 text-sm font-semibold">
                  Confirmez le don sur votre téléphone
                </p>
                {activePayment?.instructions && (
                  <p className="text-zinc-400 text-[11px] leading-relaxed bg-black/30 border border-brand-border rounded-[4px] p-3">
                    {activePayment.instructions}
                  </p>
                )}
              </div>
            )}

            {postOtpVisible && phase === "pending" && (
              <div className="bg-black/30 border border-amber-500/25 rounded-[4px] p-3 space-y-2">
                <p className="text-amber-300 text-[11px] font-semibold">
                  Vous avez reçu un code par SMS ? (certains réseaux le demandent)
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Code reçu"
                    value={postOtp}
                    onChange={(e) => setPostOtp(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-[4px] bg-black/30 border border-brand-border text-white text-xs focus:outline-none focus:border-brand-primary"
                  />
                  <button
                    onClick={handleConfirmOtp}
                    disabled={postOtpBusy || !postOtp.trim()}
                    className="px-3 py-1.5 rounded-[5px] bg-brand-primary text-white text-xs font-bold disabled:opacity-50 cursor-pointer active:scale-95 transition-all"
                  >
                    {postOtpBusy ? <Spinner className="w-3.5 h-3.5 animate-spin" /> : "Valider"}
                  </button>
                </div>
              </div>
            )}

            {errorMessage && (
              <div
                className={`flex items-center gap-2 p-2 rounded-[4px] text-[11px] border ${
                  phase === "failed"
                    ? "bg-red-500/15 border-red-500/30 text-red-400"
                    : "bg-amber-500/15 border-amber-500/30 text-amber-300"
                }`}
              >
                <WarningCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (phase === "failed") {
                    setView("form");
                    setPhase("idle");
                    setStep(1);
                  } else {
                    onClose();
                  }
                }}
                className="w-1/3 py-2.5 rounded-[5px] bg-black/30 hover:bg-white/10 text-zinc-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                {phase === "failed" ? (
                  <>
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Modifier</span>
                  </>
                ) : (
                  <span>Annuler</span>
                )}
              </button>
              {phase === "failed" && (
                <button
                  onClick={handleRetry}
                  disabled={retrying}
                  className="flex-1 py-2.5 rounded-[5px] bg-brand-primary hover:bg-[#b5034f] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                >
                  {retrying ? (
                    <Spinner className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Réessayer</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        ) : (
          /* ── Formulaire de don (wizard : Méthode → Numéro → Confirmation) ── */
          <form onSubmit={handlePay} className="space-y-4">
            <div className="text-center space-y-2 pt-1">
              <div className="w-12 h-12 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center mx-auto">
                <Heart className="h-6 w-6 text-brand-primary" fill="currentColor" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  Soutenir <span className="text-brand-primary">CHILLERS</span>
                </h3>
                <p className="text-xs text-zinc-300 mt-1">
                  Gratuit et sans pub. Ton don finance les serveurs.
                </p>
              </div>
            </div>

            {!configured ? (
              <div className="flex items-center gap-2 p-2.5 rounded-[4px] bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs">
                <WarningCircle className="w-4 h-4 shrink-0" />
                <span>Le paiement en ligne est indisponible pour le moment.</span>
              </div>
            ) : (
              <>
                <PaymentStepIndicator step={step} />

                {/* ── Étape 1 · Méthode ── */}
                {step === 1 && (
                  <div className="space-y-4">
                    {/* Montant */}
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1.5 font-semibold">
                        Montant du don (FCFA)
                      </label>
                      <div className="grid grid-cols-4 gap-1.5 mb-2">
                        {PRESETS.map((p) => (
                          <button
                            type="button"
                            key={p}
                            onClick={() => {
                              setAmount(p);
                              setCustomAmount("");
                            }}
                            className={`py-2 rounded-[5px] border text-xs font-bold transition-all cursor-pointer ${
                              !customAmount && amount === p
                                ? "bg-brand-primary/15 border-brand-primary text-brand-primary shadow-[0_0_12px_rgba(244,42,124,0.18)]"
                                : "bg-black/30 border-brand-border text-zinc-300 hover:border-brand-primary/40"
                            }`}
                          >
                            {formatAmount(p)}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={100}
                        step={50}
                        placeholder="Autre montant (min. 100)"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-[4px] bg-black/30 border border-brand-border text-white text-xs focus:outline-none focus:border-brand-primary"
                      />
                    </div>

                    {/* Pays */}
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1 font-semibold">Pays</label>
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-[4px] bg-black/30 border border-brand-border text-white text-xs focus:outline-none focus:border-brand-primary cursor-pointer"
                      >
                        {(config?.countries || [])
                          .filter((c) => ["XOF", "XAF"].includes(c.currency?.toUpperCase()))
                          .map((c) => (
                            <option key={c.iso} value={c.iso}>
                              {c.name} ({c.iso})
                            </option>
                          ))}
                        {!config?.countries?.length && <option value="CM">Cameroun (CM)</option>}
                      </select>
                    </div>

                    {/* Réseau */}
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1 font-semibold">
                        Moyen de paiement
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {networks.map((n) => {
                          const selected = network === n.code;
                          const isCard = n.code === "card";
                          const isCrypto = n.code === "crypto";
                          return (
                            <button
                              type="button"
                              key={n.code}
                              onClick={() => setNetwork(n.code)}
                              className={`p-2 rounded-[5px] border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                selected
                                  ? "bg-brand-primary/15 border-brand-primary text-brand-primary font-bold shadow-[0_0_12px_rgba(244,42,124,0.18)]"
                                  : "bg-black/30 border-brand-border text-zinc-400 hover:border-brand-primary/40"
                              }`}
                            >
                              {isCard ? (
                                <CreditCard className="w-3.5 h-3.5" />
                              ) : isCrypto ? (
                                <CurrencyCircleDollar className="w-3.5 h-3.5" />
                              ) : null}
                              <span className="text-[11px] font-black tracking-wide truncate">
                                {n.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Étape 2 · Numéro ── */}
                {step === 2 && needsPhone && (
                  <div className="space-y-3">
                    {/* Mini-récap méthode + montant */}
                    <div className="flex items-center justify-between bg-black/30 border border-brand-border rounded-[4px] px-3 py-2">
                      <span className="text-[11px] text-zinc-300 font-semibold">
                        {networks.find((n) => n.code === network)?.name || network}
                      </span>
                      <span className="text-xs font-black text-white">
                        {formatAmount(effectiveAmount)} FCFA
                      </span>
                    </div>

                    {/* Téléphone */}
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1 font-semibold">
                        Numéro Mobile Money
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-2 rounded-[4px] bg-black/30 border border-brand-border text-zinc-300 text-xs font-bold shrink-0">
                          {COUNTRY_DIAL[country] || "+"}
                        </span>
                        <input
                          type="tel"
                          inputMode="tel"
                          placeholder="6XXXXXXXX"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="flex-1 px-2.5 py-2 rounded-[4px] bg-black/30 border border-brand-border text-white text-xs focus:outline-none focus:border-brand-primary"
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    {/* OTP pré-paiement */}
                    {activeRate?.otpRequired && (
                      <div className="bg-black/30 border border-brand-border rounded-[4px] p-2.5 space-y-1.5">
                        <p className="text-amber-300 text-[11px] font-semibold">
                          ⚠️ Ce réseau exige un code avant le paiement :
                        </p>
                        <p className="text-zinc-400 text-[10px] leading-relaxed">
                          {activeRate.otpInstructions}
                        </p>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Code obtenu"
                          value={preOtp}
                          onChange={(e) => setPreOtp(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-[4px] bg-black/30 border border-amber-500/30 text-white text-xs focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* ── Étape 3 · Confirmation ── */}
                {step === 3 && (
                  <div className="bg-black/30 border border-brand-border rounded-[4px] divide-y divide-brand-border/60 text-xs">
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-zinc-400">Montant</span>
                      <span className="font-black text-white">
                        {formatAmount(effectiveAmount)} FCFA
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-zinc-400">Moyen</span>
                      <span className="font-bold text-white">
                        {networks.find((n) => n.code === network)?.name || network}
                      </span>
                    </div>
                    {needsPhone ? (
                      <div className="flex items-center justify-between px-3 py-2">
                        <span className="text-zinc-400">Numéro</span>
                        <span className="font-bold text-white">
                          {COUNTRY_DIAL[country] || "+"} {phone.trim()}
                        </span>
                      </div>
                    ) : (
                      <div className="px-3 py-2 text-[10px] text-zinc-500 leading-relaxed">
                        Tu seras redirigé vers une page de paiement sécurisée pour finaliser avec{" "}
                        {network === "card" ? "ta carte" : "ta crypto"}.
                      </div>
                    )}
                    {activeRate?.otpRequired && preOtp.trim() && (
                      <div className="flex items-center justify-between px-3 py-2">
                        <span className="text-zinc-400">Code</span>
                        <span className="font-bold text-white">{preOtp.trim()}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {errorMessage && (
              <div className="flex items-center gap-2 p-2 rounded-[4px] bg-red-500/15 border border-red-500/30 text-red-400 text-[11px]">
                <WarningCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Actions par étape */}
            {configured && (
              <div className="flex gap-2">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setStep(step === 3 && needsPhone ? 2 : 1);
                    }}
                    className="w-1/3 py-2.5 rounded-[5px] bg-black/30 hover:bg-white/10 text-zinc-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Retour</span>
                  </button>
                )}
                {step === 1 && (
                  <button
                    type="button"
                    onClick={goFromMethod}
                    disabled={!network}
                    className="flex-1 py-2.5 rounded-[5px] bg-white text-black font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-zinc-200 cursor-pointer transition-all active:scale-95 disabled:opacity-40"
                  >
                    <span>Continuer</span>
                    <CaretRight className="w-3.5 h-3.5" />
                  </button>
                )}
                {step === 2 && needsPhone && (
                  <button
                    type="button"
                    onClick={goFromPhone}
                    className="flex-1 py-2.5 rounded-[5px] bg-white text-black font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-zinc-200 cursor-pointer transition-all active:scale-95"
                  >
                    <span>Continuer</span>
                    <CaretRight className="w-3.5 h-3.5" />
                  </button>
                )}
                {step === 3 && (
                  <button
                    type="submit"
                    disabled={submitting || !configured || !network}
                    className="flex-1 py-2.5 rounded-[5px] bg-brand-primary hover:bg-[#b5034f] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Spinner className="w-4 h-4 animate-spin" />
                        <span>Démarrage…</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Donner {formatAmount(effectiveAmount || 0)} FCFA</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            <p className="text-[10px] text-zinc-600 text-center leading-relaxed">
              Paiement sécurisé via Mobile Money ou carte. Chillers ne stocke aucun de tes
              coordonnées bancaires.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
