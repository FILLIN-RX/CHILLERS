import { create } from "zustand";

/**
 * Store global pour piloter le Splash Screen.
 * Quand `ready` passe à true, le SplashScreen déclenche son animation de sortie.
 *
 * Usage :
 *   const { setReady } = useSplashStore();
 *   setReady(true); // appeler après que les données initiales sont chargées
 */
interface SplashState {
  ready: boolean;
  setReady: (ready: boolean) => void;
}

export const useSplashStore = create<SplashState>((set) => ({
  ready: false,
  setReady: (ready) => set({ ready }),
}));
