"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  IconHeart,
  IconCopy,
  IconCheck,
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
        className="w-full sm:max-w-sm bg-zinc-900 border-t sm:border border-white/10 rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl relative"
      >
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-4 sm:hidden" />

        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
        >
          <IconX className="h-4 w-4" />
        </button>

        <div className="text-center space-y-2 mb-5">
          <div className="w-12 h-12 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center mx-auto">
            <IconHeart className="h-6 w-6 text-brand-primary" fill="currentColor" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              Soutenir <span className="text-brand-primary">CHILLERS</span>
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              Gratuit et sans abonnement. Votre soutien finance les serveurs.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="p-3 rounded-xl bg-zinc-800/50 border border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Orange Money</span>
                <span className="text-sm font-bold text-white font-mono tracking-wider block mt-0.5">697 40 73 80</span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard("697407380", "om")}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                  copiedType === "om"
                    ? "bg-brand-primary/20 text-brand-primary border border-brand-primary/30"
                    : "bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                }`}
              >
                {copiedType === "om" ? <IconCheck className="h-3.5 w-3.5" /> : <IconCopy className="h-3.5 w-3.5" />}
                {copiedType === "om" ? "Copié" : "Copier"}
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-800/50 border border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">MTN MoMo</span>
                <span className="text-sm font-bold text-white font-mono tracking-wider block mt-0.5">674 37 64 24</span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard("674376424", "momo")}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                  copiedType === "momo"
                    ? "bg-brand-primary/20 text-brand-primary border border-brand-primary/30"
                    : "bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                }`}
              >
                {copiedType === "momo" ? <IconCheck className="h-3.5 w-3.5" /> : <IconCopy className="h-3.5 w-3.5" />}
                {copiedType === "momo" ? "Copié" : "Copier"}
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-colors"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
