import React from 'react';
import { getSeasonDetails } from '@/app/api';
import { notFound } from 'next/navigation';
import VideoPlayer from '@/components/VideoPlayer';

export default async function SeasonPage({ params }: { params: { id: string, seasonNumber: string } }) {
  const { id, seasonNumber } = params;
  const seasonData = await getSeasonDetails(id, seasonNumber);

  if (!seasonData) {
    notFound();
  }

  // Map season data to episode list
  const episodes = seasonData.episodes.map((ep: any) => ({
    id: String(ep.id),
    title: ep.name,
    duration: `${ep.runtime || 24}m`,
    number: ep.episode_number,
    thumbnail: ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : "",
    synopsis: ep.overview,
    videoUrl: '' // This will be set by the player or requested
  }));

  // Create a mock item for the VideoPlayer
  const mockItem = {
    id: id,
    title: `Season ${seasonNumber}`,
    type: 'series' as const,
    description: seasonData.overview,
    synopsis: seasonData.overview,
    backdropUrl: '',
    posterUrl: '',
    rating: 0,
    year: 0,
    duration: `${episodes.length} Episodes`,
    genres: [],
    cast: [],
    episodes: episodes
  };

  return (
    <main className="min-h-screen bg-black p-4">
      <h1 className="text-white text-3xl font-bold mb-4">Season {seasonNumber}</h1>
      <VideoPlayer
        item={mockItem}
        onBack={() => window.history.back()}
        onOpenDetails={() => {}}
      />
    </main>
  );
}
