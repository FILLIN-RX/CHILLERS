import React from 'react';
import VideoPlayer from '@/components/VideoPlayer';
import { getMediaDetails } from '@/app/api';
import { MovieOrShow } from '@/app/mockData';
import { notFound } from 'next/navigation';

export default async function WatchPage({ params }: { params: { id: string } }) {
  const { id } = params;
  
  // Note: Since this is a server component, we fetch data here
  // Adjust based on your API structure. If getMediaDetails requires type,
  // we might need to handle it via searchParams or a lookup.
  
  // Placeholder for fetching item - update to match your API requirements
  const item = await getMediaDetails(id, false); 

  if (!item) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto pt-10 px-4">
        <VideoPlayer
          item={item}
          onBack={() => window.history.back()}
          onOpenDetails={(item) => console.log('Details:', item)}
        />
      </div>
    </main>
  );
}
