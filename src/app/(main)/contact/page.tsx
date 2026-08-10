import { Metadata } from "next";
import { SITE_LOCALE } from "@/lib/seo";
import PageContent from "./page-content";

export const metadata: Metadata = {
  title: "Contactez l'équipe CHILLERS",
  description:
    "Une question ou un problème ? Contactez l'équipe CHILLERS, votre plateforme de streaming gratuit de films, séries et anime.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact · CHILLERS",
    description:
      "Une question ou un problème ? Contactez l'équipe CHILLERS, votre plateforme de streaming gratuit de films, séries et anime.",
    url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://chillers.vercel.app"}/contact`,
    siteName: "CHILLERS",
    locale: SITE_LOCALE,
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact · CHILLERS",
    description:
      "Une question ou un problème ? Contactez l'équipe CHILLERS, votre plateforme de streaming gratuit de films, séries et anime.",
  },
};

export default function Page() {
  return <PageContent />;
}
