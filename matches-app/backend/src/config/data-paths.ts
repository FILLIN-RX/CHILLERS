import path from 'path';

/** Racine du backend matches-app (src/ ou dist/). */
export const BACKEND_ROOT = path.resolve(__dirname, '../..');

/** Dossier du lab « chaînes de match » (snapshot report.json). */
export const SPORTS_LAB_DIR =
  process.env.SPORTS_LAB_DIR ?? path.resolve(BACKEND_ROOT, '../../sports-channels-lab');
