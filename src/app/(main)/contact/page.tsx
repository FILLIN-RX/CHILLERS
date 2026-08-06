import { Metadata } from "next";
import PageContent from "./page-content";

export const metadata: Metadata = {
  title: "Contact",
  description: "Une question ou un problème ? Contactez l'équipe CHILLERS.",
  openGraph: {
    title: "Contact · CHILLERS",
    description: "Une question ou un problème ? Contactez l'équipe CHILLERS.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact · CHILLERS",
    description: "Une question ou un problème ? Contactez l'équipe CHILLERS.",
  },
};

export default function Page() {
  return <PageContent />;
}
