'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { httpJson } from '@/app/api';
import { IconCheck, IconX, IconArrowLeft } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';

export default function SubscribePage() {
  const { user, token } = useAuthStore();
  const router = useRouter();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, this might be a public endpoint. For now, fetch from a new public or user endpoint,
    // or just hardcode if the endpoint isn't public. Actually, let's fetch from our admin endpoint but it's protected.
    // Wait, let's create a public endpoint for plans or just mock it here if it fails.
    const fetchPlans = async () => {
      try {
        const res = await httpJson<{ success: boolean; plans: any[] }>('/auth/plans');
        if (res?.success) {
          setPlans(res.plans);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  const handleSubscribe = (planCode: string) => {
    alert(`Redirection vers le paiement (Factice) pour le plan: ${planCode}`);
    // MOCK PAYMENT SUCCESS -> Redirect to home
    setTimeout(() => {
      alert('Paiement réussi (Simulation) ! Votre abonnement a été mis à jour.');
      router.push('/');
    }, 1500);
  };

  if (loading) return <div className="p-10 text-center text-white">Chargement des abonnements...</div>;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white py-20 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Bouton retour */}
        <button
          onClick={() => router.back()}
          aria-label="Retour"
          className="inline-flex items-center gap-2 px-4 py-2 mb-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-sm font-medium transition-all hover:scale-[1.02] active:scale-95"
        >
          <IconArrowLeft className="w-4 h-4" />
          Retour
        </button>

        <h1 className="text-4xl md:text-5xl font-bold text-center mb-4">Choisissez votre abonnement</h1>
        <p className="text-gray-400 text-center mb-12 text-lg">Débloquez toutes les fonctionnalités de Chiller.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div key={plan._id} className={`bg-[#1a1a1a] rounded-2xl p-8 border ${user?.subscription?.plan === plan.code ? 'border-primary' : 'border-gray-800'} flex flex-col relative`}>
              {user?.subscription?.plan === plan.code && (
                <div className="absolute top-0 right-0 bg-primary text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-xl">
                  ACTUEL
                </div>
              )}
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <div className="mb-6">
                <span className="text-4xl font-extrabold">{plan.price}€</span>
                <span className="text-gray-400"> / {plan.durationMonths} mois</span>
              </div>
              
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3">
                  <IconCheck className="text-primary w-5 h-5" />
                  <span>Résolution max: <strong>{plan.features.maxResolution}</strong></span>
                </li>
                <li className="flex items-center gap-3">
                  <IconCheck className="text-primary w-5 h-5" />
                  <span>Écrans simultanés: <strong>{plan.features.maxDevices}</strong></span>
                </li>
                <li className="flex items-center gap-3">
                  {plan.features.hasContinueWatching ? <IconCheck className="text-primary w-5 h-5" /> : <IconX className="text-red-500 w-5 h-5" />}
                  <span className={plan.features.hasContinueWatching ? '' : 'text-gray-500 line-through'}>Reprise de lecture</span>
                </li>
                <li className="flex items-center gap-3">
                  {plan.features.hasWatchHistory ? <IconCheck className="text-primary w-5 h-5" /> : <IconX className="text-red-500 w-5 h-5" />}
                  <span className={plan.features.hasWatchHistory ? '' : 'text-gray-500 line-through'}>Historique de visionnage</span>
                </li>
              </ul>
              
              <button 
                onClick={() => handleSubscribe(plan.code)}
                disabled={user?.subscription?.plan === plan.code}
                className={`w-full py-3 rounded-lg font-bold transition-all ${user?.subscription?.plan === plan.code ? 'bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-primary/90 text-white'}`}
              >
                {user?.subscription?.plan === plan.code ? 'Plan Actuel' : 'S\'abonner'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
