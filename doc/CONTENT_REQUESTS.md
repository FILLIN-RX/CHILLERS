# Module de Demande de Contenus (Content Requests)

Le module de demande de contenu permet aux utilisateurs de soumettre des films ou des séries manquants sur la plateforme CHILLERS, déclenchant automatiquement une recherche profonde multi-sources en Go.

---

## 1. Interface Utilisateur & Contraintes Graphiques

- **Bouton d'Action (`RequestButton`)** :
  - Intégré directement sur les fiches médias (`/media/[slug]` et `/tv/[id]`).
  - Accessible aux utilisateurs pour demander un film ou une saison/épisode d'une série.
- **Modal de Saisie (`RequestModal`)** :
  - **Contrainte stricte** : `border-radius: 2px` (`rounded-[2px]`) sur tous les conteneurs, inputs, badges et boutons.
  - Sélecteur de type (*Film* / *Série*).
  - Sélecteur automatique de Saison & Épisode pour les séries.
  - Feedback d'état en temps réel (*Recherche lancée*, *Succès*, *Erreur*).

---

## 2. Modèle de Données MongoDB (`MediaRequest`)

Fichier : `backend/src/models/MediaRequest.ts`

```typescript
interface IMediaRequest {
  tmdbId?: number;
  title: string;
  type: 'movie' | 'series';
  season?: number;
  episode?: number;
  year?: number;
  posterUrl?: string;
  status: 'pending' | 'searching' | 'fulfilled' | 'not_found';
  requestedBy: Array<{
    userId?: string;
    email?: string;
    requestedAt: Date;
  }>;
  requestCount: number; // Incrémenté si plusieurs utilisateurs demandent le même contenu
  streamSources?: Array<{
    source: string;
    streamUrl: string;
    quality?: string;
    language?: string;
    server?: string;
  }>;
  fulfilledAt?: Date;
  lastSearchAt?: Date;
  searchAttempts: number;
}
```

---

## 3. Déclenchement et Traitement Automatique

1. **Soumission utilisateur** :
   - Requête `POST /api/requests` reçue par Node.js.
   - Si la demande existe déjà : incrémente `requestCount` et ajoute l'utilisateur dans `requestedBy`.
   - Si la demande est nouvelle : crée l'entrée avec `status: 'pending'`.
2. **Appel au microservice Go** :
   - Node.js appelle `POST http://localhost:8095/search`.
   - Go prend en charge la recherche en tâche de fond (`202 Accepted`).
3. **Fulfillment (Webhook)** :
   - Dès que Go trouve un flux valide : envoie un callback à Node.js `POST /api/internal/requests/:id/fulfill`.
   - Node.js met à jour le statut en `fulfilled` et insère automatiquement le flux dans la collection `movies` ou `series`. Le contenu devient **immédiatement visionnable** sur CHILLERS !

---

## 4. Dashboard Administrateur

Accessible sur **`/admin/requests`** :
- Statistiques globales (*Total demandes*, *En attente*, *Trouvés & Liés*, *Non trouvés*).
- Filtres par statut et par type (*Films* / *Séries*).
- Recherche instantanée par titre.
- Bouton **"Relancer Go"** pour forcer un nouveau cycle de recherche parallèle sur un contenu.
