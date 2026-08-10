"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function LiveShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { translate: _ } = useLanguage();
  const isChannelPage = pathname?.startsWith("/live/") && pathname !== "/live";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-zinc-900/95 backdrop-blur border-b border-white/10">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-8 md:px-12 lg:px-[4%] py-3">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href={isChannelPage ? "/live" : "/"}
              className="flex items-center gap-1.5 text-zinc-300 hover:text-white transition-colors text-sm font-medium shrink-0"
            >
              <IconArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{isChannelPage ? _("nav.live") : _("watch.backToHome")}</span>
            </Link>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-black tracking-widest uppercase bg-gradient-to-r from-[#D70466] to-[#7C3AED] bg-clip-text text-transparent truncate">
                CHILLERS
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest bg-red-600 text-white px-2 py-0.5 rounded-full shrink-0">
                {_("live.liveLabel")}
              </span>
            </div>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="flex-1 flex flex-col">{children}</main>

      <footer className="border-t border-white/10 py-6 px-4 text-center text-xs text-zinc-500">
        CHILLERS · TV en direct — chaînes gratuites et publiques
      </footer>
    </div>
  );
}
