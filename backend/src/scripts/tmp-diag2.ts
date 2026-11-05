import 'dotenv/config';
import { resolveKoraStream } from '../modules/sports/kora.service';
import { pickPlayableServers } from '../modules/sports/utils/stream-probe';
(async () => {
  for (let i = 1; i <= 2; i++) {
    const t0 = Date.now();
    try {
      const k = await resolveKoraStream('718', true);
      console.log(`kora run${i}:`, Date.now() - t0 + 'ms', 'null?', !k, 'servers:', k?.servers.length ?? '-');
      if (k) console.log('  playable:', (await pickPlayableServers(k)).length);
    } catch (e: any) {
      console.log('kora THROW:', e?.stack?.split('\n').slice(0, 3).join(' | ') || e?.message);
    }
  }
  process.exit(0);
})();
