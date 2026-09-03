import { Router } from 'express';
import * as userController from './user.controller';
import { requireAuth } from '../auth/../../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.post('/favorites', userController.toggleFavorite);
router.put('/progress', userController.updateProgress);
router.post('/history', userController.markAsWatched);
router.put('/preferences', userController.updatePreferences);

// Watch Later & Playlists
router.post('/watch-later', userController.toggleWatchLater);
router.post('/playlists', userController.createPlaylist);
router.post('/playlists/:playlistId/items', userController.addMediaToPlaylist);
router.delete('/playlists/:playlistId/items/:tmdbId', userController.removeMediaFromPlaylist);
router.delete('/playlists/:playlistId', userController.deletePlaylist);

export default router;
