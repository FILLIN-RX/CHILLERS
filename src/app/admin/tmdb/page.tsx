'use client';

import { useEffect, useState } from 'react';
import { adminGetTmdbStats, adminTriggerTmdbLink, adminGetLogs } from '@/app/api';
import Spinner from '@/components/Spinner';

export default function AdminTmdb() {
  const [stats, setStats] = useState<any>(null);
  const [logs, setLogs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [logType, setLogType] = useState('series');

  useEffect(() => {
    Promise.all([
      adminGetTmdbStats(),
      adminGetLogs('all', 200),
    ]).then(([s, l]: any) => {
      if (s.success) setStats(s.data);
      if (l.success) setLogs(l.data);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minHeight: '40vh', color: '#6b6b80' }}>
      <Spinner /> Chargement...
    </div>
  );

  const card: React.CSSProperties = {
    background: '#181825', border: '1px solid #252535', borderRadius: 14, padding: '1.25rem', flex: 1, minWidth: 200,
  };

  const linkRate = (linked: number, total: number) =>
    total > 0 ? `${Math.round((linked / total) * 100)}%` : '—';

  return (
    <div>
      <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Liaison TMDB</h1>

      {msg && (
        <p style={{
          padding: '0.75rem 1rem', borderRadius: 10, marginBottom: '1rem', fontSize: '0.875rem',
          background: msg.includes('Erreur') ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
          color: msg.includes('Erreur') ? '#ef4444' : '#22c55e',
        }}>
          {msg}
        </p>
      )}

      {/* STATS */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '2rem' }}>
        <div style={card}>
          <p style={{ color: '#6b6b80', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Films</p>
          <p style={{ color: '#fff', fontSize: '1.75rem', fontWeight: 700, margin: '0.25rem 0' }}>{stats?.movies?.total || 0}</p>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            <span style={{ color: '#22c55e' }}>✓ {stats?.movies?.linked || 0} liés</span>
            <span style={{ color: '#ef4444' }}>✗ {stats?.movies?.unlinked || 0} non liés</span>
            <span style={{ color: '#6366f1' }}>{linkRate(stats?.movies?.linked, stats?.movies?.total)}</span>
          </div>
        </div>
        <div style={card}>
          <p style={{ color: '#6b6b80', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Séries</p>
          <p style={{ color: '#fff', fontSize: '1.75rem', fontWeight: 700, margin: '0.25rem 0' }}>{stats?.series?.total || 0}</p>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            <span style={{ color: '#22c55e' }}>✓ {stats?.series?.linked || 0} liées</span>
            <span style={{ color: '#ef4444' }}>✗ {stats?.series?.unlinked || 0} non liées</span>
            <span style={{ color: '#6366f1' }}>{linkRate(stats?.series?.linked, stats?.series?.total)}</span>
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Liaison</h2>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <button onClick={async () => {
          setMsg('Liaison TMDB films en cours...');
          const res = await adminTriggerTmdbLink('movies');
          setMsg(res.data?.status === 'done' ? 'Liaison films terminée' : `Erreur: ${res.data?.message || 'Inconnue'}`);
        }} style={{ padding: '0.625rem 1.25rem', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
          Lier les films (TMDB)
        </button>
        <button onClick={async () => {
          setMsg('Liaison TMDB séries en cours...');
          const res = await adminTriggerTmdbLink('series');
          setMsg(res.data?.status === 'done' ? 'Liaison séries terminée' : `Erreur: ${res.data?.message || 'Inconnue'}`);
        }} style={{ padding: '0.625rem 1.25rem', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
          Lier les séries (TMDB)
        </button>
      </div>

      {/* LOGS */}
      <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Erreurs de liaison</h2>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button onClick={() => setLogType('series')} style={{
          padding: '0.4rem 0.875rem', borderRadius: 8, border: 'none',
          background: logType === 'series' ? '#6366f1' : '#252535',
          color: '#fff', cursor: 'pointer', fontSize: '0.8125rem',
        }}>Séries</button>
        <button onClick={() => setLogType('movies')} style={{
          padding: '0.4rem 0.875rem', borderRadius: 8, border: 'none',
          background: logType === 'movies' ? '#6366f1' : '#252535',
          color: '#fff', cursor: 'pointer', fontSize: '0.8125rem',
        }}>Films</button>
      </div>
      <pre style={{
        background: '#0a0a0a', border: '1px solid #252535', borderRadius: 12,
        padding: '1rem', color: '#f87171', fontSize: '0.75rem',
        maxHeight: 500, overflow: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.6,
        fontFamily: 'monospace',
      }}>
        {logType === 'series'
          ? (logs?.series?.length ? logs.series.join('\n') : 'Aucune erreur')
          : (logs?.movies?.length ? logs.movies.join('\n') : 'Aucune erreur')
        }
      </pre>
    </div>
  );
}
