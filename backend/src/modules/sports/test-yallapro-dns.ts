/**
 * Script de test du fallback DNS pour yallapro
 * Usage: npx tsx src/modules/sports/test-yallapro-dns.ts
 */

import { getYallaproMatches } from './yasirtv.service';

async function testYallaproDNS() {
  console.log('🧪 Test du fallback DNS yallapro...\n');
  
  try {
    const startTime = Date.now();
    const matches = await getYallaproMatches();
    const duration = Date.now() - startTime;
    
    console.log('\n✅ Test réussi !');
    console.log(`   Durée: ${duration}ms`);
    console.log(`   Matchs trouvés: ${matches.length}`);
    
    if (matches.length > 0) {
      console.log('\n📺 Premiers matchs:');
      matches.slice(0, 3).forEach((match, i) => {
        console.log(`   ${i + 1}. ${match.home || '(sans titre)'}`);
        console.log(`      ID: ${match.id}`);
        console.log(`      Source: ${match.sourceId.slice(0, 60)}...`);
      });
    } else {
      console.log('\n⚠️  Aucun match trouvé (peut-être aucun match en cours actuellement)');
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Test échoué:');
    console.error(`   Erreur: ${error.message}`);
    console.error(`   Code: ${error.code || 'N/A'}`);
    if (error.stack) {
      console.error(`\n   Stack trace:\n${error.stack.split('\n').slice(0, 5).join('\n')}`);
    }
    process.exit(1);
  }
}

testYallaproDNS();
