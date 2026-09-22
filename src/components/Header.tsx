"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MagnifyingGlass, House, FilmSlate, Television, Star, Radio, User, ClockCounterClockwise, BookmarkSimple, SignOut, Crown, DownloadSimple, List, X, SquaresFour, CaretLeft, CaretRight, GearSix } from "@phosphor-icons/react";
import gsap from "gsap";
import { useLanguage } from "@/i18n/LanguageContext";
import { getActiveNavTab } from "@/lib/navActive";
import { useAuthStore } from "@/stores/useAuthStore";
import { useDownloadsStore } from "@/store/downloads";
import AuthModal from "@/components/AuthModal";
import UserAvatar from "@/components/UserAvatar";
import GenreFilterBar from "@/components/GenreFilterBar";
import { getMovieGenres, getTVGenres } from "@/services/media";
import type { Genre } from "@/types/media";

interface HeaderProps {
  onSearchClick: () => void;
}

function HeaderComponent({ onSearchClick }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { translate: _, lang } = useLanguage();

  const tabs = [
    { id: "home", label: _("nav.home"), href: "/", icon: House, fillIcon: House },
    { id: "movies", label: _("nav.movies"), href: "/media/movies", icon: FilmSlate, fillIcon: null },
    { id: "series", label: _("nav.series"), href: "/media/series", icon: Television, fillIcon: Television },
    { id: "anime", label: _("nav.anime"), href: "/media/anime", icon: Star, fillIcon: Star },
    { id: "live", label: _("nav.live"), href: "/live", icon: Radio, fillIcon: null },
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

  const listingType = pathname.startsWith("/media/movies")
    ? "movies"
    : pathname.startsWith("/media/series")
    ? "series"
    : pathname.startsWith("/media/anime")
    ? "anime"
    : null;

  const [genres, setGenres] = useState<Genre[]>([]);
  const [genresLoading, setGenresLoading] = useState(false);
  const activeGenreId = searchParams?.get("genre") || null;

  useEffect(() => {
    if (!isListingPage || !listingType) return;
    setGenresLoading(true);
    const fetcher = listingType === "movies" ? getMovieGenres : getTVGenres;
    fetcher()
      .then(setGenres)
      .catch(() => {})
      .finally(() => setGenresLoading(false));
  }, [isListingPage, listingType]);

  const handleSelectGenreInHeader = (genreId: string | null) => {
    if (!listingType) return;
    if (genreId) {
      router.push(`/media/${listingType}?genre=${genreId}`);
    } else {
      router.push(`/media/${listingType}`);
    }
  };

  const [isScrolled, setIsScrolled] = useState(false);
  const [hideMobile, setHideMobile] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const lastScrollY = useRef(0);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const activeDownloadsCount = useDownloadsStore((s) =>
    s.tasks.filter(
      (t) => t.status === "downloading" || t.status === "resolving" || t.status === "queued"
    ).length
  );
  const doneDownloadsCount = useDownloadsStore((s) =>
    s.tasks.filter((t) => t.status === "done").length
  );

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 30;
      setIsScrolled(scrolled);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fermer le drawer lors d'une navigation
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [pathname]);

  const isWatchPage = pathname?.startsWith("/watch");
  const isSeasonPage = Boolean(pathname?.includes("/season"));

  return (
    <>
      <header
        ref={headerRef}
        className={`fixed top-0 left-0 w-full z-40 select-none [app-region:drag] transition-colors duration-300 ${
          isDetailPage && !isWatchPage && !isSeasonPage ? "max-sm:hidden" : ""
        } ${
          isScrolled || isWatchPage || isSeasonPage
            ? "bg-[#0c0c0e]/95 backdrop-blur-xl shadow-2xl border-b border-white/8"
            : "bg-gradient-to-b from-black/90 via-black/40 to-transparent border-b-0"
        }`}
      >
        <div className="flex flex-col max-w-[1920px] mx-auto px-3 sm:px-6 lg:px-8 pt-2 pb-2.5 sm:py-3 gap-2">
          {/* LIGNE PRINCIPALE : Menu burger (mobile), Logo, Nav PC, Search PC, Bouton PRO & Profil */}
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            {/* GAUCHE : BURGER (Mobile) + RETOUR + LOGO + NAV PC */}
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 [app-region:no-drag]">
              {/* BOUTON BURGER STYLE MOVIEBOX (Mobile uniquement) */}
              <button
                onClick={() => setIsDrawerOpen(true)}
                aria-label="Menu"
                className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
              >
                <List className="w-6 h-6 stroke-[2.2]" />
              </button>

              {/* FLÈCHES HISTORIQUE / RETOUR */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => router.back()}
                  title="Page précédente"
                  aria-label="Retour"
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-95"
                >
                  <CaretLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => router.forward()}
                  title="Page suivante"
                  aria-label="Suivant"
                  className="hidden lg:flex w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 items-center justify-center text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-95"
                >
                  <CaretRight className="w-4 h-4" />
                </button>
              </div>

              {/* LOGO AVEC ICÔNE ET TEXTE */}
              <Link href="/" className="group flex items-center focus:outline-none shrink-0">
                <Image
                  src="/android-chrome-192x192.png"
                  alt="CHILLERS"
                  width={32}
                  height={32}
                  sizes="32px"
                  className="h-7 sm:h-8 w-auto object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-[0_0_12px_rgba(215,4,102,0.4)]"
                  priority
                />
                <span className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center font-sans -ml-1.5">
                  HILL<span className="text-brand-primary">ERS</span>
                </span>
              </Link>

              {/* ONGLETS DESKTOP (Couleur Primary pure sans glassmorphism sur l'actif) */}
              <nav className="hidden lg:flex items-center gap-2">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const ActiveIcon = tab.fillIcon ?? tab.icon;
                  const TabIcon = isActive ? ActiveIcon : tab.icon;
                  return (
                    <Link
                      key={tab.id}
                      href={tab.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`relative flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors focus:outline-none ${
                        isActive
                          ? "text-brand-primary font-bold"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      <TabIcon className="h-3.5 w-3.5" />
                      {tab.label}
                    </Link>
                  );
                })}
                {isListingPage && isScrolled ? (
                  <div className="flex items-center pl-1 animate-in fade-in duration-200">
                    <GenreFilterBar
                      genres={genres}
                      activeGenreId={activeGenreId}
                      onSelect={handleSelectGenreInHeader}
                      isLoading={genresLoading}
                      compact
                    />
                  </div>
                ) : (
                  <Link
                    href="/categories"
                    aria-current={activeTab === "categories" ? "page" : undefined}
                    className={`relative flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors focus:outline-none ${
                      activeTab === "categories"
                        ? "text-brand-primary font-bold"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {_("nav.categories")}
                  </Link>
                )}
              </nav>
            </div>

            {/* DROITE : RECHERCHE + BOUTONS ACTIONS + USER AVATAR AVEC BORDURE ABONNEMENT */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 [app-region:no-drag]">
              {/* BOUTON CROWN GOLD STYLE MOVIEBOX */}
              <Link
                href="/subscribe"
                title="Débloquer Premium"
                className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-amber-400 text-zinc-950 hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(234,179,8,0.4)] transition-all cursor-pointer"
              >
                <Crown className="w-4 h-4 sm:w-5 sm:h-5 fill-zinc-950 stroke-zinc-950" />
              </Link>

              {/* BOUTON TÉLÉCHARGEMENTS (PC) */}
              <Link
                href="/downloads"
                aria-label="Téléchargements"
                title="Mes Téléchargements"
                className={`hidden sm:flex relative h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition-colors focus:outline-none ${
                  pathname === "/downloads" ? "text-brand-primary" : ""
                }`}
              >
                <DownloadSimple className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                {activeDownloadsCount > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-primary text-[9px] font-black text-white">
                    {activeDownloadsCount}
                  </span>
                ) : doneDownloadsCount > 0 ? (
                  <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-black" />
                ) : null}
              </Link>

              {/* BOUTON RECHERCHE (Placé juste à côté de l'avatar) */}
              <button
                onClick={onSearchClick}
                aria-label="Rechercher"
                title="Rechercher films / séries"
                className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/8 hover:bg-white/15 border border-white/10 text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-95"
              >
                <MagnifyingGlass className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>

              {/* USER AVATAR / PROFIL AVEC BORDURE SELON ABONNEMENT */}
              {user ? (
                <div className="relative group/user">
                  <button
                    onClick={() => router.push("/profile")}
                    aria-label="Mon Profil"
                    className="flex items-center justify-center focus:outline-none cursor-pointer transition-transform hover:scale-105 active:scale-95"
                  >
                    <UserAvatar user={user} size="sm" showBadge={true} />
                  </button>

                  {/* MENU DÉROULANT DESKTOP */}
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
                      <User className="w-4 h-4" />
                      {lang === "fr" ? "Mon Profil" : "My Profile"}
                    </Link>

                    <Link
                      href="/downloads"
                      className="flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors font-medium"
                    >
                      <DownloadSimple className="w-4 h-4 text-emerald-400" />
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
                      <BookmarkSimple className="w-4 h-4" />
                      {lang === "fr" ? "Ma Liste" : "Watchlist"}
                    </Link>

                    <Link
                      href="/profile?tab=history"
                      className="flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors font-medium"
                    >
                      <ClockCounterClockwise className="w-4 h-4" />
                      {lang === "fr" ? "Historique" : "History"}
                    </Link>

                    <div className="border-t border-white/10 my-1"></div>

                    <button
                      onClick={logout}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#D70466] hover:bg-[#b5034f] border border-[#D70466] active:scale-95 text-white font-bold text-xs shadow-md transition-all cursor-pointer mt-1"
                    >
                      <SignOut className="w-4 h-4" />
                      <span>{lang === "fr" ? "Se déconnecter" : "Log out"}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* BOUTON CONNEXION AVATAR */
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  aria-label="Connexion"
                  className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-all focus:outline-none cursor-pointer shadow-sm active:scale-95"
                >
                  <User className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* SÉLECTEUR DE CATÉGORIES MOBILE (Au top sur mobile, directement dans le header) */}
          {isListingPage && (
            <div className="flex lg:hidden items-center justify-between pt-1.5 pb-0.5 border-t border-white/10 [app-region:no-drag]">
              <span className="text-xs font-black text-white tracking-wide uppercase">
                {listingType === "movies"
                  ? _("nav.movies") || "Films"
                  : listingType === "series"
                  ? _("nav.series") || "Séries"
                  : _("nav.anime") || "Anime"}
              </span>
              <GenreFilterBar
                genres={genres}
                activeGenreId={activeGenreId}
                onSelect={handleSelectGenreInHeader}
                isLoading={genresLoading}
                compact
              />
            </div>
          )}
        </div>

        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      </header>

      {/* SIDEBAR DRAWER MOBILE (Ouvert par le burger style MovieBox) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-[9999] md:hidden">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in"
            onClick={() => setIsDrawerOpen(false)}
          />
          <div className="relative z-10 w-[280px] max-w-[85vw] h-full bg-[#121214] border-r border-white/10 p-5 flex flex-col justify-between shadow-2xl animate-in slide-in-from-left duration-250">
            <div className="space-y-6">
              {/* Header drawer avec logo et bouton fermer */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <Link href="/" onClick={() => setIsDrawerOpen(false)} className="flex items-center">
                  <Image
                    src="/android-chrome-192x192.png"
                    alt="CHILLERS"
                    width={28}
                    height={28}
                    sizes="28px"
                    className="h-7 w-auto object-contain"
                  />
                  <span className="text-lg font-black text-white -ml-1.5">
                    HILL<span className="text-brand-primary">ERS</span>
                  </span>
                </Link>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation du Drawer */}
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <Link
                      key={tab.id}
                      href={tab.href}
                      onClick={() => setIsDrawerOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        isActive
                          ? "bg-brand-primary/20 text-brand-primary border border-brand-primary/30"
                          : "text-zinc-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{tab.label}</span>
                    </Link>
                  );
                })}
                <Link
                  href="/categories"
                  onClick={() => setIsDrawerOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === "categories"
                      ? "bg-brand-primary/20 text-brand-primary border border-brand-primary/30"
                      : "text-zinc-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <SquaresFour className="w-5 h-5" />
                  <span>{_("nav.categories")}</span>
                </Link>
              </nav>

              {/* Bannière VIP Drawer */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-center gap-2 mb-1.5">
                  <Crown className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-xs font-bold text-amber-300">CHILLERS VIP</span>
                </div>
                <p className="text-[11px] text-zinc-400 mb-3">
                  {lang === "fr" ? "Sans pub, streaming HD & téléchargements" : "No ads, HD streaming & downloads"}
                </p>
                <Link
                  href="/subscribe"
                  onClick={() => setIsDrawerOpen(false)}
                  className="block w-full text-center py-2 px-3 rounded-xl bg-amber-400 text-zinc-950 font-bold text-xs shadow-md active:scale-95 transition-all"
                >
                  {lang === "fr" ? "Débloquer" : "Unlock"}
                </Link>
              </div>
            </div>

            {/* Bas du Drawer : Déconnexion */}
            {user && (
              <div className="pt-4 border-t border-white/10">
                <button
                  onClick={() => {
                    setIsDrawerOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#D70466] hover:bg-[#b5034f] border border-[#D70466] active:scale-95 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  <SignOut className="w-4 h-4" />
                  <span>{lang === "fr" ? "Se déconnecter" : "Logout"}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const Header = React.memo(HeaderComponent);
export default Header;

