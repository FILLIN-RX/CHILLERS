import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { httpJson } from '@/app/api';
import { UserProfile } from './useAuthStore';

interface SubscriptionStoreState {
  globalSubscriptionEnabled: boolean;
  loading: boolean;
  setGlobalSubscriptionEnabled: (enabled: boolean) => void;
  fetchGlobalState: () => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionStoreState>()(
  persist(
    (set) => ({
      globalSubscriptionEnabled: true,
      loading: false,
      setGlobalSubscriptionEnabled: (enabled: boolean) => set({ globalSubscriptionEnabled: enabled }),
      fetchGlobalState: async () => {
        set({ loading: true });
        try {
          const res = await httpJson<{ success: boolean; globalSubscriptionEnabled: boolean }>(
            '/api/subscriptions/global-state'
          );
          if (res?.success && typeof res.globalSubscriptionEnabled === 'boolean') {
            set({ globalSubscriptionEnabled: res.globalSubscriptionEnabled, loading: false });
          } else {
            set({ loading: false });
          }
        } catch (err) {
          console.warn('[useSubscriptionStore] Could not fetch global subscription state:', err);
          set({ loading: false });
        }
      },
    }),
    {
      name: 'chiller-subscription-storage',
    }
  )
);

/**
 * Determines if a user has PRO / Premium privileges.
 * When global subscriptions are DISABLED by the admin (`globalSubscriptionEnabled === false`),
 * ALL users (including non-logged-in / guest users `user === null`) receive full PRO privileges.
 */
export function isUserPro(user?: UserProfile | null, globalSubscriptionEnabled: boolean = true): boolean {
  if (!globalSubscriptionEnabled) return true;
  if (!user) return false;
  return user.subscription?.plan === 'premium' || user.role === 'admin';
}

/**
 * Determines if a user is an active subscriber (Standard or Premium).
 * When global subscriptions are DISABLED by the admin (`globalSubscriptionEnabled === false`),
 * ALL users (including non-logged-in / guest users `user === null`) are treated as active subscribers.
 */
export function isUserSubscriber(user?: UserProfile | null, globalSubscriptionEnabled: boolean = true): boolean {
  if (!globalSubscriptionEnabled) return true;
  if (!user) return false;
  return (
    user.subscription?.status === 'active' &&
    (user.subscription.plan === 'standard' || user.subscription.plan === 'premium')
  );
}
