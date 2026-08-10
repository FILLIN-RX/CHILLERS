import { Metadata } from "next";
import { Suspense } from "react";
import { API_BASE } from "@/lib/server-api";
import { buildMediaMetadata } from "@/lib/seo";
import SeasonContent from "./season-content";

type Props = {
  params: Promise<{ id: string; seasonNumber: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, seasonNumber } = await params;

  try {
    const res = await fetch(`${API_BASE}/tv/${id}?language=fr`, {
      signal: AbortSignal.timeout(5000),
    });
    const json = await res.json();

    if (json.success && json.data) {
      const d = json.data;
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

export default function SeasonPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
          <div className="h-12 w-12 border-4 border-zinc-700 border-t-brand-primary rounded-full animate-spin" />
        </div>
      }
    >
      <SeasonContent />
    </Suspense>
  );
}
