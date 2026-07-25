#!/bin/bash
# Installe le service systemd pour démarrer automatiquement au boot
# Usage: sudo bash install-service.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_FILE="/etc/systemd/system/chiller-scraper.service"
CURRENT_USER="$(whoami)"

echo "Installation du service Chiller Scraper..."
echo "  Dossier: $SCRIPT_DIR"
echo "  Utilisateur: $CURRENT_USER"

# Build si dist/ n'existe pas
if [ ! -d "$SCRIPT_DIR/dist" ]; then
    echo "Build en cours..."
    cd "$SCRIPT_DIR"
    npm install
    npx playwright install chromium
    npm run build
fi

# Créer le service avec les bons chemins
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Chiller Scraper Service
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$SCRIPT_DIR
ExecStart=/usr/bin/node $SCRIPT_DIR/dist/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=$SCRIPT_DIR/.env
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Activer et démarrer
systemctl daemon-reload
systemctl enable chiller-scraper
systemctl start chiller-scraper

echo ""
echo "✅ Service installé et démarré!"
echo ""
echo "Commandes utiles:"
echo "  sudo systemctl status chiller-scraper   # voir l'état"
echo "  sudo systemctl restart chiller-scraper   # redémarrer"
echo "  sudo journalctl -u chiller-scraper -f    # voir les logs"
echo "  sudo systemctl stop chiller-scraper      # arrêter"
