'use client';

import React, { useEffect, useState } from 'react';
import Spinner from '@/components/Spinner';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { adminGetGlobalSubscriptionState, adminSetGlobalSubscriptionState } from '@/services/admin';

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

  // Fetch current state on mount
  useEffect(() => {
    const fetchCurrentState = async () => {
      try {
        let res: GlobalStateResponse | null = null;
        try {
          res = await adminGetGlobalSubscriptionState();
        } catch {
          res = null;
        }

        if (res?.success) {
          useSubscriptionStore.getState().setGlobalSubscriptionEnabled(res.globalSubscriptionEnabled);
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
          }));
        }
      } catch (err) {
        console.warn('Fallback fetching global subscription state:', err);
        setState(prev => ({
          ...prev,
          loading: false,
        }));
      }
    };

    fetchCurrentState();
  }, []);

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

    try {
      let res: SetGlobalStateResponse | null = null;
      try {
        res = await adminSetGlobalSubscriptionState(newState);
      } catch {
        res = null;
      }

      if (res?.success) {
        useSubscriptionStore.getState().setGlobalSubscriptionEnabled(res.globalSubscriptionEnabled);
        setState(prev => ({
          ...prev,
          enabled: res.globalSubscriptionEnabled,
          loading: false,
          successMessage: `Abonnements ${res.globalSubscriptionEnabled ? 'activés' : 'désactivés'} avec succès`,
          error: undefined,
        }));
        onToggle?.(res.globalSubscriptionEnabled);
      } else {
        // Revert on failure
        setState(prev => ({
          ...prev,
          enabled: previousEnabled,
          loading: false,
          error: res?.message || 'Erreur lors de la mise à jour',
        }));
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
    }
  };

  if (state.loading) {
    return (
      <div className="subscription-toggle-loading">
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <div className="subscription-toggle">
      <div className="subscription-toggle-card">
        <div className="subscription-toggle-row">
          <div>
            <h3>État des abonnements</h3>
            <p>
              Abonnements : <span className={state.enabled ? 'is-enabled' : 'is-disabled'}>
                {state.enabled ? 'ACTIVÉS' : 'DÉSACTIVÉS'}
              </span>
            </p>
          </div>
          
          <button
            onClick={handleToggle}
            disabled={state.loading}
            aria-label={state.enabled ? 'Désactiver tous les abonnements' : 'Activer tous les abonnements'}
            aria-pressed={state.enabled}
            className={`subscription-toggle-button ${state.enabled ? 'is-enabled' : 'is-disabled'} ${state.loading ? 'is-loading' : ''}`}
          >
            <span className="subscription-toggle-thumb">
              {state.loading && <Spinner size={16} />}
            </span>
          </button>
        </div>

        {state.error && (
          <div className="subscription-toggle-message is-error">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{state.error}</span>
          </div>
        )}

        {state.successMessage && (
          <div className="subscription-toggle-message is-success">
            <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{state.successMessage}</span>
          </div>
        )}
      </div>

      <div className="subscription-toggle-note">
        Quand les abonnements sont désactivés, tous les utilisateurs bénéficient d’un accès PRO sans restriction.
      </div>
    </div>
  );
}
