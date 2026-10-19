/**
 * Ordonnanceur du snapshot « chaînes de match ».
 *
 * Les 5 providers ne publient que la rencontre du jour : sans scan récurrent,
 * le snapshot du lab reste bloqué sur le dernier lancement manuel et la page
 * `/test-channels` ne montre jamais la semaine. Ce module relance donc le
 * pipeline du lab (`scan → [iptv] → probe → prune → report`) sur un cron, et
 * écrit `sports-channels-lab/data/report.json` — que `lab-store.ts` recharge
 * déjà automatiquement dès que le mtime change (aucun redémarrage).
 *
 * Choix d'architecture :
 * - enfant `tsx` avec `cwd = sports-channels-lab` (mêmes scripts que `npm run
 *   snapshot`), pas d'import du lab dans le bundle backend : le lab reste
 *   exclu du tsconfig/eslint et n'alourdit pas `dist/` ;
 * - mutex + timeout par étape : un scan bloqué sur un provider ne peut pas
 *   empiler les runs ;
 * - iptv-org 1×/jour (le premier run de la journée) : sa playlist ne bouge
 *   pas dans l'heure ;
 * - flags : actif seulement avec `SPORTS_CHANNELS_LAB=1`, désactivable par
 *   `SPORTS_LAB_SCAN=0` (Render n'a pas le flag → rien ne tourne en prod).
 */
import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import cron, { type ScheduledTask } from 'node-cron';
import { BACKEND_ROOT } from '../../../config/data-paths';
import { appendLog } from '../../../config/log-buffer';
import { LAB_ENABLED } from './lab-store';

const LAB_DIR = path.resolve(BACKEND_ROOT, '..', 'sports-channels-lab');
const RUNTIME_DIR = path.join(BACKEND_ROOT, '.runtime');
const STATE_PATH = path.join(RUNTIME_DIR, 'sports-lab.json');
const REPORT_PATH = path.join(LAB_DIR, 'data', 'report.json');

/** 6 passages/jour : 11h, 15h, 18h, 20h, 22h, minuit (heure serveur). */
const DEFAULT_CRON = '0 0,11,15,18,20,22 * * *';
const STEP_TIMEOUT_MS = 8 * 60_000;
const RUN_TIMEOUT_MS = 20 * 60_000;

const envOff = (v: string | undefined) => v === '0' || (v || '').toLowerCase() === 'false';

const KEEP_DAYS = Math.max(1, Number(process.env.SPORTS_LAB_KEEP_DAYS) || 7);

function tsxBinary(): string | null {
  for (const name of ['tsx', 'tsx.cmd']) {
    const bin = path.join(BACKEND_ROOT, 'node_modules', '.bin', name);
    if (fs.existsSync(bin)) return bin;
  }
  return null;
}

/** Raison du blocage, ou null si l'ordonnanceur peut tourner. */
export function labSchedulerBlockReason(): string | null {
  if (!LAB_ENABLED) return 'SPORTS_CHANNELS_LAB absent';
  if (envOff(process.env.SPORTS_LAB_SCAN)) return 'SPORTS_LAB_SCAN=0';
  if (!fs.existsSync(path.join(LAB_DIR, 'package.json'))) return `lab absent (${LAB_DIR})`;
  if (!tsxBinary()) return 'tsx introuvable dans backend/node_modules/.bin';
  return null;
}

export const LAB_SCHEDULER_ENABLED = labSchedulerBlockReason() === null;

function cronExpression(): string {
  const raw = (process.env.SPORTS_LAB_CRON || '').trim();
  if (!raw) return DEFAULT_CRON;
  if (!cron.validate(raw)) {
    console.warn(`[Sports Lab] SPORTS_LAB_CRON invalide (${raw}) → ${DEFAULT_CRON}`);
    return DEFAULT_CRON;
  }
  return raw;
}

/* ── État persistant (survit au redémarrage) ─────────────────────── */

interface StepOutcome {
  step: string;
  ok: boolean;
  ms: number;
  code: number | null;
  error?: string;
}

interface LabRunRecord {
  reason: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  ok: boolean;
  steps: StepOutcome[];
  totals?: { records?: number; playable?: number; fixtures?: number };
}

interface LabState {
  lastIptvDate?: string;
  lastRun?: LabRunRecord;
}

function readState(): LabState {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) as LabState;
  } catch {
    return {};
  }
}

function writeState(patch: LabState): void {
  try {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify({ ...readState(), ...patch }, null, 2));
  } catch {
    // état best-effort : un échec d'écriture n'arrête pas le scan
  }
}

/* ── Exécution ───────────────────────────────────────────────────── */

let running = false;
let currentChild: ChildProcess | null = null;
let current: { step: string; startedAt: string } | null = null;
let lastRun: LabRunRecord | null = readState().lastRun ?? null;

/** Log visible en console ET relayé vers le buffer SSE de l'admin. */
function log(msg: string): void {
  console.log(msg);
  appendLog(msg);
}

function tailOf(buf: string): string {
  const lines = buf.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.slice(-2).join(' | ').slice(0, 300);
}

function runStep(bin: string, args: string[], budgetMs: number): Promise<StepOutcome> {
  const step = path.basename(args[0], '.ts');
  const started = Date.now();
  return new Promise((resolve) => {
    let child: ChildProcess;
    try {
      child = spawn(bin, args, { cwd: LAB_DIR, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      resolve({ step, ok: false, ms: 0, code: null, error: (err as Error).message });
      return;
    }
    currentChild = child;
    let out = '';
    const grab = (chunk: Buffer) => {
      out = (out + chunk.toString('utf8')).slice(-4000);
    };
    child.stdout?.on('data', grab);
    child.stderr?.on('data', grab);

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, budgetMs);

    const finish = (code: number | null, error?: string) => {
      clearTimeout(timer);
      if (currentChild === child) currentChild = null;
      resolve({
        step,
        ok: !timedOut && !error && code === 0,
        ms: Date.now() - started,
        code,
        error: error || (timedOut ? `timeout ${Math.round(budgetMs / 1000)} s` : code !== 0 ? tailOf(out) : undefined),
      });
    };

    child.on('error', (err) => finish(null, err.message));
    child.on('close', (code) => finish(code));
  });
}

function reportTotals(): LabRunRecord['totals'] | undefined {
  try {
    const raw = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
    return {
      records: raw?.totals?.records,
      playable: raw?.totals?.playable,
      fixtures: Array.isArray(raw?.fixtures) ? raw.fixtures.length : undefined,
    };
  } catch {
    return undefined;
  }
}

function needsIptvToday(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return readState().lastIptvDate !== today;
}

/**
 * État du prochain déclenchement, sans lancer le pipeline : `busy` si un run
 * est en cours, `disabled` si l'ordonnanceur est éteint.
 */
export function precheckLabSnapshot(): 'busy' | 'disabled' | null {
  const block = labSchedulerBlockReason();
  if (block) return 'disabled';
  if (running) return 'busy';
  return null;
}

/**
 * Lance le pipeline complet du lab. Retourne l'état du déclenchement :
 * `busy` si un run est déjà en cours, `disabled` si l'ordonnanceur est éteint.
 */
export async function runLabSnapshot(reason: string): Promise<'started' | 'busy' | 'disabled'> {
  const block = labSchedulerBlockReason();
  if (block) return 'disabled';
  if (running) return 'busy';

  running = true;
  const startedAt = new Date();
  const steps: StepOutcome[] = [];
  log(`[Sports Lab] Snapshot lancé (${reason})`);

  try {
    const bin = tsxBinary()!;
    const plan: Array<[string, string[]]> = [['scan', ['src/scan.ts']]];
    if (needsIptvToday()) plan.push(['iptv', ['src/iptv.ts']]);
    plan.push(
      ['probe', ['src/probe.ts', '--refresh']],
      ['prune', ['src/prune.ts', `--keep-days=${KEEP_DAYS}`]],
      ['report', ['src/report.ts', '--quiet']]
    );

    const deadline = startedAt.getTime() + RUN_TIMEOUT_MS;
    for (const [step, args] of plan) {
      const budget = Math.min(STEP_TIMEOUT_MS, deadline - Date.now());
      if (budget <= 5_000) {
        steps.push({ step, ok: false, ms: 0, code: null, error: 'budget global dépassé' });
        break;
      }
      current = { step, startedAt: new Date().toISOString() };
      const outcome = await runStep(bin, args, budget);
      steps.push(outcome);
      log(
        `[Sports Lab] ${outcome.ok ? '✓' : '✗'} ${step} ${Math.round(outcome.ms / 1000)}s` +
          (outcome.error ? ` — ${outcome.error}` : '')
      );
      if (!outcome.ok) break;
    }

    if (steps.some((s) => s.step === 'iptv' && s.ok)) {
      writeState({ lastIptvDate: startedAt.toISOString().slice(0, 10) });
    }

    const finishedAt = new Date();
    const record: LabRunRecord = {
      reason,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      ok: steps.every((s) => s.ok) && steps.length > 0,
      steps,
      totals: reportTotals(),
    };
    lastRun = record;
    writeState({ lastRun: record });
    log(
      `[Sports Lab] Snapshot ${record.ok ? 'terminé' : 'interrompu'} en ${Math.round(record.durationMs / 1000)}s` +
        (record.totals?.records !== undefined
          ? ` — ${record.totals.fixtures ?? '?'} fixtures, ${record.totals.records} liens, ${record.totals.playable ?? '?'} jouables`
          : '')
    );
    return 'started';
  } catch (err) {
    log(`[Sports Lab] Snapshot en échec : ${(err as Error).message}`);
    return 'started';
  } finally {
    running = false;
    current = null;
    currentChild = null;
  }
}

/* ── Ordonnanceur ────────────────────────────────────────────────── */

let task: ScheduledTask | null = null;

export function startLabScheduler(): void {
  const block = labSchedulerBlockReason();
  if (block) {
    if (LAB_ENABLED) console.log(`[Sports Lab] Ordonnanceur arrêté : ${block}`);
    return;
  }

  const expr = cronExpression();
  task = cron.schedule(
    expr,
    () => {
      void runLabSnapshot('cron');
    },
    { name: 'sports-lab-snapshot', noOverlap: true, unref: true }
  );

  // Un backend tué ne doit pas laisser un scan orphelin tourner.
  process.on('exit', () => {
    try {
      currentChild?.kill('SIGKILL');
    } catch {
      /* déjà mort */
    }
  });

  const next = task.getNextRun();
  log(
    `[Sports Lab] Snapshot programmé « ${expr} » → prochain run ${
      next ? next.toLocaleString() : 'inconnu'
    } (rétention ${KEEP_DAYS} j)`
  );
}

export function stopLabScheduler(): void {
  task?.stop();
  task = null;
}

/* ── Statut (endpoint /status) ───────────────────────────────────── */

export function getLabStatus() {
  const report = (() => {
    try {
      const stat = fs.statSync(REPORT_PATH);
      const raw = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
      return {
        generatedAt: raw?.generatedAt ?? null,
        mtime: stat.mtime.toISOString(),
        records: raw?.totals?.records,
        playable: raw?.totals?.playable,
        fixtures: Array.isArray(raw?.fixtures) ? raw.fixtures.length : undefined,
      };
    } catch {
      return null;
    }
  })();

  return {
    enabled: LAB_SCHEDULER_ENABLED,
    blockReason: labSchedulerBlockReason(),
    running,
    current,
    cron: cronExpression(),
    nextRun: (task?.getNextRun() ?? null)?.toISOString() ?? null,
    keepDays: KEEP_DAYS,
    iptvPlannedToday: needsIptvToday(),
    lastRun,
    report,
  };
}

export function triggerLabScan(reason = 'manuel') {
  return runLabSnapshot(reason);
}
