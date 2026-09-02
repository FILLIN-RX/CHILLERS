"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLanguage } from "@/i18n/LanguageContext";
import { useRouter, useSearchParams } from "next/navigation";
import { IconBookmark, IconHistory, IconSettings, IconUser, IconPlayerPlay, IconCrown, IconDeviceDesktop, IconDownload } from "@tabler/icons-react";
import Link from "next/link";
import { userService } from "@/services/user";
import { authService } from "@/services/auth";
import UserAvatar from "@/components/UserAvatar";
import DownloadsView from "@/features/downloads/DownloadsView";

export default function ProfileClient() {
  const { user, token, updateUser } = useAuthStore();
  const { lang, translate: _ } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "watchlist";

  const [quality, setQuality] = useState(user?.preferences?.defaultQuality || "Auto");

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
                ? "Retrouvez vos favoris, votre historique de visionnage et vos téléchargements."
                : "Access your watchlist, watch history, and offline downloads."}
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

  const tabs = [
    { id: "watchlist", label: lang === 'fr' ? 'Ma Liste' : 'Watchlist', icon: IconBookmark },
    { id: "downloads", label: lang === 'fr' ? 'Téléchargements' : 'Downloads', icon: IconDownload },
    { id: "history", label: lang === 'fr' ? 'Historique' : 'History', icon: IconHistory },
    { id: "subscription", label: lang === 'fr' ? 'Abonnement' : 'Subscription', icon: IconCrown },
    { id: "settings", label: lang === 'fr' ? 'Paramètres' : 'Settings', icon: IconSettings },
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

  return (
    <div className="min-h-screen pt-24 pb-24 px-4 sm:px-8 xl:px-12 max-w-[1600px] w-full mx-auto">
      
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 w-full">
        {/* Sidebar / User Info & Tabs */}
        <div className="w-full lg:w-80 flex-shrink-0 space-y-6">
          {/* User Profile Card */}
          <div className="relative overflow-hidden rounded-3xl bg-zinc-900 border border-white/10 p-6 shadow-2xl">
            <div className="flex items-center gap-5">
              <UserAvatar user={user} size="lg" showBadge={true} />
              <div className="flex-1 min-w-0">
                <h2 className="text-lg sm:text-xl font-extrabold text-white truncate">{user.username || user.email.split('@')[0]}</h2>
                <p className="text-xs sm:text-sm text-zinc-400 truncate">{user.email}</p>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                    user.subscription?.plan === 'premium'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : user.subscription?.plan === 'standard'
                        ? 'bg-blue-500/20 text-cyan-300 border-blue-500/30'
                        : 'bg-white/10 text-zinc-300 border-white/5'
                  }`}>
                    {user.subscription?.plan === 'premium' && <IconCrown className="w-3 h-3 text-yellow-400" />}
                    {user.subscription?.plan === 'standard' && <IconCrown className="w-3 h-3 text-cyan-400" />}
                    {user.role === 'admin' ? 'Admin VIP' : (user.subscription?.plan || 'Free')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible no-scrollbar pb-2 lg:pb-0">
            {tabs.map(t => {
              const active = tab === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => router.push(`/profile?tab=${t.id}`)}
                  className={`flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap outline-none ${
                    active 
                      ? "bg-white/10 text-white shadow-lg border border-white/5" 
                      : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${active ? 'text-[#D70466]' : ''}`} />
                  {t.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-h-[600px] pb-10 w-full">
          {tab === "watchlist" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                  {lang === 'fr' ? 'Ma Liste' : 'My Watchlist'}
                </h2>
                <span className="text-sm font-medium text-zinc-500 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                  {user.favorites?.length || 0} {lang === 'fr' ? 'titres' : 'titles'}
                </span>
              </div>
              
              {(!user.favorites || user.favorites.length === 0) ? (
                <div className="flex flex-col items-center justify-center h-64 bg-zinc-900/30 border border-dashed border-white/10 rounded-3xl">
                  <IconBookmark className="w-12 h-12 text-zinc-600 mb-4" />
                  <p className="text-zinc-400 font-medium">{lang === 'fr' ? "Votre liste est vide." : "Your watchlist is empty."}</p>
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

          {tab === "downloads" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
              <DownloadsView isEmbeddedInProfile={true} />
            </div>
          )}

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
                      {user.activeSessions.map((session: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center bg-black/40 p-4 rounded-xl border border-white/5">
                          <div className="flex items-center gap-3">
                            <IconDeviceDesktop className="text-zinc-500 w-5 h-5" />
                            <div>
                              <p className="text-white text-sm font-medium">{session.deviceName || 'Appareil Inconnu'}</p>
                              <p className="text-xs text-zinc-500">
                                {lang === 'fr' ? 'Dernière connexion :' : 'Last login:'} {new Date(session.lastLogin).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' })}
                              </p>
                            </div>
                          </div>
                          {idx === 0 && <span className="text-xs font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded">Cet appareil</span>}
                        </div>
                      ))}
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
    </div>
  );
}
