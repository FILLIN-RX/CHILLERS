"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { PersonDetails, MovieOrShow } from "@/types/media";
import { usePersonDetails } from "@/hooks/usePersonDetails";
import { useLanguage } from "@/i18n/LanguageContext";
import MovieCard from "@/components/MovieCard";
import CardImage from "@/components/CardImage";
import {
  ArrowLeft,
  CalendarBlank,
  MapPin,
  Briefcase,
  ShareNetwork,
  LinkSimple,
  X,
  Check,
  FilmSlate,
} from "@phosphor-icons/react";

interface PersonClientProps {
  id: string;
  initialPerson: PersonDetails | null;
}

const MAX_GRID = 24;

export default function PersonClient({ id, initialPerson }: PersonClientProps) {
  const router = useRouter();
  const { translate: _ } = useLanguage();
  const { data: personData } = usePersonDetails(id, {
    initialData: initialPerson ?? undefined,
    staleTime: 5 * 60_000,
  });
  const person = personData ?? null;
  const [bioExpanded, setBioExpanded] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!person) {
    return (
      <div className="min-h-screen bg-[#1F1F1F] text-white flex flex-col items-center justify-center p-4 text-center">
        <h2 className="text-2xl font-bold mb-2">Personne introuvable</h2>
        <p className="text-zinc-400 mb-6">Cette fiche n&apos;est pas disponible ou a été déplacée.</p>
        <button
          onClick={() => router.back()}
          className="px-6 py-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium transition-all cursor-pointer"
        >
          Retourner au catalogue
        </button>
      </div>
    );
  }

  const handleShare = async () => {
    const url = window.location.href;
    const title = `${person.name} — Filmographie sur CHILLERS`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {}
    }
    setShareOpen(!shareOpen);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => {
      setCopiedLink(false);
      setShareOpen(false);
    }, 2000);
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    } catch {
      return d;
    }
  };

  const openMedia = (m: MovieOrShow) => {
    const isTv = m.type === "series" || m.type === "anime";
    router.push(isTv ? `/tv/${m.id}` : `/media/${m.id}`);
  };

  const playMedia = (m: MovieOrShow) => {
    const isTv = m.type === "series" || m.type === "anime";
    router.push(`/watch/${m.id}?type=${isTv ? "tv" : "movie"}`);
  };

  const movies = person.movies.slice(0, MAX_GRID);
  const tvShows = person.tvShows.slice(0, MAX_GRID);
  const departmentLabel =
    person.knownForDepartment === "Acting"
      ? "Acteur"
      : person.knownForDepartment === "Directing"
        ? "Réalisateur"
        : person.knownForDepartment === "Writing"
          ? "Scénariste"
          : person.knownForDepartment || "Artiste";

  const bio = person.biography?.trim() || "";
  const bioLong = bio.length > 280;

  return (
    <div className="min-h-screen bg-[#1F1F1F] text-white select-none pb-20">
      {/* ── Barre supérieure simple ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-[#1F1F1F]/95 backdrop-blur-xl border-b border-zinc-800/80">
        <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16">
          <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 h-14">
            <button
              onClick={() => {
                window.scrollTo(0, 0);
                router.back();
              }}
              aria-label={_("media.back") || "Retour"}
              className="flex items-center gap-2 text-sm font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Retour</span>
            </button>

            <div className="relative flex items-center gap-2">
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer active:scale-95"
              >
                <ShareNetwork className="h-4 w-4" />
                <span>Partager</span>
              </button>
              {shareOpen && (
                <div className="absolute top-full right-0 mt-2 z-40 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-xl p-2 shadow-2xl flex items-center gap-2">
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-800 text-xs text-zinc-200 transition-colors cursor-pointer"
                  >
                    {copiedLink ? <Check className="h-4 w-4 text-green-400" /> : <LinkSimple className="h-4 w-4" />}
                    <span>{copiedLink ? "Lien copié !" : "Copier le lien"}</span>
                  </button>
                  <button
                    onClick={() => setShareOpen(false)}
                    aria-label="Fermer"
                    className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 transition-colors cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16 py-6 space-y-8">
        {/* ── Header compact (photo + identité) ──────────────────────────────── */}
        <div className="mx-auto w-full max-w-[1600px] flex items-start gap-4 sm:gap-6">
          <div className="relative w-24 sm:w-32 shrink-0 rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 shadow-lg aspect-[2/3]">
            <CardImage
              src={person.profileUrl}
              alt={person.name}
              fill
              className="object-cover object-top"
              sizes="96px, (max-width: 640px) 128px"
              priority
              fallbackText={person.name}
            />
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {person.knownForDepartment && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider bg-brand-primary/20 text-brand-primary">
                  {departmentLabel}
                </span>
              )}
              {person.age !== null && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider bg-white/10 text-zinc-300">
                  {person.age} ans{person.deathday ? " (†)" : ""}
                </span>
              )}
              {person.creditsCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider bg-white/10 text-zinc-300 flex items-center gap-1">
                  <FilmSlate className="h-3 w-3" />
                  {person.creditsCount} crédits
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight break-words">
              {person.name}
            </h1>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-zinc-400 font-medium">
              {person.birthday && (
                <span className="flex items-center gap-1">
                  <CalendarBlank className="h-3.5 w-3.5 text-zinc-500" />
                  {formatDate(person.birthday)}
                  {person.deathday && ` — ${formatDate(person.deathday)}`}
                </span>
              )}
              {person.placeOfBirth && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                  {person.placeOfBirth}
                </span>
              )}
            </div>

            {person.alsoKnownAs.length > 0 && (
              <p className="text-xs text-zinc-500 line-clamp-1" title={person.alsoKnownAs.join(", ")}>
                <span className="text-zinc-600">Aussi connu sous le nom : </span>
                {person.alsoKnownAs.slice(0, 4).join(", ")}
                {person.alsoKnownAs.length > 4 && "…"}
              </p>
            )}
          </div>
        </div>

        {/* ── Biographie (tronquée) ──────────────────────────────────────────── */}
        {bio && (
          <section className="mx-auto w-full max-w-[1600px] border-t border-zinc-800/80 pt-5">
            <h2 className="text-sm font-black uppercase tracking-wider text-zinc-500 mb-2">Biographie</h2>
            <div className="space-y-2">
              <p
                className={`text-zinc-300 text-sm leading-relaxed whitespace-pre-line ${
                  bioLong && !bioExpanded ? "line-clamp-2" : ""
                }`}
              >
                {bio}
              </p>
              {bioLong && (
                <button
                  onClick={() => setBioExpanded(!bioExpanded)}
                  className="text-brand-primary text-sm font-bold hover:underline cursor-pointer"
                >
                  {bioExpanded ? "Réduire" : "Lire la suite"}
                </button>
              )}
            </div>
          </section>
        )}

        {/* ── Métadonnées en chips ───────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-[1600px] flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900/60 border border-zinc-800/80 text-xs text-zinc-300 font-medium">
            <Briefcase className="h-3.5 w-3.5 text-zinc-500" />
            {departmentLabel}
          </span>
          {person.birthday && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900/60 border border-zinc-800/80 text-xs text-zinc-300 font-medium">
              <CalendarBlank className="h-3.5 w-3.5 text-zinc-500" />
              Né(e) le {formatDate(person.birthday)}
            </span>
          )}
          {person.placeOfBirth && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900/60 border border-zinc-800/80 text-xs text-zinc-300 font-medium">
              <MapPin className="h-3.5 w-3.5 text-zinc-500" />
              {person.placeOfBirth}
            </span>
          )}
          {person.alsoKnownAs.slice(0, 6).map((alias) => (
            <span
              key={alias}
              className="px-3 py-1 rounded-full bg-zinc-900/60 border border-zinc-800/80 text-xs text-zinc-400 font-medium"
            >
              {alias}
            </span>
          ))}
        </section>

        {/* ── Films ──────────────────────────────────────────────────────────── */}
        {movies.length > 0 && (
          <section className="mx-auto w-full max-w-[1600px] space-y-4 pt-4 border-t border-zinc-800/80">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                <span className="h-4 w-1 rounded-full bg-brand-primary" />
                <span>Films</span>
              </h2>
              <span className="text-xs text-zinc-500 font-semibold">{person.movies.length} titres</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 w-full">
              {movies.map((m) => (
                <MovieCard
                  key={`movie-${m.id}`}
                  item={m}
                  variant="grid-poster"
                  onOpenDetails={openMedia}
                  onPlay={playMedia}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Séries ─────────────────────────────────────────────────────────── */}
        {tvShows.length > 0 && (
          <section className="mx-auto w-full max-w-[1600px] space-y-4 pt-4 border-t border-zinc-800/80">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                <span className="h-4 w-1 rounded-full bg-brand-secondary" />
                <span>Séries & Émissions</span>
              </h2>
              <span className="text-xs text-zinc-500 font-semibold">{person.tvShows.length} titres</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 w-full">
              {tvShows.map((s) => (
                <MovieCard
                  key={`tv-${s.id}`}
                  item={s}
                  variant="grid-poster"
                  onOpenDetails={openMedia}
                  onPlay={playMedia}
                />
              ))}
            </div>
          </section>
        )}

        {movies.length === 0 && tvShows.length === 0 && (
          <section className="mx-auto w-full max-w-[1600px] text-center py-16 space-y-3 border-t border-zinc-800/80">
            <FilmSlate className="h-10 w-10 text-zinc-700 mx-auto" />
            <p className="text-zinc-400 font-medium">Aucun film ou série trouvé pour cette personne.</p>
          </section>
        )}
      </div>
    </div>
  );
}
