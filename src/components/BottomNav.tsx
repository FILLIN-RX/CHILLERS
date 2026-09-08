"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { House, FilmSlate, Television, Radio, User } from "@phosphor-icons/react";
import { useLanguage } from "@/i18n/LanguageContext";
import { getActiveNavTab } from "@/lib/navActive";
import { useAuthStore } from "@/stores/useAuthStore";
import UserAvatar from "@/components/UserAvatar";
import AuthModal from "@/components/AuthModal";
import { useHydrated } from "@/hooks/useHydrated";

interface BottomNavProps {
  onSearchClick: () => void;
}

export default function BottomNav({ onSearchClick }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { translate: _, lang } = useLanguage();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const hydrated = useHydrated();

  const { user } = useAuthStore();

  const items = [
    { id: "home", label: lang === "fr" ? "Accueil" : "Home", icon: House, href: "/" },
    { id: "movies", label: lang === "fr" ? "Films" : "Movie", icon: FilmSlate, href: "/media/movies" },
    { id: "series", label: lang === "fr" ? "Séries" : "TV Show", icon: Television, href: "/media/series" },
    {
      id: "live",
      label: "Live",
      icon: Radio,
      href: "/live",
    },
    {
      id: "profile",
      label: user ? (lang === "fr" ? "Profil" : "Profile") : (lang === "fr" ? "Connexion" : "Login"),
      icon: User,
      href: user ? "/profile" : "/login",
    },
  ] as const;

  useEffect(() => {
    const update = () => setIsFullscreen(!!document.fullscreenElement);
    update();
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  const activeTab = getActiveNavTab(pathname);

  if (!hydrated) return null;
  if (isFullscreen || pathname?.startsWith("/watch")) return null;

  return (
    <>
      <nav className="glass-nav fixed bottom-0 left-0 w-full z-50 md:hidden border-t border-zinc-800/60 bg-[#0e0e11]/95 backdrop-blur-xl">
        <div className="flex items-center justify-around py-2 px-1 pb-[max(8px,env(safe-area-inset-bottom))]">
          {items.map((item) => {
            const Icon = item.icon;
            const isProfile = item.id === "profile";
            const isActive = isProfile
              ? pathname.startsWith("/profile")
              : activeTab === item.id;

            if (isProfile && !user) {
              return (
                <button
                  key={item.id}
                  onClick={() => router.push("/login")}
                  aria-label={item.label}
                  className={`relative flex flex-col items-center gap-1 py-1 px-2 min-w-[56px] rounded-xl transition-all duration-200 focus:outline-none active:scale-90 ${
                    isActive ? "text-[#00E599]" : "text-zinc-400"
                  }`}
                >
                  <Icon className="h-5 w-5 stroke-[2.2]" />
                  <span className="text-[10px] font-bold leading-none truncate max-w-[60px]">
                    {item.label}
                  </span>
                </button>
              );
            }

            return (
              <Link
                key={item.id}
                href={item.href}
                aria-label={item.label}
                className={`relative flex flex-col items-center gap-1 py-1 px-2 min-w-[56px] rounded-xl transition-all duration-200 focus:outline-none active:scale-90 ${
                  isActive ? "text-[#00E599]" : "text-zinc-400"
                }`}
              >
                <div className="relative flex items-center justify-center">
                  {isProfile && user ? (
                    <div
                      className={`rounded-full p-0.5 ${
                        isActive ? "ring-2 ring-[#00E599]" : ""
                      }`}
                    >
                      <UserAvatar user={user} size="xs" showBadge={false} />
                    </div>
                  ) : (
                    <Icon className="h-5 w-5 stroke-[2.2]" />
                  )}
                </div>
                <span
                  className={`text-[10px] font-bold leading-none truncate max-w-[60px] ${
                    isActive ? "text-[#00E599]" : "text-zinc-400"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
}
