#!/usr/bin/env node
/**
 * Script pour marquer la transaction orpheline comme FAILED
 * Nécessite un endpoint admin pour mettre à jour une transaction
 */

const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://flow:Fillin2378@cluster0.srbxv06.mongodb.net/chillers?appName=Cluster0';
const PAYMENT_ID = '6af38b2b762a389673375342';

async function markAsFailed() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connecté à MongoDB\n');

    // Définir le schéma de la transaction
    const PaymentTransactionSchema = new mongoose.Schema({
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      planCode: String,
      planName: String,
      amount: Number,
      currency: String,
      country: String,
      network: String,
      msisdn: String,
      saspayPaymentId: String,
      reference: String,
      status: String,
      checkoutUrl: String,
      instructions: String,
      idempotencyKey: String,
      activatedAt: Date,
      lastError: String,
    }, { timestamps: true });

    const PaymentTransaction = mongoose.models.PaymentTransaction || 
      mongoose.model('PaymentTransaction', PaymentTransactionSchema);

    // Trouver la transaction
    console.log(`🔍 Recherche de la transaction ${PAYMENT_ID}...`);
    const txn = await PaymentTransaction.findById(PAYMENT_ID);

    if (!txn) {
      console.error('❌ Transaction non trouvée');
      process.exit(1);
    }

    console.log('✅ Transaction trouvée\n');
    console.log('📊 État actuel:');
    console.log(`   ID: ${txn._id}`);
    console.log(`   Status: ${txn.status}`);
    console.log(`   Montant: ${txn.amount} ${txn.currency}`);
    console.log(`   Réseau: ${txn.network}`);
    console.log(`   Checkout URL: ${txn.checkoutUrl || '❌ Absente'}`);
    console.log(`   Erreur actuelle: ${txn.lastError || 'Aucune'}`);

    if (txn.status === 'FAILED') {
      console.log('\n✅ La transaction est déjà marquée comme FAILED');
      console.log('   Aucune action nécessaire');
      await mongoose.disconnect();
      return;
    }

    // Mettre à jour la transaction
    console.log('\n🔧 Mise à jour de la transaction...');
    txn.status = 'FAILED';
    txn.lastError = 'Checkout URL non généré - montant trop faible pour crypto (0.83 USD < 1 USD minimum)';
    await txn.save();

    console.log('✅ Transaction mise à jour avec succès\n');
    console.log('📊 Nouvel état:');
    console.log(`   Status: ${txn.status}`);
    console.log(`   Erreur: ${txn.lastError}`);

    await mongoose.disconnect();
    console.log('\n✅ Déconnecté de MongoDB');
    console.log('🎉 Opération terminée avec succès');

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

markAsFailed();
