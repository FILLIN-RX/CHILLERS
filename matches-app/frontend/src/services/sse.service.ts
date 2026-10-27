import type { SportMatch, MatchSummary } from '../types/matches';

export interface GoalEventData {
  matchId: string;
  matchTitle: string;
  leagueName: string;
  minute?: string;
  scoringTeam: 'home' | 'away' | 'unknown';
  teamName: string;
  newScore: string;
  homeTeam: { id: string; name: string; score?: number };
  awayTeam: { id: string; name: string; score?: number };
  timestamp: number;
  simulated?: boolean;
}

export interface MatchUpdateData {
  match: SportMatch;
  changeType: 'score' | 'status' | 'minute' | 'general';
  timestamp: number;
}

export interface SseCallbacks {
  onOpen?: () => void;
  onConnected?: (data: { clientId: string; activeClients: number }) => void;
  onInit?: (data: { type: string; matches?: SportMatch[]; match?: SportMatch; summary?: MatchSummary }) => void;
  onLiveScores?: (data: { matches: SportMatch[]; count: number; timestamp: number }) => void;
  onMatchUpdate?: (data: MatchUpdateData) => void;
  onGoal?: (data: GoalEventData) => void;
  onMatchSummary?: (data: { matchId: string; summary: MatchSummary; timestamp: number }) => void;
  onError?: (err: Event) => void;
  onClose?: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050/api';

export class LiveSseClient {
  private eventSource: EventSource | null = null;
  private reconnectTimer: any = null;
  private isManuallyClosed = false;
  private matchId?: string;
  private callbacks: SseCallbacks = {};

  connect(callbacks: SseCallbacks, matchId?: string) {
    this.callbacks = callbacks;
    this.matchId = matchId;
    this.isManuallyClosed = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    const sseUrl = new URL(`${API_BASE_URL}/matches/live/sse`);
    if (matchId) {
      sseUrl.searchParams.set('matchId', matchId);
    }

    console.log('[SSE Client] Connexion au flux SSE :', sseUrl.toString());
    const es = new EventSource(sseUrl.toString());
    this.eventSource = es;

    es.onopen = () => {
      console.log('[SSE Client] Connecté au flux SSE avec succès.');
      this.callbacks.onOpen?.();
    };

    es.addEventListener('connected', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        this.callbacks.onConnected?.(data);
      } catch (e) {
        console.error('[SSE Client] Erreur parse event connected:', e);
      }
    });

    es.addEventListener('init', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        this.callbacks.onInit?.(data);
      } catch (e) {
        console.error('[SSE Client] Erreur parse event init:', e);
      }
    });

    es.addEventListener('live-scores', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        this.callbacks.onLiveScores?.(data);
      } catch (e) {
        console.error('[SSE Client] Erreur parse event live-scores:', e);
      }
    });

    es.addEventListener('match-update', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        this.callbacks.onMatchUpdate?.(data);
      } catch (e) {
        console.error('[SSE Client] Erreur parse event match-update:', e);
      }
    });

    es.addEventListener('goal', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        this.callbacks.onGoal?.(data);
      } catch (e) {
        console.error('[SSE Client] Erreur parse event goal:', e);
      }
    });

    es.addEventListener('match-summary', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        this.callbacks.onMatchSummary?.(data);
      } catch (e) {
        console.error('[SSE Client] Erreur parse event match-summary:', e);
      }
    });

    es.onerror = (err) => {
      if (this.isManuallyClosed) return;
      console.warn('[SSE Client] Erreur ou perte de connexion SSE. Tentative de reconnexion dans 4s...', err);
      this.callbacks.onError?.(err);
      
      es.close();
      this.eventSource = null;

      // Tentative de reconnexion automatique
      this.reconnectTimer = setTimeout(() => {
        if (!this.isManuallyClosed) {
          this.connect(this.callbacks, this.matchId);
        }
      }, 4000);
    };
  }

  disconnect() {
    this.isManuallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log('[SSE Client] Déconnexion manuelle du flux SSE.');
    }
    this.callbacks.onClose?.();
  }

  get isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }
}

export const liveSseClient = new LiveSseClient();
