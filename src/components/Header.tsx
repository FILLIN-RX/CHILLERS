"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  IconSearch,
  IconHome,
  IconHomeFilled,
  IconMovie,
  IconDeviceTv,
  IconDeviceTvFilled,
  IconSparkles,
  IconTower,
  IconSparklesFilled,
  IconUser,
  IconHistory,
  IconBookmark,
  IconLogout,
  IconCrown,
  IconDownload,
  IconSettings,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { getActiveNavTab } from "@/lib/navActive";
import { useAuthStore } from "@/stores/useAuthStore";
import { useDownloadsStore } from "@/store/downloads";
import AuthModal from "@/components/AuthModal";
import UserAvatar from "@/components/UserAvatar";

interface HeaderProps {
  onSearchClick: () => void;
}

export default function Header({ onSearchClick }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { translate: _, lang } = useLanguage();

  const tabs = [
    { id: "home", label: _("nav.home"), href: "/", icon: IconHome, fillIcon: IconHomeFilled },
    { id: "movies", label: _("nav.movies"), href: "/media/movies", icon: IconMovie, fillIcon: null },
    { id: "series", label: _("nav.series"), href: "/media/series", icon: IconDeviceTv, fillIcon: IconDeviceTvFilled },
    { id: "anime", label: _("nav.anime"), href: "/media/anime", icon: IconSparkles, fillIcon: IconSparklesFilled },
    { id: "live", label: _("nav.live"), href: "/live", icon: IconTower, fillIcon: null },
  ];

  const activeTab = getActiveNavTab(pathname);

  const isDetailPage =
    /^\/media\/(?!movies$|series$|anime$)(.+)$/.test(pathname) ||
    pathname.startsWith("/tv/") ||
    pathname.startsWith("/watch/");
  const isListingPage =
    pathname.startsWith("/media/movies") ||
    pathname.startsWith("/media/series") ||
    pathname.startsWith("/media/anime");

  const [isScrolled, setIsScrolled] = useState(false);
  const [hideMobile, setHideMobile] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const { user, logout } = useAuthStore();
  const tasks = useDownloadsStore((s) => s.tasks);
  const activeDownloadsCount = tasks.filter(
    (t) => t.status === "downloading" || t.status === "resolving" || t.status === "queued"
  ).length;
  const doneDownloadsCount = tasks.filter((t) => t.status === "done").length;

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 20;
      setIsScrolled(scrolled);
      if (isListingPage) {
        setHideMobile(scrolled);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isListingPage]);

  if (pathname?.startsWith("/watch")) return null;

  return (
    <header
      className={`fixed top-0 left-0 w-full z-40 transition-all duration-300 select-none [app-region:drag] ${
        isDetailPage ? "max-sm:hidden" : ""
      } ${
        hideMobile ? "-translate-y-full sm:translate-y-0" : ""
      } ${
        isScrolled
          ? "bg-[#0c0c0e]/95 backdrop-blur-xl shadow-2xl border-b border-white/8"
          : "bg-gradient-to-b from-black/90 via-black/40 to-transparent"
      }`}
    >
      <div className="flex items-center justify-between px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 max-w-[1920px] mx-auto gap-4">
        {/* GAUCHE : FLÈCHES PC UNIQUEMENT + LOGO + ONGLETS DE NAVIGATION */}
        <div className="flex items-center gap-3 sm:gap-5 flex-shrink-0 [app-region:no-drag]">
          {/* FLÈCHES HISTORIQUE (PC / GRAND ÉCRAN UNIQUEMENT) */}
          <div className="hidden lg:flex items-center gap-1.5">
            <button
              onClick={() => router.back()}
              title="Page précédente"
              className="w-8 h-8 rounded-full bg-black/40 hover:bg-white/10 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer active:scale-95"
            >
              <IconChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => router.forward()}
              title="Page suivante"
              className="w-8 h-8 rounded-full bg-black/40 hover:bg-white/10 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer active:scale-95"
            >
              <IconChevronRight className="w-4 h-4" />
            </button>
          </div>

          <Link href="/" className="group flex items-center focus:outline-none shrink-0">
            <Image
              src="/android-chrome-512x512.png"
              alt="CHILLERS"
              width={34}
              height={34}
              className="h-7 sm:h-8 w-auto object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-[0_0_12px_rgba(229,9,20,0.3)]"
              priority
            />
          </Link>

          <nav className="hidden xl:flex items-center gap-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const ActiveIcon = tab.fillIcon ?? tab.icon;
              const TabIcon = isActive ? ActiveIcon : tab.icon;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all focus:outline-none rounded-full ${
                    isActive
                      ? "text-white bg-white/12 shadow-sm ring-1 ring-white/15"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <TabIcon className={`h-3.5 w-3.5 ${isActive ? "text-brand-primary" : ""}`} />
                  {tab.label}
                </Link>
              );
            })}
            <Link
              href="/categories"
              aria-current={activeTab === "categories" ? "page" : undefined}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all focus:outline-none rounded-full ${
                activeTab === "categories"
                  ? "text-white bg-white/12 shadow-sm ring-1 ring-white/15"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {_("nav.categories")}
            </Link>
          </nav>
        </div>

        {/* CENTRE : BARRE DE RECHERCHE PILL STYLE SPOTIFY */}
        <div className="flex-1 max-w-md hidden md:flex items-center justify-center [app-region:no-drag]">
          <button
            onClick={onSearchClick}
            aria-label="Rechercher"
            className="w-full flex items-center gap-3 px-4 py-2 rounded-full bg-zinc-900/90 hover:bg-zinc-800/90 border border-white/10 hover:border-white/20 text-zinc-400 hover:text-white transition-all shadow-inner group cursor-pointer"
          >
            <IconSearch className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
            <span className="text-xs font-medium truncate">
              {lang === "fr" ? "Que souhaitez-vous regarder ?" : "What do you want to watch?"}
            </span>
            <kbd className="hidden lg:inline-block ml-auto text-[10px] font-mono text-zinc-500 bg-black/40 px-1.5 py-0.5 rounded border border-white/10">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* DROITE : ACTIONS (Recherche mobile, Téléchargements, Langue, Profil) */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0 [app-region:no-drag]">
          <button
            onClick={onSearchClick}
            aria-label={_("nav.search")}
            className="md:hidden flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition-colors focus:outline-none"
          >
            <IconSearch className="h-4 w-4" />
          </button>

          {/* BOUTON TÉLÉCHARGEMENTS AVEC BADGE LIVE */}
          <Link
            href="/downloads"
            aria-label="Téléchargements"
            title="Mes Téléchargements"
            className={`relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition-colors focus:outline-none ${
              pathname === "/downloads" ? "text-white bg-white/15 ring-1 ring-white/25" : ""
            }`}
          >
            <IconDownload className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            {activeDownloadsCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-primary text-[9px] font-black text-white animate-pulse">
                {activeDownloadsCount}
              </span>
            ) : doneDownloadsCount > 0 ? (
              <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-black" />
            ) : null}
          </Link>

          <LanguageSwitcher />

          {user ? (
            <div className="flex items-center gap-2">
              {user.subscription?.plan !== "premium" && user.role !== "admin" && (
                <Link
                  href="/subscribe"
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all shadow-sm"
                >
                  <IconCrown className="w-3.5 h-3.5 text-yellow-400" />
                  <span>PRO</span>
                </Link>
              )}

              <div className="relative group/user">
                {user.subscription?.plan === "premium" || user.role === "admin" ? (
                  <button
                    onClick={() => router.push("/profile")}
                    className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/15 hover:from-amber-500/30 hover:to-yellow-500/25 border border-amber-500/40 text-amber-300 transition-all focus:outline-none cursor-pointer"
                  >
                    <UserAvatar user={user} size="xs" showBadge={false} />
                    <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider truncate max-w-[80px] text-amber-200">
                      {user.username || user.email.split("@")[0]}
                    </span>
                    <span className="flex items-center px-1.5 py-0.2 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-[9px] font-black tracking-widest shadow-sm">
                      VIP
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={() => router.push("/profile")}
                    className="flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-2 py-1 rounded-full bg-white/8 hover:bg-white/15 border border-white/10 text-white transition-all focus:outline-none cursor-pointer"
                  >
                    <UserAvatar user={user} size="xs" showBadge={false} />
                    <span className="hidden sm:inline text-xs font-semibold uppercase tracking-wider truncate max-w-[80px]">
                      {user.username || user.email.split("@")[0]}
                    </span>
                  </button>
                )}

                {/* MENU UTILISATEUR */}
                <div className="absolute right-0 top-full mt-2 w-60 bg-[#141416]/98 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover/user:opacity-100 group-hover/user:visible transition-all flex flex-col p-2 z-50">
                  <div className="flex items-center gap-3 px-3 py-2.5 border-b border-white/10 mb-1">
                    <UserAvatar user={user} size="sm" showBadge={true} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-white font-bold truncate">
                        {user.username || user.email}
                      </p>
                      <p className="text-[10px] text-zinc-400 truncate">{user.email}</p>
                    </div>
                  </div>

                  <Link
                    href="/profile"
                    className="flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors font-medium"
                  >
                    <IconUser className="w-4 h-4" />
                    {lang === "fr" ? "Mon Profil" : "My Profile"}
                  </Link>

                  <Link
                    href="/downloads"
                    className="flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors font-medium"
                  >
                    <IconDownload className="w-4 h-4 text-emerald-400" />
                    {lang === "fr" ? "Mes Téléchargements" : "Downloads"}
                    {doneDownloadsCount > 0 && (
                      <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                        {doneDownloadsCount}
                      </span>
                    )}
                  </Link>

                  <Link
                    href="/profile?tab=watchlist"
                    className="flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors font-medium"
                  >
                    <IconBookmark className="w-4 h-4" />
                    {lang === "fr" ? "Ma Liste" : "Watchlist"}
                  </Link>

                  <Link
                    href="/profile?tab=history"
                    className="flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors font-medium"
                  >
                    <IconHistory className="w-4 h-4" />
                    {lang === "fr" ? "Historique" : "History"}
                  </Link>

                  <div className="border-t border-white/10 my-1"></div>

                  <button
                    onClick={logout}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs text-left text-red-400 hover:bg-white/10 rounded-xl transition-colors font-medium cursor-pointer"
                  >
                    <IconLogout className="w-4 h-4" />
                    {lang === "fr" ? "Se déconnecter" : "Log out"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link
                href="/subscribe"
                className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 text-amber-300 hover:text-amber-200 text-xs font-bold transition-all shadow-sm"
              >
                <IconCrown className="w-3.5 h-3.5 text-yellow-400" />
                <span>PRO</span>
              </Link>
              <button
                onClick={() => {
                  if (window.innerWidth < 768) {
                    router.push("/login");
                  } else {
                    setIsAuthModalOpen(true);
                  }
                }}
                className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-white text-black hover:bg-zinc-200 text-xs font-bold transition-colors focus:outline-none cursor-pointer shadow-sm active:scale-95"
              >
                <IconUser className="w-3.5 h-3.5" />
                <span>{lang === "fr" ? "Connexion" : "Log in"}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </header>
  );
}
