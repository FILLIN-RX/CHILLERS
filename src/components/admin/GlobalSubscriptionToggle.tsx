'use client';

import React, { useEffect, useState } from 'react';
import { httpJson } from '@/app/api';
import { message } from 'antd';
import Spinner from '@/components/Spinner';
import { useAuthStore } from '@/stores/useAuthStore';

interface GlobalSubscriptionToggleProps {
  onToggle?: (newState: boolean) => void;
}

interface ToggleState {
  enabled: boolean;
  loading: boolean;
  error?: string;
  successMessage?: string;
}

interface GlobalStateResponse {
  success: boolean;
  globalSubscriptionEnabled: boolean;
  cachedAt?: string;
}

interface SetGlobalStateResponse {
  success: boolean;
  globalSubscriptionEnabled: boolean;
  previousState: boolean;
  message: string;
  updatedAt: string;
}

export default function GlobalSubscriptionToggle({ onToggle }: GlobalSubscriptionToggleProps) {
  const [state, setState] = useState<ToggleState>({
    enabled: true,
    loading: true,
  });

  const { token } = useAuthStore();

  // Fetch current state on mount
  useEffect(() => {
    const fetchCurrentState = async () => {
      if (!token) {
        setState(prev => ({ ...prev, loading: false, error: 'Non autorisé' }));
        return;
      }

      try {
        const res = await httpJson<GlobalStateResponse>(
          '/admin/subscriptions/global-state',
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        if (res?.success) {
          setState(prev => ({
            ...prev,
            enabled: res.globalSubscriptionEnabled,
            loading: false,
            error: undefined,
          }));
        } else {
          setState(prev => ({
            ...prev,
            loading: false,
            error: 'Erreur lors de la récupération de l\'état',
          }));
        }
      } catch (err) {
        console.error('Error fetching global subscription state:', err);
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Erreur lors de la récupération de l\'état',
        }));
      }
    };

    fetchCurrentState();
  }, [token]);

  // Clear messages after 4 seconds
  useEffect(() => {
    if (state.successMessage) {
      const timer = setTimeout(() => {
        setState(prev => ({ ...prev, successMessage: undefined }));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [state.successMessage]);

  useEffect(() => {
    if (state.error) {
      const timer = setTimeout(() => {
        setState(prev => ({ ...prev, error: undefined }));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [state.error]);

  const handleToggle = async () => {
    if (state.loading) return;

    const newState = !state.enabled;

    // Optimistically update UI
    const previousEnabled = state.enabled;
    setState(prev => ({
      ...prev,
      enabled: newState,
      loading: true,
      error: undefined,
      successMessage: undefined,
    }));

    if (!token) {
      setState(prev => ({
        ...prev,
        enabled: previousEnabled,
        loading: false,
        error: 'Non autorisé',
      }));
      return;
    }

    try {
      const res = await httpJson<SetGlobalStateResponse>(
        '/admin/subscriptions/global-state',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: { enabled: newState }
        }
      );

      if (res?.success) {
        setState(prev => ({
          ...prev,
          enabled: res.globalSubscriptionEnabled,
          loading: false,
          successMessage: `Abonnements ${res.globalSubscriptionEnabled ? 'activés' : 'désactivés'} avec succès`,
          error: undefined,
        }));
        onToggle?.(res.globalSubscriptionEnabled);
        message.success(`Abonnements ${res.globalSubscriptionEnabled ? 'activés' : 'désactivés'} avec succès`);
      } else {
        // Revert on failure
        setState(prev => ({
          ...prev,
          enabled: previousEnabled,
          loading: false,
          error: res?.message || 'Erreur lors de la mise à jour',
        }));
        message.error('Erreur lors de la mise à jour');
      }
    } catch (err) {
      console.error('Error toggling subscription state:', err);
      // Revert on failure
      setState(prev => ({
        ...prev,
        enabled: previousEnabled,
        loading: false,
        error: 'Erreur lors de la mise à jour',
      }));
      message.error('Erreur lors de la mise à jour');
    }
  };

  if (state.loading) {
    return (
      <div className="bg-dark-paper border border-dark-border rounded-xl p-6 flex items-center justify-center">
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-dark-paper border border-dark-border rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white mb-2">État des Abonnements</h3>
            <p className="text-gray-400 text-sm">
              Abonnements: <span className={`font-bold ${state.enabled ? 'text-green-500' : 'text-red-500'}`}>
                {state.enabled ? 'ACTIVÉS' : 'DÉSACTIVÉS'}
              </span>
            </p>
          </div>
          
          <button
            onClick={handleToggle}
            disabled={state.loading}
            className={`relative inline-flex h-12 w-20 items-center rounded-full transition-colors ${
              state.enabled 
                ? 'bg-green-500 hover:bg-green-600' 
                : 'bg-gray-600 hover:bg-gray-700'
            } ${state.loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`inline-block h-10 w-10 transform rounded-full bg-white transition-transform ${
                state.enabled ? 'translate-x-9' : 'translate-x-1'
              } flex items-center justify-center`}
            >
              {state.loading && <Spinner size={16} />}
            </span>
          </button>
        </div>

        {state.error && (
          <div className="mt-4 bg-red-500/20 border border-red-500/50 rounded-lg p-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-red-200">{state.error}</span>
          </div>
        )}

        {state.successMessage && (
          <div className="mt-4 bg-green-500/20 border border-green-500/50 rounded-lg p-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-green-200">{state.successMessage}</span>
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500 px-1">
        Cliquez sur le bouton pour basculer l'état des abonnements. Quand les abonnements sont désactivés, tous les utilisateurs sont traités comme utilisateurs gratuits.
      </div>
    </div>
  );
}
