# CHILLERS Matches & Sports App ⚽🏀

Application indépendante de scores et matchs en direct, séparée du backend et frontend principal de Chillers.

## 📁 Architecture du projet

```
matches-app/
├── frontend/             # Application Vue 3 + Vuetify 3 + Vite + Pinia
│   ├── src/
│   │   ├── components/   # CalendarStrip, HeroMatchCard, MatchRow, TeamLogo
│   │   ├── plugins/      # Configuration Vuetify 3 (Dark Theme Apple/Chillers)
│   │   ├── router/       # Vue Router (Liste des matchs & Détails du match)
│   │   ├── services/     # Client API Axios connecté au backend
│   │   ├── stores/       # Store Pinia (Filtres, Favoris, Matchs)
│   │   ├── types/        # Interfaces TypeScript
│   │   └── views/        # MatchesView.vue, MatchDetailView.vue
│   └── package.json
│
├── backend/              # API REST standalone Node.js / Express + TypeScript
│   ├── src/
│   │   ├── matches/      # Controller, Service, Routes, Types
│   │   └── index.ts      # Serveur Express sur le port 5050
│   └── package.json
│
└── scraper/              # (Recommandé) Microservice de scraping de flux en Python
```

---

## 🚀 Démarrage rapide

### 1. Démarrer le Backend des Matchs (Port 5050)
```bash
cd matches-app/backend
npm run dev
```
Endpoints disponibles :
- `GET http://localhost:5050/api/matches` (Liste avec filtres `date`, `league`, `sport`, `status`)
- `GET http://localhost:5050/api/matches/leagues` (Liste des championnats majeurs)
- `GET http://localhost:5050/api/matches/:id` (Détail d'un match)
- `GET http://localhost:5050/api/matches/:id/summary` (Boxscore, Compositions & Événements)
- `GET http://localhost:5050/health` (Healthcheck)

### 2. Démarrer le Frontend Vue.js + Vuetify (Port 5173)
```bash
cd matches-app/frontend
npm run dev
```
Accès navigateur : `http://localhost:5173`

---

## 💡 Conseil Architecture : Node.js vs Python pour le Scraping des Flux

Tu as demandé si Node.js est le meilleur choix et si le scraping des flux doit être un module à part en Python :

### **Recommandation optimale : Architecture Microservices Hybride**
1. **API Centrale des Matchs (Node.js / Express TypeScript) :**
   - **Pourquoi Node.js ?** Idéal pour servir l'API REST temps réel aux clients Vue.js, gérer le polling, le cache LRU (30s) et les requêtes asynchrones rapides vers ESPN Scoreboard. Partage les mêmes types TypeScript avec le frontend.
2. **Scraper / Extracteur de Flux Vidéo (Python) :**
   - **Pourquoi Python à part entière ?** Python est de loin la meilleure technologie pour le scraping lourd de flux vidéo de streaming (Playwright/Selenium pour contourner Cloudflare, `yt-dlp` pour extraire les playlists m3u8 directes, `BeautifulSoup`).
   - **Comment les lier ?** Le microservice Python tourne en tâche de fond (ou sur un port dédié comme 8000 via FastAPI), et ton backend Node.js l'interroge pour récupérer l'URL m3u8 fraîche dès qu'un utilisateur clique sur "Regarder en direct".
