import { Metadata } from "next";
import ProfileClient from "./ProfileClient";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Mon Profil - Chillers",
  description: "Gérez votre liste de favoris, votre historique et vos paramètres.",
};

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen pt-24 pb-20 flex items-center justify-center text-white">Chargement...</div>}>
      <ProfileClient />
    </Suspense>
  );
}
