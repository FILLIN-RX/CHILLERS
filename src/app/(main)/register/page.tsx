"use client";

import React, { useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IconMail, IconLock, IconUser, IconLoader2, IconSparkles, IconChevronLeft } from "@tabler/icons-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { authService } from "@/services/auth";
import { useLanguage } from "@/i18n/LanguageContext";
import { getStableDeviceFingerprint } from "@/lib/deviceFingerprint";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/";
  const { lang } = useLanguage();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { deviceId, deviceName } = getStableDeviceFingerprint();

      const res = await authService.register(
        email.trim(),
        password,
        username.trim() || undefined,
        deviceId,
        deviceName
      );
      if (res.success && res.token && res.user) {
        setAuth(res.token, res.user);
        router.push(redirectUrl);
      } else {
        setError(res.message || (lang === "fr" ? "Erreur lors de la création du compte." : "Registration error."));
      }
    } catch (err: any) {
      setError(err.message || (lang === "fr" ? "Erreur d'inscription." : "Sign up error."));
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
            {lang === "fr" ? "Créer un compte" : "Create an account"}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            {lang === "fr"
              ? "Rejoignez Chillers pour une expérience de streaming optimale."
              : "Join Chillers for the ultimate streaming experience."}
          </p>
        </div>

        {error && (
          <div className="mt-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs sm:text-sm font-medium">
            {error}
          </div>
        )}

        <div className="mt-6 bg-zinc-900 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                {lang === "fr" ? "Pseudo / Nom d'utilisateur" : "Username"}
              </label>
              <div className="relative">
                <IconUser className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  required
                  placeholder="Ex: Alex22"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-black/60 border border-white/10 rounded-xl text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-[#D70466] transition-colors"
                />
              </div>
            </div>

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
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                {lang === "fr" ? "Mot de passe" : "Password"}
              </label>
              <div className="relative">
                <IconLock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="password"
                  required
                  autoComplete="new-password"
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
              <span>{lang === "fr" ? "S'inscrire gratuitement" : "Create Account"}</span>
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <p className="text-xs text-zinc-400">
              {lang === "fr" ? "Vous avez déjà un compte ?" : "Already have an account?"}{" "}
              <Link
                href={`/login?redirect=${encodeURIComponent(redirectUrl)}`}
                className="font-bold text-[#D70466] hover:underline ml-1"
              >
                {lang === "fr" ? "Se connecter" : "Sign In"}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#09090B]" />}>
      <RegisterForm />
    </Suspense>
  );
}
