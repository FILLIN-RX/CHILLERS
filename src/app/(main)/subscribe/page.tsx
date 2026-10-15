'use client';

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { userService } from "@/services/user";
import { HttpError } from "@/services/http";
import {
  paymentsService,
  type PaymentNetwork,
  type PaymentPlan,
  type PaymentsConfig,
  type PaymentRate,
  type SoftpayResult,
} from "@/services/payments";
import {
  Check,
  X,
  ListChecks,
  Crown,
  WarningCircle,
  Spinner,
  ArrowLeft,
  ShieldCheck,
  CreditCard,
  CurrencyCircleDollar,
  GlobeHemisphereEast,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import PosterWallBackground from "@/components/PosterWallBackground";

/* Symboles / indicatifs pour les pays et devises courants */
const CURRENCY_SYMBOL: Record<string, string> = {
  XOF: "FCFA", XAF: "FCFA", USD: "$", EUR: "€", GBP: "£", GHS: "GH₵",
  NGN: "₦", KES: "KSh", TZS: "TSh", UGX: "USh", RWF: "RF", ZMW: "ZK",
  MWK: "MK", GNF: "GNF", CDF: "FC", MAD: "MAD", DZD: "DA", EGP: "E£",
};

const COUNTRY_DIAL: Record<string, string> = {
  CM: "+237", CI: "+225", BJ: "+229", SN: "+221", BF: "+226", ML: "+223",
  NE: "+227", TG: "+228", GH: "+233", NG: "+234", KE: "+254", CD: "+243",
  RW: "+250", TZ: "+255", UG: "+256", ZM: "+260", MW: "+265", GN: "+224",
};

const formatAmount = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.00$/, "");

const symbolFor = (code: string) => CURRENCY_SYMBOL[code] || code;

type ModalView = "form" | "processing" | "success";
type PaymentPhase = "idle" | "pending" | "success" | "failed";

export default function SubscribePage() {
  const { user } = useAuthStore();
  const router = useRouter();

  /* ── Données ── */
  const [config, setConfig] = useState<PaymentsConfig | null>(null);
  const [currency, setCurrency] = useState("XOF");
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── Modal de paiement ── */
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlan | null>(null);
  const [view, setView] = useState<ModalView>("form");
  const [country, setCountry] = useState("CM");
  const [network, setNetwork] = useState("");
  const [networks, setNetworks] = useState<PaymentNetwork[]>([]);
  const [phone, setPhone] = useState("");
  const [preOtp, setPreOtp] = useState("");
  const [rates, setRates] = useState<PaymentRate[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /* ── Paiement en cours ── */
  const [activePayment, setActivePayment] = useState<{ id: string; instructions?: string } | null>(null);
  const [phase, setPhase] = useState<PaymentPhase>("idle");
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

  const refreshProfile = useCallback(async () => {
    try {
      const st = useAuthStore.getState();
      if (!st.token) return;
      const res = await userService.getProfile(st.token);
      if (res.success && res.user) st.setAuth(st.token, res.user as never);
    } catch {
      /* profil rafraîchi au prochain chargement */
    }
  }, []);

  /* ── Chargement config + plans ── */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cfg = await paymentsService.config();
        if (!alive) return;
        setConfig(cfg);
        const cur = cfg.defaultCurrency || "XOF";
        setCurrency(cur);
        const [cfgRes, plansRes] = await Promise.allSettled([
          paymentsService.rates(),
          paymentsService.plans(cur),
        ]);
        if (!alive) return;
        if (cfgRes.status === "fulfilled") setRates(cfgRes.value.rates);
        if (plansRes.status === "fulfilled") setPlans(plansRes.value.plans);
      } catch (err) {
        console.error("[Subscribe] chargement impossible:", err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* ── Recharger les prix quand la devise change ── */
  const changeCurrency = useCallback(async (code: string) => {
    setCurrency(code);
    try {
      const res = await paymentsService.plans(code);
      setPlans(res.plans);
    } catch (err) {
      console.error("[Subscribe] conversion impossible:", err);
    }
  }, []);

  /* ── Retour de la page de paiement hébergée (carte/crypto, Wave…) ── */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const pid = q.get("payment");
    if (!pid) return;
    window.history.replaceState({}, "", "/subscribe");
    // Mise à jour d'état différée : le lint interdit les setState synchrones
    // dans le corps d'un effet (cascade de rendus).
    const t = setTimeout(() => {
      setPostOtpVisible(false);
      setActivePayment({ id: pid });
      setView("processing");
      setPhase("pending");
      pollStartRef.current = Date.now();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  /* ── Polling du statut (filet de sécurité côté serveur = verify) ── */
  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      pollStartRef.current = Date.now();
      pollRef.current = setInterval(async () => {
        try {
          const res = await paymentsService.status(id);
          if (res.status === "SUCCESS") {
            stopPolling();
            setPhase("success");
            await refreshProfile();
          } else if (res.status === "FAILED" || res.status === "CANCELLED") {
            stopPolling();
            setPhase("failed");
            setErrorMessage(
              res.status === "CANCELLED"
                ? "Le paiement a été annulé."
                : "Le paiement a échoué. Vérifiez votre solde et réessayez."
            );
          } else if (Date.now() - pollStartRef.current > 12_000) {
            // PENDING depuis >12s : si le réseau exige une confirmation OTP,
            // le user a probablement reçu un code — on propose de le saisir.
            setPostOtpVisible(true);
          }
        } catch {
          /* erreur réseau transitoire — le prochain tour rattrape */
        }
      }, 3_500);
    },
    [refreshProfile, stopPolling]
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  useEffect(() => {
    if (phase === "pending" && activePayment?.id) startPolling(activePayment.id);
  }, [phase, activePayment?.id, startPolling]);

  /* ── Réseaux du pays sélectionné (fetch dans l'effet, setState en callback) ── */
  useEffect(() => {
    if (!selectedPlan || view !== "form") return;
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
      .catch(() => {
        if (!alive) return;
        setNetworks([{ code: "card", name: "Carte bancaire", country: "XX" }]);
        setNetwork("card");
      });
    return () => {
      alive = false;
    };
  }, [selectedPlan, country, view]);

  const activeRate = rates.find((r) => r.code === network);

  /* ── Ouverture / fermeture du modal ── */
  const openPlan = (plan: PaymentPlan) => {
    if (!user) {
      router.push("/login?redirect=/subscribe");
      return;
    }
    setSelectedPlan(plan);
    setView("form");
    setPhase("idle");
    setActivePayment(null);
    setErrorMessage(null);
    setPhone("");
    setPreOtp("");
    setPostOtp("");
    setPostOtpVisible(false);
    // Pays par défaut : TOUJOURS le Cameroun s'il est disponible,
    // sinon premier pays de la devise sélectionnée.
    const available = config?.countries || [];
    const fromCurrency = available.find((c) => c.currency?.toUpperCase() === currency)?.iso;
    setCountry(available.some((c) => c.iso === "CM") ? "CM" : fromCurrency || "CM");
  };

  const closeModal = () => {
    stopPolling();
    setSelectedPlan(null);
    setActivePayment(null);
    setPhase("idle");
    setErrorMessage(null);
  };

  /* ── Envoi softpay ── */
  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan || !network) return;
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
      const result: SoftpayResult = await paymentsService.softpay({
        planCode: selectedPlan.code,
        currency,
        country: needsPhone ? country : undefined,
        network,
        phone: needsPhone ? phone.trim() : undefined,
        otp: activeRate?.otpRequired ? preOtp.trim() : undefined,
      });

      if (result.checkoutUrl) {
        // Page hébergée SasPay (cartes, Wave, Orange CI…) : le retour se fait
        // via /subscribe?payment=<id> — on stocke l'id en attendant.
        sessionStorage.setItem("chillers_pending_payment", result.paymentId);
        window.location.href = result.checkoutUrl;
        return;
      }

      setActivePayment({ id: result.paymentId, instructions: result.instructions });
      if (result.status === "SUCCESS") {
        setPhase("success");
        await refreshProfile();
      } else {
        setPostOtpVisible(false);
        setPhase("pending");
      }
    } catch (err) {
      setErrorMessage(
        err instanceof HttpError
          ? err.body || err.message
          : err instanceof Error
          ? err.message
          : "Impossible de démarrer le paiement."
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Confirmation OTP après push ── */
  const handleConfirmOtp = async () => {
    if (!activePayment || !postOtp.trim()) return;
    setPostOtpBusy(true);
    setErrorMessage(null);
    try {
      const res = await paymentsService.confirmOtp(activePayment.id, postOtp.trim());
      if (res.status === "SUCCESS") {
        stopPolling();
        setPhase("success");
        await refreshProfile();
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
        setErrorMessage("Ce réseau n'a pas besoin de code — validez directement sur votre téléphone.");
      } else {
        setErrorMessage("Code incorrect, réessayez.");
      }
    } finally {
      setPostOtpBusy(false);
    }
  };

  /* ── Relance après échec ── */
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

  /* ── Rendu ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#060608] flex items-center justify-center text-foreground">
        <Spinner className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  const configured = config?.configured ?? false;
  const currencyOptions = config?.currencies?.length
    ? config.currencies.map((c) => c.code)
    : ["XOF"];

  return (
    <div className="relative min-h-screen lg:h-screen lg:overflow-hidden bg-[#060608] text-foreground pt-24 sm:pt-28 pb-16 px-4 sm:px-6 lg:px-8 select-none lg:flex lg:flex-col lg:justify-center">
      {/* Mur de posters façon 404 — statique, verrouillé au viewport */}
      <PosterWallBackground position="fixed" dim />

      <div className="relative z-10 max-w-5xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10 lg:mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold mb-4">
            <Crown className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span>Formules VIP & Streaming Illimité</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground mb-3">
            Passez à l&apos;Expérience Chiller
          </h1>
          <p className="text-brand-text-muted text-xs sm:text-sm leading-relaxed max-w-xl mx-auto">
            Payez en Mobile Money ou carte — activation immédiate de votre abonnement.
          </p>
        </div>

        {/* Sélecteur de devise */}
        <div className="flex items-center justify-center gap-2 mb-10 lg:mb-6">
          <GlobeHemisphereEast className="w-4 h-4 text-brand-text-muted" />
          <label htmlFor="currency-select" className="text-xs text-brand-text-muted font-semibold">
            Devise :
          </label>
          <select
            id="currency-select"
            value={currency}
            onChange={(e) => changeCurrency(e.target.value)}
            className="bg-brand-card border border-brand-border rounded-xs px-3 py-1.5 text-xs font-bold text-foreground focus:outline-none focus:border-brand-primary cursor-pointer"
          >
            {currencyOptions.map((code) => (
              <option key={code} value={code}>
                {code} ({symbolFor(code)})
              </option>
            ))}
          </select>
        </div>

        {!configured && (
          <div className="max-w-xl mx-auto mb-10 flex items-center gap-2 p-3 rounded-xs bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs">
            <WarningCircle className="w-4 h-4 shrink-0" />
            <span>
              Le paiement en ligne est momentanément indisponible. Réessayez plus tard.
            </span>
          </div>
        )}

        {/* Grille des abonnements */}
        <div className="flex flex-col md:flex-row items-stretch justify-center gap-5 sm:gap-6 max-w-4xl mx-auto mb-16 lg:mb-0">
          {plans.map((plan) => {
            const isCurrent = user?.subscription?.plan === plan.code;
            const isPremium = plan.code === "premium";

            return (
              <div
                key={plan._id}
                className={`relative flex-1 w-full rounded-xs p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 ${
                  isPremium
                    ? "bg-brand-card border-2 border-brand-secondary/60 shadow-[0_8px_30px_rgba(124,58,237,0.18)]"
                    : "bg-brand-card border border-brand-border hover:border-brand-primary/40"
                }`}
              >
                {isPremium && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-xs bg-brand-primary text-foreground text-[10px] font-black tracking-wider uppercase shadow-md">
                    RECOMMANDÉ
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl sm:text-2xl font-bold text-foreground">{plan.name}</h3>
                    {isCurrent && (
                      <span className="px-2.5 py-0.5 rounded-xs bg-emerald-500/20 text-emerald-400 text-[11px] font-bold">
                        Actuel
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-2 mb-6">
                    <span className="text-3xl sm:text-4xl font-black text-foreground">
                      {formatAmount(plan.price)}
                    </span>
                    <span className="text-xs font-bold text-brand-text-muted">
                      {symbolFor(plan.currency)} / mois
                    </span>
                  </div>

                  <ul className="space-y-3 mb-8 text-xs sm:text-sm text-brand-text-muted">
                    <li className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>
                        Qualité maximale :{" "}
                        <strong className="text-foreground">{plan.features.maxResolution}</strong>
                      </span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>
                        Écrans simultanés :{" "}
                        <strong className="text-foreground">{plan.features.maxDevices}</strong>
                      </span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Reprise de lecture automatique</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Téléchargements illimités haute vitesse</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Accès prioritaire sans attente</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => openPlan(plan)}
                  disabled={isCurrent}
                  className={`w-full py-3 rounded-md font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-md active:scale-95 ${
                    isCurrent
                      ? "bg-brand-card text-brand-text-muted cursor-not-allowed"
                      : isPremium
                      ? "bg-brand-primary hover:bg-brand-primary/85 text-foreground"
                      : "bg-white text-black hover:bg-zinc-200"
                  }`}
                >
                  {isCurrent ? "Votre Plan Actuel" : `Choisir ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        {/* ── MODAL DE PAIEMENT ────────────────────────────────────────── */}
        {selectedPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
            <div className="relative w-full max-w-md glass-modal border border-brand-border rounded-2xl p-5 sm:p-6 my-4">
              <button
                onClick={closeModal}
                aria-label="Fermer"
                className="absolute top-4 right-4 text-brand-text-muted hover:text-foreground p-1 rounded-md hover:bg-white/10 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* ── Succès ── */}
              {view === "success" || phase === "success" ? (
                <div className="text-center py-4 space-y-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                    <ListChecks className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Abonnement activé !</h3>
                  <p className="text-brand-text-muted text-xs sm:text-sm leading-relaxed">
                    Votre formule <strong className="text-foreground">{selectedPlan.name}</strong> est
                    active. Bon visionnage !
                  </p>
                  <button
                    onClick={() => router.push("/")}
                    className="w-full py-2.5 rounded-md bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-all cursor-pointer"
                  >
                    Profiter de CHILLERS
                  </button>
                </div>
              ) : view === "processing" || phase === "pending" || phase === "failed" ? (
                /* ── En attente / échec ── */
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-brand-border pb-3 pr-6">
                    <div>
                      <span className="text-[10px] font-bold text-brand-primary uppercase tracking-widest block">
                        Paiement en cours
                      </span>
                      <h3 className="text-base sm:text-lg font-black text-foreground leading-tight">
                        {selectedPlan.name}
                      </h3>
                    </div>
                    <div className="text-right">
                      <span className="text-base sm:text-lg font-black text-foreground">
                        {formatAmount(selectedPlan.price)}
                      </span>
                      <span className="text-[10px] text-brand-text-muted font-bold block">
                        {symbolFor(selectedPlan.currency)}
                      </span>
                    </div>
                  </div>

                  {phase !== "failed" && (
                    <div className="text-center py-3 space-y-3">
                      <Spinner className="w-8 h-8 animate-spin text-brand-primary mx-auto" />
                      <p className="text-foreground text-sm font-semibold">
                        Confirmez le paiement sur votre téléphone
                      </p>
                      {activePayment?.instructions && (
                        <p className="text-brand-text-muted text-[11px] leading-relaxed bg-brand-card/60 border border-brand-border rounded-xs p-3">
                          {activePayment.instructions}
                        </p>
                      )}
                      <p className="text-brand-text-muted text-[11px]">
                        Validation automatique dès confirmation — vous n&apos;avez rien d&apos;autre à
                        faire.
                      </p>
                    </div>
                  )}

                  {postOtpVisible && phase === "pending" && (
                    <div className="bg-brand-card/60 border border-amber-500/25 rounded-xs p-3 space-y-2">
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
                          className="flex-1 px-2.5 py-1.5 rounded-xs bg-brand-card border border-brand-border text-foreground text-xs focus:outline-none focus:border-brand-primary"
                        />
                        <button
                          onClick={handleConfirmOtp}
                          disabled={postOtpBusy || !postOtp.trim()}
                          className="px-3 py-1.5 rounded-md bg-brand-primary text-foreground text-xs font-bold disabled:opacity-50 cursor-pointer active:scale-95 transition-all"
                        >
                          {postOtpBusy ? <Spinner className="w-3.5 h-3.5 animate-spin" /> : "Valider"}
                        </button>
                      </div>
                    </div>
                  )}

                  {phase === "failed" && (
                    <div className="flex items-center gap-2 p-2 rounded-xs bg-red-500/15 border border-red-500/30 text-red-400 text-[11px]">
                      <WarningCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errorMessage || "Le paiement a échoué."}</span>
                    </div>
                  )}
                  {phase !== "failed" && errorMessage && (
                    <div className="flex items-center gap-2 p-2 rounded-xs bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px]">
                      <WarningCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => (phase === "failed" ? setView("form") : closeModal())}
                      className="w-1/3 py-2.5 rounded-md bg-brand-card hover:bg-zinc-700 text-brand-text-muted font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
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
                        className="flex-1 py-2.5 rounded-md bg-brand-primary hover:bg-brand-primary/85 text-foreground font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                      >
                        {retrying ? (
                          <Spinner className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Réessayer le paiement</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* ── Formulaire de paiement ── */
                <form onSubmit={handlePay} className="space-y-4">
                  <div className="flex items-center justify-between border-b border-brand-border pb-3 pr-6">
                    <div>
                      <span className="text-[10px] font-bold text-brand-primary uppercase tracking-widest block">
                        Abonnement
                      </span>
                      <h3 className="text-base sm:text-lg font-black text-foreground leading-tight">
                        {selectedPlan.name}
                      </h3>
                    </div>
                    <div className="text-right">
                      <span className="text-base sm:text-lg font-black text-foreground">
                        {formatAmount(selectedPlan.price)}
                      </span>
                      <span className="text-[10px] text-brand-text-muted font-bold block">
                        {symbolFor(selectedPlan.currency)} / mois
                      </span>
                    </div>
                  </div>

                  {!configured ? (
                    <div className="flex items-center gap-2 p-2.5 rounded-xs bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs">
                      <WarningCircle className="w-4 h-4 shrink-0" />
                      <span>Le paiement en ligne est indisponible pour le moment.</span>
                    </div>
                  ) : (
                    <>
                      {/* Pays */}
                      <div>
                        <label className="text-[10px] text-brand-text-muted block mb-1 font-semibold">
                          Pays
                        </label>
                        <select
                          value={country}
                          onChange={(e) => {
                            const iso = e.target.value;
                            setCountry(iso);
                            // La devise suit le pays par défaut (convertible si besoin)
                            const cur = config?.countries?.find((c) => c.iso === iso)?.currency;
                            if (cur && cur.toUpperCase() !== currency) {
                              changeCurrency(cur.toUpperCase());
                            }
                          }}
                          className="w-full px-2.5 py-2 rounded-xs bg-brand-card border border-brand-border text-foreground text-xs focus:outline-none focus:border-brand-primary cursor-pointer"
                        >
                          {(config?.countries || []).map((c) => (
                            <option key={c.iso} value={c.iso}>
                              {c.name} ({c.iso})
                            </option>
                          ))}
                          {!config?.countries?.length && <option value="CM">Cameroun (CM)</option>}
                        </select>
                      </div>

                      {/* Réseau */}
                      <div>
                        <label className="text-[10px] text-brand-text-muted block mb-1 font-semibold">
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
                                className={`p-2.5 rounded-md border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                  selected
                                    ? "bg-brand-primary/15 border-brand-primary text-brand-primary font-bold shadow-[0_0_12px_rgba(244,42,124,0.18)]"
                                    : "bg-brand-card border-brand-border text-brand-text-muted hover:border-brand-primary/40"
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

                      {/* Frais + OTP pré-paiement */}
                      {activeRate && (
                        <div className="bg-brand-card/60 border border-brand-border rounded-xs p-2.5 space-y-2">
                          {activeRate.feePercent > 0 && (
                            <p className="text-[10px] text-brand-text-muted">
                              Frais opérateur :{" "}
                              <strong className="text-foreground">
                                {activeRate.feePercent}%
                                {activeRate.feeFixed > 0 ? ` + ${formatAmount(activeRate.feeFixed)}` : ""}
                              </strong>{" "}
                              {activeRate.feeMode === "DEDUCTED"
                                ? "inclus dans le montant"
                                : "ajoutés au montant débité"}
                              .
                            </p>
                          )}
                          {activeRate.otpRequired && (
                            <>
                              <p className="text-amber-300 text-[11px] font-semibold leading-relaxed">
                                ⚠️ Ce réseau exige un code <strong>avant</strong> le paiement :
                              </p>
                              <p className="text-brand-text-muted text-[10px] leading-relaxed">
                                {activeRate.otpInstructions}
                              </p>
                            </>
                          )}
                        </div>
                      )}

                      {/* Téléphone (Mobile Money uniquement — carte/crypto = checkout hébergé) */}
                      {network !== "card" && network !== "crypto" ? (
                        <div>
                          <label className="text-[10px] text-brand-text-muted block mb-1 font-semibold">
                            Numéro Mobile Money
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-2 rounded-xs bg-brand-card border border-brand-border text-brand-text-muted text-xs font-bold shrink-0">
                              {COUNTRY_DIAL[country] || "+"}
                            </span>
                            <input
                              type="tel"
                              inputMode="tel"
                              placeholder="6XXXXXXXX"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              className="flex-1 px-2.5 py-2 rounded-xs bg-brand-card border border-brand-border text-foreground text-xs focus:outline-none focus:border-brand-primary"
                              required
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] text-brand-text-muted leading-relaxed">
                          Vous serez redirigé vers une page de paiement sécurisée pour finaliser
                          avec {network === "card" ? "votre carte" : "votre crypto"}.
                        </p>
                      )}

                      {/* OTP pré-paiement */}
                      {activeRate?.otpRequired && (
                        <div>
                          <label className="text-[10px] text-brand-text-muted block mb-1 font-semibold">
                            Code obtenu avant paiement *
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Code USSD reçu"
                            value={preOtp}
                            onChange={(e) => setPreOtp(e.target.value)}
                            className="w-full px-2.5 py-2 rounded-xs bg-brand-card border border-amber-500/30 text-foreground text-xs focus:outline-none focus:border-amber-400"
                            required
                          />
                        </div>
                      )}
                    </>
                  )}

                  {errorMessage && (
                    <div className="flex items-center gap-2 p-2 rounded-xs bg-red-500/15 border border-red-500/30 text-red-400 text-[11px]">
                      <WarningCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="w-1/3 py-2.5 rounded-md bg-brand-card hover:bg-zinc-700 text-brand-text-muted font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Retour</span>
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || !configured || !network}
                      className="flex-1 py-2.5 rounded-md bg-brand-primary hover:bg-brand-primary/85 text-foreground font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <Spinner className="w-4 h-4 animate-spin" />
                          <span>Démarrage…</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>
                            Payer {formatAmount(selectedPlan.price)}{" "}
                            {symbolFor(selectedPlan.currency)}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
