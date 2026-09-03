"use client";

import React, { useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IconMail, IconLock, IconLoader2, IconSparkles, IconChevronLeft } from "@tabler/icons-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { authService } from "@/services/auth";
import { useLanguage } from "@/i18n/LanguageContext";
import { getStableDeviceFingerprint } from "@/lib/deviceFingerprint";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/";
  const { lang } = useLanguage();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceLimitReached, setDeviceLimitReached] = useState(false);

  const handleSubmit = async (e?: React.FormEvent, forceDisconnect = false) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { deviceId, deviceName } = getStableDeviceFingerprint();

      const res = await authService.login(email.trim(), password, deviceId, deviceName, forceDisconnect);
      if (res.success && res.token && res.user) {
        setAuth(res.token, res.user);
        router.push(redirectUrl);
      } else if (res.code === "DEVICE_LIMIT_REACHED") {
        setDeviceLimitReached(true);
        setError(
          lang === "fr"
            ? "Limite d'appareils connectés atteinte pour votre abonnement."
            : "Device limit reached for your subscription plan."
        );
      } else {
        setDeviceLimitReached(false);
        setError(res.message || (lang === "fr" ? "Identifiants invalides." : "Invalid credentials."));
      }
    } catch (err: any) {
      setError(err.message || (lang === "fr" ? "Erreur de connexion." : "Connection error."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#09090B] text-white flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-12">
      {/* Top back navigation on mobile */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20">
        <Link
          href="/"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs font-semibold text-zinc-300 hover:text-white transition-all"
        >
          <IconChevronLeft className="w-4 h-4" />
          <span>{lang === "fr" ? "Accueil" : "Home"}</span>
        </Link>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center space-y-3">
          <Link href="/" className="inline-flex flex-col items-center gap-2 group transition-transform hover:scale-105">
            <Image
              src="/android-chrome-512x512.png"
              alt="CHILLERS"
              width={56}
              height={56}
              className="w-12 h-12 sm:w-14 sm:h-14 object-contain drop-shadow-[0_0_20px_rgba(215,4,102,0.4)]"
              priority
            />
            <span className="text-2xl sm:text-3xl font-black tracking-wider uppercase bg-gradient-to-r from-[#D70466] to-[#7C3AED] bg-clip-text text-transparent">
              CHILLERS
            </span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            {lang === "fr" ? "Connexion à votre compte" : "Sign in to your account"}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            {lang === "fr"
              ? "Accédez à vos favoris, reprises de lecture et flux 1080p."
              : "Access your favorites, watch history and 1080p streams."}
          </p>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs sm:text-sm font-medium space-y-3">
            <p className="text-red-400">{error}</p>
            {deviceLimitReached && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => handleSubmit(undefined, true)}
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:opacity-95 text-white font-bold text-xs transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading && <IconLoader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {lang === "fr"
                      ? "Déconnecter tous les autres appareils et se connecter"
                      : "Disconnect all other devices and log in"}
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 bg-zinc-900 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                {lang === "fr" ? "Adresse email" : "Email address"}
              </label>
              <div className="relative">
                <IconMail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="nom@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-black/60 border border-white/10 rounded-xl text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-[#D70466] transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-zinc-300">
                  {lang === "fr" ? "Mot de passe" : "Password"}
                </label>
              </div>
              <div className="relative">
                <IconLock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-black/60 border border-white/10 rounded-xl text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-[#D70466] transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-[#D70466] hover:bg-[#b5034f] text-white text-sm font-bold shadow-lg transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            >
              {loading && <IconLoader2 className="w-4 h-4 animate-spin" />}
              <span>{lang === "fr" ? "Se connecter" : "Sign In"}</span>
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <p className="text-xs text-zinc-400">
              {lang === "fr" ? "Vous n'avez pas encore de compte ?" : "Don't have an account yet?"}{" "}
              <Link
                href={`/register?redirect=${encodeURIComponent(redirectUrl)}`}
                className="font-bold text-[#D70466] hover:underline ml-1"
              >
                {lang === "fr" ? "Créer un compte" : "Sign Up"}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#09090B]" />}>
      <LoginForm />
    </Suspense>
  );
}
