"use client";

import React, { useState } from "react";
import {
  IconHeart,
  IconCopy,
  IconCheck,
  IconX,
  IconDeviceMobile,
  IconSparkles,
} from "@tabler/icons-react";

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DonationModal({ isOpen, onClose }: DonationModalProps) {
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = async (text: string, type: string) => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-md bg-gradient-to-b from-zinc-900 to-zinc-950 border border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Top Effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-gradient-to-b from-red-600/30 via-orange-500/20 to-transparent blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          aria-label="Fermer"
        >
          <IconX className="h-5 w-5" />
        </button>

        {/* Header Content */}
        <div className="text-center space-y-2 pt-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 to-orange-500 text-white shadow-lg shadow-red-500/20 mb-1">
            <IconHeart className="h-7 w-7 fill-white" />
          </div>

          <h2 className="text-2xl font-black text-white tracking-tight">
            Soutenir CHILLERS
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed px-2">
            Chillers est 100% gratuit et sans pubs intrusives. Vos dons nous aident à financer les serveurs et le streaming haute vitesse !
          </p>
        </div>

        {/* Payment Methods Cards */}
        <div className="mt-6 space-y-3">
          {/* Orange Money */}
          <div className="group relative p-4 rounded-2xl bg-zinc-800/60 border border-orange-500/30 hover:border-orange-500/60 transition-all hover:shadow-lg hover:shadow-orange-500/10">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 font-bold text-lg">
                  OM
                </div>
                <div>
                  <span className="text-xs font-bold text-orange-400 uppercase tracking-wider block">
                    Orange Money
                  </span>
                  <span className="text-base font-black text-white font-mono tracking-wider">
                    697 40 73 80
                  </span>
                </div>
              </div>

              <button
                onClick={() => copyToClipboard("697407380", "om")}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  copiedType === "om"
                    ? "bg-green-500/20 border border-green-500/40 text-green-400"
                    : "bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-300"
                }`}
              >
                {copiedType === "om" ? (
                  <>
                    <IconCheck className="h-4 w-4" />
                    Copié !
                  </>
                ) : (
                  <>
                    <IconCopy className="h-4 w-4" />
                    Copier
                  </>
                )}
              </button>
            </div>
            <div className="mt-2 text-[11px] text-zinc-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
              Composer <span className="font-mono text-zinc-300 font-semibold">#150*1*1*697407380*MONTANT#</span>
            </div>
          </div>

          {/* MTN Mobile Money */}
          <div className="group relative p-4 rounded-2xl bg-zinc-800/60 border border-yellow-500/30 hover:border-yellow-500/60 transition-all hover:shadow-lg hover:shadow-yellow-500/10">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center text-yellow-400 font-bold text-lg">
                  MoMo
                </div>
                <div>
                  <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider block">
                    MTN Mobile Money
                  </span>
                  <span className="text-base font-black text-white font-mono tracking-wider">
                    674 37 64 24
                  </span>
                </div>
              </div>

              <button
                onClick={() => copyToClipboard("674376424", "momo")}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  copiedType === "momo"
                    ? "bg-green-500/20 border border-green-500/40 text-green-400"
                    : "bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-300"
                }`}
              >
                {copiedType === "momo" ? (
                  <>
                    <IconCheck className="h-4 w-4" />
                    Copié !
                  </>
                ) : (
                  <>
                    <IconCopy className="h-4 w-4" />
                    Copier
                  </>
                )}
              </button>
            </div>
            <div className="mt-2 text-[11px] text-zinc-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              Composer <span className="font-mono text-zinc-300 font-semibold">*126*1*1*674376424*MONTANT#</span>
            </div>
          </div>
        </div>

        {/* Footer Thanks */}
        <div className="mt-6 pt-4 border-t border-white/5 text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
            <IconSparkles className="h-4 w-4 text-orange-400" />
            Merci infiniment pour votre soutien à la communauté Chillers !
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase tracking-wider transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
