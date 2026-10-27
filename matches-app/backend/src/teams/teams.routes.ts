import { Router } from 'express';
import { teamsController } from './teams.controller';

const router = Router();

// 1. Liste des équipes (avec ?league=)
router.get('/', (req, res, next) => teamsController.getLeagueTeams(req, res, next));

// 2. Détails d'une équipe et son effectif (Roster)
router.get('/:teamId', (req, res, next) => teamsController.getTeamDetails(req, res, next));
router.get('/:teamId/roster', (req, res, next) => teamsController.getTeamRoster(req, res, next));

export default router;
