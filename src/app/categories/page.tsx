"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import CategoryCard from "@/components/CategoryCard";
import { getMovieGenres, Genre } from "@/app/api";

export default function CategoriesPage() {
  const router = useRouter();
  const [genres, setGenres] = useState<Genre[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchGenres() {
      try {
        const data = await getMovieGenres();
        setGenres(data);
      } catch (err) {
        console.error("Failed to load genres", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchGenres();
  }, []);

  return (
    <main className="min-h-screen bg-brand-dark pt-[72px] px-6 pb-28">
      <div className="max-w-7xl mx-auto space-y-6 pt-6">
        <div>
          <h2 className="text-3xl font-extrabold text-foreground">Explore Categories</h2>
          <p className="text-brand-text-muted text-sm mt-1">Find content curated by genre and editorial focus.</p>
        </div>
        
        {isLoading ? (
          <div className="text-white">Loading...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {genres.map((g) => (
              <CategoryCard
                key={g.id}
                category={{
                  id: String(g.id),
                  name: g.name,
                  imageUrl: `https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=600&auto=format&fit=crop`,
                }}
                onClick={(c) => {
                  router.push(`/media/movies?genre=${c.id}`);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
