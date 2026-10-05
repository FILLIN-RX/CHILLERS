# 📖 Chillers Sports API - Documentation Complète des Endpoints

Cette documentation détaille l'ensemble des endpoints disponibles sur l'API Chillers Sports (`http://localhost:5050/api`).

---

## 1. 🌍 Pays & Championnats (Phase 1)

### `GET /api/matches/countries`
Retourne la liste des 12 pays et entités sportives configurés avec leur drapeau et le nombre de championnats.
* **Exemple de réponse** :
```json
{
  "success": true,
  "data": [
    { "id": "france", "name": "France", "code": "FR", "flag": "🇫🇷", "leaguesCount": 3 },
    { "id": "england", "name": "Angleterre", "code": "GB-ENG", "flag": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "leaguesCount": 4 },
    { "id": "spain", "name": "Espagne", "code": "ES", "flag": "🇪🇸", "leaguesCount": 3 }
  ],
  "count": 12
}
```

### `GET /api/matches/countries/:countryId/leagues`
Retourne tous les championnats d'un pays précis.
* **Paramètres URL** : `countryId` (ex: `france`, `england`, `spain`, `italy`, etc.)
* **Exemple** : `GET /api/matches/countries/france/leagues`
```json
{
  "success": true,
  "data": [
    { "id": "fra.1", "name": "Ligue 1", "slug": "ligue-1", "flag": "🇫🇷" },
    { "id": "fra.2", "name": "Ligue 2", "slug": "ligue-2", "flag": "🇫🇷" },
    { "id": "fra.coupe_de_france", "name": "Coupe de France", "slug": "coupe-de-france", "flag": "🇫🇷" }
  ]
}
```

### `GET /api/matches/leagues`
Liste l'ensemble des championnats supportés (filtrable avec `?country=`).

---

## 2. ⚽ Matchs & Filtres Temporels (Phase 1)

### `GET /api/matches`
Retourne les matchs filtrés selon plusieurs critères combinables.
* **Paramètres de requête (Query params)** :
  * `country` : Filtre par pays (ex: `france`, `england`). Récupère en parallèle tous les championnats du pays.
  * `league` : ID ou slug du championnat (ex: `eng.1`, `fra.1`, `uefa.champions`, `nba`).
  * `month` : **Mois complet** au format `YYYYMM` ou `YYYY-MM` (ex: `202609` pour ramener tous les matchs de septembre 2026).
  * `season` : Année de saison (ex: `2024`, `2025`, `2026`).
  * `seasontype` : `1` (pré-saison), `2` (saison régulière), `3` (post-saison / playoffs).
  * `date` : Date précise au format `YYYYMMDD` ou `YYYY-MM-DD`.
  * `status` : `live` (en direct), `upcoming` (à venir), `finished` (terminé), ou `all`.
  * `sport` : `football`, `basketball`, ou `all`.
  * `search` : Recherche textuelle par nom d'équipe ou championnat.
  * `limit` : Nombre maximum de résultats.

* **Exemples** :
  * `GET /api/matches?country=france&month=202609`
  * `GET /api/matches?league=eng.1&season=2026&limit=10`
  * `GET /api/matches?status=live`

---

## 3. 🏆 Compétitions, Classements & Saisons (Phase 2)

### `GET /api/competitions/:leagueId`
Retourne les métadonnées de la compétition, les saisons disponibles et le classement actuel.
* **Paramètres URL** : `leagueId` (ex: `eng.1`, `fra.1`, `esp.1`, `nba`).
* **Query** : `?season=2024` (optionnel pour consulter une saison passée).

### `GET /api/competitions/:leagueId/standings`
Retourne le classement officiel complet (Standings).
* **Query** : `?season=2024` (permet de consulter les **archives historiques**).
* **Données incluses par équipe** :
  * `rank` : Position au classement (#1, #2, ...)
  * `team` : ID, nom, logo, abréviation
  * `gamesPlayed` : Matchs joués
  * `wins` : Victoires
  * `ties` : Nuls
  * `losses` : Défaites
  * `points` : Points au classement
  * `goalsFor` / `goalsAgainst` : Buts marqués / encaissés
  * `goalDifference` : Différence de buts
  * `note` : Qualification européenne ou relégation

### `GET /api/competitions/:leagueId/seasons`
Retourne la liste des saisons disponibles pour ce championnat (jusqu'à 25 saisons d'historique).
* **Exemple** : `GET /api/competitions/eng.1/seasons`
```json
[
  { "year": 2026, "displayName": "2026-2027", "isCurrent": true },
  { "year": 2025, "displayName": "2025-2026", "isCurrent": false },
  { "year": 2024, "displayName": "2024-2025", "isCurrent": false }
]
```

### `GET /api/competitions/:leagueId/matches`
Retourne le calendrier des matchs de la compétition (filtrable par `?month=`, `?season=`, `?date=`).

---

## 4. 📊 Analyse Complète d'un Match (Phase 3)

### `GET /api/matches/:id/analysis`
Retourne le dossier d'analyse complet d'un match individuel.
* **Paramètres** : `id` (ID du match ESPN) et optionnellement `?league=eng.1`.
* **Données retournées** :
  * **Score & Statut** : Score en direct, mi-temps, temps additionnel, statut.
  * **Probabilité de Victoire (`currentWinProbability`)** : `% Domicile`, `% Nul`, `% Extérieur`.
  * **Courbe d'évolution temporelle (`winProbabilityTimeline`)** : Historique play-by-play de la probabilité à chaque minute/action (ex: 500+ points en NBA).
  * **Cotes des bookmakers (`odds`)** : DraftKings Moneyline, Spread (handicap), Over/Under.
  * **Face-à-Face Historique (`headToHead`)** : Dernières confrontations directes entre les 2 clubs avec scores, dates et compétitions.
  * **Forme Récente (`recentForm`)** : 5 derniers matchs de chaque équipe avec résultats (V/N/D).
  * **Statistiques Comparatives (`boxscore`)** : Possession, tirs totaux, cadrés, corners, fautes, arrêts de gardien.
  * **Chronologie des Actions (`keyEvents`)** : Buts (buteur et passeur), cartons jaunes/rouges, remplacements.
  * **Commentaires Live (`commentary`)** : Fil textuel minute par minute.
  * **Stade & Arbitre (`venue`)** : Nom du stade, ville, affluence réelle et arbitre principal.

---

## 5. 👥 Équipes & Joueurs (Phase 4)

### `GET /api/competitions/:leagueId/teams`
Retourne toutes les équipes engagées dans la compétition avec logos et couleurs officielles.

### `GET /api/competitions/:leagueId/leaders`
Retourne les **Top Buteurs** et **Top Passeurs Décisifs** de la compétition avec photos officielles, clubs et classements.

### `GET /api/teams/:teamId`
Fiche détaillée d'un club : stade, capacité, ville, couleurs officielles, bilan.

### `GET /api/teams/:teamId/roster`
**Effectif complet d'un club groupé par poste** :
* Gardiens (`Goalkeeper`)
* Défenseurs (`Defender`)
* Milieux (`Midfielder`)
* Attaquants (`Forward`)
* Chaque joueur inclut : photo HD, numéro de maillot, nationalité, drapeau, et **statistiques de saison** (buts, passes, apparitions, tirs, cartons).

### `GET /api/players/:playerId`
Fiche individuelle d'un joueur :
* Bio : Nom, âge, date de naissance, nationalité, drapeau, taille, poids, poste.
* Équipe actuelle (nom, logo).
* Photo officielle haute résolution.
* Résumé statistique de sa saison (matchs, titularisations, buts, passes, tirs).

---

## 6. ⚡ Temps Réel & Server-Sent Events (SSE)

### `GET /api/matches/live/sse`
Flux temps réel unidirectionnel haute performance basé sur le protocole standard **Server-Sent Events** (`text/event-stream`).
* **Paramètres de requête optionnels** :
  * `matchId` : Si fourni, le flux se focalise sur les événements et mises à jour spécifiques à ce match. Si omis, le flux envoie les scores de l'ensemble des matchs en direct.
* **Comportement & Optimisation** :
  * Envoi d'un heartbeat ping (`: keep-alive\n\n`) toutes les 15 secondes pour maintenir la connexion active à travers les proxys.
  * Polling intelligent en arrière-plan (intervalle 8s) activé **uniquement** quand au moins un client est connecté (mise en veille automatique à 0 client).
  * Auto-reconnexion transparente côté client.
* **Événements émis (`event: ...`)** :
  * `connected` : Confirmation de la connexion avec identifiant client.
  * `init` : Snapshot initial des matchs ou du match suivi.
  * `live-scores` : Liste actualisée des matchs en direct toutes les 8 secondes.
  * `goal` : Émis instantanément lors d'une détection de but (titre du match, équipe, minute, nouveau score).
  * `match-update` : Émis lors d'un changement de minute, de statut ou de score d'un match.
  * `match-summary` : Détail complet du match et des actions play-by-play.

### `POST /api/matches/live/sse/test-goal`
Déclenche immédiatement un événement de but simulé sur le flux SSE (utilisé pour les tests et démonstrations).
* **Body (JSON)** : `{ "matchId": "401883191" }` (optionnel)

