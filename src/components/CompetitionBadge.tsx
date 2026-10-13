"use client";

/**
 * Bandeau de compétition d'une affiche : écusson officiel du service de score
 * quand la jointure a réussi, libellé de la source en repli.
 */
export default function CompetitionBadge({
  competition,
  logo,
}: {
  competition: string | null;
  logo?: string;
}) {
  return (
    <span className="flex items-center gap-1.5 min-w-0 max-w-[150px]">
      {logo && (
        // Les écussons de ligue ESPN sont noirs sur fond transparent : sans
        // pastille claire ils disparaissent sur le fond sombre du site.
        <span className="flex w-4 h-4 shrink-0 rounded-[3px] bg-white items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" loading="lazy" className="w-3.5 h-3.5 object-contain" />
        </span>
      )}
      <span className="text-[10px] font-bold text-zinc-400 truncate group-hover:text-white transition-colors">
        {competition || "Football"}
      </span>
    </span>
  );
}
