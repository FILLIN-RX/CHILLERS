'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  adminScrapperHealth,
  adminScrapperSettings,
  adminScrapperLogs,
  adminScrapperRunningTasks,
  adminScrapperCronStatus,
  adminScrapperState,
  adminScrapperLogsStreamUrl,
  adminScrapperTriggerScrape,
  adminScrapperRunMaintenance,
  adminScrapperCronStart,
  adminScrapperCronStop,
  adminScrapperStopTask,
} from '@/app/api';

interface HealthData {
  status: string;
  uptime: number;
  db: string;
}

interface SettingsData {
  port: string;
  mongoUri: string;
  tmdbToken: string;
  cronRunning: boolean;
}

interface ScraperStateData {
  films: { lastPage: number; updatedAt: string } | null;
  series: { lastPage: number; updatedAt: string } | null;
}

const btn = (label: string, onClick: () => void, color: string, disabled = false) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: '0.5rem 1rem', borderRadius: 8, border: 'none',
      background: disabled ? '#444' : color, color: disabled ? '#888' : '#fff',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap',
      opacity: disabled ? 0.6 : 1,
    }}
  >
    {label}
  </button>
);

export default function AdminScrapper() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [runningTasks, setRunningTasks] = useState<string[]>([]);
  const [cronRunning, setCronRunning] = useState(false);
  const [scraperState, setScraperState] = useState<ScraperStateData | null>(null);
  const [streamLines, setStreamLines] = useState<string[]>([]);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [healthRes, settingsRes, tasksRes, cronRes, stateRes] = await Promise.all([
        adminScrapperHealth(),
        adminScrapperSettings(),
        adminScrapperRunningTasks(),
        adminScrapperCronStatus(),
        adminScrapperState(),
      ]);
      if (healthRes.success) { setHealth(healthRes.data); setConnected(true); }
      else setConnected(false);
      if (settingsRes.success) setSettings(settingsRes.data);
      if (tasksRes.success) setRunningTasks(tasksRes.data || []);
      if (cronRes.success) setCronRunning(cronRes.data.running);
      if (stateRes.success) setScraperState(stateRes.data);
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 5000);
    return () => clearInterval(id);
  }, [fetchAll]);

  useEffect(() => {
    const url = adminScrapperLogsStreamUrl();
    const es = new EventSource(url);
    es.onmessage = (e) => {
      try {
        const { line } = JSON.parse(e.data);
        setStreamLines(prev => [...prev.slice(-499), line]);
      } catch { }
    };
    es.onerror = () => { };
    return () => es.close();
  }, []);

  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [streamLines]);

  const run = async (label: string, action: () => Promise<any>) => {
    setLastAction(`${label}...`);
    try {
      await action();
      setLastAction(`${label} ✓`);
    } catch {
      setLastAction(`${label} ✗ Erreur`);
    }
    setTimeout(() => fetchAll(), 500);
  };

  const isBusy = (name: string) => runningTasks.includes(name);

  const formatUptime = (s: number) => {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${d}j ${h}h ${m}m`;
  };

  return (
    <div>
      <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
        Scrapper distant
      </h1>
      <p style={{ color: '#6b6b80', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Surveillance du service de scraping déporté
      </p>

      {/* Status banner */}
      <div style={{
        background: loading ? '#181825' : connected ? '#0a2a1a' : '#2a0a0a',
        border: `1px solid ${loading ? '#252535' : connected ? '#22c55e' : '#ef4444'}`,
        borderRadius: 12, padding: '1rem', marginBottom: '1.5rem',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
      }}>
        <span style={{
          width: 12, height: 12, borderRadius: '50%',
          background: loading ? '#555' : connected ? '#22c55e' : '#ef4444',
          flexShrink: 0,
        }} />
        <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>
          {loading ? 'Connexion...' : connected ? 'Scrapper connecté' : 'Scrapper déconnecté'}
        </span>
        {health && (
          <span style={{ color: '#6b6b80', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
            Uptime: {formatUptime(health.uptime)} · DB: {health.db}
          </span>
        )}
        <button onClick={fetchAll} style={{
          marginLeft: 'auto', padding: '0.4rem 0.75rem', borderRadius: 6, border: 'none',
          background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
        }}>
          Rafraîchir
        </button>
      </div>

      {!connected && !loading && (
        <div style={{
          background: '#2a0a0a', border: '1px solid #ef4444', borderRadius: 12,
          padding: '2rem', textAlign: 'center', marginBottom: '1.5rem',
        }}>
          <p style={{ color: '#fca5a5', fontSize: '1rem', margin: 0 }}>
            Le scrapper distant est injoignable. Vérifiez que le service tourne et que SCRAPER_API_URL est configuré dans le .env du backend.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Scraper state */}
        {scraperState && (
          <div style={{ background: '#181825', border: '1px solid #252535', borderRadius: 14, padding: '1.25rem' }}>
            <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: 600, margin: '0 0 0.75rem 0' }}>
              État du scraping
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <div style={{ color: '#6b6b80', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Films</div>
                <div style={{ color: '#fff', fontSize: '0.9rem' }}>
                  Dernière page: {scraperState.films ? `#${scraperState.films.lastPage}` : '—'}
                </div>
                <div style={{ color: '#888', fontSize: '0.75rem' }}>
                  {scraperState.films ? new Date(scraperState.films.updatedAt).toLocaleString() : 'Aucun scraping'}
                </div>
              </div>
              <div>
                <div style={{ color: '#6b6b80', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Séries</div>
                <div style={{ color: '#fff', fontSize: '0.9rem' }}>
                  Dernière page: {scraperState.series ? `#${scraperState.series.lastPage}` : '—'}
                </div>
                <div style={{ color: '#888', fontSize: '0.75rem' }}>
                  {scraperState.series ? new Date(scraperState.series.updatedAt).toLocaleString() : 'Aucun scraping'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Config status */}
        {settings && (
          <div style={{ background: '#181825', border: '1px solid #252535', borderRadius: 14, padding: '1.25rem' }}>
            <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: 600, margin: '0 0 0.75rem 0' }}>
              Configuration distante
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
              <span style={{ color: '#6b6b80' }}>Port :</span>
              <span style={{ color: '#fff' }}>{settings.port}</span>
              <span style={{ color: '#6b6b80' }}>MongoDB :</span>
              <span style={{ color: settings.mongoUri.includes('✓') ? '#22c55e' : '#ef4444' }}>{settings.mongoUri}</span>
              <span style={{ color: '#6b6b80' }}>TMDB Token :</span>
              <span style={{ color: settings.tmdbToken.includes('✓') ? '#22c55e' : '#ef4444' }}>{settings.tmdbToken}</span>
              <span style={{ color: '#6b6b80' }}>Cron :</span>
              <span style={{ color: settings.cronRunning ? '#22c55e' : '#ef4444' }}>
                {settings.cronRunning ? 'Actif' : 'Arrêté'}
              </span>
            </div>
          </div>
        )}

        {/* Cron & Running tasks */}
        <div style={{ background: '#181825', border: '1px solid #252535', borderRadius: 14, padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: 600, margin: 0 }}>
              Cron & Tâches
            </h2>
            <span style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              background: cronRunning ? '#22c55e' : '#ef4444',
            }} />
            <span style={{ color: '#aaa', fontSize: '0.8rem' }}>
              {cronRunning ? 'Cron actif' : 'Cron arrêté'}
            </span>
          </div>

          {/* Running tasks */}
          {runningTasks.length > 0 && (
            <div style={{ background: '#1a1a2e', border: '1px solid #22c55e', borderRadius: 8, padding: '0.6rem 0.8rem', marginBottom: '0.75rem' }}>
              <span style={{ color: '#22c55e', fontSize: '0.8rem', fontWeight: 600 }}>
                ⚡ Tâches en cours : {runningTasks.join(', ')}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {btn('Démarrer cron', () => run('Démarrage cron', adminScrapperCronStart), '#22c55e')}
            {btn('Arrêter cron', () => run('Arrêt cron', adminScrapperCronStop), '#ef4444')}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            {btn('Scraping Films', () => run('Scraping Films', () => adminScrapperTriggerScrape('films')), '#6366f1', isBusy('Scraping Films'))}
            {btn('Scraping Séries', () => run('Scraping Séries', () => adminScrapperTriggerScrape('series')), '#6366f1', isBusy('Scraping Séries'))}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {btn('Maint. Liens', () => run('Maintenance Liens', () => adminScrapperRunMaintenance('dead-links')), '#f59e0b', isBusy('Maintenance Liens'))}
            {btn('TMDB Films', () => run('Linking TMDB Films', () => adminScrapperRunMaintenance('tmdb-movies')), '#f59e0b', isBusy('Linking TMDB Films'))}
            {btn('TMDB Séries', () => run('Linking TMDB Séries', () => adminScrapperRunMaintenance('tmdb-series')), '#f59e0b', isBusy('Linking TMDB Séries'))}
          </div>
        </div>

        {/* Last action */}
        {lastAction && (
          <div style={{
            background: '#1a1a2e', border: '1px solid #2a2a4e', borderRadius: 12,
            padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
          }}>
            <span style={{ color: '#fff', fontSize: '0.85rem', flex: 1 }}>{lastAction}</span>
            <button onClick={() => setLastAction(null)} style={{
              background: 'transparent', border: 'none', color: '#6b6b80',
              cursor: 'pointer', fontSize: '0.85rem',
            }}>✕</button>
          </div>
        )}

        {/* Live logs */}
        <div style={{ background: '#181825', border: '1px solid #252535', borderRadius: 14, padding: '1.25rem' }}>
          <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: 600, margin: '0 0 0.75rem 0' }}>
            Logs en direct (SSE)
          </h2>
          <pre ref={preRef} style={{
            background: '#0a0a10', color: '#c0c0d0', padding: '0.75rem', borderRadius: 8,
            fontSize: '0.75rem', lineHeight: '1.5', maxHeight: 400, overflow: 'auto',
            margin: 0, fontFamily: 'Geist Mono, monospace', whiteSpace: 'pre-wrap',
          }}>
            {streamLines.length === 0
              ? <span style={{ color: '#555' }}>En attente de logs...</span>
              : streamLines.map((l, i) => <div key={i}>{l}</div>)
            }
          </pre>
        </div>
      </div>
    </div>
  );
}
