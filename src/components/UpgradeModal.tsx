'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-all">
      <div className="bg-[#1a1a1a] rounded-2xl p-8 max-w-md w-full border border-gray-800 shadow-2xl relative animate-in fade-in zoom-in duration-300">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-[#D70466]/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#D70466]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Passez au niveau supérieur</h3>
          <p className="text-gray-400 text-sm">
            {featureName} est réservée aux abonnements supérieurs. Mettez à niveau votre plan pour la débloquer et profiter de bien d'autres avantages !
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <button 
            onClick={() => router.push('/subscribe')}
            className="w-full bg-gradient-to-r from-[#D70466] to-[#7C3AED] hover:opacity-90 text-white font-bold py-3 px-4 rounded-xl transition-all"
          >
            Voir les abonnements
          </button>
          <button 
            onClick={onClose}
            className="w-full bg-transparent hover:bg-gray-800 text-gray-300 font-bold py-3 px-4 rounded-xl transition-all"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
