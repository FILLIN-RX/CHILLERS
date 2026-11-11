#!/usr/bin/env node
/**
 * Vérification détaillée d'une transaction spécifique
 */

const API_URL = 'https://chillers-production-eace.up.railway.app';
const ADMIN_USERNAME = 'Fillin';
const ADMIN_PASSWORD = 'Fillin2378';
const PAYMENT_ID = '6af38b2b762a389673375342'; // Transaction 0.83 USD crypto du 10 nov

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
  console.log('🔍 Investigation détaillée de la transaction');
  console.log('═'.repeat(60));

  // 1. Login admin
  console.log('📝 Connexion admin...');
  const loginRes = await request('/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
    }),
  });

  const token = loginRes.data.token;
  console.log('✅ Connecté\n');

  // 2. Récupérer toutes les transactions
  console.log('📊 Récupération des transactions...');
  const transactionsRes = await request('/api/admin/transactions?from=2026-11-10T00:00:00Z&to=2026-11-11T23:59:59Z&status=ALL&limit=100', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const targetTxn = transactionsRes.data.items.find(t => t._id === PAYMENT_ID);

  if (!targetTxn) {
    console.error('❌ Transaction non trouvée');
    process.exit(1);
  }

  console.log('✅ Transaction trouvée\n');
  console.log('═'.repeat(60));
  console.log('📄 DÉTAILS COMPLETS');
  console.log('═'.repeat(60));
  console.log(JSON.stringify(targetTxn, null, 2));

  console.log('\n' + '═'.repeat(60));
  console.log('🔍 ANALYSE');
  console.log('═'.repeat(60));

  console.log(`\n📌 Informations de base:`);
  console.log(`   ID Local: ${targetTxn._id}`);
  console.log(`   Status: ${targetTxn.status}`);
  console.log(`   Montant: ${targetTxn.amount} ${targetTxn.currency}`);
  console.log(`   Réseau: ${targetTxn.network}`);
  console.log(`   Pays: ${targetTxn.country}`);
  console.log(`   Plan: ${targetTxn.planCode} - ${targetTxn.planName || 'N/A'}`);

  console.log(`\n🔗 Identifiants SasPay:`);
  console.log(`   Payment ID: ${targetTxn.saspayPaymentId || '❌ Non généré'}`);
  console.log(`   Référence: ${targetTxn.reference || '❌ Non générée'}`);
  console.log(`   Idempotency Key: ${targetTxn.idempotencyKey || 'N/A'}`);

  console.log(`\n👤 Client:`);
  if (targetTxn.userId) {
    console.log(`   User ID: ${targetTxn.userId._id || targetTxn.userId}`);
    if (targetTxn.userId.username) {
      console.log(`   Username: ${targetTxn.userId.username}`);
    }
    if (targetTxn.userId.email) {
      console.log(`   Email: ${targetTxn.userId.email}`);
    }
  } else {
    console.log(`   ℹ️  Don anonyme (sans compte)`);
  }

  console.log(`\n📅 Dates:`);
  console.log(`   Créée: ${targetTxn.createdAt}`);
  console.log(`   Mise à jour: ${targetTxn.updatedAt}`);
  if (targetTxn.activatedAt) {
    console.log(`   Activée: ${targetTxn.activatedAt}`);
  }

  console.log(`\n🔧 État technique:`);
  if (targetTxn.checkoutUrl) {
    console.log(`   Checkout URL: ${targetTxn.checkoutUrl}`);
  } else {
    console.log(`   ❌ Aucune URL de checkout générée`);
  }

  if (targetTxn.instructions) {
    console.log(`   Instructions: ${targetTxn.instructions}`);
  }

  if (targetTxn.lastError) {
    console.log(`   ⚠️  Erreur: ${targetTxn.lastError}`);
  }

  // Diagnostic
  console.log('\n' + '═'.repeat(60));
  console.log('💡 DIAGNOSTIC');
  console.log('═'.repeat(60));

  if (targetTxn.status === 'PENDING') {
    console.log('\n⏳ La transaction est en attente (PENDING)');
    
    if (!targetTxn.saspayPaymentId) {
      console.log('\n❌ PROBLÈME IDENTIFIÉ:');
      console.log('   La transaction n\'a PAS été envoyée à SasPay');
      console.log('   Aucun Payment ID SasPay n\'a été généré');
      console.log('\n🔍 Causes possibles:');
      console.log('   1. Erreur lors de l\'appel API SasPay (softpay)');
      console.log('   2. Validation échouée côté SasPay');
      console.log('   3. Problème de configuration (SASPAY_API_KEY)');
      console.log('   4. Montant inférieur au minimum accepté par SasPay');
      console.log('   5. Réseau crypto non disponible ou mal configuré');
    } else if (targetTxn.checkoutUrl) {
      console.log('\n✅ Transaction initiée avec succès');
      console.log('   Le client doit compléter le paiement sur SasPay');
      console.log(`   URL: ${targetTxn.checkoutUrl}`);
      console.log('\n💡 Actions possibles:');
      console.log('   • Le client n\'a peut-être pas complété le paiement');
      console.log('   • Vérifier le statut sur le dashboard SasPay');
      console.log('   • Attendre le webhook de confirmation');
    } else {
      console.log('\n⚠️  Situation inhabituelle:');
      console.log('   Payment ID existe mais pas de checkout URL');
    }
  } else if (targetTxn.status === 'FAILED') {
    console.log('\n❌ La transaction a échoué');
    if (targetTxn.lastError) {
      console.log(`   Raison: ${targetTxn.lastError}`);
    }
  }

  // Vérification des limites de montant
  if (targetTxn.network === 'crypto' && targetTxn.amount < 0.5) {
    console.log('\n⚠️  ATTENTION: Montant crypto potentiellement trop faible');
    console.log(`   Montant: ${targetTxn.amount} ${targetTxn.currency}`);
    console.log('   Minimum généralement requis pour crypto: 0.50 USD');
  }

  console.log('\n' + '═'.repeat(60));
}

main().catch((err) => {
  console.error('\n❌ Erreur:', err.message);
  process.exit(1);
});
