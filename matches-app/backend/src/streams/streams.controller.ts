import { Request, Response, NextFunction } from 'express';
import { streamsService } from './streams.service';

export class StreamsController {
  /**
   * GET /api/streams/:id
   * Résout le flux pour un ID de match (ID ESPN ou ID LiveBall direct)
   */
  async getStreamById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : (rawId || '');
      const { home, away } = req.query;

      const result = await streamsService.resolveStreamForMatch(
        id,
        typeof home === 'string' ? home : undefined,
        typeof away === 'string' ? away : undefined
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/streams/resolve?home=Real+Madrid&away=Barcelona
   * Résolution directe par noms d'équipes
   */
  async resolveByTeams(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { home, away } = req.query;

      if (!home || !away || typeof home !== 'string' || typeof away !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Les paramètres "home" et "away" sont obligatoires.',
        });
        return;
      }

      const result = await streamsService.resolveStreamForMatch('custom', home, away);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/streams/live
   * Liste brute des matchs actuellement disponibles en direct
   */
  async getLiveList(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const matches = await streamsService.getLiveBallMatches();
      res.json({
        success: true,
        count: matches.length,
        matches,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const streamsController = new StreamsController();
