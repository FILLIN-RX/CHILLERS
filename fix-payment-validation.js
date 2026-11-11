#!/usr/bin/env node
/**
 * Script pour appliquer les corrections de validation de paiement
 * 
 * Ce script :
 * 1. Marque la transaction orpheline comme FAILED
 * 2. Génère un patch pour ajouter les validations au backend
 */

const API_URL = 'https://chillers-production-eace.up.railway.app';
const ADMIN_USERNAME = 'Fillin';
const ADMIN_PASSWORD = 'Fillin2378';
const ORPHAN_PAYMENT_ID = '6af38b2b762a389673375342';

async function request(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return response.json();
}

async function markTransactionAsFailed() {
  console.log('🔧 Marquage de la transaction orpheline comme FAILED...\n');
  
  // Note: Cette fonctionnalité nécessiterait un endpoint admin spécifique
  // pour mettre à jour manuellement une transaction
  
  console.log('⚠️  ACTION MANUELLE REQUISE:');
  console.log('   Connectez-vous à MongoDB et exécutez:');
  console.log('');
  console.log('   ```javascript');
  console.log('   db.paymenttransactions.updateOne(');
  console.log(`     { _id: ObjectId("${ORPHAN_PAYMENT_ID}") },`);
  console.log('     { $set: { ');
  console.log('       status: "FAILED",');
  console.log('       lastError: "Checkout URL non généré - montant trop faible pour crypto (0.83 USD < 1 USD minimum)"');
  console.log('     }}');
  console.log('   )');
  console.log('   ```');
  console.log('');
}

function generatePatches() {
  console.log('\n' + '═'.repeat(60));
  console.log('📝 PATCHES DE CODE À APPLIQUER');
  console.log('═'.repeat(60));
  
  console.log('\n1️⃣  Ajout de validation de montant minimum');
  console.log('    Fichier: backend/src/modules/payments/payments.service.ts');
  console.log('    Ligne: ~236 (avant l\'appel saspaySoftpay)');
  console.log('');
  console.log('```typescript');
  console.log('// Validation des montants minimums par réseau');
  console.log('const CRYPTO_MIN_AMOUNT = 1.0; // USD');
  console.log('const CARD_MIN_AMOUNT = 0.5; // USD');
  console.log('');
  console.log('if (network === \'crypto\' && sendCurrency === \'USD\' && amount < CRYPTO_MIN_AMOUNT) {');
  console.log('  throw new PaymentError(');
  console.log('    `Le montant minimum pour les paiements crypto est de ${CRYPTO_MIN_AMOUNT} USD.`,');
  console.log('    400,');
  console.log('    \'amount_too_small\'');
  console.log('  );');
  console.log('}');
  console.log('');
  console.log('if (network === \'card\' && sendCurrency === \'USD\' && amount < CARD_MIN_AMOUNT) {');
  console.log('  throw new PaymentError(');
  console.log('    `Le montant minimum pour les paiements carte est de ${CARD_MIN_AMOUNT} USD.`,');
  console.log('    400,');
  console.log('    \'amount_too_small\'');
  console.log('  );');
  console.log('}');
  console.log('```');
  
  console.log('\n2️⃣  Validation obligatoire de checkout_url');
  console.log('    Fichier: backend/src/modules/payments/payments.service.ts');
  console.log('    Ligne: ~274 (après réception de la réponse SasPay)');
  console.log('');
  console.log('```typescript');
  console.log('// Vérification checkout_url pour réseaux hébergés');
  console.log('const needsCheckoutUrl = [\'crypto\', \'card\'].includes(network);');
  console.log('');
  console.log('if (needsCheckoutUrl && !resp.checkout_url) {');
  console.log('  txn.status = \'FAILED\';');
  console.log('  txn.lastError = `Checkout URL manquante pour le réseau ${network}. ` +');
  console.log('    (amount < 1 ? \'Montant possiblement trop faible.\' : \'Erreur SasPay.\');');
  console.log('  await txn.save();');
  console.log('  ');
  console.log('  throw new PaymentError(');
  console.log('    `Impossible de créer un paiement ${network}. ${amount < 1 ? \'Montant minimum: 1 USD.\' : \'Erreur gateway.\'}`,');
  console.log('    422,');
  console.log('    \'checkout_url_missing\'');
  console.log('  );');
  console.log('}');
  console.log('```');
  
  console.log('\n3️⃣  Ajout de logging détaillé');
  console.log('    Fichier: backend/src/modules/payments/payments.service.ts');
  console.log('    Ligne: ~274 (juste après l\'appel saspaySoftpay)');
  console.log('');
  console.log('```typescript');
  console.log('console.log(\'[SasPay] Réponse softpay:\', {');
  console.log('  id: resp.id,');
  console.log('  status: resp.status,');
  console.log('  hasCheckoutUrl: !!resp.checkout_url,');
  console.log('  hasInstructions: !!resp.instructions,');
  console.log('  network,');
  console.log('  amount,');
  console.log('  currency: sendCurrency');
  console.log('});');
  console.log('```');
}

async function verifyCurrentState() {
  console.log('🔍 Vérification de l\'état actuel...\n');
  
  try {
    // Login
    const loginRes = await request('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: ADMIN_USERNAME,
        password: ADMIN_PASSWORD,
      }),
    });
    
    const token = loginRes.data.token;
    
    // Get transaction
    const transactionsRes = await request('/api/admin/transactions?from=2026-11-10T00:00:00Z&to=2026-11-11T23:59:59Z&status=ALL&limit=100', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    const targetTxn = transactionsRes.data.items.find(t => t._id === ORPHAN_PAYMENT_ID);
    
    if (targetTxn) {
      console.log('✅ Transaction trouvée');
      console.log(`   ID: ${targetTxn._id}`);
      console.log(`   Status: ${targetTxn.status}`);
      console.log(`   Montant: ${targetTxn.amount} ${targetTxn.currency}`);
      console.log(`   Checkout URL: ${targetTxn.checkoutUrl || '❌ Absente'}`);
      
      if (targetTxn.status === 'FAILED') {
        console.log('\n✅ La transaction est déjà marquée comme FAILED');
        console.log(`   Erreur: ${targetTxn.lastError || 'Non spécifiée'}`);
        return true;
      } else {
        console.log('\n⚠️  La transaction est toujours en status:', targetTxn.status);
        return false;
      }
    } else {
      console.log('❌ Transaction non trouvée');
      return false;
    }
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    return false;
  }
}

async function main() {
  console.log('🛠️  Fix Payment Validation');
  console.log('═'.repeat(60));
  console.log('');
  
  const isFixed = await verifyCurrentState();
  
  console.log('');
  
  if (!isFixed) {
    await markTransactionAsFailed();
  }
  
  generatePatches();
  
  console.log('\n' + '═'.repeat(60));
  console.log('✅ Script terminé');
  console.log('');
  console.log('📋 Prochaines étapes:');
  console.log('   1. Marquer manuellement la transaction comme FAILED (si pas déjà fait)');
  console.log('   2. Appliquer les patches de code ci-dessus');
  console.log('   3. Tester avec un montant < 1 USD pour vérifier le rejet');
  console.log('   4. Tester avec un montant ≥ 1 USD pour vérifier le succès');
  console.log('   5. Déployer les changements');
  console.log('═'.repeat(60));
}

main().catch(err => {
  console.error('\n❌ Erreur fatale:', err.message);
  process.exit(1);
});
