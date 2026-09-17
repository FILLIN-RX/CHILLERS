"use client";

import { useState } from "react";
import { X, FilmReel, Television, Sparkle, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { httpJson } from "@/services/http";

interface RequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTitle?: string;
  initialType?: "movie" | "series";
  tmdbId?: number;
  posterUrl?: string;
  year?: number;
  initialSeason?: number;
  initialEpisode?: number;
  onSuccess?: () => void;
}

export default function RequestModal({
  isOpen,
  onClose,
  initialTitle = "",
  initialType = "movie",
  tmdbId,
  posterUrl,
  year,
  initialSeason = 1,
  initialEpisode = 1,
  onSuccess,
}: RequestModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [type, setType] = useState<"movie" | "series">(initialType);
  const [season, setSeason] = useState(initialSeason);
  const [episode, setEpisode] = useState(initialEpisode);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setStatus("idle");
    setErrorMessage("");

    try {
      await httpJson("/api/requests", {
        method: "POST",
        body: {
          tmdbId,
          title: title.trim(),
          type,
          season: type === "series" ? season : undefined,
          episode: type === "series" ? episode : undefined,
          year,
          posterUrl,
        },
      });

      setStatus("success");
      onSuccess?.();
      setTimeout(() => {
        onClose();
        setStatus("idle");
      }, 2500);
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(
        err?.message?.includes("401")
          ? "Veuillez vous connecter pour demander un contenu."
          : "Une erreur est survenue lors de l'envoi de la demande."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      {/* Modal Box - Max 2px border radius */}
      <div
        className="relative w-full max-w-lg bg-[#0f0f13] border border-white/10 shadow-2xl overflow-hidden rounded-[2px]"
        style={{ borderRadius: "2px" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <Sparkle size={20} className="text-primary" weight="fill" />
            <h3 className="text-base font-semibold text-white tracking-wide">
              Demander l'ajout d'un contenu
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white/50 hover:text-white hover:bg-white/10 transition-colors rounded-[2px]"
            style={{ borderRadius: "2px" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {status === "success" ? (
            <div className="py-8 text-center space-y-3">
              <CheckCircle size={48} className="text-emerald-400 mx-auto animate-bounce" weight="fill" />
              <h4 className="text-lg font-medium text-white">Demande enregistrée !</h4>
              <p className="text-sm text-white/60 max-w-xs mx-auto">
                Notre robot de recherche multi-sources en Go explore le web en ce moment même. Vous serez notifié dès qu'il sera disponible.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-white/[0.04] border border-white/10 rounded-[2px]" style={{ borderRadius: "2px" }}>
                <button
                  type="button"
                  onClick={() => setType("movie")}
                  className={`flex items-center justify-center gap-2 py-2 text-xs font-medium uppercase tracking-wider transition-all rounded-[2px] ${
                    type === "movie"
                      ? "bg-primary text-white shadow-md font-semibold"
                      : "text-white/60 hover:text-white"
                  }`}
                  style={{ borderRadius: "2px" }}
                >
                  <FilmReel size={16} />
                  Film
                </button>
                <button
                  type="button"
                  onClick={() => setType("series")}
                  className={`flex items-center justify-center gap-2 py-2 text-xs font-medium uppercase tracking-wider transition-all rounded-[2px] ${
                    type === "series"
                      ? "bg-primary text-white shadow-md font-semibold"
                      : "text-white/60 hover:text-white"
                  }`}
                  style={{ borderRadius: "2px" }}
                >
                  <Television size={16} />
                  Série
                </button>
              </div>

              {/* Title Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70">Titre du film ou de la série</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Interstellar, Breaking Bad..."
                  required
                  className="w-full px-3.5 py-2.5 bg-black/50 border border-white/15 text-white text-sm focus:outline-none focus:border-primary transition-colors rounded-[2px]"
                  style={{ borderRadius: "2px" }}
                />
              </div>

              {/* Season / Episode Fields for Series */}
              {type === "series" && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/70">Saison</label>
                    <input
                      type="number"
                      min={1}
                      value={season}
                      onChange={(e) => setSeason(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3.5 py-2.5 bg-black/50 border border-white/15 text-white text-sm focus:outline-none focus:border-primary transition-colors rounded-[2px]"
                      style={{ borderRadius: "2px" }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/70">Épisode</label>
                    <input
                      type="number"
                      min={1}
                      value={episode}
                      onChange={(e) => setEpisode(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3.5 py-2.5 bg-black/50 border border-white/15 text-white text-sm focus:outline-none focus:border-primary transition-colors rounded-[2px]"
                      style={{ borderRadius: "2px" }}
                    />
                  </div>
                </div>
              )}

              {/* Info Note */}
              <div className="p-3 bg-white/[0.02] border border-white/5 text-xs text-white/50 leading-relaxed rounded-[2px]" style={{ borderRadius: "2px" }}>
                💡 Dès la soumission, notre microservice autonome lance une recherche parallèle sur les serveurs partenaires et prépare les flux streaming.
              </div>

              {/* Error Alert */}
              {status === "error" && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-[2px]" style={{ borderRadius: "2px" }}>
                  <WarningCircle size={16} className="shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-colors rounded-[2px]"
                  style={{ borderRadius: "2px" }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading || !title.trim()}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg rounded-[2px]"
                  style={{ borderRadius: "2px" }}
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Recherche...
                    </>
                  ) : (
                    <>
                      <Sparkle size={15} weight="fill" />
                      Lancer la recherche
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
