'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  adminCronStart,
  adminCronStop,
  adminCronStatus,
  adminTriggerScrape,
  adminRunMaintenance,
  adminTriggerTmdbLink,
  adminGetRunningTasks,
  adminStopTask,
  adminStopAllTasks,
  adminListProcesses,
  adminKillProcess,
  adminGetSystemCron,
} from '@/app/api';

interface OsProcess {
  label: string;
  pid: number;
  cmd: string;
}

interface SystemCron {
  present: boolean;
  lines: string[];
}

const ALL_TASK_NAMES = [
  'Scraping Films', 'Scraping Séries',
  'Maintenance Liens', 'Linking TMDB Films', 'Linking TMDB Séries',
  'Organize Séries Doodstream', 'Sync Séries → MongoDB',
];

export default function AdminCron() {
  const router = useRouter();
  const [cronRunning, setCronRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastTask, setLastTask] = useState<string | null>(null);
  const [runningTasks, setRunningTasks] = useState<string[]>([]);
  const [osProcesses, setOsProcesses] = useState<OsProcess[]>([]);
  const [systemCron, setSystemCron] = useState<SystemCron>({ present: false, lines: [] });
  const [showOsPanel, setShowOsPanel] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const [cronRes, tasksRes, processesRes, sysCronRes] = await Promise.all([
        adminCronStatus(),
        adminGetRunningTasks(),
        adminListProcesses(),
        adminGetSystemCron(),
      ]);
      if (cronRes.success) setCronRunning(cronRes.data.running);
      if (tasksRes.success) setRunningTasks(tasksRes.data || []);
      if (processesRes.success) setOsProcesses(processesRes.data || []);
      if (sysCronRes.success) setSystemCron(sysCronRes.data || { present: false, lines: [] });
    } catch {
      // silencieux : le polling suivant retentera
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 3000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const run = async (label: string, action: () => Promise<any>) => {
    setLastTask(`${label}...`);
    try {
      await action();
      setLastTask(`${label} ✓ Lancé avec succès`);
    } catch {
      setLastTask(`${label} ✗ Erreur`);
    }
  };

  const isRunning = (label: string) => runningTasks.includes(label);

  // Process OS dont le label est dans ALL_TASK_NAMES mais qui ne sont PAS
  // remontés par runningTasks (donc fantômes non trackés par le backend)
  const orphanProcesses = osProcesses.filter(p => !runningTasks.includes(p.label));

  const btn = (label: string, action: () => Promise<any>, color = '#6366f1') => {
    const busy = isRunning(label);
    return (
      <button
        onClick={() => run(label, action)}
        disabled={busy}
        style={{
          padding: '0.5rem 1rem', borderRadius: 8, border: 'none',
          background: busy ? '#444' : color, color: busy ? '#888' : '#fff',
          cursor: busy ? 'not-allowed' : 'pointer',
          fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? '⏳ En cours...' : label}
      </button>
    );
  };

  const row = (label: string, action: () => Promise<any>, color: string) => (
    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      {btn(label, action, color)}
      {isRunning(label) && (
        <button
          onClick={async () => {
            const res = await adminStopTask(label);
            if (res?.data?.killed) {
              setLastTask(`${label} ⏹ Arrêt demandé`);
            } else {
              setLastTask(`${label} ⚠ Aucune tâche en cours à arrêter`);
            }
            fetchStatus();
          }}
          style={{
            padding: '0.25rem 0.6rem', borderRadius: 6, border: 'none',
            background: '#ef4444', color: '#fff', cursor: 'pointer',
            fontSize: '0.75rem', fontWeight: 600,
          }}
          title="Arrêter"
        >
          ⏹ Arrêter
        </button>
      )}
    </div>
  );

  const runAll = async (label: string, actions: (() => Promise<any>)[]) => {
    setLastTask(`${label}...`);
    try {
      await Promise.all(actions.map(a => a()));
      setLastTask(`${label} ✓ Lancé avec succès`);
    } catch {
      setLastTask(`${label} ✗ Erreur`);
    }
  };

  const stopAll = async () => {
    setLastTask('Arrêt de toutes les tâches...');
    try {
      const res = await adminStopAllTasks();
      const stopped: string[] = res?.data?.stopped ?? [];
      setLastTask(
        stopped.length > 0
          ? `⏹ ${stopped.length} tâche(s) arrêtée(s) : ${stopped.join(', ')}`
          : '⏹ Cron arrêté — aucune tâche en cours',
      );
    } catch {
      setLastTask('Arrêt de toutes les tâches ✗ Erreur');
    } finally {
      fetchStatus();
    }
  };

  const killOrphan = async (pid: number, label: string) => {
    setLastTask(`Tuer PID ${pid} (${label})...`);
    const res = await adminKillProcess(pid);
    if (res?.data?.killed) {
      setLastTask(`PID ${pid} tué ✓`);
    } else {
      setLastTask(`PID ${pid} : ${res?.data?.killed === false ? 'déjà mort' : 'échec'}`);
    }
    fetchStatus();
  };

  return (
    <div>
      <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
        Tâches planifiées
      </h1>
      <p style={{ color: '#6b6b80', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Gère le scraping, la maintenance et les tâches cron
      </p>

      {/* Bandeau : crontab système détectée */}
      {systemCron.present && (
        <div style={{
          background: '#3a1a1a', border: '2px solid #ef4444', borderRadius: 12,
          padding: '1rem', marginBottom: '1rem',
        }}>
          <div style={{ color: '#fca5a5', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.5rem' }}>
            🚨 Crontab système active — l'admin n'a pas le contrôle total
          </div>
          <div style={{ color: '#fca5a5', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
            Une crontab lance des scripts toutes les minutes sans passer par cette interface.
            Supprimez-la pour garder le contrôle :
          </div>
          <pre style={{
            background: '#0f0f17', color: '#fbbf24', padding: '0.5rem 0.75rem',
            borderRadius: 6, fontSize: '0.75rem', margin: '0.5rem 0', overflow: 'auto',
          }}>
            {systemCron.lines.join('\n')}
          </pre>
          <div style={{ color: '#fca5a5', fontSize: '0.75rem' }}>
            → Sur le serveur : <code style={{ background: '#0f0f17', padding: '0.1rem 0.3rem', borderRadius: 4 }}>
              crontab -e
            </code> puis supprimer les lignes, ou <code style={{ background: '#0f0f17', padding: '0.1rem 0.3rem', borderRadius: 4 }}>
              crontab -r
            </code> pour tout vider.
          </div>
        </div>
      )}

      {/* Bandeau : process orphelins (non trackés par le backend) */}
      {orphanProcesses.length > 0 && (
        <div style={{
          background: '#1a1a2e', border: '2px solid #f59e0b', borderRadius: 12,
          padding: '0.75rem 1rem', marginBottom: '1rem',
        }}>
          <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            ⚠ {orphanProcesses.length} process non-géré(s) détecté(s) sur le serveur
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {orphanProcesses.map(p => (
              <div key={p.pid} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: '#0f0f17', padding: '0.4rem 0.6rem', borderRadius: 6,
              }}>
                <span style={{ color: '#fbbf24', fontSize: '0.8rem', fontWeight: 600, flex: 1 }}>
                  {p.label} <span style={{ color: '#888' }}>(PID {p.pid})</span>
                </span>
                <code style={{ color: '#888', fontSize: '0.7rem', maxWidth: '40%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.cmd}
                </code>
                <button
                  onClick={() => killOrphan(p.pid, p.label)}
                  style={{
                    padding: '0.25rem 0.6rem', borderRadius: 6, border: 'none',
                    background: '#ef4444', color: '#fff', cursor: 'pointer',
                    fontSize: '0.75rem', fontWeight: 600,
                  }}
                >
                  💀 Tuer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Cron Status */}
        <div style={{ background: '#181825', border: '1px solid #252535', borderRadius: 14, padding: '1.25rem' }}>
          <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: 600, margin: '0 0 0.75rem 0' }}>
            Cron (planification automatique)
          </h2>
          <p style={{ color: '#6b6b80', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
            Le cron lance le scraping chaque jour à 03:00 et la maintenance chaque heure.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <span style={{
              display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
              background: loading ? '#555' : cronRunning ? '#22c55e' : '#ef4444',
            }} />
            <span style={{ color: '#aaa', fontSize: '0.875rem' }}>
              {loading ? 'Chargement...' : cronRunning ? 'Cron actif' : 'Cron arrêté'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={async () => { await run('Démarrage cron', adminCronStart); fetchStatus(); }} style={{ padding: '0.5rem 1rem', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>Démarrer</button>
            <button onClick={async () => { await run('Arrêt cron', adminCronStop); fetchStatus(); }} style={{ padding: '0.5rem 1rem', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>Arrêter</button>
            <button onClick={stopAll} style={{ padding: '0.5rem 1rem', borderRadius: 8, border: 'none', background: '#b91c1c', color: '#fff', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 700 }} title="Arrête la planification et tue toutes les tâches en cours">⏹ Tout arrêter</button>
            <button onClick={fetchStatus} style={{ padding: '0.5rem 1rem', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>Rafraîchir</button>
          </div>
        </div>

        {/* Running tasks indicator (backend) */}
        {runningTasks.length > 0 && (
          <div style={{ background: '#1a1a2e', border: '1px solid #22c55e', borderRadius: 12, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ color: '#22c55e', fontSize: '0.8125rem', fontWeight: 600, flex: 1 }}>
              ⚡ Tâches en cours : {runningTasks.join(', ')}
            </span>
            <button
              onClick={stopAll}
              style={{
                padding: '0.4rem 0.9rem', borderRadius: 8, border: 'none',
                background: '#b91c1c', color: '#fff', cursor: 'pointer',
                fontSize: '0.8125rem', fontWeight: 700, whiteSpace: 'nowrap',
              }}
            >
              ⏹ Tout arrêter
            </button>
          </div>
        )}

        {/* Scraping */}
        <div style={{ background: '#181825', border: '1px solid #252535', borderRadius: 14, padding: '1.25rem' }}>
          <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: 600, margin: '0 0 0.75rem 0' }}>
            Scraping
          </h2>
          <p style={{ color: '#6b6b80', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
            Récupère les nouveaux films et séries depuis open-otaku.me.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {row('Scraping Films', () => adminTriggerScrape('films'), '#6366f1')}
            {row('Scraping Séries', () => adminTriggerScrape('series'), '#6366f1')}
            <button
              onClick={() => runAll('Scraping Films+Séries', [() => adminTriggerScrape('films'), () => adminTriggerScrape('series')])}
              disabled={isRunning('Scraping Films') || isRunning('Scraping Séries')}
              style={{
                padding: '0.5rem 1rem', borderRadius: 8, border: 'none',
                background: '#6366f1', color: '#fff', cursor: 'pointer',
                fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap',
                opacity: isRunning('Scraping Films') || isRunning('Scraping Séries') ? 0.6 : 1,
              }}
            >
              Les deux
            </button>
          </div>
        </div>

        {/* Maintenance */}
        <div style={{ background: '#181825', border: '1px solid #252535', borderRadius: 14, padding: '1.25rem' }}>
          <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: 600, margin: '0 0 0.75rem 0' }}>
            Maintenance
          </h2>
          <p style={{ color: '#6b6b80', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
            Vérification des liens, liaison TMDB, synchronisation.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {row('Maintenance Liens', () => adminRunMaintenance('dead-links'), '#22c55e')}
            {row('Linking TMDB Films', () => adminRunMaintenance('tmdb-movies'), '#22c55e')}
            {row('Linking TMDB Séries', () => adminRunMaintenance('tmdb-series'), '#22c55e')}
            {row('Organize Séries Doodstream', () => adminRunMaintenance('organize'), '#22c55e')}
            {row('Sync Séries → MongoDB', () => adminRunMaintenance('sync'), '#22c55e')}
            <button
              onClick={() => run('Toute la maintenance', () => adminRunMaintenance('all'))}
              disabled={ALL_TASK_NAMES.some(n => runningTasks.includes(n))}
              style={{
                padding: '0.5rem 1rem', borderRadius: 8, border: 'none',
                background: '#22c55e', color: '#fff', cursor: 'pointer',
                fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap',
                opacity: ALL_TASK_NAMES.some(n => runningTasks.includes(n)) ? 0.6 : 1,
              }}
            >
              Toute la maintenance
            </button>
          </div>
        </div>

        {/* TMDB Linking */}
        <div style={{ background: '#181825', border: '1px solid #252535', borderRadius: 14, padding: '1.25rem' }}>
          <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: 600, margin: '0 0 0.75rem 0' }}>
            Liaison TMDB
          </h2>
          <p style={{ color: '#6b6b80', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
            Lie les films/séries scrapés à leur fiche TMDB.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {row('Linking TMDB Films', () => adminTriggerTmdbLink('movies'), '#f59e0b')}
            {row('Linking TMDB Séries', () => adminTriggerTmdbLink('series'), '#f59e0b')}
          </div>
        </div>

        {/* Debug : état OS brut */}
        <div style={{ background: '#0f0f17', border: '1px solid #252535', borderRadius: 14, padding: '1.25rem' }}>
          <button
            onClick={() => setShowOsPanel(s => !s)}
            style={{
              background: 'transparent', border: 'none', color: '#6b6b80',
              cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: 0,
            }}
          >
            {showOsPanel ? '▼' : '▶'} État OS brut ({osProcesses.length} process scraper actifs)
          </button>
          {showOsPanel && (
            <div style={{ marginTop: '0.75rem' }}>
              {osProcesses.length === 0 ? (
                <div style={{ color: '#555', fontSize: '0.8rem' }}>Aucun process scraper en cours.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ color: '#888', textAlign: 'left' }}>
                      <th style={{ padding: '0.3rem' }}>Label</th>
                      <th style={{ padding: '0.3rem' }}>PID</th>
                      <th style={{ padding: '0.3rem' }}>Commande</th>
                    </tr>
                  </thead>
                  <tbody>
                    {osProcesses.map(p => (
                      <tr key={p.pid} style={{ borderTop: '1px solid #252535' }}>
                        <td style={{ padding: '0.3rem', color: '#fff' }}>{p.label}</td>
                        <td style={{ padding: '0.3rem', color: '#fbbf24' }}>{p.pid}</td>
                        <td style={{ padding: '0.3rem', color: '#888', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                          {p.cmd}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Last task message */}
        {lastTask && (
          <div style={{
            background: '#1a1a2e', border: '1px solid #2a2a4e', borderRadius: 12,
            padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem',
            flexWrap: 'wrap',
          }}>
            <span style={{ color: '#fff', fontSize: '0.875rem', flex: 1 }}>
              {lastTask}
            </span>
            <button
              onClick={() => router.push('/admin/logs')}
              style={{
                padding: '0.5rem 1rem', borderRadius: 8, border: 'none',
                background: '#6366f1', color: '#fff', cursor: 'pointer',
                fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap',
              }}
            >
              Voir les logs →
            </button>
            <button
              onClick={() => setLastTask(null)}
              style={{
                padding: '0.25rem 0.5rem', borderRadius: 6, border: 'none',
                background: 'transparent', color: '#6b6b80', cursor: 'pointer',
                fontSize: '0.8125rem',
              }}
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
