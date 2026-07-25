#!/bin/bash
# setup.sh — Configuration complète du scrapper distant sur Windows (Git Bash/WSL)
# Usage: bash setup.sh

set -e

echo "========================================"
echo "  Chiller Scrapper — Installation"
echo "========================================"

# 1. .env
if [ ! -f .env ]; then
    cp .env.example .env
    echo "[1/5] .env créé depuis .env.example — édite-le avec tes vraies clés !"
else
    echo "[1/5] .env déjà existant, on garde"
fi

# 2. Dépendances
echo "[2/5] Installation des dépendances npm..."
npm install

# 3. Playwright (navigateur pour le scraping)
echo "[3/5] Installation de Chromium (Playwright)..."
npx playwright install chromium

# 4. Build
echo "[4/5] Build TypeScript..."
npm run build

# 5. PM2
echo "[5/5] Lancement avec PM2..."
pm2 start ecosystem.config.cjs --env production
pm2 save

echo ""
echo "========================================"
echo "  ✅ Scrapper installé et démarré !"
echo "========================================"
echo ""
echo "Commandes utiles :"
echo "  pm2 status                  → voir l'état"
echo "  pm2 logs chiller-scraper    → voir les logs"
echo "  pm2 monit                   → monitoring"
echo "  pm2 restart chiller-scraper → redémarrer"
echo "  pm2 stop chiller-scraper    → arrêter"
echo "  pm2 startup                 → démarrage auto au boot Windows"
echo ""
