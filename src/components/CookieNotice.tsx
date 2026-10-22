"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const COOKIE_NOTICE_KEY = "chillers-cookie-notice-dismissed-v1";

export default function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(window.localStorage.getItem(COOKIE_NOTICE_KEY) !== "true");
  }, []);

  const dismiss = () => {
    window.localStorage.setItem(COOKIE_NOTICE_KEY, "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside
      aria-label="Information sur les cookies"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-xl rounded-2xl border border-white/10 bg-[#191919] p-4 text-white shadow-2xl sm:inset-x-6 sm:bottom-6 sm:p-5"
    >
      <p className="text-sm font-bold">Information sur les cookies</p>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-300">
        CHILLERS utilise des cookies pour assurer le fonctionnement du site,
        mémoriser vos préférences et mieux comprendre son utilisation.
      </p>
      <div className="mt-4 flex items-center justify-end gap-3">
        <Link
          href="/privacy"
          className="text-xs font-semibold text-zinc-300 underline decoration-white/30 underline-offset-4 hover:text-white"
        >
          En savoir plus
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-full bg-brand-primary px-4 py-2 text-xs font-bold text-white hover:opacity-90"
        >
          J&apos;ai compris
        </button>
      </div>
    </aside>
  );
}
