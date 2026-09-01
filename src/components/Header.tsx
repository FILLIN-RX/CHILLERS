"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { IconSearch, IconHome, IconHomeFilled, IconMovie, IconDeviceTv, IconDeviceTvFilled, IconSparkles, IconTower, IconSparklesFilled, IconUser, IconMenu2, IconX, IconSettings, IconHistory, IconBookmark, IconLogout } from "@tabler/icons-react";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { getActiveNavTab } from "@/lib/navActive";
import { useAuthStore } from "@/stores/useAuthStore";
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

  // Single source of truth shared with <BottomNav> so the two indicators
  // never disagree (see src/lib/navActive.ts).
  const activeTab = getActiveNavTab(pathname);

  const isDetailPage = /^\/media\/(?!movies$|series$|anime$)(.+)$/.test(pathname) || pathname.startsWith("/tv/") || pathname.startsWith("/watch/");
  const isListingPage = pathname.startsWith("/media/movies") || pathname.startsWith("/media/series") || pathname.startsWith("/media/anime");

  const [isScrolled, setIsScrolled] = useState(false);
  const [hideMobile, setHideMobile] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const { user, logout } = useAuthStore();

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

  return (
    <header className={`fixed top-0 left-0 w-full z-40 transition-all duration-500 ${
      isDetailPage ? "max-sm:hidden" : ""
    } ${
      hideMobile ? "-translate-y-full sm:translate-y-0" : ""
    } ${
      isScrolled
        ? "bg-zinc-900 shadow-lg border-b border-white/10"
        : "bg-gradient-to-b from-black/90 via-black/50 to-transparent"
    }`}>
      <div className="flex items-center justify-between px-4 sm:px-8 md:px-12 lg:px-[4%] py-3 sm:py-4">

        <div className="flex items-center gap-6 sm:gap-8">
          <Link href="/" className="group flex items-center focus:outline-none shrink-0">
            <Image
              src="/android-chrome-512x512.png"
              alt="Chillers Logo"
              width={40}
              height={40}
              className="h-7 sm:h-9 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
              priority
            />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const ActiveIcon = tab.fillIcon ?? tab.icon;
              const TabIcon = isActive ? ActiveIcon : tab.icon;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none rounded-full ${
                    isActive
                      ? "text-white font-bold bg-white/5 backdrop-blur-md ring-1 ring-white/15 shadow-lg shadow-black/40"
                      : "text-zinc-300 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <TabIcon className={`h-4 w-4 ${isActive ? "text-red-500" : ""}`} />
                  {tab.label}
                </Link>
              );
            })}
            <Link
              href="/categories"
              aria-current={activeTab === "categories" ? "page" : undefined}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none rounded ${
                activeTab === "categories"
                  ? "text-white font-bold bg-white/5 backdrop-blur-sm ring-1 ring-white/10 shadow-lg shadow-black/40"
                  : "text-zinc-300 hover:text-white hover:bg-white/5"
              }`}
            >
              {_("nav.categories")}
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onSearchClick}
            aria-label={_("nav.search")}
            className="hidden sm:flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full hover:bg-zinc-800 hover:text-white transition-colors focus:outline-none text-zinc-300"
          >
            <IconSearch className="h-5 w-5" />
          </button>

          <LanguageSwitcher />

          {user ? (
            <div className="relative group/user">
              <button 
                onClick={() => router.push('/profile')}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/5 text-white/90 transition-all focus:outline-none"
              >
                <UserAvatar user={user} size="xs" showBadge={false} />
                <span className="text-xs font-semibold uppercase tracking-wider truncate max-w-[90px]">
                  {user.username || user.email.split('@')[0]}
                </span>
              </button>
              <div className="absolute right-0 top-full mt-2 w-64 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover/user:opacity-100 group-hover/user:visible transition-all flex flex-col p-2 z-50">
                <div className="flex items-center gap-3 px-3 py-2.5 border-b border-white/10 mb-1">
                  <UserAvatar user={user} size="sm" showBadge={true} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-white font-bold truncate">{user.username || user.email}</p>
                    <p className="text-[10px] sm:text-xs text-zinc-400 truncate">{user.email}</p>
                  </div>
                </div>
                
                <Link href="/profile" className="flex items-center gap-2 px-3 py-2 text-xs sm:text-sm text-zinc-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors font-medium">
                  <IconUser className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {lang === 'fr' ? 'Mon Profil' : 'My Profile'}
                </Link>
                
                <Link href="/profile?tab=watchlist" className="flex items-center gap-2 px-3 py-2 text-xs sm:text-sm text-zinc-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors font-medium">
                  <IconBookmark className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {lang === 'fr' ? 'Ma Liste' : 'Watchlist'}
                </Link>

                <Link href="/profile?tab=history" className="flex items-center gap-2 px-3 py-2 text-xs sm:text-sm text-zinc-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors font-medium">
                  <IconHistory className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {lang === 'fr' ? 'Historique' : 'History'}
                </Link>

                <Link href="/profile?tab=settings" className="flex items-center gap-2 px-3 py-2 text-xs sm:text-sm text-zinc-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors font-medium">
                  <IconSettings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {lang === 'fr' ? 'Paramètres' : 'Settings'}
                </Link>

                <div className="border-t border-white/10 my-1"></div>

                <button onClick={logout} className="flex items-center gap-2 px-3 py-2 text-xs sm:text-sm text-left text-red-400 hover:bg-white/10 rounded-lg transition-colors font-medium">
                  <IconLogout className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {lang === 'fr' ? 'Se déconnecter' : 'Log out'}
                </button>
              </div>
            </div>
          ) : (
            <div className="relative group/user">
              <button 
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/5 text-white/80 transition-colors focus:outline-none"
              >
                <IconUser className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {lang === 'fr' ? 'Connexion' : 'Log in'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </header>
  );
}
