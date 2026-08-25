"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  IconHeart,
  IconCopy,
  IconCheck,
  IconDeviceMobile,
  IconX,
} from "@tabler/icons-react";
import { acquireModalScrollLock, releaseModalScrollLock } from "@/lib/modalScrollLock";

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DonationModal({ isOpen, onClose }: DonationModalProps) {
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

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

  const copyToClipboard = async (text: string, type: "om" | "momo") => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
    } catch {
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity"
      onClick={(e) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        className="w-full sm:max-w-md bg-[#18181B] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-2xl p-6 sm:p-7 shadow-2xl relative max-h-[92vh] overflow-y-auto"
      >
        {/* Barre de poignée Bottom Sheet (mobile) */}
        <div className="w-12 h-1.5 bg-zinc-700 rounded-full mx-auto mb-4 sm:hidden" />

        {/* Bouton Fermer */}
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-4 right-4 p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
        >
          <IconX className="h-5 w-5" />
        </button>

        {/* En-tête */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#D70466]/15 border border-[#D70466]/30 flex items-center justify-center text-[#D70466] mx-auto">
            <IconHeart className="h-7 w-7 fill-[#D70466]" />
          </div>

          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              Soutenez <span className="text-[#D70466]">CHILLERS</span>
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 leading-relaxed max-w-sm mx-auto">
              Chillers est 100% gratuit et sans abonnement. Votre soutien permet de financer les serveurs et le streaming.
            </p>
          </div>
        </div>

        {/* Cartes de paiement */}
        <div className="mt-5 space-y-3">
          {/* Orange Money */}
          <div className="p-4 rounded-xl bg-[#202024] border border-white/5 hover:border-orange-500/40 transition-colors">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center font-bold text-orange-400 text-xs">
                  OM
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider">
                      Orange Money
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-zinc-800 text-zinc-300">
                      Cameroun
                    </span>
                  </div>
                  <span className="text-base font-bold text-white font-mono tracking-wider block mt-0.5">
                    697 40 73 80
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => copyToClipboard("697407380", "om")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  copiedType === "om"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10"
                }`}
              >
                {copiedType === "om" ? (
                  <>
                    <IconCheck className="h-4 w-4" />
                    Copié
                  </>
                ) : (
                  <>
                    <IconCopy className="h-4 w-4" />
                    Copier
                  </>
                )}
              </button>
            </div>

            <div className="mt-2.5 pt-2 border-t border-white/5 text-[11px] text-zinc-400 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <IconDeviceMobile className="h-3.5 w-3.5 text-orange-400" />
                Code direct :
              </span>
              <span className="font-mono text-xs text-orange-300 font-semibold bg-black/40 px-2 py-0.5 rounded">
                #150*1*1*697407380*MONTANT#
              </span>
            </div>
          </div>

          {/* MTN Mobile Money */}
          <div className="p-4 rounded-xl bg-[#202024] border border-white/5 hover:border-yellow-500/40 transition-colors">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center font-bold text-yellow-400 text-xs">
                  MoMo
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-yellow-400 uppercase tracking-wider">
                      MTN MoMo
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-zinc-800 text-zinc-300">
                      Cameroun
                    </span>
                  </div>
                  <span className="text-base font-bold text-white font-mono tracking-wider block mt-0.5">
                    674 37 64 24
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => copyToClipboard("674376424", "momo")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  copiedType === "momo"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10"
                }`}
              >
                {copiedType === "momo" ? (
                  <>
                    <IconCheck className="h-4 w-4" />
                    Copié
                  </>
                ) : (
                  <>
                    <IconCopy className="h-4 w-4" />
                    Copier
                  </>
                )}
              </button>
            </div>

            <div className="mt-2.5 pt-2 border-t border-white/5 text-[11px] text-zinc-400 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <IconDeviceMobile className="h-3.5 w-3.5 text-yellow-400" />
                Code direct :
              </span>
              <span className="font-mono text-xs text-yellow-300 font-semibold bg-black/40 px-2 py-0.5 rounded">
                *126*1*1*674376424*MONTANT#
              </span>
            </div>
          </div>
        </div>

        {/* Bouton d'action */}
        <div className="mt-5 pt-4 border-t border-white/5 text-center space-y-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-[#D70466] hover:bg-[#b5034f] text-white text-xs font-bold uppercase tracking-wider transition-colors active:scale-[0.99]"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
