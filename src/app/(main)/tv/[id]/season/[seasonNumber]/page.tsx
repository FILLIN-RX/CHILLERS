import { Metadata } from "next";
import { Suspense } from "react";
import { API_BASE, getServerApiHeaders } from "@/lib/server-api";
import { buildMediaMetadata, buildMediaJsonLd } from "@/lib/seo";
import SeasonContent from "./season-content";

type Props = {
  params: Promise<{ id: string; seasonNumber: string }>;
};

async function fetchSeasonData(id: string) {
  let d = null;
  const tmdbToken = process.env.TMDB_TOKEN || process.env.NEXT_PUBLIC_TMDB_TOKEN;
  if (tmdbToken) {
    try {
      const tmdbRes = await fetch(`https://api.themoviedb.org/3/tv/${id}?language=fr-FR`, {
        headers: { Authorization: `Bearer ${tmdbToken}` },
        signal: AbortSignal.timeout(5000),
      });
      const json = await tmdbRes.json();
      if (json && !json.status_code) {
        d = json;
      }
    } catch (err) {
      console.warn("TMDB fetch failed for season metadata, falling back to backend...", err);
    }
  }

  if (!d) {
    const res = await fetch(`${API_BASE}/tv/${id}?language=fr`, {
      headers: getServerApiHeaders(),
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json().catch(() => null);
    if (json && json.success && json.data) {
      d = json.data;
    }
  }
  return d;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, seasonNumber } = await params;

  try {
    const d = await fetchSeasonData(id);
    if (d) {
      const title = `${d.title || d.name || id} — Saison ${seasonNumber}`;
      const year = d.release_date
        ? new Date(d.release_date).getFullYear()
        : d.first_air_date
          ? new Date(d.first_air_date).getFullYear()
          : undefined;
      const rating = typeof d.vote_average === "number" ? Math.round(d.vote_average * 10) / 10 : undefined;
      const genres = Array.isArray(d.genres) ? d.genres.map((g: any) => g.name) : [];

      return buildMediaMetadata({
        id,
        title,
        type: "tv",
        overview: d.overview,
        posterPath: d.poster_path,
        backdropPath: d.backdrop_path,
        year,
        rating,
        genres,
        path: `/tv/${id}/season/${seasonNumber}`,
        seasonLabel: `la saison ${seasonNumber}`,
        context: "season",
      });
    }
  } catch {}

  return {};
}

export default async function SeasonPage({ params }: Props) {
  const { id, seasonNumber } = await params;
  let jsonLd = null;

  try {
    const d = await fetchSeasonData(id);
    if (d) {
      const title = `${d.title || d.name || id} — Saison ${seasonNumber}`;
      const year = d.release_date
        ? new Date(d.release_date).getFullYear()
        : d.first_air_date
          ? new Date(d.first_air_date).getFullYear()
          : undefined;
      const rating = typeof d.vote_average === "number" ? Math.round(d.vote_average * 10) / 10 : undefined;
      const genres = Array.isArray(d.genres) ? d.genres.map((g: any) => g.name) : [];

      jsonLd = buildMediaJsonLd({
        id,
        title,
        type: "tv",
        overview: d.overview,
        posterPath: d.poster_path,
        backdropPath: d.backdrop_path,
        year,
        rating,
        genres,
        path: `/tv/${id}/season/${seasonNumber}`,
        seasonLabel: `la saison ${seasonNumber}`,
        context: "season",
      });
    }
  } catch {}

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
          <div className="h-12 w-12 border-4 border-zinc-700 border-t-brand-primary rounded-full animate-spin" />
        </div>
      }
    >
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <SeasonContent />
    </Suspense>
  );
}

