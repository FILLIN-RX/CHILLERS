import { Router } from 'express';
import { competitionsController } from './competitions.controller';
import { matchesController } from '../matches/matches.controller';
import { teamsController } from '../teams/teams.controller';

const router = Router();

// Liste générale des compétitions
router.get('/', (req, res, next) => matchesController.getLeagues(req, res, next));

// Détails complets, classements, saisons, équipes, top buteurs et matchs d'une compétition
router.get('/:leagueId', (req, res, next) => competitionsController.getCompetitionDetails(req, res, next));
router.get('/:leagueId/standings', (req, res, next) => competitionsController.getStandings(req, res, next));
router.get('/:leagueId/seasons', (req, res, next) => competitionsController.getSeasons(req, res, next));
router.get('/:leagueId/teams', (req, res, next) => teamsController.getLeagueTeams(req, res, next));
router.get('/:leagueId/leaders', (req, res, next) => teamsController.getCompetitionLeaders(req, res, next));
router.get('/:leagueId/matches', (req, res, next) => competitionsController.getCompetitionMatches(req, res, next));

export default router;
