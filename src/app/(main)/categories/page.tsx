import { Metadata } from "next";
import { SITE_LOCALE, SITE_URL } from "@/lib/seo";
import PageContent from "./page-content";

export const metadata: Metadata = {
  title: "Nollywood",
  description:
    "Découvrez les films Africaine et Nollywood disponibles sur CHILLERS.",
  alternates: { canonical: "/categories" },
  openGraph: {
    title: "Nollywood · CHILLERS",
    description:
      "Découvrez les films Africaine et Nollywood disponibles sur CHILLERS.",
    url: `${SITE_URL}/categories`,
    siteName: "CHILLERS",
    locale: SITE_LOCALE,
  },
  twitter: {
    card: "summary_large_image",
    title: "Nollywood · CHILLERS",
    description:
      "Découvrez les films Africaine et Nollywood disponibles sur CHILLERS.",
  },
};

export default function Page() {
  return <PageContent />;
}
