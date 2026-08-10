import { Metadata } from "next";
import { SITE_LOCALE } from "@/lib/seo";
import PageContent from "./page-content";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Politique de confidentialité de CHILLERS, la plateforme de streaming gratuit de films, séries et anime.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Confidentialité · CHILLERS",
    description: "Politique de confidentialité de CHILLERS, la plateforme de streaming gratuit de films et séries.",
    url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://chillers.vercel.app"}/privacy`,
    siteName: "CHILLERS",
    locale: SITE_LOCALE,
  },
  twitter: {
    card: "summary_large_image",
    title: "Confidentialité · CHILLERS",
    description: "Politique de confidentialité de CHILLERS, la plateforme de streaming gratuit de films et séries.",
  },
};

export default function Page() {
  return <PageContent />;
}
