import type { Metadata } from "next";
import SportHeader from "./SportHeader";

export const metadata: Metadata = {
  title: { default: "CHILLERS SPORT — Scores en direct", template: "%s · CHILLERS SPORT" },
};

/** Layout indépendant du reste du site (sans AppShell) : header CHILLERS SPORT + contenu. */
export default function SportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <SportHeader />
      {children}
    </div>
  );
}
