import { Metadata } from "next";
import { Suspense } from "react";
import { API_BASE, getServerApiHeaders } from "@/lib/server-api";
import { buildMediaMetadata, buildMediaJsonLd, SITE_LOCALE, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { getPopularTV } from "@/services/media";
import TvClientWrapper from "./TvClientWrapper";

type Props = {
  params: Promise<{ id: string }>;
};

async function fetchTvData(id: string) {
  let d = null;
  const tmdbToken = process.env.TMDB_TOKEN || process.env.NEXT_PUBLIC_TMDB_TOKEN;
  if (tmdbToken) {
    try {
      const tmdbRes = await fetch(`https://api.themoviedb.org/3/tv/${id}?language=fr-FR&append_to_response=credits,videos`, {
        headers: { Authorization: `Bearer ${tmdbToken}` },
        signal: AbortSignal.timeout(5000),
      });
      const json = await tmdbRes.json();
      if (json && !json.status_code) {
        d = json;
      }
    } catch (err) {
      console.warn("TMDB fetch failed for tv details, falling back to backend...", err);
    }
  }

  // Si on a pas les données complètes ou si on préfère utiliser notre propre mapper,
  // on utilise l'API interne (c'est plus sûr car elle gère le mapping vers MovieOrShow).
  try {
    const res = await fetch(`${API_BASE}/tv/${id}?language=fr`, {
      headers: getServerApiHeaders(),
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json().catch(() => null);
    if (json && json.success && json.data) {
      return json.data;
    }
  } catch (err) {
    console.warn("Backend fetch failed for tv details", err);
  }
  
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const d = await fetchTvData(id);
    if (d) {
      return buildMediaMetadata({
        id: id,
        title: d.title,
        type: "tv",
        overview: d.synopsis || d.description,
        posterPath: d.posterUrl,
        backdropPath: d.backdropUrl,
        year: d.year,
        rating: d.rating,
        genres: d.genres,
        path: `/tv/${id}`,
      });
    }
  } catch {}
  return {};
}

export default async function TvPage({ params }: Props) {
  const { id } = await params;
  
  const [item, popularList] = await Promise.all([
    fetchTvData(id),
    getPopularTV(1).catch(() => []),
  ]);
  
  const similar = popularList ? popularList.filter((m: any) => m.id !== id).slice(0, 14) : [];
  
  let jsonLd = null;
  if (item) {
    jsonLd = buildMediaJsonLd({
      id: id,
      title: item.title,
      type: "tv",
      overview: item.synopsis || item.description,
      posterPath: item.posterUrl,
      backdropPath: item.backdropUrl,
      year: item.year,
      rating: item.rating,
      genres: item.genres,
      path: `/tv/${id}`,
    });
  }

  return (
    <Suspense fallback={<TvFallback />}>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <TvClientWrapper id={id} initialItem={item} initialSimilar={similar} />
    </Suspense>
  );
}

function TvFallback() {
  return (
    <div className="min-h-screen bg-[#09090B] text-white select-none pb-24">
      {/* 1. HERO SKELETON */}
      <div className="relative w-full h-[65vh] sm:h-[75vh] lg:h-[80vh] max-h-[800px] overflow-hidden bg-zinc-900 animate-pulse">
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-8 md:px-12 lg:px-16 pb-10 sm:pb-16 flex flex-col md:flex-row md:items-end gap-6 sm:gap-8">
          <div className="w-[170px] sm:w-[210px] lg:w-[240px] aspect-[2/3] rounded-2xl bg-zinc-800 border border-white/10 shrink-0 shadow-2xl" />
          <div className="flex-1 space-y-4">
            <div className="flex gap-2">
              <div className="h-6 w-24 rounded-full bg-zinc-800" />
              <div className="h-6 w-16 rounded-full bg-zinc-800" />
            </div>
            <div className="h-10 sm:h-12 w-3/4 rounded-xl bg-zinc-800" />
            <div className="h-4 w-1/3 rounded-lg bg-zinc-800" />
            <div className="flex gap-3 pt-2">
              <div className="h-12 w-44 rounded-full bg-zinc-800" />
              <div className="h-12 w-32 rounded-full bg-zinc-800" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. SEASONS GRID SKELETON */}
      <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16 py-10 space-y-6">
        <div className="h-8 w-44 bg-zinc-800 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl bg-zinc-800/60" />
          ))}
        </div>
      </div>
    </div>
  );
}
