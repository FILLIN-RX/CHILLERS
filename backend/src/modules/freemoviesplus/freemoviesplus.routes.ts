import { Router, Request, Response } from 'express';
import { searchFmplus, getFmplusVideo } from './freemoviesplus.service';

const router = Router();

router.get('/search', async (req: Request, res: Response) => {
  try {
    const { title, type = 'movie' } = req.query as { title?: string; type?: string };
    if (!title) {
      return res.status(400).json({ success: false, message: 'Paramètre ?title= requis' });
    }
    const results = await searchFmplus(title, type);
    return res.json({ success: true, data: results });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/video', async (req: Request, res: Response) => {
  try {
    const { uid } = req.query as { uid?: string };
    if (!uid) {
      return res.status(400).json({ success: false, message: 'Paramètre ?uid= requis' });
    }
    const data = await getFmplusVideo(uid);
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;