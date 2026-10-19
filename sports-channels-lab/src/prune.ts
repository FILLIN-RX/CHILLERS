/**
 * prune.ts — rétention du store : purge les liens dont le dernier passage
 * (`lastSeen`) dépasse N jours.
 *
 * Sans purge, `channels.jsonl` accumule les fixtures et liens morts de tous
 * les jours : le rapport grossit et la page de test finit par afficher des
 * rencontres depuis longtemps passées. Le lab ne conserve que la semaine
 * glissante — les providers ne publient que la journée en cours, la semaine
 * se construit donc scan après scan.
 *
 * Usage :
 *   tsx src/prune.ts                       # 7 jours (ou SPORTS_LAB_KEEP_DAYS)
 *   tsx src/prune.ts --keep-days=10
 *   tsx src/prune.ts --dry-run             # compte sans écrire
 */
import { loadAll, saveAll } from './record';

const args = process.argv.slice(2);
const flag = (name: string, def?: string): string | undefined => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
const DRY = args.includes('--dry-run');
const KEEP_DAYS = Number(flag('keep-days', process.env.SPORTS_LAB_KEEP_DAYS || '7')) || 7;

if (KEEP_DAYS <= 0) {
  console.log('[prune] keep-days <= 0 : rétention désactivée, rien à faire.');
} else {
  const started = Date.now();
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  const all = loadAll();

  let removed = 0;
  let kept = 0;
  for (const [key, rec] of all) {
    const last = Date.parse(rec.lastSeen) || 0;
    if (last < cutoff) {
      all.delete(key);
      removed += 1;
    } else {
      kept += 1;
    }
  }

  if (!DRY && removed > 0) saveAll(all);
  console.log(
    `[prune] ${removed} lien(s) de plus de ${KEEP_DAYS} j supprimé(s), ${kept} conservé(s)` +
      `${DRY ? ' (dry-run, non écrit)' : ''} — ${Math.round(Date.now() - started)} ms`
  );
}
