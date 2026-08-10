import { Metadata } from "next";
import { SITE_LOCALE } from "@/lib/seo";
import PageContent from "./page-content";

export const metadata: Metadata = {
  title: "Support & Aide CHILLERS",
  description:
    "Besoin d'aide avec CHILLERS ? Retrouvez toutes les réponses dans notre centre d'aide : streaming, lecture, téléchargement et plus.",
  alternates: { canonical: "/support" },
  openGraph: {
    title: "Support · CHILLERS",
    description:
      "Besoin d'aide avec CHILLERS ? Retrouvez toutes les réponses dans notre centre d'aide : streaming, lecture, téléchargement et plus.",
    url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://chillers.vercel.app"}/support`,
    siteName: "CHILLERS",
    locale: SITE_LOCALE,
  },
  twitter: {
    card: "summary_large_image",
    title: "Support · CHILLERS",
    description:
      "Besoin d'aide avec CHILLERS ? Retrouvez toutes les réponses dans notre centre d'aide : streaming, lecture, téléchargement et plus.",
  },
};

export default function Page() {
  return <PageContent />;
}
