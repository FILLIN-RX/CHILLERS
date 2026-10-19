import type { Metadata } from "next";
import { SITE_URL, SITE_NAME, SITE_LOCALE, DEFAULT_OG_IMAGE } from "@/lib/seo";
import LiveTvPageContent from "./page-content";

export const metadata: Metadata = {
  title: "TV Française en Direct — Généralistes, Sport, Cinéma, Kids & Musique",
  description:
    "Regardez les chaînes TV françaises en direct et gratuitement sur CHILLERS : TF1, M6, ARTE, beIN SPORTS, CANAL+, DAZN, Disney, Cartoon Network, MTV et plus encore.",
  alternates: {
    canonical: `${SITE_URL}/live/tv`,
  },
  keywords: [
    "tv française en direct",
    "chaînes tv gratuites",
    "tf1 en direct",
    "m6 en direct",
    "beinsports en direct",
    "dazn ligue 1",
    "canal+ en direct",
    "cartoon network en direct",
    "regarder la tv en ligne",
  ],
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: SITE_LOCALE,
    title: "📺 TV Française en Direct · CHILLERS",
    description:
      "Les chaînes TV françaises en direct : généralistes, foot & sport, cinéma, dessins animés et musique. 100% gratuit sur CHILLERS.",
    url: `${SITE_URL}/live/tv`,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    site: "@chillers",
    title: "📺 TV Française en Direct · CHILLERS",
    description:
      "Les chaînes TV françaises en direct : généralistes, sport, cinéma, kids et musique.",
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function LiveTvPage() {
  return <LiveTvPageContent />;
}
