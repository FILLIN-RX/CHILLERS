import cron, { ScheduledTask } from 'node-cron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { appendLog } from '../config/log-buffer';

const isDev = process.env.NODE_ENV !== 'production';

let cronTasks: ScheduledTask[] = [];
let isRunning = false;
const runningProcesses: Map<string, ChildProcess> = new Map();

function runProcess(name: string, command: string, args: string[]) {
  const startTime = new Date().toISOString();
  const header = `[Cron] Lancement : ${name}`;
  console.log(`[${startTime}] ${header}`);
  appendLog(header);

  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  runningProcesses.set(name, child);

  child.stdout.on('data', (data) => {
    for (const line of data.toString().split('\n').filter((l: string) => l)) {
      const msg = `[${name}] ${line}`;
      console.log(msg);
      appendLog(msg);
    }
  });

  child.stderr.on('data', (data) => {
    for (const line of data.toString().split('\n').filter((l: string) => l)) {
      const msg = `[${name}] ${line}`;
      console.error(msg);
      appendLog(msg);
    }
  });

  child.on('close', (code) => {
    runningProcesses.delete(name);
    const endTime = new Date().toISOString();
    const msg = code === 0
      ? `[Cron] Terminé avec succès : ${name}`
      : `[Cron] ERREUR : ${name} (code: ${code})`;
    console.log(`[${endTime}] ${msg}`);
    appendLog(msg);
  });
}

export function stopTask(name: string): boolean {
  const child = runningProcesses.get(name);
  if (!child) return false;
  appendLog(`[Admin] Arrêt demandé : ${name}`);
  child.kill('SIGTERM');
  return true;
}

export function getRunningTasks(): string[] {
  return Array.from(runningProcesses.keys());
}

export function runScrapingTasks() {
  console.log(`[${new Date().toISOString()}] [Cron] Lancement des tâches de scraping...`);
  appendLog('[Cron] Lancement scraping films...');
  runner('Scraping Films', 'src/scraping/scrape-films.ts');

  appendLog('[Cron] Lancement scraping séries...');
  runner('Scraping Séries', 'src/scraping/scrape-series.ts');
}

export function runMaintenanceTasks() {
  console.log(`[${new Date().toISOString()}] [Cron] Lancement des tâches de maintenance...`);
  appendLog('[Cron] Lancement maintenance liens...');
  runner('Maintenance Liens', 'src/maintenance/maintainer.ts');

  appendLog('[Cron] Lancement linking TMDB films...');
  runner('Linking TMDB Films', 'src/maintenance/link-movies-tmdb.ts');

  appendLog('[Cron] Lancement linking TMDB séries...');
  runner('Linking TMDB Séries', 'src/maintenance/link-series-tmdb.ts');
}

export function startCron() {
  if (isRunning) return;
  cronTasks = [
    cron.schedule('0 * * * *', runMaintenanceTasks),
    cron.schedule('0 3 * * *', runScrapingTasks),
  ];
  isRunning = true;
  appendLog('[Cron] Tâches planifiées démarrées (toutes les heures + scraping 03:00)');
  console.log('[Cron] Tâches planifiées démarrées.');
}

export function stopCron() {
  if (!isRunning) return;
  cronTasks.forEach(t => t.stop());
  cronTasks = [];
  isRunning = false;
  appendLog('[Cron] Tâches planifiées arrêtées');
  console.log('[Cron] Tâches planifiées arrêtées.');
}

export function getCronStatus() {
  return { running: isRunning, tasks: cronTasks.length };
}

function resolveScript(relativePath: string): string {
  if (isDev) {
    return path.join(process.cwd(), relativePath);
  }
  const jsPath = relativePath.replace(/\.ts$/, '.js').replace('src/', 'dist/');
  return path.join(process.cwd(), jsPath);
}

export const runner = (name: string, scriptPath: string) => {
  if (isDev) {
    runProcess(name, 'npx', ['tsx', resolveScript(scriptPath)]);
  } else {
    runProcess(name, 'node', [resolveScript(scriptPath)]);
  }
};
