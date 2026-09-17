'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Crown, X } from '@phosphor-icons/react';

export default function UpgradeModal({ 
  isOpen, 
  onClose,
  featureName = "Cette fonctionnalité"
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  featureName?: string;
}) {
  const router = useRouter();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md transition-all animate-fade-in select-none">
      <div className="bg-[#121215] rounded-[3px] p-6 sm:p-7 max-w-sm w-full border border-white/15 shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <button 
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-[2px] hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-5">
          <div className="w-12 h-12 bg-amber-500/15 border border-amber-500/30 rounded-[3px] flex items-center justify-center mx-auto mb-3 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
            <Crown className="w-6 h-6 text-amber-400 fill-amber-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-1.5">Passez en VIP</h3>
          <p className="text-zinc-400 text-xs leading-relaxed">
            <strong className="text-white">{featureName}</strong> est réservée aux membres VIP. Débloquez le streaming illimité 1080p et les téléchargements instantanés.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button 
            onClick={() => {
              onClose();
              router.push('/subscribe');
            }}
            className="w-full bg-[#D70466] hover:bg-[#b5034f] text-white font-bold py-2.5 px-4 rounded-[3px] text-xs sm:text-sm transition-all shadow-md cursor-pointer active:scale-95"
          >
            Découvrir les offres
          </button>
          <button 
            onClick={onClose}
            className="w-full bg-transparent hover:bg-white/5 text-zinc-400 hover:text-white font-medium py-2 px-4 rounded-[3px] text-xs transition-all cursor-pointer"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
