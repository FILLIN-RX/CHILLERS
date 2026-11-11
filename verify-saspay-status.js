#!/usr/bin/env node
/**
 * Vérification du statut côté SasPay
 */

const SASPAY_API_KEY = 'sk_live_BxD7vE5EEVaUH4JHJMq4qzuFliZp3BeaeamEXD_hcYU';
const SASPAY_PAYMENT_ID = '58663483-337d-4629-8415-43b93cadd991';

async function verifySaspayPayment() {
  console.log('🔍 Vérification du paiement côté SasPay');
  console.log('═'.repeat(60));
  console.log(`Payment ID: ${SASPAY_PAYMENT_ID}\n`);

  try {
    const response = await fetch(`https://api.saspay.me/v1/payments/${SASPAY_PAYMENT_ID}/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SASPAY_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`Status HTTP: ${response.status} ${response.statusText}`);
    
    const data = await response.json();
    console.log('\n📄 Réponse SasPay:');
    console.log(JSON.stringify(data, null, 2));

    console.log('\n' + '═'.repeat(60));
    console.log('🔍 ANALYSE DU STATUT SASPAY');
    console.log('═'.repeat(60));

    if (data.status === 'SUCCESS') {
      console.log('✅ Le paiement a RÉUSSI côté SasPay');
      console.log('⚠️  MAIS il est encore PENDING côté CHILLERS');
      console.log('💡 Le webhook n\'a probablement pas été reçu/traité correctement');
    } else if (data.status === 'FAILED') {
      console.log('❌ Le paiement a ÉCHOUÉ côté SasPay');
      console.log(`Raison: ${data.message || 'Non spécifiée'}`);
    } else if (data.status === 'PENDING') {
      console.log('⏳ Le paiement est toujours PENDING côté SasPay');
      console.log('Le client n\'a probablement jamais complété le paiement');
    } else {
      console.log(`ℹ️  Statut: ${data.status}`);
    }

  } catch (error) {
    console.error('\n❌ Erreur lors de la vérification:', error.message);
    
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
  }

  console.log('\n' + '═'.repeat(60));
}

verifySaspayPayment();
