/**
 * Test du cache DNS de yallapro (vérifier que le domaine trouvé est mis en cache)
 * Usage: npx tsx src/modules/sports/test-yallapro-cache.ts
 */

import { getYallaproMatches } from './yasirtv.service';

async function testCache() {
  console.log('🧪 Test du cache DNS yallapro...\n');
  
  console.log('1️⃣ Premier appel (devrait chercher le domaine):');
  const start1 = Date.now();
  await getYallaproMatches();
  const duration1 = Date.now() - start1;
  console.log(`   ✓ Durée: ${duration1}ms\n`);
  
  console.log('2️⃣ Deuxième appel immédiat (devrait utiliser le cache):');
  const start2 = Date.now();
  await getYallaproMatches();
  const duration2 = Date.now() - start2;
  console.log(`   ✓ Durée: ${duration2}ms\n`);
  
  console.log('3️⃣ Troisième appel (toujours en cache):');
  const start3 = Date.now();
  await getYallaproMatches();
  const duration3 = Date.now() - start3;
  console.log(`   ✓ Durée: ${duration3}ms\n`);
  
  if (duration2 < duration1 * 0.3 && duration3 < duration1 * 0.3) {
    console.log('✅ Cache fonctionne ! Les appels suivants sont >70% plus rapides');
    console.log(`   Premier appel: ${duration1}ms (recherche DNS)`);
    console.log(`   Deuxième appel: ${duration2}ms (cache)`);
    console.log(`   Troisième appel: ${duration3}ms (cache)`);
  } else {
    console.log('⚠️  Le cache semble ne pas fonctionner optimalement');
    console.log(`   Durées: ${duration1}ms → ${duration2}ms → ${duration3}ms`);
  }
}

testCache().then(() => process.exit(0)).catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
