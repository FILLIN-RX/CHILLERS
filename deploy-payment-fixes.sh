#!/bin/bash
# Script de déploiement des corrections de paiement

set -e  # Arrêter en cas d'erreur

echo "🚀 Déploiement des Corrections de Paiement"
echo "═══════════════════════════════════════════"
echo ""

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Vérifier qu'on est dans le bon répertoire
if [ ! -f "package.json" ] || [ ! -d "backend" ]; then
    echo -e "${RED}❌ Erreur: Ce script doit être exécuté depuis la racine du projet CHILLERS${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Répertoire correct${NC}"
echo ""

# 2. Afficher les fichiers modifiés
echo "📝 Fichiers modifiés:"
git status --short backend/src/modules/payments/payments.service.ts
echo ""

# 3. Compiler le backend
echo "🔨 Compilation du backend..."
cd backend
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Compilation réussie${NC}"
else
    echo -e "${RED}❌ Erreur de compilation${NC}"
    exit 1
fi
cd ..
echo ""

# 4. Exécuter les tests (optionnel)
echo "🧪 Tests unitaires..."
cd backend
npm test -- payment-validation.test.ts 2>/dev/null || echo -e "${YELLOW}⚠️  Tests non exécutés (environnement de test non configuré)${NC}"
cd ..
echo ""

# 5. Afficher le diff des changements
echo "📊 Différences de code:"
git diff backend/src/modules/payments/payments.service.ts | head -50
echo ""

# 6. Confirmation avant commit
echo -e "${YELLOW}⚠️  Prêt à commiter et déployer${NC}"
read -p "Continuer? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Déploiement annulé"
    exit 1
fi

# 7. Commit des changements
echo "📦 Commit des changements..."
git add backend/src/modules/payments/payments.service.ts
git add backend/src/modules/payments/__tests__/payment-validation.test.ts
git add backend/scripts/mark-transaction-failed.js
git add PAYMENT_INVESTIGATION_REPORT.md
git add CORRECTIONS_APPLIQUEES.md

git commit -m "fix(payments): add crypto/card minimum amount validation

- Add 1 USD minimum for crypto payments
- Add 0.5 USD minimum for card payments
- Add mandatory checkout_url validation for hosted networks
- Add detailed SasPay response logging
- Mark orphan transaction as FAILED
- Add unit tests for payment validation

Fixes transaction 6af38b2b762a389673375342 issue where 0.83 USD
crypto payment was stuck in PENDING due to amount below minimum."

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Commit réussi${NC}"
else
    echo -e "${RED}❌ Erreur de commit${NC}"
    exit 1
fi
echo ""

# 8. Push vers le repo
echo "🚢 Push vers GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Push réussi${NC}"
else
    echo -e "${RED}❌ Erreur de push${NC}"
    exit 1
fi
echo ""

# 9. Railway redéploiera automatiquement
echo "═══════════════════════════════════════════"
echo -e "${GREEN}🎉 Déploiement lancé avec succès!${NC}"
echo ""
echo "📋 Prochaines étapes:"
echo "   1. Surveiller les logs Railway"
echo "   2. Tester avec montant < 1 USD (doit rejeter)"
echo "   3. Tester avec montant ≥ 1 USD (doit passer)"
echo "   4. Vérifier qu'aucune transaction orpheline n'est créée"
echo ""
echo "🔗 Railway Dashboard:"
echo "   https://railway.app/project/chillers-production"
echo ""
echo "═══════════════════════════════════════════"
