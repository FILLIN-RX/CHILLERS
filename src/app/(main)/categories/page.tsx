import { Metadata } from "next";
import PageContent from "./page-content";

export const metadata: Metadata = {
  title: "Catégories",
  description: "Explorez les catégories de films et séries disponibles sur CHILLERS.",
  openGraph: {
    title: "Catégories · CHILLERS",
    description: "Explorez les catégories de films et séries disponibles sur CHILLERS.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Catégories · CHILLERS",
    description: "Explorez les catégories de films et séries disponibles sur CHILLERS.",
  },
};

export default function Page() {
  return <PageContent />;
}
