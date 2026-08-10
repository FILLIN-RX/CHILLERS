import { Metadata } from "next";
import { SITE_LOCALE } from "@/lib/seo";
import PageContent from "./page-content";

export const metadata: Metadata = {
  title: "Catégories de films et séries",
  description:
    "Explorez toutes les catégories de films, séries et anime disponibles en streaming gratuit sur CHILLERS.",
  alternates: { canonical: "/categories" },
  openGraph: {
    title: "Catégories de films et séries · CHILLERS",
    description:
      "Explorez toutes les catégories de films, séries et anime disponibles en streaming gratuit sur CHILLERS.",
    url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://chillers.vercel.app"}/categories`,
    siteName: "CHILLERS",
    locale: SITE_LOCALE,
  },
  twitter: {
    card: "summary_large_image",
    title: "Catégories de films et séries · CHILLERS",
    description:
      "Explorez toutes les catégories de films, séries et anime disponibles en streaming gratuit sur CHILLERS.",
  },
};

export default function Page() {
  return <PageContent />;
}
