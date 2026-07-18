"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeftIcon, HeartIcon } from "@heroicons/react/24/solid";

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-[#09090B] text-white flex flex-col">
      <div className="fixed top-0 left-0 z-40 p-4">
        <button
          onClick={() => { window.scrollTo(0, 0); window.history.back(); }}
          aria-label="Retour"
          className="flex items-center justify-center w-10 h-10 rounded-full bg-black/70 backdrop-blur-sm border border-white/10 text-white hover:bg-white/10 transition-all"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-24">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-brand-primary/20 flex items-center justify-center">
              <HeartIcon className="h-8 w-8 text-brand-primary" />
            </div>
            <h1 className="text-2xl font-black">Nous soutenir</h1>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Ce site est gratuit et sans pub. Si tu aimes le projet, tu peux nous soutenir via un don. 
              Chaque contribution aide à maintenir et améliorer le service.
            </p>
          </div>

          <div className="space-y-4 pt-4">
            <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 font-black text-lg">OM</div>
                <div className="text-left">
                  <p className="text-sm font-bold">Orange Money</p>
                  <p className="text-xs text-zinc-400">+243 970 000 000</p>
                </div>
              </div>
              <div className="h-px bg-zinc-800" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-black text-lg">M</div>
                <div className="text-left">
                  <p className="text-sm font-bold">Mobile Money</p>
                  <p className="text-xs text-zinc-400">+243 970 000 000</p>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-zinc-600 italic">
              Chillers ne stocke aucun fichier. Tout contenu est hébergé par des tiers non affiliés. À des fins éducatives uniquement.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 border border-white/20 text-white text-sm font-bold hover:bg-white/20 transition-all mt-4"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
