"use client";

import React, { useState, useEffect, useRef } from "react";
import { IconX, IconUser, IconMail, IconLock, IconLoader2 } from "@tabler/icons-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { authService } from "@/services/auth";
import { useLanguage } from "@/i18n/LanguageContext";
import { getStableDeviceFingerprint } from "@/lib/deviceFingerprint";

import { useRouter } from "next/navigation";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "login" | "register";
}

export default function AuthModal({ isOpen, onClose, initialMode = "login" }: AuthModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const setAuth = useAuthStore((state) => state.setAuth);
  const { lang } = useLanguage();

  useEffect(() => {
    if (isOpen && typeof window !== "undefined" && window.innerWidth < 768) {
      onClose();
      router.push(initialMode === "register" ? "/register" : "/login");
      return;
    }
    setMode(initialMode);
    setError(null);
    setEmail("");
    setPassword("");
    setUsername("");
  }, [isOpen, initialMode, onClose, router]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const [deviceLimitReached, setDeviceLimitReached] = useState(false);

  const handleSubmit = async (e?: React.FormEvent, forceDisconnect = false) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { deviceId, deviceName } = getStableDeviceFingerprint();

      if (mode === "login") {
        const res = await authService.login(email, password, deviceId, deviceName, forceDisconnect);
        if (res.success && res.token && res.user) {
          setAuth(res.token, res.user);
          onClose();
        } else if (res.code === "DEVICE_LIMIT_REACHED") {
          setDeviceLimitReached(true);
          setError(
            lang === "fr"
              ? "Limite d'appareils connectés atteinte pour votre compte."
              : "Device limit reached for your account."
          );
        } else {
          setDeviceLimitReached(false);
          setError(res.message || "Erreur de connexion");
        }
      } else {
        const res = await authService.register(email, password, username, deviceId, deviceName);
        if (res.success && res.token && res.user) {
          setAuth(res.token, res.user);
          onClose();
        } else {
          setError(res.message || "Erreur d'inscription");
        }
      }
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        ref={modalRef}
        className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/50 hover:text-white rounded-full hover:bg-white/10 transition-colors"
        >
          <IconX className="w-5 h-5" />
        </button>

        <div className="p-8">
          <h2 className="text-2xl font-bold text-white mb-2">
            {mode === "login" 
              ? (lang === 'fr' ? "Connexion" : "Log in") 
              : (lang === 'fr' ? "Créer un compte" : "Create an account")}
          </h2>
          <p className="text-sm text-zinc-400 mb-8">
            {mode === "login" 
              ? (lang === 'fr' ? "Connectez-vous pour retrouver vos favoris et votre progression." : "Log in to access your favorites and continue watching.")
              : (lang === 'fr' ? "Rejoignez Chillers pour une expérience personnalisée." : "Join Chillers for a personalized experience.")}
          </p>

          {error && (
            <div className="mb-6 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs sm:text-sm space-y-2.5">
              <p>{error}</p>
              {deviceLimitReached && mode === "login" && (
                <button
                  type="button"
                  onClick={() => handleSubmit(undefined, true)}
                  disabled={loading}
                  className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-red-600 to-amber-600 hover:opacity-95 text-white font-bold text-xs shadow transition-all active:scale-95 cursor-pointer"
                >
                  {lang === "fr"
                    ? "Déconnecter tous les autres appareils et continuer"
                    : "Disconnect all other devices and continue"}
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="relative">
                <IconUser className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type="text"
                  placeholder={lang === 'fr' ? "Pseudo" : "Username"}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-black/50 border border-white/10 rounded-xl text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#D70466] focus:border-transparent transition-all"
                />
              </div>
            )}
            
            <div className="relative">
              <IconMail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type="email"
                required
                placeholder={lang === 'fr' ? "Adresse email" : "Email address"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-black/50 border border-white/10 rounded-xl text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#D70466] focus:border-transparent transition-all"
              />
            </div>

            <div className="relative">
              <IconLock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type="password"
                required
                placeholder={lang === 'fr' ? "Mot de passe" : "Password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-black/50 border border-white/10 rounded-xl text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#D70466] focus:border-transparent transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="relative w-full flex items-center justify-center py-3 rounded-xl bg-gradient-to-r from-[#D70466] to-[#7C3AED] text-white font-bold tracking-wide hover:shadow-[0_0_20px_rgba(215,4,102,0.4)] transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <IconLoader2 className="w-5 h-5 animate-spin" />
              ) : (
                mode === "login" 
                  ? (lang === 'fr' ? "Se connecter" : "Log in") 
                  : (lang === 'fr' ? "S'inscrire" : "Sign up")
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-zinc-400">
            {mode === "login" 
              ? (lang === 'fr' ? "Pas encore de compte ?" : "Don't have an account?") 
              : (lang === 'fr' ? "Déjà un compte ?" : "Already have an account?")}
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="ml-2 text-white hover:text-[#D70466] font-semibold transition-colors focus:outline-none"
            >
              {mode === "login" 
                ? (lang === 'fr' ? "S'inscrire" : "Sign up") 
                : (lang === 'fr' ? "Se connecter" : "Log in")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
