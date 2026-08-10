import { Metadata } from "next";
import { SITE_LOCALE } from "@/lib/seo";
import PageContent from "./page-content";

export const metadata: Metadata = {
  title: "À propos de CHILLERS",
  description:
    "Découvrez qui est derrière CHILLERS, la plateforme de streaming gratuit de films, séries et anime en VF/VOSTFR.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "À propos de CHILLERS",
    description:
      "Découvrez qui est derrière CHILLERS, la plateforme de streaming gratuit de films, séries et anime en VF/VOSTFR.",
    url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://chillers.vercel.app"}/about`,
    siteName: "CHILLERS",
    locale: SITE_LOCALE,
  },
  twitter: {
    card: "summary_large_image",
    title: "À propos de CHILLERS",
    description:
      "Découvrez qui est derrière CHILLERS, la plateforme de streaming gratuit de films, séries et anime en VF/VOSTFR.",
  },
};

export default function Page() {
  return <PageContent />;
}
