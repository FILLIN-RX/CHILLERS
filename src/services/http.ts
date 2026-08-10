// A single typed HTTP client that wraps fetch with:
// - AbortSignal propagation (caller can abort; internal timeout aborts otherwise)
// - sensible defaults for JSON endpoints
// - a typed error class with status + body for easy branching in callers
//
// All service modules in src/services/*.ts should funnel their HTTP through here.

export const API_BASE_PATH = "/api";
const SERVER_TIMEOUT_MS = 12_000;

/** Read NEXT_PUBLIC_API_URL at runtime on the client to resolve the backend origin for /uploads and absolute image URLs. */
export function getBackendOrigin(): string {
  if (typeof window === "undefined") return "";
  const raw = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
  return raw.replace(/\/api\/?$/, "");
}

export class HttpError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string, message?: string) {
    super(message || `HTTP ${status}`);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

export interface HttpJsonOptions {
  query?: Record<string, string | number | undefined | null>;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Override the default 12-000ms timeout. Set to 0 to disable. */
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  headers?: Record<string, string>;
}

function buildUrl(path: string, query?: HttpJsonOptions["query"]): string {
  const base = path.startsWith("http")
    ? path
    : path.startsWith(API_BASE_PATH)
      ? path
      : `${API_BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;

  if (!query) return base;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  if (!qs) return base;
  return base.includes("?") ? `${base}&${qs}` : `${base}?${qs}`;
}

/**
 * Typed JSON over fetch. Throws HttpError on non-2xx, DOMException("AbortError") on abort.
 * Caches nothing — caching belongs to TanStack Query at the call site.
 */
export async function httpJson<T>(path: string, options: HttpJsonOptions = {}): Promise<T> {
  const url = buildUrl(path, options.query);
  const ctrl = new AbortController();
  const timeoutMs = options.timeoutMs ?? SERVER_TIMEOUT_MS;
  const timer = timeoutMs > 0 ? setTimeout(() => ctrl.abort(), timeoutMs) : null;

  // Propagate external aborts into the internal controller.
  const onExternalAbort = () => ctrl.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", onExternalAbort, { once: true });

  try {
    const res = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: ctrl.signal,
    });

    if (!res.ok) {
      let bodyText = "";
      try {
        bodyText = await res.text();
      } catch {
        /* ignore */
      }
      throw new HttpError(res.status, bodyText);
    }

    // Caller wants raw response (e.g. file stream).
    if ((options as { raw?: boolean }).raw) {
      return res as unknown as T;
    }

    return (await res.json()) as T;
  } finally {
    if (timer) clearTimeout(timer);
    options.signal?.removeEventListener("abort", onExternalAbort);
  }
}

/** Convert a relative image URL (/uploads/...) into an absolute backend URL on the client. */
export function resolveImageUrl(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/uploads/") || url.startsWith(API_BASE_PATH)) {
    return `${getBackendOrigin()}${url}`;
  }
  return url;
}