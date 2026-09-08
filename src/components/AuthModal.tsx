"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { signIn } from "next-auth/react";
import { X, User, Envelope, Lock, Spinner } from "@phosphor-icons/react";
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

const GOOGLE_AUTH_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

export default function AuthModal({ isOpen, onClose, initialMode = "login" }: AuthModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceLimitReached, setDeviceLimitReached] = useState(false);
  const [mounted, setMounted] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const setAuth = useAuthStore((state) => state.setAuth);
  const { lang } = useLanguage();

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!isOpen || !mounted) return null;

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

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        ref={modalRef}
        className="relative z-10 w-full max-w-md my-auto bg-zinc-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/50 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
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
                  className="w-full py-2 px-3 rounded-lg bg-[#D70466] hover:opacity-95 text-white font-bold text-xs shadow transition-all active:scale-95 cursor-pointer"
                >
                  {lang === "fr"
                    ? "Déconnecter tous les autres appareils et continuer"
                    : "Disconnect all other devices and continue"}
                </button>
              )}
            </div>
          )}

          {GOOGLE_AUTH_ENABLED && (
            <div className="mb-6">
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  setError(null);
                  try {
                    await signIn("google", { callbackUrl: window.location.href });
                  } catch (err: any) {
                    setError(err?.message || "Erreur de connexion avec Google");
                    setLoading(false);
                  }
                }}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-white font-medium text-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5c1.56 0 2.98.54 4.09 1.58l3.07-3.07C17.29 1.7 14.83 1 12 1 7.42 1 3.53 3.61 1.63 7.39l3.73 2.89C6.27 7.23 8.89 5 12 5z" />
                  <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.72 2.88c2.18-2.01 3.7-4.97 3.7-8.7z" />
                  <path fill="#FBBC05" d="M5.36 14.72c-.24-.72-.36-1.48-.36-2.72s.12-2 .36-2.72L1.63 6.39C.59 8.47 0 10.66 0 12s.59 3.53 1.63 5.61l3.73-2.89z" />
                  <path fill="#34A853" d="M12 23c3.24 0 5.95-1.08 7.93-2.91l-3.72-2.88c-1.07.72-2.45 1.16-4.21 1.16-3.11 0-5.73-2.23-6.64-5.28L1.63 15.98C3.53 19.76 7.42 23 12 23z" />
                </svg>
                <span>{lang === "fr" ? "Continuer avec Google" : "Continue with Google"}</span>
              </button>

              <div className="relative my-6 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <span className="relative bg-zinc-900 px-4 text-xs uppercase tracking-wider text-zinc-500">
                  {lang === "fr" ? "ou avec email" : "or with email"}
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
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
              <Envelope className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
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
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
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
              className="relative w-full flex items-center justify-center py-3 rounded-xl bg-[#D70466] text-white font-bold tracking-wide hover:shadow-[0_0_20px_rgba(215,4,102,0.4)] transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <Spinner className="w-5 h-5 animate-spin" />
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
              className="ml-2 text-white hover:text-[#D70466] font-semibold transition-colors focus:outline-none cursor-pointer"
            >
              {mode === "login" 
                ? (lang === 'fr' ? "S'inscrire" : "Sign up") 
                : (lang === 'fr' ? "Se connecter" : "Log in")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
