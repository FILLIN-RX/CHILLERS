"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { MovieOrShow } from "@/app/mockData";
import { getPopularMovies, getPopularTV, searchMedia } from "@/app/api";
import MovieCard from "@/components/MovieCard";
import MovieModal from "@/components/MovieModal";

export default function MediaTypePage() {
  const { type } = useParams();
  const [items, setItems] = useState<MovieOrShow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        let data: MovieOrShow[] = [];
        if (type === 'movies') {
            data = await getPopularMovies();
        } else if (type === 'series' || type === 'anime') {
            data = await getPopularTV();
            // Optional: Filter for anime if needed based on type
            if (type === 'anime') {
                data = data.filter(item => item.genres.includes('Animation') || item.type === 'anime');
            }
        }
        setItems(data);
      } catch (err) {
        console.error("Failed to load data", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [type]);

  return (
    <main className="min-h-screen bg-brand-dark pt-24 px-6 pb-20">
      <div className="max-w-7xl mx-auto space-y-8">
        <h1 className="text-3xl font-extrabold text-foreground capitalize">{type}</h1>
        
        {isLoading ? (
          <div className="text-white">Loading...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {items.map((item) => (
              <MovieCard
                key={item.id}
                movie={item}
                onPlay={() => console.log('Play:', item)}
                onOpenDetails={() => console.log('Details:', item)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
