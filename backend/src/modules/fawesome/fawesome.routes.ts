import { Router, Request, Response } from 'express';
import { searchFawesome, getFawesomePopular } from './fawesome.service';

const router = Router();

router.get('/search', async (req: Request, res: Response) => {
  try {
    const { title, type = 'movie' } = req.query as { title?: string; type?: string };
    if (!title) {
      return res.status(400).json({ success: false, message: 'Paramètre ?title= requis' });
    }
    const results = await searchFawesome(title, type);
    return res.json({ success: true, data: results });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/popular', async (req: Request, res: Response) => {
  try {
    const { page } = req.query as { page?: string };
    const results = await getFawesomePopular(page ? parseInt(page, 10) : 1);
    return res.json({ success: true, data: results });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;