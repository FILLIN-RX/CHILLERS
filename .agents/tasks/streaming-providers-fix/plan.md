# Plan d'implémentation : Corrections des providers de streaming

**Date:** 11 janvier 2025  
**Estimation totale:** 6-8 heures de développement + tests

---

## 🎯 Objectif

Restaurer la diffusion des matchs en direct en corrigeant les défaillances critiques des providers yallapro (DNS) et LiveBall (FlareSolverr), puis renforcer la robustesse du système avec retry/fallback.

---

## Phase 1 : Corrections critiques (2h)

### ✅ Tâche 1.1 : Configurer FlareSolverr

**Priorité:** 🔴 CRITIQUE  
**Durée estimée:** 30 min  
**Blocage:** Aucun flux LiveBall disponible sans cela

**Actions:**

1. **Déployer FlareSolverr (option Docker local pour dev)**
   ```bash
   docker run -d \
     --name flaresolverr \
     -p 8191:8191 \
     -e LOG_LEVEL=info \
     --restart unless-stopped \
     ghcr.io/flaresolverr/flaresolverr:latest
   ```

2. **Configurer .env**
   - **Fichier:** `backend/.env`
   - **Ligne à ajouter:**
     ```bash
     FLARESOLVERR_URL=http://localhost:8191/v1
     ```

3. **Tester FlareSolverr**
   ```bash
   curl -X POST http://localhost:8191/v1 \
     -H "Content-Type: application/json" \
     -d '{"cmd":"request.get","url":"https://liveball.sx/","maxTimeout":30000}'
   ```

4. **Redémarrer le backend**
   ```bash
   cd backend && npm run dev
   ```

**Vérification:**
```bash
curl http://localhost:4000/api/liveball/matches
# Doit retourner une liste de matchs
```

---

### ✅ Tâche 1.2 : Réparer yallapro DNS avec fallback

**Priorité:** 🔴 CRITIQUE  
**Durée estimée:** 1h 30min  
**Fichiers modifiés:** `backend/src/modules/sports/yasirtv.service.ts`

#### Changements à apporter

**1. Ajouter les domaines de fallback (ligne 22-23)**

```typescript
// REMPLACER
const YALLAPRO_WP = (process.env.YALLAPRO_WP_URL || 'https://to.yallapro.cfd').replace(/\/+$/, '');

// PAR
const YALLAPRO_FALLBACK_DOMAINS = [
  'https://to.yallapro.cfd',       // Domaine actuel (peut être mort)
  'https://yalla-shoot.io',         // Alternative populaire
  'https://www.yallapro.com',       // Alternative .com
  'https://yallapro.live',          // Alternative .live
];

let cachedWorkingDomain: string | null = null;
let lastDomainCheck = 0;
const DOMAIN_CHECK_TTL = 10 * 60_000; // Re-vérifier toutes les 10 min

/**
 * Trouve le premier domaine yallapro accessible.
 * Cache le résultat 10 min pour éviter de tester tous les domaines à chaque requête.
 */
async function getYallaproWorkingDomain(): Promise<string | null> {
  const configured = process.env.YALLAPRO_WP_URL?.replace(/\/+$/, '');
  if (configured) {
    console.log(`[yallapro] Utilisation du domaine configuré: ${configured}`);
    return configured;
  }
  
  const now = Date.now();
  if (cachedWorkingDomain && now - lastDomainCheck < DOMAIN_CHECK_TTL) {
    return cachedWorkingDomain;
  }
  
  console.log('[yallapro] Recherche d\'un domaine accessible...');
  for (const domain of YALLAPRO_FALLBACK_DOMAINS) {
    try {
      await axios.head(domain, { timeout: 3000 });
      console.log(`[yallapro] ✓ Domaine actif trouvé: ${domain}`);
      cachedWorkingDomain = domain;
      lastDomainCheck = now;
      return domain;
    } catch (err: any) {
      console.warn(`[yallapro] ✗ Domaine inaccessible: ${domain} (${err.code || err.message})`);
    }
  }
  
  console.error('[yallapro] ❌ Aucun domaine yallapro accessible');
  return null;
}
```

**2. Modifier `getYallaproMatches()` (ligne 237+)**

```typescript
// REMPLACER la fonction entière
export async function getYallaproMatches(): Promise<SportsMatch[]> {
  const cached = MATCH_CACHE.get('yallapro');
  if (cached) return cached;

  try {
    const domain = await getYallaproWorkingDomain();
    if (!domain) {
      console.warn('[yallapro] Aucun domaine yallapro accessible, retour liste vide');
      return [];
    }
    
    const raw = await axios.get<any[]>(`${domain}/wp-json/wp/v2/posts`, {
      timeout: 12_000,
      params: { per_page: 20, _fields: 'id,link,title,content' },
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    const posts = Array.isArray(raw.data) ? raw.data : [];

    const matches: SportsMatch[] = [];
    for (const post of posts) {
      const title = String(post?.title?.rendered || '').trim();
      if (!title) continue;

      const content = String(post?.content?.rendered || '');
      const playerPage = extractIframe(content, `${domain}/`);
      if (!playerPage) continue;

      matches.push({
        id: `yallapro:${post.id}`,
        sourceId: String(playerPage),
        source: 'yallapro',
        status: 'live',
        home: title,
        away: '',
        startTs: Math.floor(Date.now() / 1000),
      });
    }

    MATCH_CACHE.set('yallapro', matches);
    console.log(`[yallapro] ✓ ${matches.length} match(s) récupéré(s) depuis ${domain}`);
    return matches;
  } catch (err: any) {
    console.warn('[yallapro] canaux indisponibles:', err?.code || err?.message);
    return [];
  }
}
```

**3. Modifier `resolveYallaproStream()` (ligne 278+)**

```typescript
// REMPLACER la fonction entière
export async function resolveYallaproStream(sourceId: string, force = false): Promise<ResolvedSportsStream | null> {
  if (!force) {
    const cached = STREAM_CACHE.get(sourceId);
    if (cached) return cached;
  }

  try {
    const domain = await getYallaproWorkingDomain();
    if (!domain) {
      console.warn('[yallapro] Impossible de résoudre le flux : aucun domaine accessible');
      return null;
    }
    
    const withServ = (n: number) => `${sourceId}${sourceId.includes('?') ? '&' : '?'}serv=${n}`;

    const resolvedServers = await Promise.all(
      [1, 2, 3].map(async (n) => {
        const servUrl = withServ(n);
        const page = await fetchText(servUrl, `${domain}/`);
        const iframe = extractIframe(page, `${domain}/`);
        if (iframe) return { name: `Miroir ${n}`, url: iframe, type: 'iframe' as const, referer: servUrl };
        const m3u8 = extractM3u8(page, servUrl);
        if (m3u8) return { name: `Miroir ${n}`, url: m3u8, type: 'hls' as const, referer: servUrl };
        return null;
      })
    );

    const unique = new Map<string, SportsServer>();
    for (const server of resolvedServers) {
      if (server && !unique.has(server.url)) unique.set(server.url, server);
    }
    const servers = Array.from(unique.values());
    if (servers.length === 0) return null;

    const primary = servers[0];
    const resolved: ResolvedSportsStream = { url: primary.url, type: primary.type ?? 'iframe', servers };
    STREAM_CACHE.set(sourceId, resolved);
    console.log(`[yallapro] ✓ Flux résolu : ${servers.length} serveur(s), type=${primary.type}`);
    return resolved;
  } catch (err: any) {
    console.warn('[yallapro] flux indisponible:', err?.code || err?.message);
    return null;
  }
}
```

**Vérification:**
```bash
# Redémarrer le backend
npm run dev

# Tester la liste de matchs
curl http://localhost:4000/api/sports/matches?source=yallapro

# Devrait retourner des matchs ou [] (si aucun match en ce moment)
```

---

## Phase 2 : Robustesse avec retry (3h)

### ✅ Tâche 2.1 : Créer l'utilitaire de retry générique

**Priorité:** 🟡 IMPORTANT  
**Durée estimée:** 45 min  
**Nouveau fichier:** `backend/src/modules/sports/utils/retry.ts`

```typescript
/**
 * Retry avec backoff exponentiel pour les opérations réseau.
 * 
 * @example
 * const result = await retryWithBackoff(
 *   () => axios.get('https://api.example.com/data'),
 *   {
 *     maxAttempts: 3,
 *     initialDelayMs: 1000,
 *     maxDelayMs: 5000,
 *     backoffFactor: 2,
 *     retryableErrors: ['ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED'],
 *   }
 * );
 */

export interface RetryOptions {
  /** Nombre maximum de tentatives (inclut la tentative initiale) */
  maxAttempts: number;
  /** Délai initial entre les tentatives (ms) */
  initialDelayMs: number;
  /** Délai maximum entre les tentatives (ms) */
  maxDelayMs: number;
  /** Facteur multiplicateur du délai (ex: 2 pour doubler à chaque fois) */
  backoffFactor: number;
  /** Codes d'erreur à retry (ex: ['ENOTFOUND', 'ETIMEDOUT']). Si undefined, retry toutes les erreurs. */
  retryableErrors?: string[];
  /** Callback appelé avant chaque retry (pour logger) */
  onRetry?: (attempt: number, error: any, delayMs: number) => void;
}

export class RetryError extends Error {
  constructor(
    message: string,
    public attempts: number,
    public lastError: any
  ) {
    super(message);
    this.name = 'RetryError';
  }
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { maxAttempts, initialDelayMs, maxDelayMs, backoffFactor, retryableErrors, onRetry } = options;
  
  let lastError: any;
  let delayMs = initialDelayMs;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Vérifier si l'erreur est retry-able
      const errorCode = error?.code || error?.response?.status?.toString();
      if (retryableErrors && errorCode && !retryableErrors.includes(errorCode)) {
        console.warn(`[Retry] Erreur non retry-able: ${errorCode}, abandon immédiat`);
        throw error;
      }
      
      // Dernier essai échoué → lever l'erreur
      if (attempt === maxAttempts) {
        throw new RetryError(
          `Échec après ${maxAttempts} tentative(s): ${error.message}`,
          maxAttempts,
          lastError
        );
      }
      
      // Callback de retry
      if (onRetry) {
        onRetry(attempt, error, delayMs);
      } else {
        console.warn(
          `[Retry] Tentative ${attempt}/${maxAttempts} échouée (${errorCode || error.message}), ` +
          `retry dans ${delayMs}ms`
        );
      }
      
      // Attendre avant le prochain essai
      await new Promise(resolve => setTimeout(resolve, delayMs));
      
      // Augmenter le délai (backoff exponentiel)
      delayMs = Math.min(delayMs * backoffFactor, maxDelayMs);
    }
  }
  
  throw lastError;
}
```

**Test unitaire:** `backend/src/modules/sports/utils/__tests__/retry.test.ts`

```typescript
import { retryWithBackoff, RetryError } from '../retry';

describe('retryWithBackoff', () => {
  it('should succeed on first attempt', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const result = await retryWithBackoff(fn, {
      maxAttempts: 3,
      initialDelayMs: 10,
      maxDelayMs: 100,
      backoffFactor: 2,
    });
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });
  
  it('should retry on retryable error', async () => {
    let attempts = 0;
    const fn = jest.fn().mockImplementation(async () => {
      attempts++;
      if (attempts < 3) {
        const err: any = new Error('DNS lookup failed');
        err.code = 'ENOTFOUND';
        throw err;
      }
      return 'success';
    });
    
    const result = await retryWithBackoff(fn, {
      maxAttempts: 3,
      initialDelayMs: 10,
      maxDelayMs: 100,
      backoffFactor: 2,
      retryableErrors: ['ENOTFOUND'],
    });
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });
  
  it('should throw RetryError after max attempts', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Network error'));
    
    await expect(
      retryWithBackoff(fn, {
        maxAttempts: 3,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffFactor: 2,
      })
    ).rejects.toThrow(RetryError);
    
    expect(fn).toHaveBeenCalledTimes(3);
  });
  
  it('should not retry on non-retryable error', async () => {
    const err: any = new Error('Validation error');
    err.code = 'VALIDATION_ERROR';
    const fn = jest.fn().mockRejectedValue(err);
    
    await expect(
      retryWithBackoff(fn, {
        maxAttempts: 3,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffFactor: 2,
        retryableErrors: ['ENOTFOUND', 'ETIMEDOUT'],
      })
    ).rejects.toThrow('Validation error');
    
    expect(fn).toHaveBeenCalledTimes(1); // Pas de retry
  });
});
```

**Vérification:**
```bash
npm test -- retry.test.ts
```

---

### ✅ Tâche 2.2 : Appliquer retry à yallapro

**Priorité:** 🟡 IMPORTANT  
**Durée estimée:** 30 min  
**Fichier modifié:** `backend/src/modules/sports/yasirtv.service.ts`

**Changements:**

1. **Importer la fonction retry (en haut du fichier)**

```typescript
import { retryWithBackoff } from './utils/retry';
```

2. **Wrapper `getYallaproMatches()` avec retry**

```typescript
export async function getYallaproMatches(): Promise<SportsMatch[]> {
  const cached = MATCH_CACHE.get('yallapro');
  if (cached) return cached;

  try {
    const matches = await retryWithBackoff(
      async () => {
        const domain = await getYallaproWorkingDomain();
        if (!domain) {
          const err: any = new Error('No yallapro domain accessible');
          err.code = 'NO_DOMAIN';
          throw err;
        }
        
        const raw = await axios.get<any[]>(`${domain}/wp-json/wp/v2/posts`, {
          timeout: 12_000,
          params: { per_page: 20, _fields: 'id,link,title,content' },
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        });
        const posts = Array.isArray(raw.data) ? raw.data : [];

        const parsedMatches: SportsMatch[] = [];
        for (const post of posts) {
          const title = String(post?.title?.rendered || '').trim();
          if (!title) continue;

          const content = String(post?.content?.rendered || '');
          const playerPage = extractIframe(content, `${domain}/`);
          if (!playerPage) continue;

          parsedMatches.push({
            id: `yallapro:${post.id}`,
            sourceId: String(playerPage),
            source: 'yallapro',
            status: 'live',
            home: title,
            away: '',
            startTs: Math.floor(Date.now() / 1000),
          });
        }
        
        return parsedMatches;
      },
      {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 5000,
        backoffFactor: 2,
        retryableErrors: ['ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET'],
        onRetry: (attempt, error, delay) => {
          console.warn(`[yallapro] Tentative ${attempt} échouée (${error.code || error.message}), retry dans ${delay}ms`);
        },
      }
    );
    
    MATCH_CACHE.set('yallapro', matches);
    console.log(`[yallapro] ✓ ${matches.length} match(s) récupéré(s)`);
    return matches;
  } catch (err: any) {
    console.warn('[yallapro] canaux indisponibles après retry:', err?.message);
    return [];
  }
}
```

**Vérification:**
```bash
npm run dev
# Tester plusieurs fois pour vérifier le retry
curl http://localhost:4000/api/sports/matches?source=yallapro
```

---

### ✅ Tâche 2.3 : Appliquer retry à LiveBall/FlareSolverr

**Priorité:** 🟡 IMPORTANT  
**Durée estimée:** 30 min  
**Fichier modifié:** `backend/src/modules/liveball/liveball.service.ts`

**Changements:**

1. **Importer retry (en haut du fichier)**

```typescript
import { retryWithBackoff } from '../sports/utils/retry';
```

2. **Wrapper `fetchWithFlareSolverr()` avec retry**

```typescript
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
        
        // FlareSolverr a répondu mais pas OK → lever une erreur pour retry
        const err: any = new Error(`FlareSolverr returned status: ${data?.status || 'unknown'}`);
        err.code = 'FLARESOLVERR_ERROR';
        throw err;
      },
      {
        maxAttempts: 2, // Seulement 2 essais pour FlareSolverr (c'est lent)
        initialDelayMs: 2000,
        maxDelayMs: 5000,
        backoffFactor: 2,
        retryableErrors: ['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', '500', '502', '503', '504'],
        onRetry: (attempt, error, delay) => {
          console.warn(`[LiveBall] FlareSolverr tentative ${attempt} échouée pour ${url}: ${error.code || error.message}`);
        },
      }
    );
  } catch (err: any) {
    console.warn(`[LiveBall] FlareSolverr request failed for ${url} après retry:`, err?.message || err);
    return null;
  }
}
```

**Vérification:**
```bash
npm run dev
curl http://localhost:4000/api/liveball/matches
```

---

### ✅ Tâche 2.4 : Améliorer les logs d'erreur

**Priorité:** 🟢 NICE-TO-HAVE  
**Durée estimée:** 30 min  
**Fichiers modifiés:** Tous les `*.service.ts` des providers

**Objectif:** Uniformiser les logs pour faciliter le debugging en production

**Template de log à adopter:**

```typescript
// ✅ BON
console.log(`[Provider] ✓ Action réussie: détails`);
console.warn(`[Provider] ⚠️ Alerte: détails (code=${error.code})`);
console.error(`[Provider] ❌ Erreur critique: détails (code=${error.code}, stack=${error.stack?.slice(0,200)})`);

// ❌ MAUVAIS
console.warn('[provider] erreur:', err?.message); // Manque de contexte
```

**Changements à appliquer dans chaque provider:**

- `liveball.service.ts` : Lignes 142, 272, 1214
- `yasirtv.service.ts` : Lignes 167, 274, 318
- `kora.service.ts` : Lignes 151, 249
- `livetv.service.ts` : Lignes 145, 201

**Exemple de changement (kora.service.ts ligne 249):**

```typescript
// AVANT
} catch (err: any) {
  console.warn(`[kora] résolution du flux ${id} impossible:`, err?.stack?.split('\n').slice(0, 3).join(' | ') || err?.message || String(err));
  return null;
}

// APRÈS
} catch (err: any) {
  const errorCode = err?.code || err?.response?.status || 'UNKNOWN';
  console.error(
    `[kora] ❌ Résolution du flux ${id} échouée: ` +
    `code=${errorCode}, message=${err?.message || String(err)}`
  );
  if (err?.stack) {
    console.debug(`[kora] Stack trace: ${err.stack.split('\n').slice(0, 5).join(' | ')}`);
  }
  return null;
}
```

---

## Phase 3 : Monitoring et health checks (2-3h)

### ✅ Tâche 3.1 : Implémenter le health monitor

**Priorité:** 🟢 NICE-TO-HAVE  
**Durée estimée:** 1h 30min  
**Nouveau fichier:** `backend/src/modules/sports/health-monitor.ts`

```typescript
import { getKoraMatches } from './kora.service';
import { getKooorahMatches, getYallaproMatches } from './yasirtv.service';
import { getStreamizMatches } from './livetv.service';
import { getLiveBallMatches } from '../liveball/liveball.service';

export type ProviderStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

export interface ProviderHealth {
  status: ProviderStatus;
  lastCheck: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastError?: string;
  lastSuccessful: number;
  totalChecks: number;
  totalFailures: number;
  uptime: number; // Pourcentage de disponibilité
}

const healthStatus = new Map<string, ProviderHealth>();

const defaultHealth: ProviderHealth = {
  status: 'unknown',
  lastCheck: 0,
  consecutiveFailures: 0,
  consecutiveSuccesses: 0,
  lastSuccessful: 0,
  totalChecks: 0,
  totalFailures: 0,
  uptime: 0,
};

const PROVIDER_CHECKERS: Record<string, () => Promise<any[]>> = {
  liveball: getLiveBallMatches,
  kora: getKoraMatches,
  kooorah: getKooorahMatches,
  yallapro: getYallaproMatches,
  streamiz: getStreamizMatches,
};

/**
 * Check la santé d'un provider et met à jour ses stats.
 */
export async function checkProviderHealth(provider: string): Promise<ProviderHealth> {
  const checker = PROVIDER_CHECKERS[provider];
  if (!checker) {
    console.warn(`[HealthMonitor] Provider inconnu: ${provider}`);
    return { ...defaultHealth, status: 'unknown', lastError: 'Unknown provider' };
  }
  
  const current = healthStatus.get(provider) || { ...defaultHealth };
  
  try {
    const startTime = Date.now();
    const matches = await checker();
    const duration = Date.now() - startTime;
    
    const isHealthy = matches && matches.length > 0;
    const isDegraded = matches && matches.length === 0;
    
    const health: ProviderHealth = {
      status: isHealthy ? 'healthy' : isDegraded ? 'degraded' : 'down',
      lastCheck: Date.now(),
      consecutiveFailures: 0,
      consecutiveSuccesses: current.consecutiveSuccesses + 1,
      lastSuccessful: Date.now(),
      totalChecks: current.totalChecks + 1,
      totalFailures: current.totalFailures,
      uptime: ((current.totalChecks - current.totalFailures) / (current.totalChecks + 1)) * 100,
    };
    
    healthStatus.set(provider, health);
    console.log(`[HealthMonitor] ✓ ${provider}: ${health.status} (${matches?.length || 0} matchs, ${duration}ms)`);
    return health;
  } catch (error: any) {
    const failures = current.consecutiveFailures + 1;
    const totalFails = current.totalFailures + 1;
    const totalChecks = current.totalChecks + 1;
    
    const health: ProviderHealth = {
      status: failures >= 3 ? 'down' : 'degraded',
      lastCheck: Date.now(),
      consecutiveFailures: failures,
      consecutiveSuccesses: 0,
      lastSuccessful: current.lastSuccessful,
      lastError: `${error.code || 'ERROR'}: ${error.message}`,
      totalChecks,
      totalFailures: totalFails,
      uptime: ((totalChecks - totalFails) / totalChecks) * 100,
    };
    
    healthStatus.set(provider, health);
    console.warn(`[HealthMonitor] ❌ ${provider}: ${health.status} (${failures} échec(s) consécutifs)`);
    return health;
  }
}

/**
 * Récupère l'état de santé actuel d'un provider (sans nouveau check).
 */
export function getProviderHealth(provider: string): ProviderHealth {
  return healthStatus.get(provider) || { ...defaultHealth };
}

/**
 * Check tous les providers en parallèle.
 */
export async function checkAllProviders(): Promise<Record<string, ProviderHealth>> {
  const providers = Object.keys(PROVIDER_CHECKERS);
  const results = await Promise.allSettled(
    providers.map(p => checkProviderHealth(p))
  );
  
  const health: Record<string, ProviderHealth> = {};
  providers.forEach((p, i) => {
    const result = results[i];
    health[p] = result.status === 'fulfilled' ? result.value : { ...defaultHealth, status: 'down' };
  });
  
  return health;
}

/**
 * Lance le health check périodique (toutes les 5 minutes).
 */
let healthCheckInterval: NodeJS.Timeout | null = null;

export function startHealthMonitoring(intervalMs: number = 5 * 60_000) {
  if (healthCheckInterval) {
    console.warn('[HealthMonitor] Health monitoring déjà démarré');
    return;
  }
  
  console.log(`[HealthMonitor] Démarrage du monitoring (intervalle: ${intervalMs / 1000}s)`);
  
  // Check immédiat au démarrage
  checkAllProviders().catch(err => {
    console.error('[HealthMonitor] Erreur check initial:', err);
  });
  
  // Puis checks périodiques
  healthCheckInterval = setInterval(() => {
    checkAllProviders().catch(err => {
      console.error('[HealthMonitor] Erreur check périodique:', err);
    });
  }, intervalMs);
}

export function stopHealthMonitoring() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    console.log('[HealthMonitor] Health monitoring arrêté');
  }
}
```

---

### ✅ Tâche 3.2 : Ajouter l'endpoint /health

**Priorité:** 🟢 NICE-TO-HAVE  
**Durée estimée:** 30 min  
**Fichiers modifiés:**
- `backend/src/modules/sports/sports.controller.ts`
- `backend/src/modules/sports/sports.routes.ts`

**1. Controller (sports.controller.ts)**

```typescript
import { getProviderHealth, checkProviderHealth } from './health-monitor';

/**
 * GET /api/sports/health
 * Retourne l'état de santé de tous les providers.
 */
export const getProvidersHealth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const forceCheck = req.query.check === 'true';
    const providers = ['liveball', 'kora', 'kooorah', 'yallapro', 'streamiz'];
    
    let health: Record<string, any>;
    
    if (forceCheck) {
      // Re-check tous les providers immédiatement
      const results = await Promise.allSettled(
        providers.map(p => checkProviderHealth(p))
      );
      health = Object.fromEntries(
        providers.map((p, i) => {
          const result = results[i];
          return [
            p,
            result.status === 'fulfilled'
              ? result.value
              : { status: 'down', lastError: result.reason?.message }
          ];
        })
      );
    } else {
      // Retourner l'état en cache
      health = Object.fromEntries(
        providers.map(p => [p, getProviderHealth(p)])
      );
    }
    
    res.json({ success: true, data: health, message: null });
  } catch (error) {
    next(error);
  }
};
```

**2. Routes (sports.routes.ts)**

```typescript
import { getProvidersHealth } from './sports.controller';

// Ajouter cette ligne
router.get('/health', getProvidersHealth);
```

**3. Démarrer le monitoring (app.ts ou server.ts)**

```typescript
import { startHealthMonitoring } from './modules/sports/health-monitor';

// Après l'initialisation de l'app
startHealthMonitoring(5 * 60_000); // Check toutes les 5 minutes
```

**Vérification:**
```bash
# État en cache (rapide)
curl http://localhost:4000/api/sports/health

# Forcer un check immédiat (plus lent)
curl http://localhost:4000/api/sports/health?check=true
```

---

## Checklist de validation finale

### Tests fonctionnels

- [ ] **LiveBall** : Liste de matchs accessible (`GET /api/liveball/matches`)
- [ ] **LiveBall** : Résolution d'un flux fonctionnelle (`GET /api/liveball/match/:id/stream`)
- [ ] **yallapro** : Liste de matchs accessible (`GET /api/sports/matches?source=yallapro`)
- [ ] **yallapro** : Résolution d'un flux fonctionnelle
- [ ] **Agrégation** : Liste fusionnée accessible (`GET /api/sports/matches`)
- [ ] **Health check** : Endpoint fonctionnel (`GET /api/sports/health`)

### Tests de robustesse

- [ ] **Retry DNS** : Simuler erreur ENOTFOUND → vérifier retry dans les logs
- [ ] **Retry FlareSolverr** : Stopper FlareSolverr → vérifier fallback proxy/cloudscraper
- [ ] **Fallback domaine** : Bloquer `to.yallapro.cfd` → vérifier switch vers domaine alternatif
- [ ] **Cache** : Requêtes répétées → vérifier que le cache évite les re-fetches

### Monitoring production

- [ ] **Logs structurés** : Tous les providers loggent avec format `[Provider] ✓/⚠️/❌ Action: détails`
- [ ] **Métriques de santé** : Health check actif et met à jour les stats
- [ ] **Alertes** : Configurer alerte Sentry/Datadog sur "provider down 3x consécutives"

---

## Déploiement en production

### Prérequis

1. ✅ Instance FlareSolverr déployée et accessible
2. ✅ Variable `FLARESOLVERR_URL` configurée dans l'environnement de production
3. ✅ Tests passés en local/staging

### Étapes de déploiement

```bash
# 1. Build du backend
cd backend
npm run build

# 2. Vérifier que le build inclut les nouveaux fichiers
ls dist/modules/sports/utils/retry.js
ls dist/modules/sports/health-monitor.js

# 3. Déployer sur Railway/Render
git add .
git commit -m "fix: Corriger providers de streaming (yallapro DNS + FlareSolverr + retry)"
git push origin main

# 4. Vérifier les variables d'env en production
# Railway: Settings → Variables → FLARESOLVERR_URL=https://...

# 5. Surveiller les logs au démarrage
# Vérifier: "[HealthMonitor] Démarrage du monitoring"

# 6. Tester les endpoints
curl https://chillers-backend.up.railway.app/api/sports/health
curl https://chillers-backend.up.railway.app/api/liveball/matches
```

---

## Récapitulatif des fichiers modifiés

| Fichier | Type | Lignes | Description |
|---------|------|--------|-------------|
| `backend/.env` | Config | +1 | Ajouter FLARESOLVERR_URL |
| `backend/src/modules/sports/yasirtv.service.ts` | Modif | ~80 | Fallback DNS + retry |
| `backend/src/modules/liveball/liveball.service.ts` | Modif | ~30 | Retry FlareSolverr |
| `backend/src/modules/sports/utils/retry.ts` | Nouveau | +120 | Utilitaire retry |
| `backend/src/modules/sports/health-monitor.ts` | Nouveau | +180 | Monitoring providers |
| `backend/src/modules/sports/sports.controller.ts` | Modif | +30 | Endpoint /health |
| `backend/src/modules/sports/sports.routes.ts` | Modif | +1 | Route /health |
| `backend/src/app.ts` ou `server.ts` | Modif | +2 | Démarrer health monitoring |

**Total estimé:** ~450 lignes ajoutées/modifiées

---

**Fin du plan d'implémentation**  
**Date:** 11 janvier 2025
