type PopupHandler = (url: string, target?: string, features?: string) => Window | null;

const LOG_PREFIX = '[PopupFirewall]';

const WHITELIST: RegExp[] = [
  // Downloads directs via DoodStream
  /doodstream\.com\/d\//i,
  /dood\.(to|sh|so|cx|la|wf|pm)\/d\//i,
  // Vidzy.cc
  /vidzy\.cc/i,
  // Fichiers video / flux
  /\.mp4(\?|$)/i,
  /\.m3u8(\?|$)/i,
  /\/api\/doodstream\//i,
  // Auth réseaux sociaux (legit)
  /accounts\.google\.com/i,
  /facebook\.com\/(dialog|v2\.\d+\/dialog)/i,
  /twitter\.com\/i\/oauth/i,
  // Fenêtres de la même origine (notre app)
  /^https?:\/\/localhost:3000/i,
  /^https?:\/\/localhost:4000/i,
];

export class PopupFirewall {
  private static origOpen: ((...args: any[]) => Window | null) | null = null;
  private static active = false;
  private static closedCount = 0;
  private static allowedCount = 0;

  static get stats() {
    return { closed: this.closedCount, allowed: this.allowedCount };
  }

  static activate() {
    if (this.active) return;
    this.active = true;

    this.interceptWindowOpen();
    this.interceptAnchorClicks();
    this.listenPostMessage();

    console.log(`${LOG_PREFIX} Pare-feu activé`);
  }

  static deactivate() {
    if (!this.active) return;
    this.active = false;

    if (this.origOpen) {
      window.open = this.origOpen;
      this.origOpen = null;
    }

    console.log(`${LOG_PREFIX} Pare-feu désactivé (${this.closedCount} fermées, ${this.allowedCount} autorisées)`);
  }

  private static handlePopup(url: string, target?: string, features?: string): Window | null {
    if (this.isAllowed(url)) {
      this.allowedCount++;
      if (!this.origOpen) return null;
      const win = this.origOpen(url, target, features);
      console.log(`${LOG_PREFIX} ✅ Popup autorisée: ${url.slice(0, 120)}`);
      return win;
    }

    this.closedCount++;
    console.log(`${LOG_PREFIX} 🚫 Popup fermée (${this.closedCount}): ${url.slice(0, 120)}`);

    // Ouvre une fenêtre vide puis la ferme immédiatement
    // L'utilisateur ne voit qu'un flash imperceptible (ou rien du tout)
    try {
      if (this.origOpen) {
        const decoy = this.origOpen('about:blank', target, features);
        if (decoy && !decoy.closed) {
          setTimeout(() => { try { decoy.close(); } catch {} }, 0);
        }
      }
    } catch {}

    return null;
  }

  private static interceptWindowOpen() {
    const orig = window.open.bind(window) as (...args: any[]) => Window | null;
    this.origOpen = orig;
    (window as any).open = (url?: string | URL, target?: string, features?: string) => {
      const strUrl = url !== undefined ? String(url) : '';
      return this.handlePopup(strUrl, target, features);
    };
  }

  private static interceptAnchorClicks() {
    document.addEventListener('click', (e) => {
      const a = (e.target as Element)?.closest?.('a[target="_blank"]');
      if (!a) return;

      const href = (a as HTMLAnchorElement).href;
      const url = (a as HTMLAnchorElement).getAttribute?.('href');

      // Les liens même-origine (relative) ne sont pas des pubs
      if (!url || url.startsWith('/') || url.startsWith('#')) return;

      if (!this.isAllowed(href)) {
        e.preventDefault();
        e.stopPropagation();
        this.closedCount++;
        console.log(`${LOG_PREFIX} 🚫 Lien pub bloqué (clic): ${href.slice(0, 120)}`);
      } else {
        this.allowedCount++;
        console.log(`${LOG_PREFIX} ✅ Lien autorisé (clic): ${href.slice(0, 120)}`);
      }
    }, true);
  }

  /**
   * Pont postMessage : les iframes peuvent demander une popup légitime
   * Le provider envoie { type: "POPUP_REQUEST", url: "..." }
   * Le firewall ouvre la popup depuis le main thread (interceptable et traçable)
   */
  private static listenPostMessage() {
    window.addEventListener('message', (event) => {
      if (!event.data || event.data.type !== 'POPUP_REQUEST') return;
      const url = String(event.data.url ?? '');
      if (!url) return;
      console.log(`${LOG_PREFIX} postMessage POPUP_REQUEST reçu: ${url.slice(0, 120)}`);
      this.handlePopup(url, '_blank');
    });
  }

  private static isAllowed(url: string): boolean {
    // Toujours autoriser les URLs vides / about:
    if (!url || url === 'about:blank') return true;
    return WHITELIST.some(r => r.test(url));
  }
}

export function createPopupFirewall(): { activate: () => void; deactivate: () => void; stats: () => { closed: number; allowed: number } } {
  return {
    activate: () => PopupFirewall.activate(),
    deactivate: () => PopupFirewall.deactivate(),
    stats: () => ({ ...PopupFirewall.stats }),
  };
}
