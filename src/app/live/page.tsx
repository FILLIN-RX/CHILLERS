import type { Metadata } from "next";
import { SITE_URL, SITE_NAME, SITE_LOCALE } from "@/lib/seo";
import LivePageContent from "./page-content";

export const metadata: Metadata = {
  title: "Matchs de Foot en Direct & Chaînes TV Gratuites Streaming HD · CHILLERS",
  description:
    "🔴 Regardez tous les matchs de football en direct streaming HD gratuit (Ligue des Champions, Premier League, La Liga, Ligue 1) et les chaînes TV en direct sans coupure sur CHILLERS.",
  alternates: {
    canonical: `${SITE_URL}/live`,
  },
  keywords: [
    "match en direct",
    "streaming foot",
    "foot direct gratuit",
    "ligue des champions streaming",
    "premier league streaming gratuit",
    "la liga streaming",
    "score en direct",
    "live streaming foot",
    "chillers tv direct",
    "tv direct gratuit",
  ],
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: SITE_LOCALE,
    title: "⚽ Matchs de Foot en Direct & Streaming HD Gratuit · CHILLERS",
    description:
      "Regardez tous les matchs de football en direct streaming HD (Ligue des Champions, Premier League, La Liga) et chaînes TV en live 100% gratuit sur CHILLERS.",
    url: `${SITE_URL}/live`,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "CHILLERS Foot en Direct Streaming HD",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "⚽ Matchs de Foot en Direct & Streaming HD Gratuit · CHILLERS",
    description:
      "Regardez tous les matchs de football en direct streaming HD (Ligue des Champions, Premier League, La Liga) et chaînes TV en live 100% gratuit sur CHILLERS.",
    images: [`${SITE_URL}/og-image.png`],
  },
};

export default function LivePage() {
  return <LivePageContent />;
}
