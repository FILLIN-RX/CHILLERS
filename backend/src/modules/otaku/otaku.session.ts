import axios from 'axios';
import ProviderSession from '../../models/ProviderSession';

export const OTAKU_BASE_URL = 'https://open-otaku.me';
const KEEPALIVE_ID = '15107071'; // Supernatural S1 — endpoint privé léger pour valider/prolonger
const KEEPALIVE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const KEEPALIVE_STALE_MS = 5 * 60 * 60 * 1000;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

type RuntimeState = {
  cookie: string | null;
  sessionId: string | null;
  expiresAt: Date | null;
  isValid: boolean;
  lastCheckedAt: Date | null;
  lastError: string | null;
  csrfToken: string | null;
  hydrated: boolean;
};

const state: RuntimeState = {
  cookie: process.env.OTAKU_COOKIE || null,
  sessionId: null,
  expiresAt: null,
  isValid: false,
  lastCheckedAt: null,
  lastError: null,
  csrfToken: null,
  hydrated: false,
};

let keepAliveTimer: NodeJS.Timeout | null = null;

export function sanitizeCookie(raw: string): string {
  const cookie = String(raw || '').trim().replace(/^cookie:\s*/i, '');
  if (/[\r\n]/.test(cookie)) throw new Error('Cookie invalide (retours à la ligne)');
  if (cookie.length > 8192) throw new Error('Cookie trop long');
  return cookie;
}

export function getOtakuHeaders(): Record<string, string> {
  return {
    'User-Agent': UA,
    'X-OO-Client': '3',
    ...(state.cookie ? { Cookie: state.cookie } : {}),
  };
}

export function hasOtakuCookie(): boolean {
  return Boolean(state.cookie);
}

export function getOtakuSessionStatus() {
  const cookie = state.cookie || '';
  return {
    configured: Boolean(cookie),
    isValid: state.isValid,
    sessionId: state.sessionId,
    expiresAt: state.expiresAt,
    lastCheckedAt: state.lastCheckedAt,
    lastError: state.lastError,
    cookiePreview: cookie ? `${cookie.slice(0, 10)}…${cookie.slice(-6)} (${cookie.length} car.)` : null,
  };
}

async function persist(partial: Partial<RuntimeState>) {
  try {
    await ProviderSession.findOneAndUpdate(
      { provider: 'otaku' },
      {
        $set: {
          cookie: state.cookie ?? undefined,
          csrfToken: state.csrfToken ?? undefined,
          sessionId: state.sessionId ?? undefined,
          expiresAt: state.expiresAt ?? undefined,
          lastCheckedAt: state.lastCheckedAt ?? undefined,
          isValid: state.isValid,
          lastError: state.lastError ?? null,
        },
      },
      { upsert: true, new: true }
    );
  } catch (err: any) {
    console.warn('[Otaku] Impossible de persister la session:', err?.message);
  }
  void partial; // keep signature flexible
}

export async function hydrateOtakuSession(): Promise<void> {
  if (state.hydrated) return;
  try {
    const doc = await ProviderSession.findOne({ provider: 'otaku' }).lean().exec() as any;
    if (doc?.cookie) {
      state.cookie = doc.cookie;
      state.sessionId = doc.sessionId || null;
      state.expiresAt = doc.expiresAt ? new Date(doc.expiresAt) : null;
      state.isValid = Boolean(doc.isValid);
      state.lastCheckedAt = doc.lastCheckedAt ? new Date(doc.lastCheckedAt) : null;
      state.lastError = doc.lastError || null;
      state.csrfToken = doc.csrfToken || null;
    }
  } catch (err: any) {
    console.warn('[Otaku] Hydratation session impossible:', err?.message);
  }
  state.hydrated = true;
}

export async function clearOtakuSession(): Promise<void> {
  state.cookie = null;
  state.sessionId = null;
  state.expiresAt = null;
  state.isValid = false;
  state.lastCheckedAt = null;
  state.lastError = null;
  state.csrfToken = null;
  try {
    await ProviderSession.deleteOne({ provider: 'otaku' });
  } catch {}
}

function isAuthError(err: any): boolean {
  return err?.response?.status === 401;
}

export async function refreshOtakuSession(force = false): Promise<{ ok: boolean; status: ReturnType<typeof getOtakuSessionStatus> }> {
  await hydrateOtakuSession();
  if (!state.cookie) {
    state.isValid = false;
    state.lastError = 'Aucun cookie configuré';
    return { ok: false, status: getOtakuSessionStatus() };
  }
  if (!force && state.lastCheckedAt && Date.now() - state.lastCheckedAt.getTime() < KEEPALIVE_STALE_MS) {
    return { ok: state.isValid, status: getOtakuSessionStatus() };
  }

  const headers = getOtakuHeaders();
  try {
    // Requête privée : prolonge le TTL serveur (expiresAt = now + 24h) si valide.
    await axios.get(`${OTAKU_BASE_URL}/api/fs-watch`, {
      params: { id: KEEPALIVE_ID },
      headers,
      timeout: 20000,
      validateStatus: (s) => s < 500,
    }).then((res) => {
      if (res.status === 401 || res.data?.error?.code === 'AUTH_REQUIRED') {
        const e: any = new Error('AUTH_REQUIRED');
        e.response = { status: 401, data: res.data };
        throw e;
      }
    });

    // Lecture de l'état de session (sessionId/expiresAt).
    const { data } = await axios.get(`${OTAKU_BASE_URL}/api/auth/session`, {
      headers,
      timeout: 15000,
      validateStatus: (s) => s < 500,
    });

    if (data?.user && data?.sessionId) {
      state.isValid = true;
      state.sessionId = data.sessionId || state.sessionId;
      state.expiresAt = data.expiresAt ? new Date(data.expiresAt) : state.expiresAt;
      state.csrfToken = data.csrfToken || state.csrfToken;
      state.lastError = null;
    } else {
      state.isValid = false;
      state.lastError = 'Session invalide ou expirée (reconnecte-toi et recopie le cookie)';
    }
  } catch (err: any) {
    if (isAuthError(err) || err?.message === 'AUTH_REQUIRED') {
      state.isValid = false;
      state.lastError = 'Session expirée ou invalide (reconnecte-toi et recopie le cookie)';
    } else {
      state.lastError = `Erreur réseau: ${err?.message || 'inconnue'}`;
      // Ne pas invalider brutalement sur erreur réseau transitoire.
    }
  }

  state.lastCheckedAt = new Date();
  await persist({});
  return { ok: state.isValid, status: getOtakuSessionStatus() };
}

export async function setOtakuSession(rawCookie: string): Promise<{ ok: boolean; status: ReturnType<typeof getOtakuSessionStatus> }> {
  await hydrateOtakuSession();
  const cookie = sanitizeCookie(rawCookie);
  if (!cookie) throw new Error('Cookie vide');
  state.cookie = cookie;
  state.isValid = false;
  state.lastError = null;
  state.lastCheckedAt = null;
  state.sessionId = null;
  state.expiresAt = null;
  state.csrfToken = null;
  await persist({});
  return refreshOtakuSession(true);
}

export function startOtakuSessionKeepAlive(): void {
  if (keepAliveTimer) return;
  void (async () => {
    await hydrateOtakuSession();
    if (!state.cookie) return;
    await refreshOtakuSession(false).catch(() => {});
  })();
  keepAliveTimer = setInterval(() => {
    void refreshOtakuSession(false).catch(() => {});
  }, KEEPALIVE_INTERVAL_MS);
  // Ne pas empêcher le process de s'arrêter
  (keepAliveTimer as any).unref?.();
  console.log('[Otaku] Keep-alive session démarré (6h)');
}
