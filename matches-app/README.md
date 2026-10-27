# CHILLERS Matches & Sports App

Application indépendante de scores et de matchs en direct, intégrée au dépôt
CHILLERS dans `matches-app/`.

## Architecture

```
matches-app/
├── frontend/   # Vue 3 + Vuetify 3 + Vite + Pinia (port 5173)
└── backend/    # Express + TypeScript (port 5050)
```

Le backend matches-app embarque la même chaîne de streaming que l'application
CHILLERS principale, avec sa propre copie locale des modules :

1. **Agrégation** : `liveball`, `kora`, `kooorah`, `yallapro`, `streamiz`.
2. **Dédoublonnage** des affiches et recherche des jumeaux entre providers.
3. **Résolution + probe** : chaque flux est résolu puis testé, le premier
   jouable est servi ; les autres alimentent la liste de secours.
4. **Relay HLS same-origin** : `/api/sports/match/:source/:id/hls/...` relaie
   playlists et segments avec le bon `Referer`. Le CDN distant ne voit que le
   backend, ce qui évite le CORS et les blocages liés au domaine appelant.

Le portage couvre le streaming web multi-providers, les chaînes TV/OHA et
l'EPG. Le backend lit la même base MongoDB que l'application CHILLERS
(`MONGO_URI`) et peut aussi exploiter le snapshot du lab
(`sports-channels-lab/data/report.json`, via `SPORTS_LAB_DIR`).

## Installation

```bash
cd matches-app/backend
npm ci
cp env.example .env

cd ../frontend
npm ci
cp env.example .env
```

## Démarrage

```bash
# Terminal 1 — API matchs + relay HLS (port 5050)
npm run matches:backend

# Terminal 2 — interface Vue (port 5173)
npm run matches:frontend
```

Depuis la racine CHILLERS, `npm run matches:install` installe les deux apps.

## Variables d'environnement

`matches-app/backend/env.example` :

- `SPORTS_MULTI_SERVER` : `0` désactive la collecte multi-serveurs.
- `MONGO_URI` : base Mongo du module Live TV (catalogue OHA + EPG).
- `EPG_FR_URL` : source XMLTV (EPGShare FR1 par défaut).
- `SPORTS_LAB_DIR` : dossier du lab (défaut `../../sports-channels-lab`).
- `SPORTS_CHANNELS_LAB=1` : active les routes `/api/sports/lab/*`.
- `LIVEBALL_DOMAIN`, `LIVEBALL_PROXY`, `WEBSHARE_API_KEY`,
  `FLARESOLVERR_URL` : contournement LiveBall/Cloudflare.
- `KORA_API_BASE`, `KOOORAH_SCHEDULE_URL`, `YALLAPRO_WP_URL`, `STREAMIZ_URL` :
  surcharge des endpoints providers.
- `PORT` : port du backend matches-app (5050 par défaut).

`matches-app/frontend/env.example` :

- `VITE_API_URL` : base de l'API matches-app, suffixe `/api` inclus.

## Endpoints utiles

- `GET /health`
- `GET /api/matches`
- `GET /api/matches/:id`
- `GET /api/matches/:id/summary`
- `GET /api/matches/:id/stream?home=...&away=...` : résolution pour le player Vue.
- `GET /api/streams/:id?home=...&away=...` : même résolution via l’API streams.
- `GET /api/sports/matches` : matchs agrégés de tous les providers.
- `GET /api/sports/match/:source/:id/stream` : résolution d'un flux provider.
- `GET /api/sports/match/:id/stream` : résolution par identifiant composite.
- `GET /api/sports/match/:id/channels` : collecte multi-serveurs.
- `GET /api/sports/match/:source/:id/hls/playlist.m3u8` : relay HLS.
- `GET /api/live/oha/channels` : catalogue OHA (Mongo).
- `GET /api/live/epg` : grille EPG.
- `GET /api/live/match-channels` : chaînes candidates/confirmées pour un match.
- `GET /api/live/oha/resolve` : résolution d'un flux OHA.
- `GET /api/live/embed-proxy` : proxy des players iframe.
- `GET /api/live/proxy` : proxy HLS (playlists + segments).

## Synchronisation OHA / EPG

Le backend expose les scripts de sync (même base Mongo que CHILLERS) :

```bash
npm run sync:oha            # catalogue complet
npm run sync:oha:revalidate # revalidation horaire
npm run sync:oha:epg        # now/next OHA
npm run sync:epg            # grille EPGShare FR1
```

Les workflows GitHub de la racine continuent d'alimenter la base partagée.
