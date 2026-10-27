import {
  fetchOhaEpisodeSources,
  fetchOhaMovieSources,
  probeOhaVod,
  resolveOhaVod,
  selectOhaVodSources,
} from '../modules/streaming/oha-vod.client';
import { buildOhaRelayUrl } from '../modules/streaming/oha-hls-relay';

async function run(label: string, sources: Awaited<ReturnType<typeof fetchOhaMovieSources>>): Promise<void> {
  const candidates = selectOhaVodSources(sources, 'fr');
  console.log(`\n${label}: ${sources.length} source(s), ${candidates.length} FR`);
  for (const source of candidates.slice(0, 4)) {
    console.log(`- ${source.name || '?'} ${source.quality || ''} ${source.url}`);
  }
  if (!candidates.length) return;

  for (const source of candidates.slice(0, 4)) {
    const started = Date.now();
    const resolved = await resolveOhaVod(source.url);
    if (!resolved) {
      console.log(`  FAIL ${source.url} → résolution échouée (${Date.now() - started}ms)`);
      continue;
    }
    const type = await probeOhaVod(resolved);
    console.log(`  OK   ${source.url} → ${type || 'inconnu'} (${Date.now() - started}ms)`);
    console.log(`    url: ${resolved.url.slice(0, 140)}`);
    if (resolved.referer) console.log(`    referer: ${resolved.referer}`);
    if (type) console.log(`    relay: ${buildOhaRelayUrl(resolved, source.url, type)}`);
  }
}

async function main(): Promise<void> {
  const [kind = 'movie', idArg = '77338', seasonArg = '1', episodeArg = '1'] = process.argv.slice(2);
  if (kind === 'series') {
    const sources = await fetchOhaEpisodeSources(Number(idArg), Number(seasonArg), Number(episodeArg));
    await run(`Série ${idArg} S${seasonArg}E${episodeArg}`, sources);
    return;
  }
  const sources = await fetchOhaMovieSources(Number(idArg));
  await run(`Film ${idArg}`, sources);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
