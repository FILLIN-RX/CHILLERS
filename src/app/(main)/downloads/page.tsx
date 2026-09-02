"use client";

import Link from "next/link";
import { IconChevronLeft } from "@tabler/icons-react";
import DownloadsView from "@/features/downloads/DownloadsView";

export default function DownloadsPage() {
  return (
    <main className="min-h-screen bg-brand-dark pt-[84px] pb-28 px-4 sm:px-8 md:px-12 lg:px-[4%] max-w-[1600px] w-full mx-auto font-sans antialiased">
      <div className="mb-4 sm:hidden">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <IconChevronLeft className="w-4 h-4" />
          <span>Accueil</span>
        </Link>
      </div>

      <DownloadsView />
    </main>
  );
}
