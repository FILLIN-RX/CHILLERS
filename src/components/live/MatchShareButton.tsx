"use client";

import { useState } from "react";
import { Check, ShareNetwork } from "@phosphor-icons/react";

export default function MatchShareButton({
  title,
  iconOnly = false,
}: {
  title: string;
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // L'utilisateur peut fermer le menu de partage sans envoyer le lien.
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      aria-label={copied ? "Lien copié" : "Partager ce match"}
      title={copied ? "Lien copié" : "Partager ce match"}
      className={
        iconOnly
          ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-colors hover:bg-white/20"
          : "inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border border-white/20 bg-brand-primary px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-brand-primary/30 transition-colors hover:bg-[#b5034f]"
      }
    >
      {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <ShareNetwork className="h-4 w-4" />}
      {!iconOnly && (copied ? "Copié" : "Partager")}
    </button>
  );
}
