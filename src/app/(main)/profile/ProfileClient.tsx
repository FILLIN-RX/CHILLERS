"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLanguage } from "@/i18n/LanguageContext";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconBookmark,
  IconHistory,
  IconSettings,
  IconUser,
  IconPlayerPlay,
  IconCrown,
  IconDeviceDesktop,
  IconDownload,
  IconArrowLeft,
  IconLogout,
  IconChevronRight,
  IconClock,
  IconPlaylist,
  IconPlus,
  IconTrash,
  IconHeart,
  IconX,
  IconMovie,
  IconDeviceTv,
} from "@tabler/icons-react";
import Link from "next/link";
import { userService } from "@/services/user";
import { authService } from "@/services/auth";
import { getStableDeviceFingerprint } from "@/lib/deviceFingerprint";
import UserAvatar from "@/components/UserAvatar";
import DownloadsView from "@/features/downloads/DownloadsView";
import { useDownloadsStore } from "@/store/downloads";
import ProfileSidebar from "@/features/profile/ProfileSidebar";

export default function ProfileClient() {
  const { user, token, updateUser, logout } = useAuthStore();
  const { lang, translate: _ } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  const tasks = useDownloadsStore((s) => s.tasks);
  const doneDownloadsCount = tasks.filter((t) => t.status === "done").length;

  const [quality, setQuality] = useState(user?.preferences?.defaultQuality || "Auto");

  // Playlist creation modal state
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState("");
  const [newPlaylistDescription, setNewPlaylistDescription] = useState("");
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  useEffect(() => {
    if (!user && !token) {
      router.push("/");
      return;
    }

    if (token) {
      authService.getProfile(token).then((res) => {
        if (res.success && res.user) {
          updateUser(res.user);
        }
      }).catch(console.error);
    }
  }, [token, router, updateUser]);

  if (!user) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-20 text-center">
        <div className="max-w-md w-full bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-[#D70466]/10 border border-[#D70466]/20 flex items-center justify-center mx-auto text-[#D70466]">
            <IconUser className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">
              {lang === "fr" ? "Connectez-vous à Chillers" : "Sign in to Chillers"}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400">
              {lang === "fr"
                ? "Retrouvez vos favoris, votre historique de visionnage, vos playlists et vos téléchargements."
                : "Access your watchlist, watch history, playlists and offline downloads."}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              href="/login?redirect=/profile"
              className="flex-1 py-3 px-4 rounded-xl bg-[#D70466] hover:bg-[#b5034f] text-white text-sm font-bold shadow-lg transition-all"
            >
              {lang === "fr" ? "Connexion" : "Log In"}
            </Link>
            <Link
              href="/register?redirect=/profile"
              className="flex-1 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-white text-sm font-bold transition-all"
            >
              {lang === "fr" ? "S'inscrire" : "Sign Up"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newPlaylistTitle.trim()) return;

    setIsCreatingPlaylist(true);
    try {
      const res = await userService.createPlaylist(token, {
        title: newPlaylistTitle.trim(),
        description: newPlaylistDescription.trim(),
      });
      if (res.success && res.playlists) {
        updateUser({ playlists: res.playlists });
        setNewPlaylistTitle("");
        setNewPlaylistDescription("");
        setShowCreatePlaylistModal(false);
      }
    } catch (err) {
      console.error("Erreur création playlist:", err);
      alert(lang === "fr" ? "Erreur lors de la création de la playlist" : "Failed to create playlist");
    } finally {
      setIsCreatingPlaylist(false);
    }
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    if (!token) return;
    if (!confirm(lang === "fr" ? "Voulez-vous supprimer cette playlist ?" : "Delete this playlist?")) return;

    try {
      const res = await userService.deletePlaylist(token, playlistId);
      if (res.success && res.playlists) {
        updateUser({ playlists: res.playlists });
        if (selectedPlaylistId === playlistId) {
          setSelectedPlaylistId(null);
        }
      }
    } catch (err) {
      console.error("Erreur suppression playlist:", err);
    }
  };

  const handleRemoveFromPlaylist = async (playlistId: string, tmdbId: string) => {
    if (!token) return;
    try {
      const res = await userService.removeMediaFromPlaylist(token, playlistId, tmdbId);
      if (res.success && res.playlists) {
        updateUser({ playlists: res.playlists });
      }
    } catch (err) {
      console.error("Erreur retrait média playlist:", err);
    }
  };

  const handleRemoveFromWatchLater = async (media: { mediaType: string; tmdbId: string; title: string }) => {
    if (!token) return;
    try {
      const res = await userService.toggleWatchLater(token, media);
      if (res.success && res.watchLater) {
        updateUser({ watchLater: res.watchLater });
      }
    } catch (err) {
      console.error("Erreur watch later:", err);
    }
  };

  const tabs = [
    {
      id: "overview",
      label: lang === 'fr' ? 'Accueil Profil' : 'Overview',
      icon: IconUser,
      description: lang === 'fr' ? 'Vue générale comme YouTube' : 'YouTube-style library overview',
    },
    {
      id: "history",
      label: lang === 'fr' ? 'Historique' : 'History',
      icon: IconHistory,
      badge: user.watchHistory?.length || 0,
      description: lang === 'fr' ? 'Reprenez vos lectures récentes' : 'Continue watching where you left off',
    },
    {
      id: "playlists",
      label: lang === 'fr' ? 'Playlists' : 'Playlists',
      icon: IconPlaylist,
      badge: user.playlists?.length || 0,
      description: lang === 'fr' ? 'Vos collections et listes personnalisées' : 'Your custom video collections',
    },
    {
      id: "watch_later",
      label: lang === 'fr' ? 'À regarder plus tard' : 'Watch Later',
      icon: IconClock,
      badge: user.watchLater?.length || 0,
      description: lang === 'fr' ? 'Vos vidéos réservées pour plus tard' : 'Videos saved for later',
    },
    {
      id: "watchlist",
      label: lang === 'fr' ? 'Vidéos "J\'aime"' : 'Liked Videos',
      icon: IconHeart,
      badge: user.favorites?.length || 0,
      description: lang === 'fr' ? 'Vos favoris et coups de cœur' : 'Your liked movies and shows',
    },
    {
      id: "downloads",
      label: lang === 'fr' ? 'Téléchargements' : 'Downloads',
      icon: IconDownload,
      badge: doneDownloadsCount > 0 ? doneDownloadsCount : undefined,
      description: lang === 'fr' ? 'Vidéos disponibles hors-connexion' : 'Videos saved for offline viewing',
    },
    {
      id: "subscription",
      label: lang === 'fr' ? 'Abonnement' : 'Subscription',
      icon: IconCrown,
      badge: user.subscription?.plan === 'premium' ? 'VIP' : undefined,
      description: lang === 'fr' ? 'Plan, avantages et appareils' : 'Plan, perks and devices',
    },
    {
      id: "settings",
      label: lang === 'fr' ? 'Paramètres' : 'Settings',
      icon: IconSettings,
      description: lang === 'fr' ? 'Qualité vidéo et compte' : 'Playback quality and account',
    },
  ];

  const handleSaveSettings = async () => {
    if (!token) return;
    try {
      const res = await userService.updatePreferences(token, { defaultQuality: quality });
      if (res.success) {
        updateUser({ preferences: res.preferences });
        alert(lang === 'fr' ? "Paramètres sauvegardés !" : "Settings saved!");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    if (confirm(lang === 'fr' ? "Êtes-vous sûr de vouloir vous déconnecter ?" : "Are you sure you want to log out?")) {
      logout();
      router.push("/");
    }
  };

  // On desktop, default to "overview" if no tab is provided in URL
  const activeTabDesktop = tab || "overview";
  const currentTabObj = tabs.find((t) => t.id === tab);

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-24 px-4 sm:px-6 lg:px-8 xl:px-12 w-full">

      {/* ======================================================== */}
      {/* 1. MOBILE VIEW: YOUTUBE-STYLE HUB OR DETAILED SECTION   */}
      {/* ======================================================== */}
      <div className="lg:hidden">
        {/* If no tab selected on mobile: Show YouTube-style "You" / Profile Hub */}
        {!tab ? (
          <div className="space-y-6">
            {/* Header / Profile Card */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 border border-white/10 p-6 shadow-xl">
              <div className="flex items-center gap-4">
                <UserAvatar user={user} size="lg" showBadge={true} />
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-extrabold text-white truncate">
                    {user.username || user.email.split('@')[0]}
                  </h1>
                  <p className="text-xs text-zinc-400 truncate">{user.email}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                      user.subscription?.plan === 'premium'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : user.subscription?.plan === 'standard'
                          ? 'bg-blue-500/20 text-cyan-300 border-blue-500/30'
                          : 'bg-white/10 text-zinc-300 border-white/5'
                    }`}>
                      {(user.subscription?.plan === 'premium' || user.subscription?.plan === 'standard') && (
                        <IconCrown className="w-3 h-3 text-yellow-400" />
                      )}
                      {user.role === 'admin' ? 'Admin VIP' : (user.subscription?.plan || 'Free')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* YouTube-style Navigation Sections List */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-2">
                {lang === 'fr' ? 'Sections de votre compte' : 'Account Sections'}
              </p>
              <div className="bg-zinc-900/60 border border-white/5 rounded-3xl overflow-hidden divide-y divide-white/5">
                {tabs.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => router.push(`/profile?tab=${t.id}`)}
                      className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-all text-left group active:bg-white/10"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-300 group-hover:text-[#D70466] group-hover:bg-[#D70466]/10 transition-colors flex-shrink-0">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white group-hover:text-[#D70466] transition-colors">
                              {t.label}
                            </span>
                            {t.badge !== undefined && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#D70466]/20 text-[#D70466]">
                                {t.badge}
                              </span>
                            )}
                          </div>
                          {t.description && (
                            <p className="text-xs text-zinc-400 truncate mt-0.5">
                              {t.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <IconChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-zinc-300 transition-colors flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Logout button (Mobile) */}
            <div className="pt-2">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2.5 p-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 font-bold text-sm transition-all active:scale-[0.99] cursor-pointer"
              >
                <IconLogout className="w-5 h-5" />
                <span>{lang === 'fr' ? 'Se déconnecter' : 'Log Out'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* When a section is clicked on mobile: Dedicated screen with clean Back button (YouTube style) */
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <button
                onClick={() => router.push("/profile")}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium transition-all active:scale-95"
              >
                <IconArrowLeft className="w-4 h-4" />
                <span>{lang === 'fr' ? 'Retour au profil' : 'Back to Profile'}</span>
              </button>
              {currentTabObj && (
                <span className="text-xs font-semibold text-zinc-400">
                  {currentTabObj.label}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 2. DESKTOP & ACTIVE MOBILE SECTION VIEW                 */}
      {/* ======================================================== */}
      <div className={`mt-6 lg:mt-0 ${!tab ? "hidden lg:flex" : "flex"} flex-col lg:flex-row gap-8 lg:gap-12 w-full`}>
        {/* Desktop Sidebar as dedicated fixed/sticky component */}
        <div className="hidden lg:block">
          <ProfileSidebar
            user={user}
            tabs={tabs}
            activeTab={activeTabDesktop}
            lang={lang}
            onLogout={handleLogout}
          />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-h-[600px] pb-10 w-full min-w-0">
          {/* ======================================================= */}
          {/* 1. YOUTUBE-STYLE OVERVIEW (ACCUEIL PROFIL)             */}
          {/* ======================================================= */}
          {((tab === "overview") || (!tab && activeTabDesktop === "overview")) && (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">

              {/* 1.1 SECTION HISTORIQUE RÉCENT */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[#D70466]">
                      <IconHistory className="w-4 h-4" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      {lang === 'fr' ? 'Historique' : 'History'}
                    </h2>
                  </div>
                  <button
                    onClick={() => router.push('/profile?tab=history')}
                    className="text-xs sm:text-sm font-bold text-zinc-400 hover:text-white px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors"
                  >
                    {lang === 'fr' ? 'Tout afficher' : 'See all'}
                  </button>
                </div>

                {(!user.watchHistory || user.watchHistory.length === 0) ? (
                  <div className="py-10 px-6 rounded-2xl bg-zinc-900/30 border border-white/5 text-center text-zinc-500 text-sm">
                    {lang === 'fr' ? "Aucun film ou épisode visionné récemment." : "No recently watched media."}
                  </div>
                ) : (
                  <div className="flex gap-4 overflow-x-auto no-scrollbar pb-3 pt-1">
                    {user.watchHistory.slice().reverse().slice(0, 10).map((h: any, i: number) => {
                      const poster = h.posterPath 
                        ? (h.posterPath.startsWith('http') ? h.posterPath : `https://image.tmdb.org/t/p/w500${h.posterPath}`)
                        : null;
                      return (
                        <Link
                          key={i}
                          href={`/media/${h.tmdbId}?type=${h.mediaType}`}
                          className="flex-shrink-0 w-64 sm:w-72 group rounded-2xl overflow-hidden bg-zinc-900/40 border border-white/5 hover:border-white/15 transition-all flex flex-col"
                        >
                          <div className="relative aspect-video w-full bg-zinc-950 overflow-hidden">
                            {poster ? (
                              <img
                                src={poster}
                                alt={h.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600">
                                <IconMovie className="w-8 h-8" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-90 transition-opacity" />
                            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] text-zinc-300">
                              <span className="px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md uppercase font-bold">
                                {h.mediaType === 'series' ? 'Série' : h.mediaType === 'anime' ? 'Anime' : 'Film'}
                              </span>
                              {h.season && h.episode && (
                                <span className="px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md">
                                  S{h.season} E{h.episode}
                                </span>
                              )}
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-xl">
                                <IconPlayerPlay className="w-5 h-5 fill-black ml-0.5" />
                              </div>
                            </div>
                          </div>
                          <div className="p-3">
                            <h3 className="text-sm font-bold text-white line-clamp-1 group-hover:text-[#D70466] transition-colors">
                              {h.title}
                            </h3>
                            <p className="text-[11px] text-zinc-500 mt-0.5">
                              {new Date(h.watchedAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* 1.2 SECTION PLAYLISTS (CRÉER UNE LISTE / VOS LISTES) */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-cyan-400">
                      <IconPlaylist className="w-4 h-4" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      {lang === 'fr' ? 'Playlists' : 'Playlists'}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowCreatePlaylistModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all shadow"
                    >
                      <IconPlus className="w-3.5 h-3.5" />
                      <span>{lang === 'fr' ? 'Nouvelle playlist' : 'New Playlist'}</span>
                    </button>
                    <button
                      onClick={() => router.push('/profile?tab=playlists')}
                      className="text-xs sm:text-sm font-bold text-zinc-400 hover:text-white px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors"
                    >
                      {lang === 'fr' ? 'Tout afficher' : 'See all'}
                    </button>
                  </div>
                </div>

                {(!user.playlists || user.playlists.length === 0) ? (
                  <div className="py-12 px-6 rounded-3xl bg-zinc-900/30 border border-white/5 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto">
                      <IconPlaylist className="w-6 h-6" />
                    </div>
                    <p className="text-zinc-400 text-sm font-medium">
                      {lang === 'fr' ? "Vous n'avez pas encore de playlist." : "You have not created any playlist yet."}
                    </p>
                    <button
                      onClick={() => setShowCreatePlaylistModal(true)}
                      className="px-4 py-2 rounded-xl bg-[#D70466] hover:bg-[#b5034f] text-white text-xs font-bold transition-all inline-flex items-center gap-2"
                    >
                      <IconPlus className="w-4 h-4" />
                      <span>{lang === 'fr' ? 'Créer ma première playlist' : 'Create my first playlist'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-4 overflow-x-auto no-scrollbar pb-3 pt-1">
                    {user.playlists.map((pl: any) => {
                      const firstItem = pl.items && pl.items.length > 0 ? pl.items[0] : null;
                      const cover = firstItem?.posterPath 
                        ? (firstItem.posterPath.startsWith('http') ? firstItem.posterPath : `https://image.tmdb.org/t/p/w500${firstItem.posterPath}`)
                        : null;
                      return (
                        <div
                          key={pl.id}
                          onClick={() => {
                            setSelectedPlaylistId(pl.id);
                            router.push('/profile?tab=playlists');
                          }}
                          className="flex-shrink-0 w-64 sm:w-72 group rounded-2xl overflow-hidden bg-zinc-900/40 border border-white/5 hover:border-white/15 transition-all cursor-pointer flex flex-col"
                        >
                          <div className="relative aspect-video w-full bg-zinc-950 overflow-hidden">
                            {cover ? (
                              <img
                                src={cover}
                                alt={pl.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-zinc-500">
                                <IconPlaylist className="w-8 h-8 text-cyan-400 mb-1" />
                                <span className="text-[10px] uppercase font-bold tracking-wider">Playlist</span>
                              </div>
                            )}
                            <div className="absolute inset-y-0 right-0 w-24 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center text-white gap-1">
                              <IconPlaylist className="w-5 h-5 text-cyan-400" />
                              <span className="text-xs font-black">{pl.items?.length || 0}</span>
                              <span className="text-[9px] uppercase tracking-wider text-zinc-400">vidéos</span>
                            </div>
                          </div>
                          <div className="p-3">
                            <h3 className="text-sm font-bold text-white line-clamp-1 group-hover:text-[#D70466] transition-colors">
                              {pl.title}
                            </h3>
                            <p className="text-[11px] text-zinc-500 mt-0.5">
                              {pl.description || (lang === 'fr' ? 'Playlist personnelle' : 'Personal playlist')}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* 1.3 SECTION À REGARDER PLUS TARD */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-amber-400">
                      <IconClock className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                        {lang === 'fr' ? 'À regarder plus tard' : 'Watch Later'}
                      </h2>
                      <p className="text-xs text-zinc-400">
                        {user.watchLater?.length || 0} {lang === 'fr' ? 'vidéos' : 'videos'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push('/profile?tab=watch_later')}
                    className="text-xs sm:text-sm font-bold text-zinc-400 hover:text-white px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors"
                  >
                    {lang === 'fr' ? 'Tout afficher' : 'See all'}
                  </button>
                </div>

                {(!user.watchLater || user.watchLater.length === 0) ? (
                  <div className="py-10 px-6 rounded-2xl bg-zinc-900/30 border border-white/5 text-center text-zinc-500 text-sm">
                    {lang === 'fr' ? "Aucun contenu enregistré pour plus tard." : "No titles saved in Watch Later."}
                  </div>
                ) : (
                  <div className="flex gap-4 overflow-x-auto no-scrollbar pb-3 pt-1">
                    {user.watchLater.map((wl: any, i: number) => {
                      const poster = wl.posterPath
                        ? (wl.posterPath.startsWith('http') ? wl.posterPath : `https://image.tmdb.org/t/p/w500${wl.posterPath}`)
                        : null;
                      return (
                        <Link
                          key={i}
                          href={`/media/${wl.tmdbId}?type=${wl.mediaType}`}
                          className="flex-shrink-0 w-64 sm:w-72 group rounded-2xl overflow-hidden bg-zinc-900/40 border border-white/5 hover:border-white/15 transition-all flex flex-col"
                        >
                          <div className="relative aspect-video w-full bg-zinc-950 overflow-hidden">
                            {poster ? (
                              <img
                                src={poster}
                                alt={wl.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600">
                                <IconMovie className="w-8 h-8" />
                              </div>
                            )}
                            <div className="absolute top-2 left-2">
                              <span className="px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] font-bold uppercase text-zinc-300">
                                {wl.mediaType === 'series' ? 'Série' : wl.mediaType === 'anime' ? 'Anime' : 'Film'}
                              </span>
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-xl">
                                <IconPlayerPlay className="w-5 h-5 fill-black ml-0.5" />
                              </div>
                            </div>
                          </div>
                          <div className="p-3">
                            <h3 className="text-sm font-bold text-white line-clamp-1 group-hover:text-[#D70466] transition-colors">
                              {wl.title}
                            </h3>
                            <p className="text-[11px] text-zinc-500 mt-0.5">
                              {new Date(wl.addedAt || Date.now()).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* 1.4 SECTION VIDÉOS "J'AIME" / FAVORIS */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-red-500">
                      <IconHeart className="w-4 h-4 fill-red-500 text-red-500" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                        {lang === 'fr' ? 'Vidéos "J\'aime"' : 'Liked Videos'}
                      </h2>
                      <p className="text-xs text-zinc-400">
                        {user.favorites?.length || 0} {lang === 'fr' ? 'vidéos' : 'videos'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push('/profile?tab=watchlist')}
                    className="text-xs sm:text-sm font-bold text-zinc-400 hover:text-white px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors"
                  >
                    {lang === 'fr' ? 'Tout afficher' : 'See all'}
                  </button>
                </div>

                {(!user.favorites || user.favorites.length === 0) ? (
                  <div className="py-10 px-6 rounded-2xl bg-zinc-900/30 border border-white/5 text-center text-zinc-500 text-sm">
                    {lang === 'fr' ? "Aucun film ou série dans vos favoris." : "No liked videos yet."}
                  </div>
                ) : (
                  <div className="flex gap-4 overflow-x-auto no-scrollbar pb-3 pt-1">
                    {user.favorites.map((fav: any) => {
                      const poster = fav.posterPath
                        ? (fav.posterPath.startsWith('http') ? fav.posterPath : `https://image.tmdb.org/t/p/w500${fav.posterPath}`)
                        : null;
                      return (
                        <Link
                          key={fav.tmdbId}
                          href={`/media/${fav.tmdbId}?type=${fav.mediaType}`}
                          className="flex-shrink-0 w-64 sm:w-72 group rounded-2xl overflow-hidden bg-zinc-900/40 border border-white/5 hover:border-white/15 transition-all flex flex-col"
                        >
                          <div className="relative aspect-video w-full bg-zinc-950 overflow-hidden">
                            {poster ? (
                              <img
                                src={poster}
                                alt={fav.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600">
                                <IconMovie className="w-8 h-8" />
                              </div>
                            )}
                            <div className="absolute top-2 left-2">
                              <span className="px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] font-bold uppercase text-zinc-300">
                                {fav.mediaType === 'series' ? 'Série' : fav.mediaType === 'anime' ? 'Anime' : 'Film'}
                              </span>
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-xl">
                                <IconPlayerPlay className="w-5 h-5 fill-black ml-0.5" />
                              </div>
                            </div>
                          </div>
                          <div className="p-3">
                            <h3 className="text-sm font-bold text-white line-clamp-1 group-hover:text-[#D70466] transition-colors">
                              {fav.title}
                            </h3>
                            <p className="text-[11px] text-zinc-500 mt-0.5 capitalize">
                              {fav.mediaType}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>

            </div>
          )}

          {/* ======================================================= */}
          {/* 2. PLAYLISTS TAB                                        */}
          {/* ======================================================= */}
          {tab === "playlists" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    {lang === 'fr' ? 'Vos Playlists' : 'Your Playlists'}
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                    {user.playlists?.length || 0} {lang === 'fr' ? 'playlists créées' : 'playlists created'}
                  </p>
                </div>
                <button
                  onClick={() => setShowCreatePlaylistModal(true)}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#D70466] hover:bg-[#b5034f] text-white font-bold text-sm shadow-lg transition-all"
                >
                  <IconPlus className="w-4 h-4" />
                  <span>{lang === 'fr' ? 'Nouvelle Playlist' : 'New Playlist'}</span>
                </button>
              </div>

              {(!user.playlists || user.playlists.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/30 border border-dashed border-white/10 rounded-3xl text-center space-y-4">
                  <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                    <IconPlaylist className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {lang === 'fr' ? 'Aucune playlist' : 'No playlists yet'}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                      {lang === 'fr'
                        ? 'Créez des listes de lecture personnalisées pour organiser vos films et séries préférés.'
                        : 'Create custom playlists to organize your favorite movies and shows.'}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCreatePlaylistModal(true)}
                    className="px-6 py-2.5 rounded-xl bg-[#D70466] text-white text-sm font-bold shadow-lg"
                  >
                    {lang === 'fr' ? 'Créer une playlist' : 'Create Playlist'}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {user.playlists.map((pl: any) => {
                    const firstItem = pl.items && pl.items.length > 0 ? pl.items[0] : null;
                    const cover = firstItem?.posterPath
                      ? (firstItem.posterPath.startsWith('http') ? firstItem.posterPath : `https://image.tmdb.org/t/p/w500${firstItem.posterPath}`)
                      : null;
                    return (
                      <div
                        key={pl.id}
                        className="bg-zinc-900/50 border border-white/5 rounded-2xl overflow-hidden group hover:border-white/15 transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="relative aspect-video w-full bg-zinc-950 overflow-hidden">
                            {cover ? (
                              <img
                                src={cover}
                                alt={pl.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950 text-zinc-500">
                                <IconPlaylist className="w-10 h-10 text-cyan-400 mb-2" />
                                <span className="text-xs font-bold uppercase tracking-wider">Playlist vide</span>
                              </div>
                            )}
                            <div className="absolute inset-y-0 right-0 w-28 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center text-white gap-1">
                              <IconPlaylist className="w-6 h-6 text-cyan-400" />
                              <span className="text-base font-black">{pl.items?.length || 0}</span>
                              <span className="text-[10px] uppercase font-bold text-zinc-400">vidéos</span>
                            </div>
                          </div>
                          <div className="p-4">
                            <h3 className="text-base font-bold text-white group-hover:text-[#D70466] transition-colors">
                              {pl.title}
                            </h3>
                            {pl.description && (
                              <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                                {pl.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Actions playlist */}
                        <div className="p-4 pt-0 flex items-center justify-between border-t border-white/5 mt-2">
                          <span className="text-[10px] text-zinc-500 font-medium">
                            {new Date(pl.createdAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <button
                            onClick={() => handleDeletePlaylist(pl.id)}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-white/5 transition-colors"
                            title={lang === 'fr' ? 'Supprimer la playlist' : 'Delete playlist'}
                          >
                            <IconTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ======================================================= */}
          {/* 3. WATCH LATER TAB (À REGARDER PLUS TARD)               */}
          {/* ======================================================= */}
          {tab === "watch_later" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    {lang === 'fr' ? 'À regarder plus tard' : 'Watch Later'}
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                    {user.watchLater?.length || 0} {lang === 'fr' ? 'vidéos enregistrées' : 'videos saved'}
                  </p>
                </div>
              </div>

              {(!user.watchLater || user.watchLater.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/30 border border-dashed border-white/10 rounded-3xl text-center space-y-4">
                  <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                    <IconClock className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {lang === 'fr' ? 'Votre liste est vide' : 'Watch Later is empty'}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                      {lang === 'fr'
                        ? 'Enregistrez des films et séries pour les visionner tranquillement plus tard.'
                        : 'Save movies and series to watch them when you have time.'}
                    </p>
                  </div>
                  <Link
                    href="/"
                    className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold"
                  >
                    {lang === 'fr' ? 'Parcourir les films' : 'Browse Movies'}
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {user.watchLater.map((wl: any) => {
                    const poster = wl.posterPath
                      ? (wl.posterPath.startsWith('http') ? wl.posterPath : `https://image.tmdb.org/t/p/w500${wl.posterPath}`)
                      : null;
                    return (
                      <div
                        key={wl.tmdbId}
                        className="bg-zinc-900/50 border border-white/5 hover:border-white/15 rounded-2xl overflow-hidden group transition-all flex flex-col justify-between shadow-lg"
                      >
                        <div className="relative aspect-video w-full bg-zinc-950 overflow-hidden">
                          {poster ? (
                            <img
                              src={poster}
                              alt={wl.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600">
                              <IconMovie className="w-8 h-8" />
                            </div>
                          )}
                          <div className="absolute top-2 left-2">
                            <span className="px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] font-bold uppercase text-zinc-300">
                              {wl.mediaType === 'series' ? 'Série' : wl.mediaType === 'anime' ? 'Anime' : 'Film'}
                            </span>
                          </div>
                          <Link
                            href={`/media/${wl.tmdbId}?type=${wl.mediaType}`}
                            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40"
                          >
                            <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-2xl">
                              <IconPlayerPlay className="w-6 h-6 fill-black ml-0.5" />
                            </div>
                          </Link>
                        </div>
                        <div className="p-4 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/media/${wl.tmdbId}?type=${wl.mediaType}`}
                              className="text-sm font-bold text-white line-clamp-1 group-hover:text-[#D70466] transition-colors"
                            >
                              {wl.title}
                            </Link>
                            <p className="text-xs text-zinc-500 mt-0.5 capitalize">
                              {wl.mediaType}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemoveFromWatchLater({ mediaType: wl.mediaType, tmdbId: wl.tmdbId, title: wl.title })}
                            className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-white/5 transition-colors flex-shrink-0"
                            title={lang === 'fr' ? 'Retirer' : 'Remove'}
                          >
                            <IconTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ======================================================= */}
          {/* 4. WATCHLIST (VIDÉOS J'AIME)                             */}
          {/* ======================================================= */}
          {tab === "watchlist" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                  {lang === 'fr' ? 'Vidéos "J\'aime"' : 'Liked Videos'}
                </h2>
                <span className="text-sm font-medium text-zinc-500 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                  {user.favorites?.length || 0} {lang === 'fr' ? 'titres' : 'titles'}
                </span>
              </div>
              
              {(!user.favorites || user.favorites.length === 0) ? (
                <div className="flex flex-col items-center justify-center h-64 bg-zinc-900/30 border border-dashed border-white/10 rounded-3xl">
                  <IconHeart className="w-12 h-12 text-zinc-600 mb-4" />
                  <p className="text-zinc-400 font-medium">{lang === 'fr' ? "Aucune vidéo aimée pour l'instant." : "No liked videos yet."}</p>
                  <Link href="/" className="mt-4 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors">
                    {lang === 'fr' ? "Explorer le catalogue" : "Explore catalog"}
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                  {user.favorites.map((fav: any) => (
                    <Link href={`/media/${fav.tmdbId}?type=${fav.mediaType}`} key={fav.tmdbId} className="group relative rounded-2xl overflow-hidden aspect-[2/3] bg-zinc-800 shadow-xl border border-white/5">
                      {fav.posterPath ? (
                        <img src={`https://image.tmdb.org/t/p/w500${fav.posterPath}`} alt={fav.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center p-4 text-center">
                          <span className="text-sm text-zinc-400 font-medium">{fav.title}</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                        <div className="translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                          <div className="w-10 h-10 rounded-full bg-[#D70466] flex items-center justify-center mb-3 shadow-lg shadow-[#D70466]/40 text-white">
                            <IconPlayerPlay className="w-5 h-5 ml-1" fill="currentColor" />
                          </div>
                          <p className="font-bold text-white text-sm line-clamp-2">{fav.title}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ======================================================= */}
          {/* 5. HISTORIQUE DÉTAILLÉ TAB                              */}
          {/* ======================================================= */}
          {tab === "history" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-8">
                {lang === 'fr' ? 'Historique de visionnage' : 'Watch History'}
              </h2>
              {(!user.watchHistory || user.watchHistory.length === 0) ? (
                <div className="flex flex-col items-center justify-center h-64 bg-zinc-900/30 border border-dashed border-white/10 rounded-3xl">
                  <IconHistory className="w-12 h-12 text-zinc-600 mb-4" />
                  <p className="text-zinc-400 font-medium">{lang === 'fr' ? "Aucun historique disponible." : "No history available."}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {user.watchHistory.slice().reverse().map((h: any, i: number) => (
                    <div key={i} className="group flex items-center gap-5 bg-zinc-900/40 hover:bg-zinc-800/80 p-4 rounded-2xl border border-white/5 transition-all">
                      {h.posterPath ? (
                        <img 
                          src={h.posterPath.startsWith('http') ? h.posterPath : `https://image.tmdb.org/t/p/w200${h.posterPath}`} 
                          alt={h.title} 
                          className="w-14 h-20 sm:w-16 sm:h-24 object-cover rounded-xl shadow-md" 
                        />
                      ) : (
                        <div className="w-14 h-20 sm:w-16 sm:h-24 bg-zinc-800 rounded-xl shadow-md" />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white text-sm sm:text-base truncate group-hover:text-[#D70466] transition-colors">{h.title}</h3>
                        {h.mediaType === 'series' && h.season && h.episode && (
                          <div className="inline-flex items-center mt-1 sm:mt-1.5 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-semibold bg-white/10 text-zinc-300">
                            Saison {h.season} • Épisode {h.episode}
                          </div>
                        )}
                        <p className="text-[10px] sm:text-xs text-zinc-500 mt-1 sm:mt-2 font-medium">
                          {new Date(h.watchedAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <Link 
                        href={`/media/${h.tmdbId}?type=${h.mediaType}`}
                        className="hidden sm:flex w-10 h-10 items-center justify-center rounded-full bg-white/5 hover:bg-white/20 text-white transition-colors"
                      >
                        <IconPlayerPlay className="w-4 h-4 ml-0.5" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ======================================================= */}
          {/* 6. SETTINGS TAB                                         */}
          {/* ======================================================= */}
          {tab === "settings" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-8">
                {lang === 'fr' ? 'Paramètres' : 'Settings'}
              </h2>
              <div className="max-w-xl space-y-8">
                
                <div className="bg-zinc-900/50 backdrop-blur-md border border-white/5 rounded-3xl p-6 sm:p-8 shadow-xl">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 rounded-full bg-[#D70466]/20 text-[#D70466] flex items-center justify-center">
                      <IconSettings className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-white">Lecture Vidéo</h3>
                      <p className="text-sm text-zinc-400">Préférences par défaut du lecteur</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-zinc-300 mb-2">
                        {lang === 'fr' ? 'Qualité vidéo par défaut' : 'Default Video Quality'}
                      </label>
                      <select
                        value={quality}
                        onChange={(e) => setQuality(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#D70466] transition-all appearance-none cursor-pointer"
                      >
                        <option value="Auto">Auto (Recommandé)</option>
                        <option value="4K">4K Ultra HD (Bande passante élevée)</option>
                        <option value="1080p">1080p Full HD</option>
                        <option value="720p">720p HD</option>
                      </select>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSaveSettings}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#D70466] hover:bg-[#b5034f] text-white font-bold tracking-wide transition-all active:scale-[0.98]"
                >
                  {lang === 'fr' ? 'Enregistrer les modifications' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* ======================================================= */}
          {/* 7. DOWNLOADS TAB                                        */}
          {/* ======================================================= */}
          {tab === "downloads" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
              <DownloadsView isEmbeddedInProfile={true} />
            </div>
          )}

          {/* ======================================================= */}
          {/* 8. SUBSCRIPTION TAB                                     */}
          {/* ======================================================= */}
          {tab === "subscription" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-8">
                {lang === 'fr' ? 'Mon Abonnement' : 'My Subscription'}
              </h2>
              <div className="max-w-2xl space-y-6">
                
                {/* Plan Info */}
                <div className={`rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden transition-all ${
                  user.subscription?.plan === 'premium' || user.role === 'admin'
                    ? 'bg-zinc-900 border border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.1)]'
                    : 'bg-zinc-900 border border-white/10'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-zinc-400 font-medium">{lang === 'fr' ? 'Plan Actuel' : 'Current Plan'}</p>
                        {user.subscription?.plan === 'premium' || user.role === 'admin' ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-black tracking-wider uppercase">
                            VIP ACTIF
                          </span>
                        ) : null}
                      </div>
                      <h3 className="text-3xl font-extrabold text-white capitalize flex items-center gap-3">
                        {user.subscription?.plan || (user.role === 'admin' ? 'Admin VIP' : 'Free')}
                        {(user.subscription?.plan === 'premium' || user.role === 'admin') && (
                          <IconCrown className="w-8 h-8 text-amber-400" />
                        )}
                      </h3>
                      <p className="text-sm text-zinc-400 mt-2 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${user.subscription?.status === 'active' || user.role === 'admin' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-zinc-600'}`} />
                        {user.subscription?.status === 'active' || user.role === 'admin'
                          ? (lang === 'fr' ? 'Abonnement Actif' : 'Active Subscription')
                          : (lang === 'fr' ? 'Inactif' : 'Inactive')}
                      </p>
                    </div>
                    <div>
                      <Link 
                        href="/subscribe"
                        className={`inline-flex items-center justify-center px-6 py-3 rounded-xl font-bold transition-all shadow-md ${
                          user.subscription?.plan === 'premium' || user.role === 'admin'
                            ? 'bg-amber-500 hover:bg-amber-400 text-black'
                            : 'bg-white/10 hover:bg-white/20 text-white border border-white/5'
                        }`}
                      >
                        {lang === 'fr' ? 'Gérer mon abonnement' : 'Manage Subscription'}
                      </Link>
                    </div>
                  </div>

                  {user.subscription?.features && (
                    <div className="mt-8 pt-8 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                        <p className="text-zinc-400 text-xs mb-1">Résolution Max</p>
                        <p className="text-white font-bold text-base">{user.subscription.features.maxResolution}</p>
                      </div>
                      <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                        <p className="text-zinc-400 text-xs mb-1">Appareils</p>
                        <p className="text-white font-bold text-base">{user.subscription.features.maxDevices}</p>
                      </div>
                      <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                        <p className="text-zinc-400 text-xs mb-1">Reprise de Lecture</p>
                        <p className="text-emerald-400 font-bold text-base">{user.subscription.features.hasContinueWatching ? 'Illimitée' : 'Non'}</p>
                      </div>
                      <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                        <p className="text-zinc-400 text-xs mb-1">Téléchargements</p>
                        <p className="text-emerald-400 font-bold text-base">{user.subscription.features.hasDownloads ? 'Illimités' : 'Non'}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Devices Info */}
                <div className="bg-zinc-900/50 backdrop-blur-md border border-white/5 rounded-3xl p-6 sm:p-8 shadow-xl">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center">
                      <IconDeviceDesktop className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-white">{lang === 'fr' ? 'Appareils Connectés' : 'Connected Devices'}</h3>
                      <p className="text-sm text-zinc-400">
                        {user.activeSessions?.length || 0} / {user.subscription?.features?.maxDevices || 1} {lang === 'fr' ? 'appareils autorisés' : 'devices allowed'}
                      </p>
                    </div>
                  </div>

                  {user.activeSessions && user.activeSessions.length > 0 ? (
                    <div className="space-y-3">
                      {user.activeSessions.map((session: any, idx: number) => {
                        const isCurrent = session.deviceId === (typeof window !== 'undefined' ? getStableDeviceFingerprint().deviceId : '');
                        return (
                          <div key={idx} className="flex justify-between items-center bg-black/40 p-4 rounded-xl border border-white/5">
                            <div className="flex items-center gap-3">
                              <IconDeviceDesktop className="text-zinc-500 w-5 h-5 flex-shrink-0" />
                              <div>
                                <p className="text-white text-sm font-medium">{session.deviceName || 'Appareil Inconnu'}</p>
                                <p className="text-xs text-zinc-500">
                                  {lang === 'fr' ? 'Dernière connexion :' : 'Last login:'} {new Date(session.lastLogin).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isCurrent ? (
                                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                                  Cet appareil
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!token) return;
                                    if (confirm(lang === 'fr' ? "Déconnecter cet appareil ?" : "Disconnect this device?")) {
                                      const res = await authService.revokeSession(token, session.deviceId);
                                      if (res.success) {
                                        updateUser({
                                          activeSessions: (user.activeSessions || []).filter((s: any) => s.deviceId !== session.deviceId)
                                        });
                                      }
                                    }
                                  }}
                                  className="text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 px-3 py-1 rounded-lg transition-colors cursor-pointer"
                                >
                                  {lang === 'fr' ? 'Déconnecter' : 'Disconnect'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-zinc-500 text-sm">Aucun appareil connecté détecté.</p>
                  )}
                </div>

              </div>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. MODAL CRÉATION DE PLAYLIST (YOUTUBE STYLE)            */}
      {/* ======================================================== */}
      {showCreatePlaylistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                  <IconPlaylist className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  {lang === 'fr' ? 'Nouvelle Playlist' : 'New Playlist'}
                </h3>
              </div>
              <button
                onClick={() => setShowCreatePlaylistModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePlaylist} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
                  {lang === 'fr' ? 'Titre de la playlist' : 'Playlist Title'} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={lang === 'fr' ? 'Ex: Mes Meilleurs Films 2026' : 'Ex: Best Movies 2026'}
                  value={newPlaylistTitle}
                  onChange={(e) => setNewPlaylistTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#D70466] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
                  {lang === 'fr' ? 'Description (optionnel)' : 'Description (optional)'}
                </label>
                <textarea
                  rows={3}
                  placeholder={lang === 'fr' ? 'Ajoutez une description...' : 'Add a description...'}
                  value={newPlaylistDescription}
                  onChange={(e) => setNewPlaylistDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#D70466] text-sm resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreatePlaylistModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold transition-colors"
                >
                  {lang === 'fr' ? 'Annuler' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isCreatingPlaylist || !newPlaylistTitle.trim()}
                  className="px-5 py-2.5 rounded-xl bg-[#D70466] hover:bg-[#b5034f] disabled:opacity-50 text-white text-sm font-bold shadow-lg transition-all"
                >
                  {isCreatingPlaylist 
                    ? (lang === 'fr' ? 'Création...' : 'Creating...') 
                    : (lang === 'fr' ? 'Créer la playlist' : 'Create Playlist')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
