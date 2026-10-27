# Matches App — Frontend

Interface Vue 3 + Vuetify 3 + Vite + Pinia pour les scores et le streaming.

```bash
npm ci
cp env.example .env
npm run dev
```

`VITE_API_URL` doit pointer vers le backend matches-app, suffixe `/api`
inclus (`http://localhost:5050/api` par défaut).

Voir `../README.md` pour l'architecture, le proxy HLS CHILLERS et les variables
d'environnement.
