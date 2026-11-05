import axios from 'axios';
import { matchesService } from '../modules/matches/matches.service';
import { findSportsMatchByTeams } from '../modules/sports/sports.service';

const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = new Set(tokens(b));
  if (!ta.length) return 0;
  const hits = ta.filter((t) => tb.has(t) || [...tb].some((u) => t.startsWith(u) || u.startsWith(t))).length;
  return hits / ta.length;
}

async function main() {
  const espn: any = await axios.get(`https://site.api.espn.com/apis/site/v2/sports/soccer/afc.cup/scoreboard?dates=${today}`, { timeout: 15000 });
  const providersMocked = [
    ['Layon Siti Seylors', 'Adelaida Yunayted', 'AFC CL Two live'],
    ['Adelaida Yunayted', 'Layon Siti Seylors', 'inverse'],
    ['Tay Po', 'BG Pathum', 'Taïwan'],
    ['Taipo', 'Taipo', 'contrôle'],
  ];
  for (const ev of espn?.data?.events ?? []) {
    const competitors = ev?.competitions?.[0]?.competitors ?? [];
    if (competitors.length < 2) continue;
    const home = competitors.find((c: any) => c.homeAway === 'home')?.team?.displayName;
    const away = competitors.find((c: any) => c.homeAway === 'away')?.team?.displayName;
    const state = ev?.status?.type?.state;
    console.log(`\n=== ${state} | ${home} vs ${away} ===`);
    for (const [h, a] of providersMocked) {
      const s = similarity(`${home} ${away}`, `${h} ${a}`);
      console.log(`  provider sample « ${h} vs ${a} » → sim=${s.toFixed(2)}`);
    }
  }
  process.exit(0);
}
main().catch((e) => { console.error(e?.message); process.exit(1); });
