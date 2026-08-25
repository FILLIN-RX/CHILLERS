import cron, { ScheduledTask } from 'node-cron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

const isDev = process.env.NODE_ENV !== 'production';

let cronTasks: ScheduledTask[] = [];
let isRunning = false;
const runningProcesses: Map<string, ChildProcess> = new Map();

function runProcess(name: string, command: string, args: string[]) {
  const startTime = new Date().toISOString();
  console.log(`[${startTime}] [Cron] Lancement : ${name}`);

  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  runningProcesses.set(name, child);

  child.stdout.on('data', (data) => {
    for (const line of data.toString().split('\n').filter((l: string) => l)) {
      console.log(`[${name}] ${line}`);
    }
  });

  child.stderr.on('data', (data) => {
    for (const line of data.toString().split('\n').filter((l: string) => l)) {
      console.error(`[${name}] ${line}`);
    }
  });

  child.on('close', (code) => {
    runningProcesses.delete(name);
    const endTime = new Date().toISOString();
    if (code === 0) {
      console.log(`[${endTime}] [Cron] Terminé avec succès : ${name}`);
    } else {
      console.error(`[${endTime}] [Cron] ERREUR : ${name} (code: ${code})`);
    }
  });
}

export function stopTask(name: string): boolean {
  const child = runningProcesses.get(name);
  if (!child) return false;
  console.log(`[Admin] Arrêt demandé : ${name}`);
  child.kill('SIGTERM');
  return true;
}

export function getRunningTasks(): string[] {
  return Array.from(runningProcesses.keys());
}

export function runScrapingTasks() {
  console.log(`[${new Date().toISOString()}] [Cron] Scraping continu déjà lancé — rien à faire`);
}

export function runMaintenanceTasks() {
  console.log(`[${new Date().toISOString()}] [Cron] Lancement des tâches de maintenance...`);
  runner('Maintenance Liens', 'src/maintenance/maintainer.ts');
  runner('Linking TMDB Films', 'src/maintenance/link-movies-tmdb.ts');
  runner('Linking TMDB Séries', 'src/maintenance/link-series-tmdb.ts');
}

export function runKeepAliveTasks() {
  console.log(`[${new Date().toISOString()}] [Cron] Lancement du Keep-Alive Uqload...`);
  runner('KeepAlive Uqload', 'src/maintenance/keepalive-uqload.ts');
}

export function startCron() {
  if (isRunning) return;
  cronTasks = [
    // Maintenance quotidienne à 10h00 UTC
    cron.schedule('0 10 * * *', runMaintenanceTasks),
    // Keep-Alive Uqload : chaque semaine (dimanche à 03h00 UTC)
    // Uqload supprime les fichiers inactifs — on ping tous les liens chaque semaine
    cron.schedule('0 3 * * 0', runKeepAliveTasks),
  ];
  isRunning = true;
  console.log('[Cron] Maintenance quotidienne planifiée à 10h00 UTC');
  console.log('[Cron] Keep-Alive Uqload planifié chaque semaine (dimanche à 03h00 UTC)');
}

export function stopCron() {
  if (!isRunning) return;
  cronTasks.forEach(t => t.stop());
  cronTasks = [];
  isRunning = false;
  console.log('[Cron] Tâches planifiées arrêtées');
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
    runProcess(name, 'node', ['--import', 'tsx', resolveScript(scriptPath)]);
  } else {
    runProcess(name, 'node', [resolveScript(scriptPath)]);
  }
};
