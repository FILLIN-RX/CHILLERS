import { Request, Response } from 'express';
import { matchesService } from './matches.service';
import { SportMatch, MatchSummary } from './matches.types';

export interface SseClient {
  id: string;
  res: Response;
  matchId?: string; // Si le client s'intéresse à un match spécifique
  joinedAt: number;
}

interface MatchStateSnapshot {
  homeScore?: number;
  awayScore?: number;
  minute?: string;
  status: string;
  statusText?: string;
}

export class MatchesSseService {
  private clients: Map<string, SseClient> = new Map();
  private pollerTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private lastMatchStates: Map<string, MatchStateSnapshot> = new Map();

  constructor() {
    this.startHeartbeat();
  }

  /**
   * Envoi d'un événement SSE formaté
   */
  private sendEvent(res: Response, eventName: string, data: any) {
    try {
      res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      // Ignorer si la socket est fermée
    }
  }

  /**
   * Envoi d'un commentaire SSE (ping / keep-alive)
   */
  private sendComment(res: Response, comment: string) {
    try {
      res.write(`: ${comment}\n\n`);
    } catch (_) {}
  }

  /**
   * Démarre le heartbeat toutes les 15 secondes pour maintenir les connexions ouvertes
   */
  private startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      for (const client of this.clients.values()) {
        this.sendComment(client.res, 'keep-alive');
      }
    }, 15000);
  }

  /**
   * Gère une nouvelle connexion entrante SSE
   */
  async handleConnection(req: Request, res: Response): Promise<void> {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const matchId = req.query.matchId ? String(req.query.matchId) : undefined;

    // Entêtes obligatoires SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Empêche la mise en tampon de nginx
      'Access-Control-Allow-Origin': '*',
    });

    // Flush immédiat des headers
    res.flushHeaders?.();

    const client: SseClient = {
      id: clientId,
      res,
      matchId,
      joinedAt: Date.now(),
    };

    this.clients.set(clientId, client);
    console.log(`[SSE] Nouveau client connecté: ${clientId} (${this.clients.size} actifs, matchId=${matchId || 'all'})`);

    // 1. Confirmer la connexion
    this.sendEvent(res, 'connected', {
      clientId,
      matchId: matchId || null,
      timestamp: Date.now(),
      activeClients: this.clients.size,
    });

    // 2. Envoyer immédiatement les données courantes
    this.sendInitialData(client);

    // 3. Démarrer la boucle de polling si c'est le premier client
    if (this.clients.size === 1) {
      this.startPoller();
    }

    // 4. Nettoyage lors de la déconnexion
    req.on('close', () => {
      this.clients.delete(clientId);
      console.log(`[SSE] Client déconnecté: ${clientId} (${this.clients.size} restants)`);
      if (this.clients.size === 0) {
        this.stopPoller();
      }
    });
  }

  /**
   * Envoie le snapshot initial au client
   */
  private async sendInitialData(client: SseClient) {
    try {
      if (client.matchId) {
        // Envoi pour un match spécifique
        const [match, summary] = await Promise.all([
          matchesService.getMatchById(client.matchId),
          matchesService.getMatchSummary(client.matchId),
        ]);

        this.sendEvent(client.res, 'init', {
          type: 'single-match',
          matchId: client.matchId,
          match,
          summary,
          timestamp: Date.now(),
        });
      } else {
        // Envoi des matchs en direct
        const liveMatches = await matchesService.getMatches({ status: 'live' });
        
        // Mettre à jour l'état local
        for (const m of liveMatches) {
          this.lastMatchStates.set(m.id, {
            homeScore: m.homeTeam.score,
            awayScore: m.awayTeam.score,
            minute: m.minute || m.statusText,
            status: m.status,
            statusText: m.statusText,
          });
        }

        this.sendEvent(client.res, 'init', {
          type: 'live-scores',
          matches: liveMatches,
          count: liveMatches.length,
          timestamp: Date.now(),
        });
      }
    } catch (e: any) {
      console.error('[SSE] Erreur lors de l\'envoi des données initiales:', e.message);
    }
  }

  /**
   * Démarre le poller de rafraîchissement
   */
  private startPoller() {
    if (this.pollerTimer) return;
    console.log('[SSE] Démarrage du polling temps réel (intervalle 8s)...');
    
    // Polling toutes les 8 secondes
    this.pollerTimer = setInterval(() => {
      this.pollLiveMatches();
    }, 8000);
  }

  /**
   * Arrête le poller pour économiser les ressources serveur quand 0 client
   */
  private stopPoller() {
    if (this.pollerTimer) {
      clearInterval(this.pollerTimer);
      this.pollerTimer = null;
      console.log('[SSE] Arrêt du polling temps réel (0 client actif).');
    }
  }

  /**
   * Boucle de rafraîchissement : compare les scores et propage les événements
   */
  private async pollLiveMatches() {
    if (this.isPolling || this.clients.size === 0) return;
    this.isPolling = true;

    try {
      // 1. Récupération des matchs live récents (avec bypass de cache court)
      const liveMatches = await matchesService.getMatches({ status: 'live', bypassCache: true });
      const now = Date.now();

      // Broadcast régulier de l'ensemble des scores live
      const liveScoresPayload = {
        matches: liveMatches,
        count: liveMatches.length,
        timestamp: now,
      };

      for (const client of this.clients.values()) {
        if (!client.matchId) {
          this.sendEvent(client.res, 'live-scores', liveScoresPayload);
        }
      }

      // 2. Détection des changements précis (buts, cartons, changement de minute)
      for (const match of liveMatches) {
        const prev = this.lastMatchStates.get(match.id);
        const currentHomeScore = match.homeTeam.score ?? 0;
        const currentAwayScore = match.awayTeam.score ?? 0;

        if (prev) {
          const prevHomeScore = prev.homeScore ?? 0;
          const prevAwayScore = prev.awayScore ?? 0;

          // Détection d'un BUT
          const isHomeGoal = currentHomeScore > prevHomeScore;
          const isAwayGoal = currentAwayScore > prevAwayScore;

          if (isHomeGoal || isAwayGoal) {
            const scoringTeam = isHomeGoal ? 'home' : 'away';
            const teamName = isHomeGoal ? match.homeTeam.name : match.awayTeam.name;

            const goalPayload = {
              matchId: match.id,
              matchTitle: match.title,
              leagueName: match.league.name,
              minute: match.minute || match.statusText,
              scoringTeam,
              teamName,
              newScore: `${currentHomeScore} - ${currentAwayScore}`,
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              timestamp: now,
            };

            console.log(`[SSE] ⚽ BUT DÉTECTÉ dans ${match.title}: ${teamName} (${goalPayload.newScore})`);

            // Notifier tous les clients ou le client abonné
            this.broadcast('goal', goalPayload);
          }

          // Détection d'un changement de statut ou de minute
          const hasScoreChanged = currentHomeScore !== prevHomeScore || currentAwayScore !== prevAwayScore;
          const hasStatusChanged = match.status !== prev.status || match.statusText !== prev.statusText;
          const hasMinuteChanged = (match.minute || '') !== (prev.minute || '');

          if (hasScoreChanged || hasStatusChanged || hasMinuteChanged) {
            const updatePayload = {
              match,
              changeType: hasScoreChanged ? 'score' : hasStatusChanged ? 'status' : 'minute',
              timestamp: now,
            };

            this.broadcastToMatchOrGlobal(match.id, 'match-update', updatePayload);
          }
        }

        // Sauvegarder l'état
        this.lastMatchStates.set(match.id, {
          homeScore: currentHomeScore,
          awayScore: currentAwayScore,
          minute: match.minute || match.statusText,
          status: match.status,
          statusText: match.statusText,
        });
      }

      // 3. Pour les clients abonnés à un match individuel
      const singleMatchClients = Array.from(this.clients.values()).filter((c) => c.matchId);
      for (const client of singleMatchClients) {
        if (!client.matchId) continue;
        try {
          const summary = await matchesService.getMatchSummary(client.matchId);
          if (summary) {
            this.sendEvent(client.res, 'match-summary', {
              matchId: client.matchId,
              summary,
              timestamp: now,
            });
          }
        } catch (_) {}
      }
    } catch (err: any) {
      console.warn('[SSE] Erreur poller:', err.message);
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Broadcast à TOUS les clients connectés
   */
  public broadcast(eventName: string, data: any) {
    for (const client of this.clients.values()) {
      this.sendEvent(client.res, eventName, data);
    }
  }

  /**
   * Broadcast aux clients globaux ET aux clients écoutant ce match en particulier
   */
  public broadcastToMatchOrGlobal(matchId: string, eventName: string, data: any) {
    for (const client of this.clients.values()) {
      if (!client.matchId || client.matchId === matchId) {
        this.sendEvent(client.res, eventName, data);
      }
    }
  }

  /**
   * Méthode utilitaire pour tester / simuler un but en direct
   */
  public simulateGoal(matchId?: string) {
    const liveMatch = matchId
      ? Array.from(this.lastMatchStates.keys()).find((id) => id === matchId)
      : Array.from(this.lastMatchStates.keys())[0];

    const payload = {
      matchId: liveMatch || 'test-match-1',
      matchTitle: 'Paris Saint-Germain vs Olympique de Marseille',
      leagueName: 'Ligue 1 McDonald\'s',
      minute: '78\'',
      scoringTeam: 'home',
      teamName: 'Paris Saint-Germain',
      newScore: '2 - 1',
      homeTeam: { id: 'home', name: 'Paris Saint-Germain', score: 2 },
      awayTeam: { id: 'away', name: 'Olympique de Marseille', score: 1 },
      timestamp: Date.now(),
      simulated: true,
    };

    console.log('[SSE] Simulation d\'un but déclenchée:', payload.newScore);
    this.broadcast('goal', payload);
    return payload;
  }
}

export const matchesSseService = new MatchesSseService();
