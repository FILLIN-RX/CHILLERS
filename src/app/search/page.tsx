"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

const SearchOverlay = dynamic(() => import("@/components/SearchOverlay"), {
  ssr: false,
});

export default function SearchPage() {
  const router = useRouter();
  return (
    <SearchOverlay
      isOpen
      onClose={() => router.back()}
      onOpenDetails={() => router.back()}
    />
  );
}
