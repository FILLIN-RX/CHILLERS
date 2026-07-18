'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminCronStart, adminCronStop, adminCronStatus, adminTriggerScrape, adminRunMaintenance, adminTriggerTmdbLink } from '@/app/api';

export default function AdminCron() {
  const router = useRouter();
  const [cronRunning, setCronRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastTask, setLastTask] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await adminCronStatus();
      if (res.success) setCronRunning(res.data.running);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const run = async (label: string, action: () => Promise<any>) => {
    setLastTask(`${label}...`);
    try {
      await action();
      setLastTask(`${label} ✓ Lancé avec succès`);
    } catch {
      setLastTask(`${label} ✗ Erreur`);
    }
  };

  const btn = (label: string, action: () => Promise<any>, color = '#6366f1') => (
    <button
      onClick={() => run(label, action)}
      style={{
        padding: '0.5rem 1rem', borderRadius: 8, border: 'none',
        background: color, color: '#fff', cursor: 'pointer',
        fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );

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

        {/* Scraping */}
        <div style={{ background: '#181825', border: '1px solid #252535', borderRadius: 14, padding: '1.25rem' }}>
          <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: 600, margin: '0 0 0.75rem 0' }}>
            Scraping
          </h2>
          <p style={{ color: '#6b6b80', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
            Récupère les nouveaux films et séries depuis open-otaku.me.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {btn('Scraping Films', () => adminTriggerScrape('films'))}
            {btn('Scraping Séries', () => adminTriggerScrape('series'))}
            {btn('Les deux', async () => { await adminTriggerScrape('films'); await adminTriggerScrape('series'); })}
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
            {btn('Vérifier liens morts', () => adminRunMaintenance('dead-links'))}
            {btn('Lier TMDB Films', () => adminRunMaintenance('tmdb-movies'))}
            {btn('Lier TMDB Séries', () => adminRunMaintenance('tmdb-series'))}
            {btn('Organiser DoodStream', () => adminRunMaintenance('organize'))}
            {btn('Sync MongoDB', () => adminRunMaintenance('sync'))}
            {btn('Toute la maintenance', () => adminRunMaintenance('all'))}
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
            {btn('Lier Films TMDB', () => adminTriggerTmdbLink('movies'))}
            {btn('Lier Séries TMDB', () => adminTriggerTmdbLink('series'))}
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
