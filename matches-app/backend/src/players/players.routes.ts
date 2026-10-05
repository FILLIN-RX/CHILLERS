import { Router } from 'express';
import { teamsController } from '../teams/teams.controller';

const router = Router();

// Fiche détaillée d'un joueur (profil, stats de saison, bio)
router.get('/:playerId', (req, res, next) => teamsController.getPlayerProfile(req, res, next));

export default router;
