import axios from 'axios';
import { searchFlemmix } from '../modules/flemmix/flemmix.service';
import { searchFrenchStream } from '../modules/frenchstream/frenchstream.service';
import { searchOmniSave } from '../modules/omnisave/omnisave.service';
import { searchFawesome } from '../modules/fawesome/fawesome.service';
import { searchFmplus } from '../modules/freemoviesplus/freemoviesplus.service';
import { searchOtaku } from '../modules/otaku/otaku.service';
import { getLiveBallMatches } from '../modules/liveball/liveball.service';

async function testAll() {
  console.log('=== AUDIT COMPLET DES PROVIDERS CHILLERS ===\n');

  // 1. FRENCHSTREAM
  try {
    console.log('Testing FrenchStream...');
    const res = await searchFrenchStream('Avatar');
    console.log(`[FrenchStream] Status: OK | Results: ${res?.length || 0}`);
  } catch (e: any) {
    console.log(`[FrenchStream] Error: ${e.message}`);
  }

  // 2. OMNISAVE
  try {
    console.log('Testing OmniSave...');
    const res = await searchOmniSave('Batman');
    console.log(`[OmniSave] Status: OK | Results: ${res.items.length || 0}`);
  } catch (e: any) {
    console.log(`[OmniSave] Error: ${e.message}`);
  }

  // 3. FAWESOME TV
  try {
    console.log('Testing Fawesome TV...');
    const res = await searchFawesome('Trapped');
    console.log(`[Fawesome] Status: OK | Results: ${res?.length || 0}`);
  } catch (e: any) {
    console.log(`[Fawesome] Error: ${e.message}`);
  }

  // 4. FREEMOVIESPLUS
  try {
    console.log('Testing FreeMoviesPlus...');
    const res = await searchFmplus('Action');
    console.log(`[FreeMoviesPlus] Status: OK | Results: ${res?.length || 0}`);
  } catch (e: any) {
    console.log(`[FreeMoviesPlus] Error: ${e.message}`);
  }

  // 5. OTAKU (Anime)
  try {
    console.log('Testing Otaku Anime...');
    const res = await searchOtaku('Naruto');
    console.log(`[Otaku] Status: OK | Results: ${res ? 1 : 0}`);
  } catch (e: any) {
    console.log(`[Otaku] Error: ${e.message}`);
  }

  // 6. LIVEBALL (Live Football)
  try {
    console.log('Testing LiveBall...');
    const res = await getLiveBallMatches();
    console.log(`[LiveBall] Status: ${res ? 'OK' : 'NULL'} | Matches found: ${res?.length || 0}`);
  } catch (e: any) {
    console.log(`[LiveBall] Error: ${e.message}`);
  }
}

testAll().catch(console.error);
