import { Request, Response, NextFunction } from 'express';
import { competitionsService } from './competitions.service';
import { matchesService } from '../matches/matches.service';

export class CompetitionsController {
  async getCompetitionDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const leagueId = String(req.params.leagueId || req.params.id);
      const season = req.query.season as string | undefined;

      const details = await competitionsService.getCompetitionDetails(leagueId, season);

      if (!details) {
        res.status(404).json({
          success: false,
          data: null,
          message: `Compétition introuvable: ${leagueId}`,
        });
        return;
      }

      res.json({
        success: true,
        data: details,
        message: null,
      });
    } catch (error) {
      next(error);
    }
  }

  async getStandings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const leagueId = String(req.params.leagueId || req.params.id);
      const season = req.query.season as string | undefined;

      const standings = await competitionsService.getStandings(leagueId, season);

      res.json({
        success: true,
        data: standings,
        count: standings.length,
        message: null,
      });
    } catch (error) {
      next(error);
    }
  }

  async getSeasons(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const leagueId = String(req.params.leagueId || req.params.id);
      const seasons = await competitionsService.getSeasons(leagueId);

      res.json({
        success: true,
        data: seasons,
        count: seasons.length,
        message: null,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCompetitionMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const leagueId = String(req.params.leagueId || req.params.id);
      const { date, month, season, seasontype, status, limit, search } = req.query;

      const matches = await matchesService.getMatches({
        league: leagueId,
        date: date as string | undefined,
        month: month as string | undefined,
        season: season as string | undefined,
        seasontype: seasontype as string | undefined,
        status: (status as any) || 'all',
        search: search as string | undefined,
        limit: limit ? parseInt(String(limit), 10) : undefined,
      });

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
}

export const competitionsController = new CompetitionsController();
