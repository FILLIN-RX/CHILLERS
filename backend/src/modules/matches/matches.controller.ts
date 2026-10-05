import { Request, Response, NextFunction } from 'express';
import { matchesService } from './matches.service';
import { MatchesFilterOptions, SportType } from './matches.types';

export class MatchesController {
  async getMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, league, date, sport, search } = req.query;

      const options: MatchesFilterOptions = {
        status: (status as any) || 'all',
        league: league as string | undefined,
        date: date as string | undefined,
        sport: (sport as SportType | 'all') || 'all',
        search: search as string | undefined,
      };

      const matches = await matchesService.getMatches(options);

      res.json({
        success: true,
        data: matches,
        count: matches.length,
        message: null,
      });
    } catch (error) {
      next(error);
    }
  }

  async getLeagues(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const leagues = matchesService.getLeagues();
      res.json({
        success: true,
        data: leagues,
        message: null,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMatchById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const match = await matchesService.getMatchById(id);

      if (!match) {
        res.status(404).json({
          success: false,
          data: null,
          message: `Match introuvable pour l'id: ${id}`,
        });
        return;
      }

      res.json({
        success: true,
        data: match,
        message: null,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMatchSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const eventId = String(req.params.id || req.params.eventId);
      const league = (req.query.league as string) || (req.params.league as string) || undefined;

      if (!eventId) {
        res.status(400).json({
          success: false,
          data: null,
          message: "L'identifiant du match (eventId) est requis.",
        });
        return;
      }

      const summary = await matchesService.getMatchSummary(eventId, league);

      if (!summary) {
        res.status(404).json({
          success: false,
          data: null,
          message: `Détails du match introuvables pour l'id: ${eventId}`,
        });
        return;
      }

      res.json({
        success: true,
        data: summary,
        message: null,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMatchStream(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const matchId = String(req.params.id);
      if (!matchId) {
        res.status(400).json({
          success: false,
          data: null,
          message: "L'identifiant du match est requis.",
        });
        return;
      }

      const stream = await matchesService.getMatchStream(matchId);

      if (!stream) {
        res.json({
          success: false,
          data: null,
          message: "Aucun flux vidéo direct disponible pour ce match actuellement.",
        });
        return;
      }

      res.json({
        success: true,
        data: stream,
        message: null,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const matchesController = new MatchesController();
