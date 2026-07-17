import app from './app';
import { connectDB } from './config/db';
// import './cron-manager';

const PORT = process.env.PORT || 4000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`[Chiller API] Running on http://localhost:${PORT}`);
    console.log(`[Chiller System] Cron manager attached and running.`);
  });
});
