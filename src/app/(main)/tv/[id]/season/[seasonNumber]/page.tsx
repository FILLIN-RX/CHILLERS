import { Metadata } from "next";
import { Suspense } from "react";
import SeasonContent from "./season-content";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

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
      const title = `${d.title || d.name || id} · Saison ${seasonNumber}`;
      const overview = (d.overview || "").trim();
      const description = overview
        ? `Découvrez cette série sur CHILLERS — ${overview.slice(0, 155)}`
        : "Découvrez cette série sur CHILLERS.";
      const posterPath = d.poster_path
        ? `https://image.tmdb.org/t/p/w500${d.poster_path}`
        : undefined;
      const backdropPath = d.backdrop_path
        ? `https://image.tmdb.org/t/p/w1280${d.backdrop_path}`
        : undefined;
      const images = [
        ...(posterPath ? [{ url: posterPath, width: 500, height: 750, alt: title }] : []),
        ...(backdropPath ? [{ url: backdropPath, width: 1280, height: 720, alt: title }] : []),
      ];

      return {
        title,
        description,
        openGraph: {
          title: `${title} · CHILLERS`,
          description,
          images,
          type: "video.tv_show",
        },        twitter: {
          card: "summary_large_image",
          title: `${title} · CHILLERS`,
          description,
          images: backdropPath || posterPath ? [backdropPath || posterPath!] : [],
        },
      };
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
