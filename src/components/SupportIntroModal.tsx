"use client";

import React from "react";
import { Heart } from "@phosphor-icons/react";

interface SupportIntroModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSupport: () => void;
}

/**
 * Modal d'accueil léger (une fois par session) : juste « Fermer » et
 * « Soutenir ». Le bouton Soutenir ouvre le vrai modal de paiement.
 */
export default function SupportIntroModal({
  isOpen,
  onClose,
  onSupport,
}: SupportIntroModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Soutenir CHILLERS"
        className="w-full sm:max-w-sm glass-modal border-t sm:border border-brand-border rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl relative my-0 sm:my-4 animate-fade-in"
      >
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-4 sm:hidden" />

        <div className="text-center space-y-2 pt-1 pb-4">
          <div className="w-12 h-12 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center mx-auto">
            <Heart className="h-6 w-6 text-brand-primary" fill="currentColor" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              Soutenir <span className="text-brand-primary">CHILLERS</span>
            </h3>
            <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
              Gratuit et sans pub. Ton don finance les serveurs.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-[5px] bg-black/30 border border-brand-border text-zinc-300 font-bold text-xs hover:bg-zinc-800/60 hover:text-white transition-all cursor-pointer active:scale-95"
          >
            Fermer
          </button>
          <button
            onClick={onSupport}
            className="flex-1 py-2.5 rounded-[5px] bg-brand-primary hover:bg-[#b5034f] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
          >
            <Heart className="w-3.5 h-3.5" fill="currentColor" />
            <span>Soutenir</span>
          </button>
        </div>
      </div>
    </div>
  );
}
