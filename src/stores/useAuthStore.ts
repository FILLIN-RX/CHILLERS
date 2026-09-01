import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  role: 'user' | 'admin';
  avatarUrl?: string;
  favorites?: any[];
  continueWatching?: any[];
  watchHistory?: any[];
  preferences?: any;
  subscription?: {
    plan: 'free' | 'standard' | 'premium';
    status: 'active' | 'inactive' | 'cancelled';
    expiresAt?: string | Date;
    features?: any;
  };
  activeSessions?: any[];
}

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  deviceId: string;
  setAuth: (token: string, user: UserProfile) => void;
  updateUser: (userUpdates: Partial<UserProfile>) => void;
  logout: () => void;
}

const generateDeviceId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'device_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      deviceId: generateDeviceId(),
      setAuth: (token, user) => set({ token, user }),
      updateUser: (userUpdates) => set((state) => ({
        user: state.user ? { ...state.user, ...userUpdates } : null
      })),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'chiller-auth-storage',
    }
  )
);
