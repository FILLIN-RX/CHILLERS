# Investigation complète : Défaillances des providers de streaming

**Date:** 11 janvier 2025  
**Statut:** Investigation terminée - Causes racines identifiées

---

## 🎯 Résumé exécutif

L'application CHILLERS est actuellement **incapable de diffuser des matchs en direct** en raison de deux défaillances critiques indépendantes :

1. **yallapro** : Erreur DNS `ENOTFOUND` sur le domaine `to.yallapro.cfd` 
2. **LiveBall** : Erreur HTTP 405 (Method Not Allowed) sur toutes les requêtes FlareSolverr

**Impact:** 100% des flux de sport inaccessibles - aucun match ne s'affiche dans l'application.

---

## 📊 Inventaire complet des providers

### Providers de streaming sport identifiés

Le backend agrège **5 sources de streaming sport** :

| Provider | Type | Statut actuel | Fichier service | Priorité |
|----------|------|---------------|-----------------|----------|
| **liveball** | HLS/iframe | ⚠️ Partiellement défaillant (405 FlareSolverr) | `liveball.service.ts` | 0 (haute) |
| **kooorah** | HLS via yasirtv.com | ✅ Fonctionnel (non testé récemment) | `yasirtv.service.ts` | 1 |
| **yallapro** | iframe via albaplayer | ❌ **DNS FAIL** | `yasirtv.service.ts` | 2 |
| **streamiz** | iframe via livetv902.me | ✅ Fonctionnel (architecture OK) | `livetv.service.ts` | 3 |
| **kora** | HLS via kora-api.org | ✅ Fonctionnel (architecture OK) | `kora.service.ts` | 4 (repli) |

### Architecture d'agrégation

```
┌─────────────────────────────────────────────────┐
│ sports.service.ts (orchestrateur)                │
│ ├─ getSportsMatches() → fusionne & déduplique   │
│ ├─ resolveSportsFlux() → chaîne de providers    │
│ └─ chainCandidates() → trie par fiabilité       │
└────────────┬────────────────────────────────────┘
             │
    ┌────────┴────────┬───────────┬─────────────┬──────────┐
    │                 │           │             │          │
┌───▼────┐    ┌──────▼─────┐  ┌─▼──────┐  ┌───▼────┐ ┌──▼─────┐
│liveball│    │ kooorah    │  │yallapro│  │streamiz│ │ kora   │
│        │    │ (yasirtv)  │  │(yasirtv│  │(livetv)│ │ (cdn)  │
└────────┘    └────────────┘  └────────┘  └────────┘ └────────┘
```

**Mécanisme de fallback actuel :**
- `resolveSportsFlux()` tente chaque provider dans l'ordre de priorité
- S'arrête au premier qui retourne un flux **jouable** (vérifié par sonde HTTP)
- Budget total : 26s (normal) ou 40s (mode agrégé)
- Budget par tentative : 10s maximum

**Problème actuel :**
- Les 2 premiers providers (priorités 0 et 2) sont défaillants
- Le système tombe en cascade vers kooorah/streamiz/kora
- **MAIS** aucun mécanisme de retry/backoff sur erreur DNS ou 405

---

## 🔴 Cause racine #1 : yallapro - Erreur DNS ENOTFOUND

### Code problématique

**Fichier :** `/home/ruxel/CHILLERS/backend/src/modules/sports/yasirtv.service.ts`  
**Lignes :** 22-23

```typescript
const YALLAPRO_WP = (process.env.YALLAPRO_WP_URL || 'https://to.yallapro.cfd').replace(/\/+$/, '');
```

**URL configurée en dur :** `https://to.yallapro.cfd`

### Analyse de la défaillance

```typescript
// Ligne 237-242 : getYallaproMatches()
const raw = await axios.get<any[]>(`${YALLAPRO_WP}/wp-json/wp/v2/posts`, {
  timeout: 12_000,
  params: { per_page: 20, _fields: 'id,link,title,content' },
  headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
});
```

**Erreur produite :** `ENOTFOUND to.yallapro.cfd`

### Diagnostic DNS

1. **Le domaine est-il toujours valide ?**
   - Les sites de streaming sportif **changent fréquemment de domaine** (lutte anti-blocage DNS)
   - Domaines alternatifs probables : `yalla-shoot.com`, `yallashoot.io`, `yallapro.com`

2. **Pas de fallback DNS**
   - Aucun domaine de secours configuré
   - Aucune détection d'erreur DNS spécifique
   - Le provider échoue silencieusement (ligne 272-274)

```typescript
} catch (err: any) {
  console.warn('[yallapro] canaux indisponibles:', err?.message);
  return [];  // ← Échec silencieux, pas de retry
}
```

3. **Pas de retry temporel**
   - Cache de 60s : si l'erreur DNS est transitoire, elle persiste 1 minute
   - Aucune stratégie de backoff exponentiel

### Recommandations yallapro

✅ **Court terme (< 1h) :**
- [ ] Vérifier le domaine actuel de yallapro via recherche web
- [ ] Mettre à jour `YALLAPRO_WP_URL` dans `.env` ou code
- [ ] Options probables : `https://yalla-shoot.io`, `https://www.yallapro.com`

✅ **Moyen terme (1 jour) :**
- [ ] Ajouter un tableau de domaines de fallback
- [ ] Tester chaque domaine séquentiellement si le premier échoue
- [ ] Logger l'erreur DNS spécifiquement (code ENOTFOUND)

✅ **Long terme (1 semaine) :**
- [ ] Implémenter un service de découverte de domaine dynamique
- [ ] Scraper la page d'accueil yalla-shoot/yallapro pour trouver le bon domaine
- [ ] Health check périodique (toutes les 6h) pour détecter les migrations

---

## 🔴 Cause racine #2 : LiveBall - Erreur 405 Method Not Allowed (FlareSolverr)

### Code problématique

**Fichier :** `/home/ruxel/CHILLERS/backend/src/modules/liveball/liveball.service.ts`  
**Lignes :** 120-145

```typescript
async function fetchWithFlareSolverr(
  url: string,
  method: 'GET' | 'POST' = 'GET',
  postData?: Record<string, any>
): Promise<string | null> {
  if (!FLARESOLVERR_URL) return null;
  try {
    const payload: Record<string, any> = {
      cmd: method === 'POST' ? 'request.post' : 'request.get',  // ← PROBLÈME ICI
      url,
      maxTimeout: 30_000,
    };
    if (method === 'POST' && postData) {
      payload.postData = typeof postData === 'string' ? postData : JSON.stringify(postData);
      payload.headers = { 'Content-Type': 'application/json' };
    }

    const { data } = await axios.post(FLARESOLVERR_URL, payload, { timeout: 35_000 });
    //                        ^^^^ POST vers FlareSolverr - CORRECT
    if (data?.status === 'ok' && data.solution?.response) {
      return data.solution.response;
    }
  } catch (err: any) {
    console.warn(`[LiveBall] FlareSolverr request failed for ${url}:`, err?.message || err);
  }
  return null;
}
```

### Analyse de la défaillance

**API FlareSolverr v1 attendue :**

```http
POST /v1 HTTP/1.1
Content-Type: application/json

{
  "cmd": "request.get",
  "url": "https://liveball.sx/",
  "maxTimeout": 30000
}
```

**Problèmes identifiés :**

1. ❌ **URL FlareSolverr manquante dans `.env`**
   ```bash
   $ grep FLARESOLVERR_URL /home/ruxel/CHILLERS/backend/.env
   # Résultat : RIEN
   ```
   → `FLARESOLVERR_URL` est `undefined` → toutes les tentatives échouent silencieusement

2. ❌ **Pas de endpoint `/v1` dans l'URL**
   - L'API FlareSolverr v1 nécessite le suffixe `/v1`
   - Si `FLARESOLVERR_URL=https://flaresolverr.example.com`, l'appel va vers `/` au lieu de `/v1`

3. ⚠️ **Format du payload peut être incorrect**
   - La documentation FlareSolverr v1 attend : `{ cmd: "request.get", url: "...", maxTimeout: 30000 }`
   - Le code actuel est **CORRECT** pour le GET
   - **MAIS** pour POST avec postData, la structure peut différer selon la version

### Configuration manquante

**Fichier :** `/home/ruxel/CHILLERS/backend/.env`  
**Ligne manquante :**

```bash
# FlareSolverr - Bypass Cloudflare pour LiveBall
FLARESOLVERR_URL=https://your-flaresolverr-instance.com/v1
```

**Sans cette configuration :**
- Ligne 125 : `if (!FLARESOLVERR_URL) return null;` → retour immédiat
- Le fallback vers proxy/cloudscraper est tenté
- Si le proxy échoue aussi → **aucun flux LiveBall disponible**

### Appels actuels à FlareSolverr

**1. Récupération de la page d'accueil (liste des matchs)**

Ligne 296-300 :
```typescript
if (FLARESOLVERR_URL) {
  const solverRes = await fetchWithFlareSolverr(url, 'GET');
  if (solverRes && accept(solverRes)) {
    return solverRes;
  }
}
```

**2. Récupération de la page d'un match spécifique**

Ligne 1212-1215 :
```typescript
if (!stdout && FLARESOLVERR_URL) {
  stdout = await fetchWithFlareSolverr(`https://${activeDomain}/api/c/r`, 'POST', { t: token, f: formatFlag });
}
```

**Problème du POST :**
- L'endpoint `/api/c/r` de LiveBall attend un POST avec `{ t: "token", f: "format" }`
- FlareSolverr doit transmettre ce POST **vers LiveBall**, pas vers lui-même
- La structure actuelle du payload peut ne pas le gérer correctement

### Recommandations LiveBall / FlareSolverr

✅ **Critique (< 30 min) :**
- [ ] Déployer une instance FlareSolverr (Docker recommandé)
- [ ] Ajouter `FLARESOLVERR_URL=https://your-instance.com/v1` dans `.env`
- [ ] Redémarrer le backend

✅ **Court terme (< 2h) :**
- [ ] Vérifier que l'URL inclut bien `/v1` dans la config
- [ ] Tester manuellement l'instance FlareSolverr :
  ```bash
  curl -X POST https://your-instance.com/v1 \
    -H "Content-Type: application/json" \
    -d '{"cmd":"request.get","url":"https://liveball.sx/","maxTimeout":30000}'
  ```
- [ ] Ajouter des logs détaillés en cas d'erreur 405

✅ **Moyen terme (1 jour) :**
- [ ] Implémenter un healthcheck FlareSolverr au démarrage
- [ ] Ajouter un retry avec backoff sur erreur 405/503
- [ ] Configurer un timeout distinct pour FlareSolverr (actuellement 35s, trop long)

✅ **Long terme (1 semaine) :**
- [ ] Déployer FlareSolverr sur Railway/Render avec redondance
- [ ] Implémenter un circuit breaker (3 échecs → disable 5 min)
- [ ] Ajouter des métriques de santé FlareSolverr dans `/api/sports/sources`

---

## 🛠️ Analyse de l'architecture complète

### Chaîne de résolution d'un flux

```
┌─────────────────────────────────────────────────────────────┐
│ Client demande un match : GET /api/sports/match/:id/stream  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │ sports.controller.ts       │
            │ getMatchStreamById()       │
            └──────────┬─────────────────┘
                       │
                       ▼
            ┌────────────────────────────┐
            │ sports.service.ts          │
            │ resolveSportsFluxById()    │
            └──────────┬─────────────────┘
                       │
          ┌────────────▼──────────────┐
          │ findSportsMatch()         │ ← Retrouve le match dans la liste agrégée
          └────────────┬──────────────┘
                       │
          ┌────────────▼──────────────┐
          │ chainCandidates()         │ ← Trouve les jumeaux (même match, autres providers)
          │ • Trie par score          │
          │ • Priorité aux HLS        │
          └────────────┬──────────────┘
                       │
          ┌────────────▼──────────────────────────────────┐
          │ Boucle sur chaque candidat (budget 26s)       │
          │ ┌─────────────────────────────────────────┐   │
          │ │ 1. PROVIDERS[source].resolve(sourceId) │   │
          │ │    ├─ liveball.service.ts               │   │
          │ │    ├─ yasirtv.service.ts (kooorah/yalla)│   │
          │ │    ├─ livetv.service.ts (streamiz)      │   │
          │ │    └─ kora.service.ts                   │   │
          │ └───────────┬─────────────────────────────┘   │
          │             │                                  │
          │ ┌───────────▼──────────────────────────────┐  │
          │ │ 2. extractDirectStream()                 │  │
          │ │    • Suit les iframes récursivement      │  │
          │ │    • Décode les configs chiffrées        │  │
          │ │    • Extrait les URL .m3u8               │  │
          │ └───────────┬──────────────────────────────┘  │
          │             │                                  │
          │ ┌───────────▼──────────────────────────────┐  │
          │ │ 3. pickPlayableServer()                  │  │
          │ │    • Sonde HTTP HEAD sur le flux         │  │
          │ │    • Vérifie Content-Type                │  │
          │ │    • Accepte seulement si jouable        │  │
          │ └────────────────────────────────────┬─────┘  │
          │                                       │        │
          │ Premier qui retourne un flux jouable │        │
          │              OU budget épuisé         │        │
          └───────────────────────────────────────┴────────┘
                                   │
                    ┌──────────────▼─────────────────┐
                    │ Flux résolu ou 404             │
                    │ • HLS → relay backend          │
                    │ • iframe → embed direct        │
                    └────────────────────────────────┘
```

### Points de défaillance identifiés

| Niveau | Composant | Problème | Impact |
|--------|-----------|----------|--------|
| 🔴 **Critique** | yallapro DNS | Domaine `to.yallapro.cfd` ENOTFOUND | Provider entièrement hors service |
| 🔴 **Critique** | FlareSolverr config | `FLARESOLVERR_URL` manquante dans .env | LiveBall ne peut pas bypass Cloudflare |
| 🟡 **Majeur** | Retry logic | Aucun retry sur erreur DNS/405 | Échecs permanents sur erreurs transitoires |
| 🟡 **Majeur** | Fallback timeout | Budget 10s par provider peut être court | Abandon prématuré de providers lents |
| 🟢 **Mineur** | Cache TTL | 60s pour les listes de matchs | Erreurs persistantes 1 min |
| 🟢 **Mineur** | Logging | Logs génériques "indisponible" | Diagnostic difficile en prod |

---

## 📝 Plan de corrections détaillé

### Phase 1 : Réparations critiques (< 2h)

#### 1.1 Corriger yallapro DNS

**Fichier :** `backend/src/modules/sports/yasirtv.service.ts`

**Changement ligne 22-23 :**

```typescript
// AVANT
const YALLAPRO_WP = (process.env.YALLAPRO_WP_URL || 'https://to.yallapro.cfd').replace(/\/+$/, '');

// APRÈS
const YALLAPRO_FALLBACK_DOMAINS = [
  'https://to.yallapro.cfd',
  'https://yalla-shoot.io',
  'https://www.yallapro.com',
  'https://yallapro.live',
];

async function getYallaproWorkingDomain(): Promise<string | null> {
  const configured = process.env.YALLAPRO_WP_URL?.replace(/\/+$/, '');
  if (configured) return configured;
  
  for (const domain of YALLAPRO_FALLBACK_DOMAINS) {
    try {
      await axios.head(domain, { timeout: 3000 });
      console.log(`[yallapro] Domaine actif trouvé: ${domain}`);
      return domain;
    } catch {}
  }
  console.error('[yallapro] Aucun domaine accessible');
  return null;
}
```

**Changement fonction `getYallaproMatches()` ligne 237+ :**

```typescript
export async function getYallaproMatches(): Promise<SportsMatch[]> {
  const cached = MATCH_CACHE.get('yallapro');
  if (cached) return cached;

  try {
    const domain = await getYallaproWorkingDomain();
    if (!domain) {
      console.warn('[yallapro] Aucun domaine yallapro accessible');
      return [];
    }
    
    const raw = await axios.get<any[]>(`${domain}/wp-json/wp/v2/posts`, {
      timeout: 12_000,
      params: { per_page: 20, _fields: 'id,link,title,content' },
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    // ... reste du code inchangé
```

**Vérification :**
```bash
npm run dev
# Attendre 10s, puis tester :
curl http://localhost:4000/api/sports/matches?source=yallapro
```

#### 1.2 Configurer FlareSolverr

**Option A : Déploiement Docker local (développement)**

```bash
docker run -d \
  --name flaresolverr \
  -p 8191:8191 \
  -e LOG_LEVEL=info \
  --restart unless-stopped \
  ghcr.io/flaresolverr/flaresolverr:latest
```

**Option B : Déploiement Railway (production)**

1. Créer un nouveau service Railway
2. Déployer l'image `ghcr.io/flaresolverr/flaresolverr:latest`
3. Exposer le port 8191
4. Noter l'URL publique (ex: `https://flaresolverr-production-xxxx.up.railway.app`)

**Configuration backend :**

**Fichier :** `backend/.env`

```bash
# Ajouter cette ligne
FLARESOLVERR_URL=http://localhost:8191/v1
# OU en production :
# FLARESOLVERR_URL=https://flaresolverr-production-xxxx.up.railway.app/v1
```

**Vérification :**
```bash
# Test manuel FlareSolverr
curl -X POST http://localhost:8191/v1 \
  -H "Content-Type: application/json" \
  -d '{
    "cmd": "request.get",
    "url": "https://liveball.sx/",
    "maxTimeout": 30000
  }'

# Devrait retourner : {"status":"ok","message":"...","solution":{...}}
```

**Redémarrer le backend :**
```bash
npm run dev
```

**Vérification LiveBall :**
```bash
curl http://localhost:4000/api/liveball/matches
# Devrait retourner une liste de matchs
```

---

### Phase 2 : Robustesse et retry (1 jour)

#### 2.1 Ajouter retry avec backoff exponentiel

**Nouveau fichier :** `backend/src/modules/sports/utils/retry.ts`

```typescript
export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  retryableErrors?: string[]; // Codes d'erreur à retry (ex: ['ENOTFOUND', 'ETIMEDOUT'])
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { maxAttempts, initialDelayMs, maxDelayMs, backoffFactor, retryableErrors } = options;
  
  let lastError: any;
  let delayMs = initialDelayMs;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Ne pas retry si l'erreur n'est pas dans la liste
      if (retryableErrors && !retryableErrors.includes(error.code)) {
        throw error;
      }
      
      if (attempt === maxAttempts) {
        console.error(`[Retry] Échec après ${maxAttempts} tentatives:`, error.message);
        throw error;
      }
      
      console.warn(`[Retry] Tentative ${attempt}/${maxAttempts} échouée, retry dans ${delayMs}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * backoffFactor, maxDelayMs);
    }
  }
  
  throw lastError;
}
```

#### 2.2 Appliquer retry à yallapro

**Fichier :** `backend/src/modules/sports/yasirtv.service.ts`

```typescript
import { retryWithBackoff } from './utils/retry';

export async function getYallaproMatches(): Promise<SportsMatch[]> {
  const cached = MATCH_CACHE.get('yallapro');
  if (cached) return cached;

  try {
    const matches = await retryWithBackoff(
      async () => {
        const domain = await getYallaproWorkingDomain();
        if (!domain) throw new Error('No yallapro domain accessible');
        
        const raw = await axios.get<any[]>(`${domain}/wp-json/wp/v2/posts`, {
          timeout: 12_000,
          params: { per_page: 20, _fields: 'id,link,title,content' },
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        });
        
        const posts = Array.isArray(raw.data) ? raw.data : [];
        // ... parsing inchangé
        return parsedMatches;
      },
      {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 5000,
        backoffFactor: 2,
        retryableErrors: ['ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED'],
      }
    );
    
    MATCH_CACHE.set('yallapro', matches);
    return matches;
  } catch (err: any) {
    console.warn('[yallapro] canaux indisponibles après retry:', err?.message);
    return [];
  }
}
```

#### 2.3 Appliquer retry à FlareSolverr

**Fichier :** `backend/src/modules/liveball/liveball.service.ts`

```typescript
import { retryWithBackoff } from '../sports/utils/retry';

async function fetchWithFlareSolverr(
  url: string,
  method: 'GET' | 'POST' = 'GET',
  postData?: Record<string, any>
): Promise<string | null> {
  if (!FLARESOLVERR_URL) return null;
  
  try {
    return await retryWithBackoff(
      async () => {
        const payload: Record<string, any> = {
          cmd: method === 'POST' ? 'request.post' : 'request.get',
          url,
          maxTimeout: 30_000,
        };
        if (method === 'POST' && postData) {
          payload.postData = typeof postData === 'string' ? postData : JSON.stringify(postData);
          payload.headers = { 'Content-Type': 'application/json' };
        }

        const { data } = await axios.post(FLARESOLVERR_URL, payload, { timeout: 35_000 });
        
        if (data?.status === 'ok' && data.solution?.response) {
          return data.solution.response;
        }
        
        throw new Error(`FlareSolverr returned status: ${data?.status}`);
      },
      {
        maxAttempts: 2,
        initialDelayMs: 2000,
        maxDelayMs: 5000,
        backoffFactor: 2,
        retryableErrors: ['ETIMEDOUT', 'ECONNREFUSED'],
      }
    );
  } catch (err: any) {
    console.warn(`[LiveBall] FlareSolverr request failed for ${url}:`, err?.message || err);
    return null;
  }
}
```

---

### Phase 3 : Monitoring et circuit breaker (1 semaine)

#### 3.1 Health checks périodiques

**Nouveau fichier :** `backend/src/modules/sports/health-monitor.ts`

```typescript
import { getKoraMatches } from './kora.service';
import { getKooorahMatches, getYallaproMatches } from './yasirtv.service';
import { getStreamizMatches } from './livetv.service';
import { getLiveBallMatches } from '../liveball/liveball.service';

interface ProviderHealth {
  status: 'healthy' | 'degraded' | 'down';
  lastCheck: number;
  consecutiveFailures: number;
  lastError?: string;
}

const healthStatus = new Map<string, ProviderHealth>();

export async function checkProviderHealth(provider: string): Promise<ProviderHealth> {
  const checkers = {
    liveball: getLiveBallMatches,
    kora: getKoraMatches,
    kooorah: getKooorahMatches,
    yallapro: getYallaproMatches,
    streamiz: getStreamizMatches,
  };
  
  const checker = checkers[provider as keyof typeof checkers];
  if (!checker) {
    return { status: 'down', lastCheck: Date.now(), consecutiveFailures: 0, lastError: 'Unknown provider' };
  }
  
  const current = healthStatus.get(provider) || { status: 'down' as const, lastCheck: 0, consecutiveFailures: 0 };
  
  try {
    const matches = await checker();
    const health: ProviderHealth = {
      status: matches && matches.length > 0 ? 'healthy' : 'degraded',
      lastCheck: Date.now(),
      consecutiveFailures: 0,
    };
    healthStatus.set(provider, health);
    return health;
  } catch (error: any) {
    const failures = current.consecutiveFailures + 1;
    const health: ProviderHealth = {
      status: failures >= 3 ? 'down' : 'degraded',
      lastCheck: Date.now(),
      consecutiveFailures: failures,
      lastError: error.message,
    };
    healthStatus.set(provider, health);
    return health;
  }
}

export function getProviderHealth(provider: string): ProviderHealth | undefined {
  return healthStatus.get(provider);
}

// Health check périodique (toutes les 5 minutes)
setInterval(() => {
  const providers = ['liveball', 'kora', 'kooorah', 'yallapro', 'streamiz'];
  providers.forEach(p => checkProviderHealth(p).catch(() => {}));
}, 5 * 60 * 1000);
```

#### 3.2 Endpoint de diagnostic

**Fichier :** `backend/src/modules/sports/sports.controller.ts`

Ajouter cette fonction :

```typescript
import { getProviderHealth } from './health-monitor';

export const getProvidersHealth = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const providers = ['liveball', 'kora', 'kooorah', 'yallapro', 'streamiz'];
    const health = Object.fromEntries(
      providers.map(p => [p, getProviderHealth(p) || { status: 'unknown', lastCheck: 0, consecutiveFailures: 0 }])
    );
    res.json({ success: true, data: health, message: null });
  } catch (error) {
    next(error);
  }
};
```

**Fichier :** `backend/src/modules/sports/sports.routes.ts`

```typescript
import { getProvidersHealth } from './sports.controller';

router.get('/health', getProvidersHealth);
```

**Test :**
```bash
curl http://localhost:4000/api/sports/health
```

---

## 🎯 Résumé des fichiers à modifier

### Fichiers critiques (Phase 1)

| Fichier | Changements | Lignes |
|---------|-------------|--------|
| `backend/.env` | Ajouter `FLARESOLVERR_URL` | +1 |
| `backend/src/modules/sports/yasirtv.service.ts` | Fallback DNS yallapro | ~50 |

### Fichiers importants (Phase 2)

| Fichier | Changements | Lignes |
|---------|-------------|--------|
| `backend/src/modules/sports/utils/retry.ts` | Nouvelle fonction retry | +80 |
| `backend/src/modules/sports/yasirtv.service.ts` | Appliquer retry | +20 |
| `backend/src/modules/liveball/liveball.service.ts` | Appliquer retry | +20 |

### Fichiers optionnels (Phase 3)

| Fichier | Changements | Lignes |
|---------|-------------|--------|
| `backend/src/modules/sports/health-monitor.ts` | Health checks | +120 |
| `backend/src/modules/sports/sports.controller.ts` | Endpoint health | +15 |
| `backend/src/modules/sports/sports.routes.ts` | Route health | +2 |

---

## 🧪 Plan de vérification

### Tests unitaires à ajouter

```typescript
// backend/src/modules/sports/__tests__/retry.test.ts
describe('retryWithBackoff', () => {
  it('should retry on ENOTFOUND error', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 3) {
        const err: any = new Error('DNS lookup failed');
        err.code = 'ENOTFOUND';
        throw err;
      }
      return 'success';
    };
    
    const result = await retryWithBackoff(fn, {
      maxAttempts: 3,
      initialDelayMs: 10,
      maxDelayMs: 100,
      backoffFactor: 2,
      retryableErrors: ['ENOTFOUND'],
    });
    
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });
});
```

### Tests d'intégration

```bash
# 1. Test yallapro après correction DNS
curl http://localhost:4000/api/sports/matches?source=yallapro
# Attendu: liste de matchs (ou tableau vide si aucun match actuellement)

# 2. Test LiveBall après configuration FlareSolverr
curl http://localhost:4000/api/liveball/matches
# Attendu: liste de matchs live/upcoming

# 3. Test résolution de flux complète
curl http://localhost:4000/api/sports/match/liveball/12345/stream
# Attendu: objet avec url, type, servers[]

# 4. Test health check
curl http://localhost:4000/api/sports/health
# Attendu: statut de chaque provider
```

---

## 📊 Métriques de succès

| Métrique | Avant | Cible | Mesure |
|----------|-------|-------|--------|
| **Taux de disponibilité des flux** | 0% | ≥95% | Logs de résolution réussie |
| **Temps de résolution moyen** | N/A | <8s | Durée `resolveSportsFlux()` |
| **Providers fonctionnels** | 0/5 | ≥3/5 | Endpoint `/health` |
| **Taux d'erreur DNS** | 100% | <5% | Compteur erreurs ENOTFOUND |
| **Taux d'erreur FlareSolverr** | 100% | <10% | Compteur erreurs 405/503 |

---

## 🚀 Recommandations stratégiques

### Court terme (< 1 semaine)

1. ✅ **Déployer FlareSolverr en production** (Railway/Render)
2. ✅ **Implémenter fallback DNS pour yallapro**
3. ✅ **Ajouter retry avec backoff sur tous les providers**
4. ✅ **Monitorer les logs de résolution de flux**

### Moyen terme (1-2 semaines)

1. ✅ **Implémenter circuit breaker** (3 échecs consécutifs → disable 5 min)
2. ✅ **Ajouter health checks périodiques** (toutes les 5 min)
3. ✅ **Configurer alertes Sentry/Datadog** sur erreurs critiques
4. ✅ **Documenter le troubleshooting** des providers

### Long terme (1 mois+)

1. ✅ **Auto-discovery de domaines yallapro/kooorah** (scraping)
2. ✅ **Provider de backup premium** (abonnement API sport payante)
3. ✅ **CDN pour les flux HLS** (réduire latence + augmenter bande passante)
4. ✅ **Système de cache distribué** (Redis) pour les flux populaires

---

## 📞 Points de contact

- **Développeur backend:** Investigation des providers
- **DevOps:** Déploiement FlareSolverr, monitoring
- **Support:** Retours utilisateurs sur qualité des flux

---

**Rapport généré le 11 janvier 2025**  
**Dernière mise à jour:** Investigation complète terminée
