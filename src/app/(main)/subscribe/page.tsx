'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { httpJson } from '@/app/api';
import {
  IconCheck,
  IconX,
  IconArrowLeft,
  IconUpload,
  IconCopy,
  IconChecklist,
  IconSparkles,
  IconAlertCircle,
  IconLoader2
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';

interface Plan {
  _id: string;
  code: string;
  name: string;
  price: number;
  durationMonths: number;
  features: {
    maxResolution: string;
    maxDevices: number;
    hasContinueWatching: boolean;
    hasWatchHistory: boolean;
    hasDownloads: boolean;
  };
}

export default function SubscribePage() {
  const { user, token } = useAuthStore();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal paiement & preuve
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'orange' | 'mtn'>('orange');
  const [senderPhone, setSenderPhone] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

  const ORANGE_NUMBER = '697407380';
  const MTN_NUMBER = '674376524';

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await httpJson<{ success: boolean; plans: Plan[] }>('/auth/plans');
        if (res?.success && res.plans?.length > 0) {
          setPlans(res.plans);
        } else {
          // Fallback par défaut si base vide
          setPlans([
            {
              _id: '1',
              code: 'standard',
              name: 'Standard HD',
              price: 1500,
              durationMonths: 1,
              features: {
                maxResolution: '720p HD',
                maxDevices: 2,
                hasContinueWatching: true,
                hasWatchHistory: true,
                hasDownloads: true,
              },
            },
            {
              _id: '2',
              code: 'premium',
              name: 'Premium 1080p Ultra',
              price: 2500,
              durationMonths: 1,
              features: {
                maxResolution: '1080p Full HD',
                maxDevices: 4,
                hasContinueWatching: true,
                hasWatchHistory: true,
                hasDownloads: true,
              },
            },
          ]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNumber(text);
    setTimeout(() => setCopiedNumber(null), 2500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setScreenshotFile(file);
      setScreenshotPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      router.push('/login?redirect=/subscribe');
      return;
    }
    if (!selectedPlan) return;
    if (!screenshotFile) {
      setErrorMessage('Veuillez joindre la capture d’écran de votre virement.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Upload de la capture d'écran
      const formData = new FormData();
      formData.append('screenshot', screenshotFile);

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
      const uploadRes = await fetch(`${API_URL}/auth/payment-proof/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const uploadJson = await uploadRes.json();
      if (!uploadJson.success || !uploadJson.url) {
        throw new Error(uploadJson.message || 'Échec du téléversement de la capture.');
      }

      // 2. Envoi de la preuve
      const res = await httpJson<{ success: boolean; message: string }>('/auth/payment-proof', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: {
          planCode: selectedPlan.code,
          planName: selectedPlan.name,
          amount: selectedPlan.price,
          paymentMethod,
          senderPhone: senderPhone.trim(),
          transactionRef: transactionRef.trim(),
          screenshotUrl: uploadJson.url,
        },
      });

      if (res.success) {
        setSuccessMessage('Votre preuve a été envoyée avec succès ! Notre équipe va valider votre paiement et activer votre compte dans quelques instants.');
      } else {
        throw new Error(res.message || 'Erreur lors de l’envoi de la preuve.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Une erreur est survenue lors de l’envoi.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center text-white">
        <IconLoader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Bouton retour */}
        <button
          onClick={() => router.back()}
          aria-label="Retour"
          className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white text-xs font-semibold transition-all hover:scale-[1.02] active:scale-95"
        >
          <IconArrowLeft className="w-4 h-4" />
          Retour
        </button>

        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-xs font-bold mb-4">
            <IconSparkles className="w-4 h-4" />
            <span>Formules VIP & Streaming Illimité</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-3">
            Passez à l&apos;Expérience Chiller
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
            Profitez du Full HD 1080p sans publicité, des téléchargements illimités et de la reprise de lecture multi-écrans.
          </p>
        </div>

        {/* Grille des abonnements */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
          {plans.map((plan) => {
            const isCurrent = user?.subscription?.plan === plan.code;
            const isPremium = plan.code === 'premium';

            return (
              <div
                key={plan._id}
                className={`relative rounded-3xl p-7 sm:p-8 flex flex-col justify-between transition-all duration-300 ${
                  isPremium
                    ? 'bg-gradient-to-b from-[#1c1424] to-[#120f18] border-2 border-[#7C3AED]/50 shadow-[0_12px_40px_rgba(124,58,237,0.2)]'
                    : 'bg-[#141416] border border-white/10 hover:border-white/20'
                }`}
              >
                {isPremium && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary text-white text-[11px] font-black tracking-wider uppercase shadow-md">
                    RECOMMANDÉ
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
                    {isCurrent && (
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                        Actuel
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-2 mb-6">
                    <span className="text-4xl sm:text-5xl font-black text-white">{plan.price}</span>
                    <span className="text-sm font-bold text-zinc-400">FCFA / mois</span>
                  </div>

                  <ul className="space-y-3.5 mb-8 text-sm text-zinc-300">
                    <li className="flex items-center gap-3">
                      <IconCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      <span>Qualité maximale : <strong className="text-white">{plan.features.maxResolution}</strong></span>
                    </li>
                    <li className="flex items-center gap-3">
                      <IconCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      <span>Écrans simultanés : <strong className="text-white">{plan.features.maxDevices}</strong></span>
                    </li>
                    <li className="flex items-center gap-3">
                      <IconCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      <span>Reprise de lecture automatique</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <IconCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      <span>Téléchargements illimités haute vitesse</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <IconCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      <span>Accès prioritaire sans attente</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => {
                    if (!user) {
                      router.push('/login?redirect=/subscribe');
                      return;
                    }
                    setSelectedPlan(plan);
                    setSuccessMessage(null);
                    setErrorMessage(null);
                  }}
                  disabled={isCurrent}
                  className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all cursor-pointer shadow-lg active:scale-95 ${
                    isCurrent
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : isPremium
                      ? 'bg-gradient-to-r from-brand-primary to-brand-secondary hover:opacity-95 text-white'
                      : 'bg-white text-black hover:bg-zinc-200'
                  }`}
                >
                  {isCurrent ? 'Votre Plan Actuel' : `Choisir ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Modal de paiement Mobile Money & Soumission de preuve */}
        {selectedPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
            <div className="relative w-full max-w-lg bg-[#141417] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl my-8">
              <button
                onClick={() => setSelectedPlan(null)}
                className="absolute top-5 right-5 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-all"
              >
                <IconX className="w-5 h-5" />
              </button>

              {successMessage ? (
                <div className="text-center py-6 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                    <IconChecklist className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Preuve bien transmise !</h3>
                  <p className="text-zinc-300 text-sm leading-relaxed">{successMessage}</p>
                  <button
                    onClick={() => {
                      setSelectedPlan(null);
                      router.push('/');
                    }}
                    className="w-full py-3 mt-4 rounded-xl bg-white text-black font-bold text-sm hover:bg-zinc-200 transition-all"
                  >
                    Retour à l&apos;accueil
                  </button>
                </div>
              ) : (
                <div>
                  <div className="mb-6">
                    <span className="text-xs font-bold text-brand-primary uppercase tracking-wider">
                      Étape de Paiement
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
                      Abonnement {selectedPlan.name} ({selectedPlan.price} FCFA)
                    </h3>
                  </div>

                  {/* Choix de l'opérateur */}
                  <div className="space-y-3 mb-6">
                    <label className="text-xs font-semibold text-zinc-400">1. Choisissez votre moyen de dépôt :</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('orange')}
                        className={`p-3.5 rounded-2xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          paymentMethod === 'orange'
                            ? 'bg-orange-500/15 border-orange-500 text-orange-400 font-bold'
                            : 'bg-zinc-900 border-white/5 text-zinc-400 hover:border-white/15'
                        }`}
                      >
                        <span className="text-sm font-black tracking-wide">Orange Money</span>
                        <span className="text-[11px] opacity-85">Cameroun</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('mtn')}
                        className={`p-3.5 rounded-2xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          paymentMethod === 'mtn'
                            ? 'bg-yellow-500/15 border-yellow-500 text-yellow-400 font-bold'
                            : 'bg-zinc-900 border-white/5 text-zinc-400 hover:border-white/15'
                        }`}
                      >
                        <span className="text-sm font-black tracking-wide">MTN MoMo</span>
                        <span className="text-[11px] opacity-85">Cameroun</span>
                      </button>
                    </div>
                  </div>

                  {/* Numéro de dépôt */}
                  <div className="bg-[#1c1c22] border border-white/5 rounded-2xl p-4 mb-6">
                    <p className="text-xs text-zinc-400 mb-1">2. Effectuez le dépôt de <strong className="text-white">{selectedPlan.price} FCFA</strong> au numéro suivant :</p>
                    <div className="flex items-center justify-between bg-black/40 px-3.5 py-2.5 rounded-xl border border-white/10">
                      <div>
                        <span className="text-xs font-bold text-zinc-400">
                          {paymentMethod === 'orange' ? 'Orange Money' : 'MTN Mobile Money'} :
                        </span>
                        <p className="text-lg font-black text-white tracking-wider">
                          {paymentMethod === 'orange' ? ORANGE_NUMBER : MTN_NUMBER}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(paymentMethod === 'orange' ? ORANGE_NUMBER : MTN_NUMBER)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all active:scale-95"
                      >
                        <IconCopy className="w-4 h-4" />
                        <span>{copiedNumber ? 'Copié !' : 'Copier'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Formulaire de preuve */}
                  <form onSubmit={handleSubmitProof} className="space-y-4">
                    <label className="text-xs font-semibold text-zinc-400 block">3. Transmettez votre preuve de paiement :</label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-zinc-400 block mb-1">Numéro expéditeur (optionnel)</label>
                        <input
                          type="tel"
                          placeholder="Ex: 6XXXXXXXX"
                          value={senderPhone}
                          onChange={(e) => setSenderPhone(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-white text-xs focus:outline-none focus:border-brand-primary"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-zinc-400 block mb-1">ID / Réf Transaction (optionnel)</label>
                        <input
                          type="text"
                          placeholder="Ex: Tx123456"
                          value={transactionRef}
                          onChange={(e) => setTransactionRef(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-white text-xs focus:outline-none focus:border-brand-primary"
                        />
                      </div>
                    </div>

                    {/* Téléversement de la capture */}
                    <div>
                      <label className="text-[11px] text-zinc-400 block mb-1 font-semibold text-white">
                        Capture d&apos;écran du virement *
                      </label>
                      <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-white/15 hover:border-brand-primary rounded-2xl bg-zinc-900/50 cursor-pointer transition-all">
                        {screenshotPreview ? (
                          <div className="relative w-full aspect-video rounded-xl overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={screenshotPreview} alt="Aperçu" className="w-full h-full object-cover" />
                            <span className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/75 text-[10px] font-bold text-white">
                              Modifier
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-zinc-400">
                            <IconUpload className="w-6 h-6 text-brand-primary" />
                            <span className="text-xs font-semibold text-zinc-300">
                              Cliquez pour choisir votre capture d&apos;écran
                            </span>
                            <span className="text-[10px] text-zinc-500">Formats acceptés : JPG, PNG (Max 15 Mo)</span>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                          required
                        />
                      </label>
                    </div>

                    {errorMessage && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs">
                        <IconAlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{errorMessage}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary text-white font-bold text-sm hover:opacity-95 transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <IconLoader2 className="w-4 h-4 animate-spin" />
                          <span>Envoi en cours...</span>
                        </>
                      ) : (
                        <span>Confirmer mon Paiement</span>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
