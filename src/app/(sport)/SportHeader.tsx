"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FF6A00]";

const NAV = [
  { href: "/matches", label: "Scores" },
  { href: "/live", label: "Chaînes TV" },
];

/*
  Header section sport — barre globale façon apple.com :
  48px, fond noir translucide + flou, logo à gauche, navigation centrée,
  lien de sortie à droite. Aucune icône.
*/
export default function SportHeader() {
  const pathname = usePathname() ?? "";

  return (
    <header
      className="sticky top-0 z-40 h-12 border-b border-white/10 bg-black/80 font-sans backdrop-blur-xl backdrop-saturate-150"
    >
      <div className="mx-auto flex h-full max-w-[1100px] items-center justify-between px-4 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:px-6">
        <Link
          href="/matches"
          aria-label="Chillers Sport"
          className={`whitespace-nowrap text-[16px] font-semibold tracking-tight text-white ${FOCUS}`}
        >
          Chillers <span className="text-[#FF6A00]">Sport</span>
        </Link>

        <nav aria-label="Sport" className="flex h-full items-stretch">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center px-3.5 text-[14px] transition-colors ${FOCUS} ${
                  active ? "font-medium text-white" : "text-white/60 hover:text-white"
                }`}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-3.5 bottom-0 h-0.5 rounded-full bg-[#FF6A00]" />
                )}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/"
          className={`whitespace-nowrap text-[13px] text-white/60 transition-colors hover:text-white sm:justify-self-end ${FOCUS}`}
        >
          <span className="sm:hidden">Accueil</span>
          <span className="hidden sm:inline">Retour à Chillers</span>
        </Link>
      </div>
    </header>
  );
}