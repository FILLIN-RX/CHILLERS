#!/usr/bin/env node
/**
 * Script d'investigation de la transaction échouée
 * ID: 3e17c631e1094599b05df2e49d6430cf
 * Date: 10 nov 2026, 22:22:52
 */

const API_URL = 'https://chillers-production-eace.up.railway.app';
const ADMIN_USERNAME = 'Fillin';
const ADMIN_PASSWORD = 'Fillin2378';
const PAYMENT_ID = '3e17c631e1094599b05df2e49d6430cf';

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

async function main() {
  console.log('🔍 Investigation de la transaction échouée');
  console.log('═'.repeat(60));
  console.log(`ID de transaction: ${PAYMENT_ID}`);
  console.log(`API: ${API_URL}`);
  console.log('');

  // 1. Login admin
  console.log('📝 Connexion admin...');
  const loginRes = await request('/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
    }),
  });

  if (!loginRes.success || !loginRes.data?.token) {
    console.error('❌ Échec de connexion admin');
    console.log(loginRes);
    process.exit(1);
  }

  const token = loginRes.data.token;
  console.log('✅ Connecté avec succès\n');

  // 2. Récupérer les transactions autour de la date (10 nov 2026)
  console.log('📊 Récupération des transactions du 10 novembre 2026...');
  const transactionsRes = await request('/api/admin/transactions?from=2026-11-10T00:00:00Z&to=2026-11-11T23:59:59Z&status=ALL&limit=100', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!transactionsRes.success) {
    console.error('❌ Échec de récupération des transactions');
    console.log(transactionsRes);
    process.exit(1);
  }

  console.log(`✅ ${transactionsRes.data.items.length} transactions trouvées\n`);

  // 3. Trouver la transaction spécifique
  console.log(`🔎 Recherche de la transaction ${PAYMENT_ID}...`);
  const targetTxn = transactionsRes.data.items.find(
    (t) => t._id === PAYMENT_ID || t.saspayPaymentId === PAYMENT_ID
  );

  if (!targetTxn) {
    console.warn(`⚠️  Transaction ${PAYMENT_ID} non trouvée dans la période`);
    console.log('\n📋 Transactions disponibles:');
    transactionsRes.data.items.forEach((t, i) => {
      console.log(`\n[${i + 1}] ${t._id}`);
      console.log(`    Statut: ${t.status}`);
      console.log(`    Montant: ${t.amount} ${t.currency}`);
      console.log(`    Réseau: ${t.network}`);
      console.log(`    Date: ${t.createdAt}`);
    });
    process.exit(0);
  }

  // 4. Afficher les détails de la transaction
  console.log('\n' + '═'.repeat(60));
  console.log('📄 DÉTAILS DE LA TRANSACTION');
  console.log('═'.repeat(60));
  console.log(JSON.stringify(targetTxn, null, 2));

  // 5. Résumé des statistiques
  console.log('\n' + '═'.repeat(60));
  console.log('📊 STATISTIQUES DE LA PÉRIODE');
  console.log('═'.repeat(60));
  console.log('Statuts:');
  Object.entries(transactionsRes.data.summary.statusCounts).forEach(([status, count]) => {
    const icon = status === 'SUCCESS' ? '✅' : status === 'FAILED' ? '❌' : status === 'CANCELLED' ? '🚫' : '⏳';
    console.log(`  ${icon} ${status}: ${count}`);
  });

  console.log('\nTotaux par devise:');
  transactionsRes.data.summary.totalsByCurrency.forEach((item) => {
    console.log(`  💰 ${item._id}: ${item.amount.toFixed(2)} (${item.count} transactions réussies)`);
  });

  // 6. Analyse de la transaction échouée
  console.log('\n' + '═'.repeat(60));
  console.log('🔍 ANALYSE DE L\'ÉCHEC');
  console.log('═'.repeat(60));

  if (targetTxn.status === 'FAILED') {
    console.log('❌ Status: FAILED');
    if (targetTxn.lastError) {
      console.log(`📝 Erreur: ${targetTxn.lastError}`);
    } else {
      console.log('⚠️  Aucun message d\'erreur enregistré');
    }

    console.log('\n🔧 Points à vérifier:');
    console.log('  1. Réseau utilisé:', targetTxn.network);
    console.log('  2. Pays:', targetTxn.country);
    console.log('  3. Montant:', targetTxn.amount, targetTxn.currency);
    console.log('  4. SasPay Payment ID:', targetTxn.saspayPaymentId || 'Non généré');
    console.log('  5. Référence:', targetTxn.reference || 'Non générée');

    if (targetTxn.network === 'crypto' && targetTxn.amount < 0.5) {
      console.log('\n⚠️  PROBLÈME POTENTIEL: Montant crypto trop faible');
      console.log('   Les paiements crypto ont souvent un minimum de 0.50 USD');
      console.log(`   Montant demandé: ${targetTxn.amount} ${targetTxn.currency}`);
    }

    if (!targetTxn.saspayPaymentId) {
      console.log('\n⚠️  PROBLÈME: Aucun ID SasPay généré');
      console.log('   La transaction a échoué avant même d\'être envoyée à SasPay');
      console.log('   Vérifier les logs backend au moment de l\'initiation');
    }
  }

  console.log('\n' + '═'.repeat(60));
}

main().catch((err) => {
  console.error('\n❌ Erreur:', err.message);
  process.exit(1);
});
