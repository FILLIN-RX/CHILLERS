# 🔍 Améliorations de la Recherche CHILLERS

## Problème Identifié
Lors de la recherche de "Game of Thrones", plusieurs variantes apparaissaient :
- Game of Thrones (Série originale)
- Game of Thrones (différentes saisons)
- Game of Thrones: Conquest & Rebellion
- Game of Thrones: The Last Watch
- etc.

**Comportement attendu** : Comme sur OpenOtaku, seul le résultat le plus pertinent devrait s'afficher.

## Solution Implémentée

### 🎯 Backend (`search.service.ts`)

#### 1. **Normalisation des Titres**
```typescript
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/^(the|le|la|les|un|une|des)\s+/i, '') // Retire articles
    .replace(/[^\w\s]/g, '') // Retire ponctuation
    .replace(/\s+/g, ' ') // Normalise espaces
    .trim();
}
```

**Exemples** :
- `"Game of Thrones"` → `"game of thrones"`
- `"The Walking Dead"` → `"walking dead"`
- `"Le Seigneur des Anneaux"` → `"seigneur des anneaux"`

#### 2. **Scoring de Pertinence**
```typescript
function calculateRelevanceScore(query, result, mediaType): number {
  let score = 0;

  // Correspondance exacte = 100 points
  if (normalizedTitle === normalizedQuery) score += 100;
  
  // Commence par la requête = 50 points
  else if (normalizedTitle.startsWith(normalizedQuery)) score += 50;
  
  // Contient la requête = 25 points
  else if (normalizedTitle.includes(normalizedQuery)) score += 25;

  // Bonus popularité (max 30 points)
  score += (voteAverage / 10) * 20;  // Max 20 points
  score += Math.min(voteCount / 100, 10);  // Max 10 points

  // Bonus année récente (max 10 points)
  if (year >= 2020) score += 10;
  else if (year >= 2010) score += 5;

  return score;
}
```

**Exemple de Scoring pour "Game of Thrones"** :
| Titre | Exacte | Popularité | Année | **Total** |
|-------|--------|------------|-------|-----------|
| Game of Thrones (série) | 100 | 30 | 10 | **140** |
| Game of Thrones: The Last Watch | 25 | 15 | 10 | **50** |
| Game of Thrones: Conquest | 25 | 10 | 10 | **45** |

→ La série originale a le score le plus élevé et apparaît en premier.

#### 3. **Déduplication Intelligente**
```typescript
function deduplicateResults(results: any[], query: string): any[] {
  const seen = new Map<string, any>();

  for (const result of results) {
    const normalized = normalizeTitle(title);
    const score = calculateRelevanceScore(query, result, mediaType);

    // Garde seulement le meilleur score par titre normalisé
    if (!seen.has(normalized) || score > seen.get(normalized).score) {
      seen.set(normalized, { ...result, score });
    }
  }

  return Array.from(seen.values())
    .sort((a, b) => b.score - a.score) // Trie par pertinence
    .slice(0, 15); // Limite à 15 résultats
}
```

**Comportement** :
- Tous les résultats avec le même titre normalisé sont regroupés
- Seul celui avec le meilleur score est conservé
- Les résultats sont triés par pertinence décroissante
- Maximum 15 résultats retournés

### 📱 Mobile (`search_service.dart`)

#### Améliorations Appliquées
```dart
Future<List<MediaItem>> _performSearch(String query) async {
  final response = await _apiService.searchMedia(query);

  // Déduplique par ID ET titre normalisé
  final seen = <String>{};
  final seenTitles = <String>{};
  final dedupedResults = <MediaItem>[];

  for (final item in response) {
    final normalizedTitle = item.title.toLowerCase().trim();
    
    if (!seen.contains(item.id) && !seenTitles.contains(normalizedTitle)) {
      seen.add(item.id);
      seenTitles.add(normalizedTitle);
      dedupedResults.add(item);
    }
  }

  // Tri intelligent
  dedupedResults.sort((a, b) {
    // 1. Correspondance exacte en premier
    final queryLower = query.toLowerCase().trim();
    final aExact = a.title.toLowerCase().trim() == queryLower ? 1 : 0;
    final bExact = b.title.toLowerCase().trim() == queryLower ? 1 : 0;
    if (aExact != bExact) return bExact - aExact;
    
    // 2. Priorité par type (movie > serie > anime)
    const priority = {'movie': 0, 'serie': 1, 'anime': 2};
    final typeDiff = (priority[a.type] ?? 999).compareTo(priority[b.type] ?? 999);
    if (typeDiff != 0) return typeDiff;
    
    // 3. Note la plus élevée
    final aRating = double.tryParse(a.rating ?? '0') ?? 0;
    final bRating = double.tryParse(b.rating ?? '0') ?? 0;
    return bRating.compareTo(aRating);
  });

  return dedupedResults;
}
```

### 🌐 Frontend Web

Le frontend web utilise directement le backend `/search` qui implémente la déduplication.
Aucune modification nécessaire car le backend fait déjà le travail.

## 📊 Résultats Attendus

### Avant
**Recherche "Game of Thrones"** → 8+ résultats :
1. Game of Thrones (Série)
2. Game of Thrones (Même série, ID différent)
3. Game of Thrones: The Last Watch
4. Game of Thrones: Conquest & Rebellion
5. Game of Thrones Saison 1
6. ...

### Après
**Recherche "Game of Thrones"** → 1 résultat principal :
1. Game of Thrones (Série originale - Score: 140)
2. (Éventuellement des dérivés si vraiment différents)

## 🎯 Avantages

### 1. **Pertinence Améliorée**
- Les résultats les plus pertinents apparaissent en premier
- Pas de confusion avec des variantes ou spin-offs

### 2. **Expérience Utilisateur**
- Interface plus claire et épurée
- Recherche rapide du contenu désiré
- Moins de scrolling nécessaire

### 3. **Performance**
- Moins de résultats à afficher
- Cache plus efficace
- Bande passante réduite

### 4. **Intelligence**
- Prend en compte la popularité
- Favorise les contenus récents
- Correspondance exacte prioritaire

## 🔧 Configuration

### Paramètres Ajustables

Dans `search.service.ts` :

```typescript
// Nombre de résultats à récupérer avant filtrage
const movieTop = moviesResp.results.slice(0, 20); // Ajustable
const tvTop = tvResp.results.slice(0, 20);

// Nombre de résultats après déduplication
const tmdbResults = {
  results: deduplicatedResults.slice(0, 15), // Ajustable
};

// Poids du scoring
score += (voteAverage / 10) * 20;  // Poids popularité
score += Math.min(voteCount / 100, 10);  // Poids vote count
```

## 🧪 Tests Recommandés

### Cas de Test
1. **"Game of Thrones"** → Doit retourner la série principale
2. **"Harry Potter"** → Doit retourner les films dans l'ordre de pertinence
3. **"Naruto"** → Doit retourner l'anime principal (pas Naruto Shippuden en premier si on cherche juste "Naruto")
4. **"Breaking Bad"** → Doit retourner la série, pas "El Camino" en premier
5. **"The Walking Dead"** → Série principale, pas les spin-offs

### Vérifications
- [ ] Pas de doublons visuels dans les résultats
- [ ] Le résultat le plus pertinent est en première position
- [ ] Les spin-offs/dérivés n'écrasent pas le contenu principal
- [ ] La recherche reste rapide (< 1s)
- [ ] Les résultats sont cohérents entre mobile et web

## 📝 Notes Techniques

### Limites du Système
- Fonctionne uniquement sur les titres (pas sur les descriptions)
- Ne détecte pas les fautes d'orthographe (pourrait être amélioré avec Levenshtein distance)
- Les articles ("The", "Le", "La") sont retirés pour la normalisation

### Améliorations Futures Possibles
1. **Recherche floue** : Tolérance aux fautes de frappe
2. **Synonymes** : "TV Show" = "Série"
3. **Multi-langue** : Correspondance entre titres FR/EN
4. **Historique** : Prioriser les contenus déjà recherchés
5. **ML** : Apprentissage des préférences utilisateur

## ✅ Status

**Backend** : ✅ Implémenté
**Mobile** : ✅ Implémenté  
**Web** : ✅ Utilise le backend (rien à faire)
**Tests** : ⏳ À effectuer en production

---

**Dernière Mise à Jour** : 2025-01-17
**Auteur** : CHILLERS Dev Team
**Version** : 2.0 (Smart Search)
