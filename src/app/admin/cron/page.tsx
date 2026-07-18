'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminCronStart, adminCronStop, adminCronStatus, adminTriggerScrape, adminRunMaintenance, adminTriggerTmdbLink, adminGetRunningTasks, adminStopTask } from '@/app/api';

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

  const fetchStatus = useCallback(async () => {
    try {
      const [cronRes, tasksRes] = await Promise.all([adminCronStatus(), adminGetRunningTasks()]);
      if (cronRes.success) setCronRunning(cronRes.data.running);
      if (tasksRes.success) setRunningTasks(tasksRes.data);
    } catch { } finally { setLoading(false); }
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
            await adminStopTask(label);
            setLastTask(`${label} ⏹ Arrêt demandé`);
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

  return (
    <div>
      <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
        Tâches planifiées
      </h1>
      <p style={{ color: '#6b6b80', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Gère le scraping, la maintenance et les tâches cron
      </p>

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
            <button onClick={fetchStatus} style={{ padding: '0.5rem 1rem', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>Statut</button>
          </div>
        </div>

        {/* Running tasks indicator */}
        {runningTasks.length > 0 && (
          <div style={{ background: '#1a1a2e', border: '1px solid #f59e0b', borderRadius: 12, padding: '0.75rem 1rem' }}>
            <span style={{ color: '#f59e0b', fontSize: '0.8125rem', fontWeight: 600 }}>
              ⚡ Tâches en cours : {runningTasks.join(', ')}
            </span>
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
