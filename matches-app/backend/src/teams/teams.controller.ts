import { Request, Response, NextFunction } from 'express';
import { teamsService } from './teams.service';

export class TeamsController {
  async getLeagueTeams(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const leagueId = String(req.params.leagueId || req.query.league || 'eng.1');
      const teams = await teamsService.getLeagueTeams(leagueId);

      res.json({
        success: true,
        data: teams,
        count: teams.length,
        message: null,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTeamDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const teamId = String(req.params.teamId || req.params.id);
      const leagueId = req.query.league as string | undefined;

      const team = await teamsService.getTeamDetails(teamId, leagueId);

      if (!team) {
        res.status(404).json({
          success: false,
          data: null,
          message: `Équipe introuvable pour l'id: ${teamId}`,
        });
        return;
      }

      res.json({
        success: true,
        data: team,
        message: null,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTeamRoster(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const teamId = String(req.params.teamId || req.params.id);
      const leagueId = req.query.league as string | undefined;

      const roster = await teamsService.getTeamRoster(teamId, leagueId);

      res.json({
        success: true,
        data: roster,
        count: roster.reduce((acc, g) => acc + g.players.length, 0),
        message: null,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPlayerProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const playerId = String(req.params.playerId || req.params.id);
      const sport = (req.query.sport as string) || 'soccer';

      const player = await teamsService.getPlayerProfile(playerId, sport);

      if (!player) {
        res.status(404).json({
          success: false,
          data: null,
          message: `Joueur introuvable pour l'id: ${playerId}`,
        });
        return;
      }

      res.json({
        success: true,
        data: player,
        message: null,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCompetitionLeaders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const leagueId = String(req.params.leagueId || req.params.id || 'eng.1');
      const leaders = await teamsService.getCompetitionLeaders(leagueId);

      res.json({
        success: true,
        data: leaders,
        count: leaders.length,
        message: null,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const teamsController = new TeamsController();
