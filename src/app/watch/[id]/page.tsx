"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import VideoPlayer from '@/components/VideoPlayer';
import { getMediaDetails } from '@/app/api';
import { MovieOrShow } from '@/app/mockData';

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [item, setItem] = useState<MovieOrShow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getMediaDetails(id, false)
      .then((data) => setItem(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="h-12 w-12 border-4 border-zinc-700 border-t-brand-primary rounded-full animate-spin" />
      </main>
    );
  }

  if (!item) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center text-white">
        <p className="text-zinc-400">Contenu introuvable.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto pt-10 px-4">
        <VideoPlayer
          item={item}
          onBack={() => router.back()}
          onOpenDetails={(item) => router.push(`/media/${item.id}?type=${item.type === 'series' || item.type === 'anime' ? 'tv' : 'movie'}`)}
        />
      </div>
    </main>
  );
}
