"use client";

import React, { useState } from "react";
import {
  IconClock,
  IconPlaylist,
  IconPlus,
  IconCheck,
  IconX,
  IconBookmark,
  IconBookmarkFilled,
} from "@tabler/icons-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { userService } from "@/services/user";
import { useLanguage } from "@/i18n/LanguageContext";

export interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  media: {
    tmdbId: string;
    mediaType: "movie" | "series" | "anime" | "tv";
    title: string;
    posterPath?: string;
    backdropPath?: string;
  };
}

export default function AddToPlaylistModal({
  isOpen,
  onClose,
  media,
}: AddToPlaylistModalProps) {
  const { user, token, updateUser } = useAuthStore();
  const { lang } = useLanguage();

  const [newTitle, setNewTitle] = useState("");
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  if (!isOpen || !media) return null;

  const isWatchLater = user?.watchLater?.some(
    (wl) => wl.tmdbId === String(media.tmdbId) && wl.mediaType === media.mediaType
  );

  const isFavorite = user?.favorites?.some(
    (f) => f.tmdbId === String(media.tmdbId) && f.mediaType === media.mediaType
  );

  // Toggle Watch Later
  const handleToggleWatchLater = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await userService.toggleWatchLater(token, {
        mediaType: media.mediaType,
        tmdbId: String(media.tmdbId),
        title: media.title,
        posterPath: media.posterPath,
      });
      if (res.success && res.watchLater) {
        updateUser({ watchLater: res.watchLater });
        setActionSuccess(
          isWatchLater
            ? lang === "fr"
              ? "Retiré de À regarder plus tard"
              : "Removed from Watch Later"
            : lang === "fr"
              ? "Ajouté à À regarder plus tard"
              : "Saved to Watch Later"
        );
        setTimeout(() => setActionSuccess(null), 2500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle Favorite
  const handleToggleFavorite = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await userService.toggleFavorite(token, {
        mediaType: media.mediaType === "tv" ? "series" : media.mediaType,
        tmdbId: String(media.tmdbId),
        title: media.title,
        posterPath: media.posterPath,
      });
      if (res.success && res.favorites) {
        updateUser({ favorites: res.favorites });
        setActionSuccess(
          isFavorite
            ? lang === "fr"
              ? "Retiré des favoris"
              : "Removed from favorites"
            : lang === "fr"
              ? "Ajouté aux favoris"
              : "Added to favorites"
        );
        setTimeout(() => setActionSuccess(null), 2500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle item in playlist
  const handleTogglePlaylist = async (playlist: any) => {
    if (!token) return;
    const exists = playlist.items?.some(
      (item: any) =>
        item.tmdbId === String(media.tmdbId) && item.mediaType === media.mediaType
    );

    setLoading(true);
    try {
      if (exists) {
        const res = await userService.removeMediaFromPlaylist(
          token,
          playlist.id,
          String(media.tmdbId)
        );
        if (res.success && res.playlists) {
          updateUser({ playlists: res.playlists });
          setActionSuccess(
            lang === "fr"
              ? `Retiré de "${playlist.title}"`
              : `Removed from "${playlist.title}"`
          );
        }
      } else {
        const res = await userService.addMediaToPlaylist(token, playlist.id, {
          mediaType: media.mediaType,
          tmdbId: String(media.tmdbId),
          title: media.title,
          posterPath: media.posterPath,
          backdropPath: media.backdropPath,
        });
        if (res.success && res.playlists) {
          updateUser({ playlists: res.playlists });
          setActionSuccess(
            lang === "fr"
              ? `Ajouté à "${playlist.title}"`
              : `Saved to "${playlist.title}"`
          );
        }
      }
      setTimeout(() => setActionSuccess(null), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Create playlist and automatically add media
  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newTitle.trim()) return;

    setLoading(true);
    try {
      const res = await userService.createPlaylist(token, {
        title: newTitle.trim(),
      });
      if (res.success && res.playlist) {
        // Now add the item to this newly created playlist
        const addRes = await userService.addMediaToPlaylist(
          token,
          res.playlist.id,
          {
            mediaType: media.mediaType,
            tmdbId: String(media.tmdbId),
            title: media.title,
            posterPath: media.posterPath,
            backdropPath: media.backdropPath,
          }
        );
        if (addRes.success && addRes.playlists) {
          updateUser({ playlists: addRes.playlists });
          setNewTitle("");
          setShowCreateInput(false);
          setActionSuccess(
            lang === "fr"
              ? `Playlist créée et vidéo ajoutée`
              : `Playlist created & added`
          );
          setTimeout(() => setActionSuccess(null), 2500);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-zinc-900 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div className="min-w-0 pr-2">
            <h3 className="text-base font-bold text-white truncate">
              {lang === "fr" ? "Enregistrer dans..." : "Save to..."}
            </h3>
            <p className="text-xs text-zinc-400 truncate">{media.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {actionSuccess && (
          <div className="py-2 px-3 rounded-xl bg-[#D70466]/20 border border-[#D70466]/30 text-white text-xs font-bold flex items-center gap-2 animate-in fade-in duration-150">
            <IconCheck className="w-4 h-4 text-[#D70466]" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Quick Collections: Watch Later & Favorites */}
        <div className="space-y-1">
          {/* Watch Later checkbox */}
          <button
            onClick={handleToggleWatchLater}
            disabled={loading}
            className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <IconClock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                  {lang === "fr" ? "À regarder plus tard" : "Watch Later"}
                </span>
                <p className="text-[11px] text-zinc-500">
                  {lang === "fr" ? "Liste privée par défaut" : "Default private list"}
                </p>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                isWatchLater
                  ? "bg-amber-500 border-amber-500 text-black"
                  : "border-zinc-700 group-hover:border-zinc-500"
              }`}
            >
              {isWatchLater && <IconCheck className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </button>

          {/* Liked / Favorites checkbox */}
          <button
            onClick={handleToggleFavorite}
            disabled={loading}
            className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#D70466]/10 text-[#D70466] flex items-center justify-center">
                {isFavorite ? (
                  <IconBookmarkFilled className="w-4 h-4" />
                ) : (
                  <IconBookmark className="w-4 h-4" />
                )}
              </div>
              <div>
                <span className="text-sm font-bold text-white group-hover:text-[#D70466] transition-colors">
                  {lang === "fr" ? "Vidéos \"J'aime\"" : "Liked Videos"}
                </span>
                <p className="text-[11px] text-zinc-500">
                  {lang === "fr" ? "Coups de cœur" : "Favorites"}
                </p>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                isFavorite
                  ? "bg-[#D70466] border-[#D70466] text-white"
                  : "border-zinc-700 group-hover:border-zinc-500"
              }`}
            >
              {isFavorite && <IconCheck className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </button>
        </div>

        {/* User Custom Playlists list */}
        <div className="pt-2 border-t border-white/5">
          <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider px-2 mb-1">
            {lang === "fr" ? "Vos Playlists" : "Your Playlists"}
          </p>

          <div className="max-h-48 overflow-y-auto no-scrollbar space-y-1">
            {user?.playlists && user.playlists.length > 0 ? (
              user.playlists.map((pl: any) => {
                const isInPl = pl.items?.some(
                  (item: any) =>
                    item.tmdbId === String(media.tmdbId) &&
                    item.mediaType === media.mediaType
                );
                return (
                  <button
                    key={pl.id}
                    onClick={() => handleTogglePlaylist(pl)}
                    disabled={loading}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 transition-all text-left group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <IconPlaylist className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      <span className="text-xs sm:text-sm font-semibold text-white group-hover:text-cyan-400 truncate">
                        {pl.title}
                      </span>
                    </div>
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0 ${
                        isInPl
                          ? "bg-cyan-500 border-cyan-500 text-black"
                          : "border-zinc-700 group-hover:border-zinc-500"
                      }`}
                    >
                      {isInPl && <IconCheck className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })
            ) : (
              <p className="text-xs text-zinc-500 px-2 py-2">
                {lang === "fr" ? "Aucune playlist créée" : "No custom playlist"}
              </p>
            )}
          </div>
        </div>

        {/* Create new playlist inline */}
        <div className="pt-2 border-t border-white/5">
          {!showCreateInput ? (
            <button
              onClick={() => setShowCreateInput(true)}
              className="w-full py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <IconPlus className="w-4 h-4" />
              <span>
                {lang === "fr" ? "Créer une nouvelle playlist" : "New Playlist"}
              </span>
            </button>
          ) : (
            <form onSubmit={handleCreateAndAdd} className="space-y-2">
              <input
                type="text"
                autoFocus
                placeholder={
                  lang === "fr" ? "Nom de la playlist..." : "Playlist name..."
                }
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#D70466]"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateInput(false);
                    setNewTitle("");
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white"
                >
                  {lang === "fr" ? "Annuler" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={loading || !newTitle.trim()}
                  className="px-3 py-1.5 rounded-lg bg-[#D70466] hover:bg-[#b5034f] disabled:opacity-50 text-xs font-bold text-white shadow"
                >
                  {lang === "fr" ? "Créer et ajouter" : "Create & Add"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
