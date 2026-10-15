"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Heart } from "@phosphor-icons/react";
import PosterWallBackground from "@/components/PosterWallBackground";

const DonationModal = dynamic(() => import("@/components/DonationModal"), { ssr: false });

export default function SupportPage() {
  const [donationOpen, setDonationOpen] = useState(false);
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);

  /* Retour de la page de paiement hébergée (carte, Wave…) : /support?payment=<id> */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const pid = q.get("payment");
    if (!pid) return;
    window.history.replaceState({}, "", "/support");
    // Ouverture différée (lint : pas de setState synchrone dans un effet)
    const t = setTimeout(() => {
      setPendingPaymentId(pid);
      setDonationOpen(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const closeDonation = () => {
    setDonationOpen(false);
    setPendingPaymentId(null);
  };

  return (
    <div className="relative min-h-screen bg-[#060608] text-white flex flex-col">
      {/* Mur de posters façon 404 — statique, en diagonale */}
      <PosterWallBackground dim />

      <div className="fixed top-0 left-0 z-40 p-4">
        <button
          onClick={() => { window.scrollTo(0, 0); window.history.back(); }}
          aria-label="Retour"
          className="flex items-center justify-center w-10 h-10 rounded-full bg-black/70 backdrop-blur-sm border border-white/10 text-white hover:bg-white/10 transition-all"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>

      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-24">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-brand-primary/20 flex items-center justify-center">
              <Heart className="h-8 w-8 text-brand-primary" fill="currentColor" />
            </div>
            <h1 className="text-2xl font-black">Nous soutenir</h1>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Ce site est gratuit et sans pub. Si tu aimes le projet, tu peux nous soutenir via un don.
              Chaque contribution aide à maintenir et améliorer le service.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={() => {
                setPendingPaymentId(null);
                setDonationOpen(true);
              }}
              className="w-full py-3.5 rounded-[6px] bg-brand-primary hover:bg-[#b5034f] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all active:scale-95"
            >
              <Heart className="w-4 h-4" fill="currentColor" />
              <span>Faire un don (Mobile Money / carte)</span>
            </button>

            

            <p className="text-[10px] text-zinc-600 italic pt-2">
              Chillers ne stocke aucun fichier. Tout contenu est hébergé par des tiers non affiliés. À des fins éducatives uniquement.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 border border-white/20 text-white text-sm font-bold hover:bg-white/20 transition-all mt-4"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>

      <DonationModal
        isOpen={donationOpen}
        onClose={closeDonation}
        initialPaymentId={pendingPaymentId}
      />
    </div>
  );
}
