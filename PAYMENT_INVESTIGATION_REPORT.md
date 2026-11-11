# 🔍 Rapport d'Investigation - Transaction Échouée

**Date d'investigation:** 11 novembre 2026  
**Transaction ID:** `6af38b2b762a389673375342`  
**Référence SasPay:** `9f48ff2b-370d-4ba5-a7f1-c2a507a4f0e4` (de l'image)  
**Payment ID SasPay:** `58663483-337d-4629-8415-43b93cadd991` (de la base de données)

---

## 📊 Résumé Exécutif

Une transaction de don de **0,83 USD** via **crypto/stablecoin** est restée bloquée en statut `PENDING` depuis le 10 novembre 2026 à 22:22:52. L'investigation révèle que **la transaction a été créée dans votre base de données avec un Payment ID SasPay, mais SasPay n'a jamais généré d'URL de checkout et le paiement n'existe pas dans leur système (404).**

---

## 🔎 Détails de la Transaction

### Informations de Base
```json
{
  "_id": "6af38b2b762a389673375342",
  "userId": null,
  "planCode": "don",
  "planName": "Don",
  "amount": 0.83,
  "currency": "USD",
  "country": "XX",
  "network": "crypto",
  "status": "PENDING",
  "saspayPaymentId": "58663483-337d-4629-8415-43b93cadd991",
  "createdAt": "2026-11-10T21:22:51.517Z",
  "updatedAt": "2026-11-10T21:22:52.564Z"
}
```

### Frais Détaillés (de l'image fournie)
- **Montant demandé:** 0,83 USD
- **Frais client:** 0,03 USD
- **Frais gateway:** 0,01 USD
- **Frais plateforme:** 0,02 USD
- **Montant débité:** 0,83 USD
- **Montant net:** 0,80 USD
- **Mode de frais:** Déduits

### Client
- **Email:** noreply@chillers.site (email par défaut pour don anonyme)
- **Type:** Don anonyme (aucun compte utilisateur rattaché)
- **IP:** 34.11.12.147

---

## ❌ Problèmes Identifiés

### 1. **Payment ID existe MAIS pas d'URL de checkout**
```
✅ Payment ID SasPay généré: 58663483-337d-4629-8415-43b93cadd991
❌ Checkout URL: undefined (jamais générée)
❌ Instructions: undefined
```

**Signification:** L'appel à l'API SasPay a retourné un Payment ID, mais pas de `checkout_url`. Pour les paiements crypto/carte, cette URL est **obligatoire** car c'est la page hébergée où le client effectue le paiement.

### 2. **Payment inexistant côté SasPay**
```bash
GET https://api.saspay.me/v1/payments/58663483-337d-4629-8415-43b93cadd991/verify
→ 404 Not Found
```

**Signification:** Le Payment ID retourné par SasPay n'existe pas dans leur système, ce qui suggère :
- Une erreur lors de la création initiale
- Un timeout qui a interrompu la réponse
- Un problème de synchronisation entre leur réponse et leur base de données

### 3. **Montant potentiellement trop faible**
- **Montant:** 0,83 USD
- **Minimum crypto courant:** 0,50 - 1,00 USD (selon le réseau blockchain)

De nombreux processeurs de paiement crypto imposent un minimum de 1 USD pour couvrir les frais de transaction blockchain.

---

## 🔧 Analyse Technique

### Flux Normal vs Flux Observé

#### Flux Normal (attendu)
```
1. Client → Backend: POST /api/payments/softpay
2. Backend → SasPay: POST /payments/softpay/
3. SasPay → Backend: { id, status: "PENDING", checkout_url: "..." }
4. Backend → DB: Sauvegarde avec checkout_url
5. Backend → Client: { checkoutUrl: "..." }
6. Client → SasPay: Accède à checkout_url et paie
7. SasPay → Backend: Webhook transaction.success
8. Backend → DB: Status = "SUCCESS"
```

#### Flux Observé (problématique)
```
1. Client → Backend: POST /api/payments/softpay ✅
2. Backend → SasPay: POST /payments/softpay/ ✅
3. SasPay → Backend: { id: "...", status: "PENDING" } ⚠️ PAS de checkout_url
4. Backend → DB: Sauvegarde SANS checkout_url ❌
5. Backend → Client: { checkoutUrl: undefined } ❌
6. Client: BLOQUÉ - Aucune URL pour payer ❌
```

### Code Source Pertinent

**Backend - payments.service.ts (lignes 237-267)**
```typescript
const resp = await saspaySoftpay(
  {
    amount: amount.toFixed(2),
    currency: sendCurrency,
    country,
    network,
    description: isDonation ? 'Don CHILLERS' : `Abonnement CHILLERS ${plan.name}`,
    customer: { email, first_name: firstName, last_name: lastName, phone: phone || undefined },
    ...(input.otp ? { otp: input.otp } : {}),
    return_url: returnUrl,
    metadata: { ...(userId ? { userId } : {}), planCode: isDonation ? 'don' : planCode, localId: String(txn._id) },
  },
  idempotencyKey
);

const status: PaymentStatus =
  resp.status === 'SUCCESS' ? 'SUCCESS' : resp.status === 'FAILED' ? 'FAILED' : 'PENDING';

txn.saspayPaymentId = resp.id;
txn.status = status;
txn.checkoutUrl = resp.checkout_url || undefined; // ⚠️ Peut être undefined
txn.instructions = Array.isArray(resp.instructions)
  ? resp.instructions.filter(Boolean).join('\n') || undefined
  : resp.instructions || undefined;
```

**Problème:** Le code sauvegarde la transaction même si `checkout_url` est `undefined`, sans vérifier que pour les réseaux card/crypto, cette URL est **obligatoire**.

---

## 💡 Causes Racines Possibles

### 1. **Montant inférieur au minimum SasPay pour crypto**
SasPay a probablement rejeté la création du checkout crypto car 0,83 USD < minimum requis (souvent 1 USD).

### 2. **Configuration SasPay incomplète**
Les paiements crypto nécessitent peut-être une configuration spéciale dans le dashboard SasPay qui n'est pas activée.

### 3. **Bug/Timeout API SasPay**
L'API SasPay a retourné un Payment ID mais sans générer le checkout complet (inconsistance interne).

### 4. **Absence de validation côté backend**
Le backend accepte et sauvegarde des transactions sans `checkout_url` pour les réseaux qui en ont obligatoirement besoin.

---

## 🛠️ Recommandations et Solutions

### Solution Immédiate (Transaction Actuelle)

La transaction `6af38b2b762a389673375342` ne peut PAS être récupérée car :
- ❌ Aucun checkout URL
- ❌ Payment inexistant côté SasPay
- ❌ Aucun webhook ne viendra

**Action:** Marquer manuellement cette transaction comme `FAILED` :

```bash
# Via MongoDB ou script admin
db.paymenttransactions.updateOne(
  { _id: ObjectId("6af38b2b762a389673375342") },
  { 
    $set: { 
      status: "FAILED",
      lastError: "Checkout URL non généré - montant probablement trop faible pour crypto (0.83 USD < 1 USD minimum)"
    }
  }
)
```

### Solution Préventive (Code Backend)

#### 1. **Ajouter validation du montant minimum**

**Fichier:** `backend/src/modules/payments/payments.service.ts`

```typescript
// Après la ligne 236 (avant l'appel saspaySoftpay)
// Validation spécifique pour crypto/carte
const CRYPTO_MIN_AMOUNT = 1.0; // USD
const CARD_MIN_AMOUNT = 0.5; // USD

if (network === 'crypto' && sendCurrency === 'USD' && amount < CRYPTO_MIN_AMOUNT) {
  throw new PaymentError(
    `Le montant minimum pour les paiements crypto est de ${CRYPTO_MIN_AMOUNT} USD.`,
    400,
    'amount_too_small'
  );
}

if (network === 'card' && sendCurrency === 'USD' && amount < CARD_MIN_AMOUNT) {
  throw new PaymentError(
    `Le montant minimum pour les paiements carte est de ${CARD_MIN_AMOUNT} USD.`,
    400,
    'amount_too_small'
  );
}
```

#### 2. **Validation obligatoire de checkout_url**

```typescript
// Après la ligne 274 (après réception de la réponse SasPay)
// Vérification que checkout_url existe pour les réseaux qui en ont besoin
const needsCheckoutUrl = ['crypto', 'card'].includes(network);

if (needsCheckoutUrl && !resp.checkout_url) {
  txn.status = 'FAILED';
  txn.lastError = `Checkout URL manquante pour le réseau ${network}. ` +
    (amount < 1 ? 'Montant possiblement trop faible.' : 'Erreur SasPay.');
  await txn.save();
  
  throw new PaymentError(
    `Impossible de créer un paiement ${network}. ${amount < 1 ? 'Montant minimum: 1 USD.' : 'Erreur gateway.'}`,
    422,
    'checkout_url_missing'
  );
}
```

#### 3. **Améliorer la récupération des taux minimums depuis SasPay**

```typescript
// Dans getRatesCached(), extraire aussi min_fee_basis_amount
minAmount: Math.max(
  Number(tier?.min_amount ?? 0) || 0,
  Number(tier?.min_fee_basis_amount ?? 0) || 0
),
```

Cette partie est déjà correcte dans votre code actuel (ligne 127-130).

#### 4. **Ajouter logging détaillé**

```typescript
// Après l'appel saspaySoftpay
console.log('[SasPay] Réponse softpay:', {
  id: resp.id,
  status: resp.status,
  hasCheckoutUrl: !!resp.checkout_url,
  hasInstructions: !!resp.instructions,
  network,
  amount,
  currency: sendCurrency
});
```

### Solution UX (Frontend)

#### Afficher clairement les montants minimums

**Fichier:** `src/app/(main)/support/page-content.tsx` (page de don)

```typescript
// Ajouter une alerte si montant trop faible
{donationAmount < 100 && (
  <div className="text-sm text-yellow-600 mt-2">
    ⚠️ Montant minimum pour don crypto: 200 FCFA (~1 USD)
  </div>
)}
```

---

## 📈 Statistiques des Transactions (10 nov 2026)

```
Total transactions: 7

Par statut:
✅ SUCCESS: 1 (14%)
⏳ PENDING: 3 (43%)
❌ FAILED: 3 (43%)

Par réseau:
🔗 crypto: 1 transaction (0.83 USD)
📱 mtn_cm: 6 transactions (XAF/XOF)

Montant total réussi:
💰 XAF: 200.00 (1 transaction)
```

---

## 🎯 Plan d'Action

### Immédiat (Aujourd'hui)
1. ✅ ~~Investigation complète~~ → Terminée
2. ⏳ Marquer la transaction `6af38b2b762a389673375342` comme FAILED
3. ⏳ Implémenter les validations de montant minimum

### Court terme (Cette semaine)
4. ⏳ Ajouter logging détaillé des réponses SasPay
5. ⏳ Tester les paiements crypto avec différents montants
6. ⏳ Vérifier la configuration SasPay pour les paiements crypto

### Moyen terme (Ce mois)
7. ⏳ Améliorer l'UI pour afficher les montants minimums par réseau
8. ⏳ Ajouter un système d'alerting pour les transactions PENDING > 1h
9. ⏳ Documenter les minimums par réseau dans la base de connaissance

---

## 📝 Questions à Poser à SasPay

1. **Quel est le montant minimum pour les paiements crypto en USD?**
2. **Pourquoi un Payment ID est généré sans checkout_url?**
3. **Y a-t-il des configurations spéciales requises pour activer crypto?**
4. **Comment gérer les paiements sous le minimum sans créer de transaction orpheline?**

---

## 🔗 Ressources

- **Dashboard SasPay:** https://app.saspay.me
- **API SasPay Docs:** https://docs.saspay.me
- **Transaction dans la DB:** `6af38b2b762a389673375342`
- **Logs backend:** Vérifier Railway logs autour de `2026-11-10T21:22:51Z`

---

## ✅ Conclusion

Le problème est **identifié et résolu au niveau diagnostic**. La transaction a échoué car :
1. Le montant (0,83 USD) est probablement sous le minimum crypto
2. SasPay n'a pas généré de checkout URL
3. Le backend n'a pas validé l'absence de checkout URL

Les solutions proposées ci-dessus empêcheront ce problème à l'avenir.

---

**Rapport généré le:** 11 novembre 2026  
**Par:** Kiro AI Investigation Tool  
**Statut:** ✅ Investigation complète
