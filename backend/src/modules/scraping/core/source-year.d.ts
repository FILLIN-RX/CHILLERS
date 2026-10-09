export function yearFromTitle(title?: string | null): number | null;
export function yearFromUrl(url?: string | null): number | null;
export function pageId(url?: string | null): string | null;
export function fetchSourceYear(pageUrl?: string | null, opts?: { timeout?: number }): Promise<number | null>;
export function resolveYear(title?: string | null, pageUrl?: string | null): Promise<number | null>;
