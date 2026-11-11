/**
 * Tests pour les validations de paiement crypto/carte
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import mongoose from 'mongoose';
import { initiateSoftpay, PaymentError } from '../payments.service';

describe('Payment Validation', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || '');
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe('Crypto Payment Minimum Amount', () => {
    it('devrait rejeter un paiement crypto < 1 USD', async () => {
      const input = {
        planCode: undefined,
        donationAmount: 80, // 0.80 USD après conversion
        currency: 'USD',
        country: 'XX',
        network: 'crypto',
        phone: '',
        email: 'test@example.com',
      };

      await expect(initiateSoftpay(null, input)).rejects.toThrow(PaymentError);
      await expect(initiateSoftpay(null, input)).rejects.toMatchObject({
        message: expect.stringContaining('1'),
        code: 'amount_too_small',
        status: 400,
      });
    });

    it('devrait accepter un paiement crypto ≥ 1 USD', async () => {
      const input = {
        planCode: undefined,
        donationAmount: 600, // 1.00 USD après conversion (si taux XAF/USD ~ 600)
        currency: 'USD',
        country: 'XX',
        network: 'crypto',
        phone: '',
        email: 'test@example.com',
      };

      // Note: Ce test nécessite que SasPay soit configuré et accessible
      // En environnement de test, on pourrait mocker saspaySoftpay
      const result = await initiateSoftpay(null, input);
      expect(result).toHaveProperty('paymentId');
      expect(result).toHaveProperty('status');
    });
  });

  describe('Card Payment Minimum Amount', () => {
    it('devrait rejeter un paiement carte < 0.5 USD', async () => {
      const input = {
        planCode: undefined,
        donationAmount: 40, // 0.40 USD après conversion
        currency: 'USD',
        country: 'XX',
        network: 'card',
        phone: '',
        email: 'test@example.com',
      };

      await expect(initiateSoftpay(null, input)).rejects.toThrow(PaymentError);
      await expect(initiateSoftpay(null, input)).rejects.toMatchObject({
        message: expect.stringContaining('0.5'),
        code: 'amount_too_small',
        status: 400,
      });
    });
  });

  describe('Mobile Money (no minimum validation)', () => {
    it('devrait accepter tout montant pour Mobile Money', async () => {
      const input = {
        planCode: undefined,
        donationAmount: 100, // 100 XAF (< 1 USD)
        currency: 'XAF',
        country: 'CM',
        network: 'mtn_cm',
        phone: '+237600000000',
        email: 'test@example.com',
      };

      // Mobile Money n'a pas de validation spécifique de minimum dans notre code
      // (la validation assertNetworkAmount gère déjà les minimums par réseau)
      const result = await initiateSoftpay(null, input);
      expect(result).toHaveProperty('paymentId');
    });
  });
});
