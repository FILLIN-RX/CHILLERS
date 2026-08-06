import { Metadata } from "next";
import PageContent from "./page-content";

export const metadata: Metadata = {
  title: "Support",
  description: "Besoin d'aide avec CHILLERS ? Retrouvez toutes les réponses dans notre page support.",
  openGraph: {
    title: "Support · CHILLERS",
    description: "Besoin d'aide avec CHILLERS ? Retrouvez toutes les réponses dans notre page support.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Support · CHILLERS",
    description: "Besoin d'aide avec CHILLERS ? Retrouvez toutes les réponses dans notre page support.",
  },
};

export default function Page() {
  return <PageContent />;
}
