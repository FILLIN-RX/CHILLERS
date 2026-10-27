import { Request, Response, NextFunction } from 'express';
import { matchesService } from './matches.service';
import { analysisService } from './analysis.service';
import { matchesSseService } from './matches.sse';
import { MatchesFilterOptions, SportType } from './matches.types';

export class MatchesController {
  async getCountries(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const countries = matchesService.getCountries();
      res.json({
        success: true,
        data: countries,
        count: countries.length,
        message: null,
      });
    } catch (error) {
      next(error);
    }
  }

  async getLeagues(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const country = req.query.country as string | undefined;
      const leagues = country
        ? matchesService.getLeaguesByCountry(country)
        : matchesService.getLeagues();

      res.json({
        success: true,
        data: leagues,
        count: leagues.length,
        message: null,
      });
    } catch (error) {
      next(error);
    }
  }

  async getLeaguesByCountry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const countryId = String(req.params.countryId || req.params.country);
      const leagues = matchesService.getLeaguesByCountry(countryId);

      res.json({
        success: true,
        data: leagues,
        count: leagues.length,
        message: null,
      });
    } catch (error) {
      next(error);
    }
  }

  async getLeagueById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const leagueId = String(req.params.leagueId || req.params.id);
      const league = matchesService.getLeagueById(leagueId);

      if (!league) {
        res.status(404).json({
          success: false,
          data: null,
          message: `Championnat introuvable pour l'id ou slug: ${leagueId}`,
        });
        return;
      }

      res.json({
        success: true,
        data: league,
        message: null,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        status,
        country,
        league,
        date,
        month,
        season,
        seasontype,
        sport,
        search,
        limit,
      } = req.query;

      const options: MatchesFilterOptions = {
        status: (status as any) || 'all',
        country: country as string | undefined,
        league: league as string | undefined,
        date: date as string | undefined,
        month: month as string | undefined,
        season: season as string | undefined,
        seasontype: seasontype as string | undefined,
        sport: (sport as SportType | 'all') || 'all',
        search: search as string | undefined,
        limit: limit ? parseInt(String(limit), 10) : undefined,
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

  async getMatchAnalysis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const eventId = String(req.params.id || req.params.eventId);
      const league = (req.query.league as string) || (req.params.league as string) || undefined;

      if (!eventId) {
        res.status(400).json({
          success: false,
          data: null,
          message: "L'identifiant du match est requis.",
        });
        return;
      }

      const analysis = await analysisService.getMatchAnalysis(eventId, league);

      if (!analysis) {
        res.status(404).json({
          success: false,
          data: null,
          message: `Analyse introuvable pour le match: ${eventId}`,
        });
        return;
      }

      res.json({
        success: true,
        data: analysis,
        message: null,
      });
    } catch (error) {
      next(error);
    }
  }

  async subscribeLiveSSE(req: Request, res: Response): Promise<void> {
    await matchesSseService.handleConnection(req, res);
  }

  simulateGoal(req: Request, res: Response): void {
    const matchId = req.body?.matchId || (req.query.matchId as string);
    const result = matchesSseService.simulateGoal(matchId);
    res.json({
      success: true,
      message: 'Événement de but simulé avec succès sur le flux SSE.',
      data: result,
    });
  }
}

export const matchesController = new MatchesController();
