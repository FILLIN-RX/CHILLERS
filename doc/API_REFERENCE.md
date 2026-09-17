# Référence des API — CHILLERS & Searcher

Ce document référence l'ensemble des endpoints HTTP du backend Node.js et du microservice Go pour le module de demandes de contenus et de recherche.

---

## 1. Endpoints du Microservice Go (`:8095`)

### `GET /health`
Vérification de l'état du microservice.

**Réponse (200 OK) :**
```json
{
  "service": "chillers-searcher",
  "status": "ok",
  "uptime": "15m42s",
  "time": "2026-09-17T16:10:24Z"
}
```

---

### `POST /search`
Lance une recherche parallèle sur l'ensemble des providers de scraping.

**Headers :**
- `Content-Type: application/json`

**Body :**
```json
{
  "requestId": "66e9...",
  "tmdbId": 27205,
  "title": "Inception",
  "type": "movie",
  "season": 1,
  "episode": 1,
  "year": 2010,
  "callbackUrl": "http://localhost:4000/api/internal/requests/66e9.../fulfill"
}
```

**Réponse immédiate (202 Accepted) :**
```json
{
  "jobId": "4ce2a6cff3f7183a",
  "requestId": "66e9...",
  "status": "searching",
  "message": "Search job started in background"
}
```

---

### `GET /jobs/:id`
Récupère l'état et le résultat d'un job de recherche.

**Réponse (200 OK) :**
```json
{
  "id": "4ce2a6cff3f7183a",
  "status": "completed",
  "result": {
    "requestId": "66e9...",
    "tmdbId": 27205,
    "type": "movie",
    "found": true,
    "sources": [
      {
        "source": "frenchstream",
        "streamUrl": "https://vidzy.cc/embed-x4cv98nvuw0k.html",
        "quality": "HD",
        "language": "TRUEFRENCH",
        "server": "vidzy"
      }
    ],
    "durationMs": 2251,
    "completedAt": "2026-09-17T16:11:04Z"
  }
}
```

---

## 2. Endpoints du Backend Node.js (`:4000`)

### `POST /api/requests`
Soumet une demande de contenu (authentification requise).

**Headers :**
- `Authorization: Bearer <jwt_token>`
- `Content-Type: application/json`

**Body :**
```json
{
  "title": "Inception",
  "type": "movie",
  "tmdbId": 27205,
  "year": 2010,
  "posterUrl": "https://image.tmdb.org/t/p/w500/..."
}
```

**Réponse (201 Created) :**
```json
{
  "success": true,
  "data": {
    "_id": "66e9...",
    "title": "Inception",
    "type": "movie",
    "status": "searching",
    "requestCount": 1
  },
  "message": "Demande enregistrée avec succès. La recherche automatique a été lancée."
}
```

---

### `GET /api/requests/me`
Récupère les demandes soumises par l'utilisateur connecté.

**Headers :**
- `Authorization: Bearer <jwt_token>`

**Réponse (200 OK) :**
```json
{
  "success": true,
  "data": [
    {
      "_id": "66e9...",
      "title": "Inception",
      "type": "movie",
      "status": "fulfilled",
      "createdAt": "2026-09-17T16:10:00Z"
    }
  ]
}
```

---

### `POST /api/internal/requests/:id/fulfill`
Callback interne appelé par le microservice Go lorsque la recherche est terminée.

**Body :**
```json
{
  "requestId": "66e9...",
  "found": true,
  "sources": [
    {
      "source": "frenchstream",
      "streamUrl": "https://vidzy.cc/embed-...",
      "quality": "1080p",
      "language": "VF"
    }
  ],
  "durationMs": 2250
}
```

---

### `GET /api/admin/requests/admin`
Récupère la liste des demandes pour le dashboard d'administration (authentification admin requise).

**Query Params :**
- `status` : `all` | `pending` | `searching` | `fulfilled` | `not_found`
- `type` : `all` | `movie` | `series`
- `search` : string
- `page` : number
- `limit` : number

---

### `POST /api/admin/requests/admin/:id/retry`
Relance manuellement la recherche Go pour une demande spécifique.
