'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminGetDashboard, adminClearCache, adminTriggerScrape, adminGetScraperState } from '@/app/api';
import Spinner from '@/components/Spinner';
import { IconMovie, IconTv, IconLogs, IconLink, IconSettings, IconTmdb } from '@/components/Icons';

interface RecentMovie {
  _id: string; titre: string; tmdbId?: number; addedAt: string; ago: string;
}
interface RecentSerie {
  _id: string; titre: string; tmdbId?: number; episodesCount: number; addedAt: string; ago: string;
}
interface HealthCheck {
  status: string; message: string;
}
interface DashboardData {
  movies: number; series: number; completeSeries: number; totalEpisodes: number;
  deadLinks: number; tmdbLinkedMovies: number; tmdbLinkedSeries: number; uptime: number;
  recent: { movies: RecentMovie[]; series: RecentSerie[] };
  health: Record<string, HealthCheck>;
}
interface ScraperStateItem { lastPage: number; updatedAt: string; }
interface ScraperStateData { films: ScraperStateItem | null; series: ScraperStateItem | null; }

const SHORTCUTS = [
  { href: '/admin/movies', label: 'Films', icon: IconMovie, color: '#6366f1' },
  { href: '/admin/series', label: 'Séries', icon: IconTv, color: '#22c55e' },
  { href: '/admin/tmdb', label: 'TMDB', icon: IconTmdb, color: '#0d9488' },
  { href: '/admin/logs', label: 'Logs', icon: IconLogs, color: '#f59e0b' },
  { href: '/admin/dead-links', label: 'Liens morts', icon: IconLink, color: '#ef4444' },
  { href: '/admin/settings', label: 'Paramètres', icon: IconSettings, color: '#a855f7' },
];

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [scraper, setScraper] = useState<ScraperStateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [configMsg, setConfigMsg] = useState('');

  useEffect(() => {
    Promise.all([
      adminGetDashboard(),
      adminGetScraperState().catch(() => ({ success: false })),
    ]).then(([d, s]: any) => {
      if (d.success) setData(d.data);
      if (s.success) setScraper(s.data);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#6b6b80', gap: '0.75rem' }}>
      <Spinner /> Chargement du tableau de bord...
    </div>
  );
  if (!data) return <p style={{ color: '#ef4444' }}>Erreur de chargement</p>;

  const uptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}j ${h}h ${m}m`;
  };

  const sectionTitle: React.CSSProperties = {
    color: '#fff', fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem',
  };
  const card: React.CSSProperties = {
    background: '#181825', border: '1px solid #252535', borderRadius: 14, padding: '1.25rem', flex: 1, minWidth: 200,
  };

  return (
    <div>
      <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Dashboard</h1>

      {/* STATS */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '2rem' }}>
        <div style={card}>
          <p style={{ color: '#6b6b80', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Films</p>
          <p style={{ color: '#fff', fontSize: '2rem', fontWeight: 700, margin: '0.25rem 0' }}>{data.movies}</p>
          <p style={{ color: '#6366f1', fontSize: '0.75rem' }}>{data.tmdbLinkedMovies} liés TMDB</p>
        </div>
        <div style={card}>
          <p style={{ color: '#6b6b80', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Séries</p>
          <p style={{ color: '#fff', fontSize: '2rem', fontWeight: 700, margin: '0.25rem 0' }}>{data.series}</p>
          <p style={{ color: '#6366f1', fontSize: '0.75rem' }}>{data.tmdbLinkedSeries} liés TMDB</p>
        </div>
        <div style={card}>
          <p style={{ color: '#6b6b80', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Épisodes</p>
          <p style={{ color: '#fff', fontSize: '2rem', fontWeight: 700, margin: '0.25rem 0' }}>{data.totalEpisodes}</p>
          <p style={{ color: '#6366f1', fontSize: '0.75rem' }}>{data.completeSeries} séries complètes</p>
        </div>
        <div style={card}>
          <p style={{ color: '#6b6b80', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Liens morts</p>
          <p style={{ color: data.deadLinks > 0 ? '#ef4444' : '#22c55e', fontSize: '2rem', fontWeight: 700, margin: '0.25rem 0' }}>{data.deadLinks}</p>
          <p style={{ color: '#6b6b80', fontSize: '0.75rem' }}>Uptime: {uptime(data.uptime)}</p>
        </div>
      </div>

      {/* SHORTCUTS */}
      <h2 style={sectionTitle}>Raccourcis</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2rem' }}>
        {SHORTCUTS.map(s => (
          <Link key={s.href} href={s.href} style={{ textDecoration: 'none' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem',
              background: '#181825', border: '1px solid #252535', borderRadius: 10,
              color: '#c0c0d0', fontSize: '0.8125rem', cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}>
              <span style={{ color: s.color, display: 'flex' }}><s.icon /></span>
              {s.label} <span style={{ color: '#6b6b80' }}>→</span>
            </div>
          </Link>
        ))}
      </div>

      {/* HEALTH */}
      <h2 style={sectionTitle}>État des services</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2rem' }}>
        {Object.entries(data.health || {}).map(([key, h]) => (
          <div key={key} style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.875rem',
            background: '#181825', border: '1px solid #252535', borderRadius: 10, fontSize: '0.8125rem',
          }}>
            <span style={{
              fontSize: '0.875rem',
              color: h.status === '✓' ? '#22c55e' : h.status === '⚠' ? '#f59e0b' : '#ef4444',
            }}>{h.status}</span>
            <span style={{ color: '#fff', fontWeight: 500, textTransform: 'capitalize' }}>{key}</span>
            <span style={{ color: '#6b6b80' }}>{h.message}</span>
          </div>
        ))}
      </div>

      {/* RECENT MOVIES */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h2 style={sectionTitle}>Derniers films ajoutés</h2>
          <div style={{ background: '#181825', border: '1px solid #252535', borderRadius: 12, overflow: 'hidden' }}>
            {data.recent?.movies?.length ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #252535', color: '#6b6b80', textTransform: 'uppercase', fontSize: '0.6875rem', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left' }}>Titre</th>
                    <th style={{ padding: '0.625rem 0.875rem', textAlign: 'right' }}>Il y a</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.movies.map((m: RecentMovie) => (
                    <tr key={m._id} style={{ borderBottom: '1px solid #1e1e2e' }}>
                      <td style={{ padding: '0.5rem 0.875rem', color: '#fff' }}>
                        <Link href={`/admin/movies?q=${encodeURIComponent(m.titre)}`} style={{ color: '#fff', textDecoration: 'none' }}>
                          {m.titre}
                        </Link>
                      </td>
                      <td style={{ padding: '0.5rem 0.875rem', color: '#6b6b80', textAlign: 'right', fontSize: '0.75rem' }}>{m.ago}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#6b6b80', padding: '1rem', margin: 0, fontSize: '0.8125rem' }}>Aucun film</p>
            )}
          </div>
        </div>

        <div>
          <h2 style={sectionTitle}>Dernières séries ajoutées</h2>
          <div style={{ background: '#181825', border: '1px solid #252535', borderRadius: 12, overflow: 'hidden' }}>
            {data.recent?.series?.length ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #252535', color: '#6b6b80', textTransform: 'uppercase', fontSize: '0.6875rem', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left' }}>Titre</th>
                    <th style={{ padding: '0.625rem 0.875rem', textAlign: 'right' }}>Ép.</th>
                    <th style={{ padding: '0.625rem 0.875rem', textAlign: 'right' }}>Il y a</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.series.map((s: RecentSerie) => (
                    <tr key={s._id} style={{ borderBottom: '1px solid #1e1e2e' }}>
                      <td style={{ padding: '0.5rem 0.875rem', color: '#fff' }}>
                        <Link href={`/admin/series/${s._id}`} style={{ color: '#fff', textDecoration: 'none' }}>
                          {s.titre}
                        </Link>
                      </td>
                      <td style={{ padding: '0.5rem 0.875rem', color: '#6b6b80', textAlign: 'right', fontSize: '0.75rem' }}>{s.episodesCount}</td>
                      <td style={{ padding: '0.5rem 0.875rem', color: '#6b6b80', textAlign: 'right', fontSize: '0.75rem' }}>{s.ago}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#6b6b80', padding: '1rem', margin: 0, fontSize: '0.8125rem' }}>Aucune série</p>
            )}
          </div>
        </div>
      </div>

      {/* SCRAPER STATE */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '2rem' }}>
        <div style={card}>
          <p style={{ color: '#6b6b80', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Scraping films</p>
          <p style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 700, margin: '0.25rem 0' }}>
            {scraper?.films ? `Page ${scraper.films.lastPage}` : '—'}
          </p>
          <p style={{ color: '#6b6b80', fontSize: '0.75rem' }}>
            {scraper?.films ? new Date(scraper.films.updatedAt).toLocaleString() : 'Aucun scraping'}
          </p>
        </div>
        <div style={card}>
          <p style={{ color: '#6b6b80', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Scraping séries</p>
          <p style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 700, margin: '0.25rem 0' }}>
            {scraper?.series ? `Page ${scraper.series.lastPage}` : '—'}
          </p>
          <p style={{ color: '#6b6b80', fontSize: '0.75rem' }}>
            {scraper?.series ? new Date(scraper.series.updatedAt).toLocaleString() : 'Aucun scraping'}
          </p>
        </div>
      </div>

      {/* ACTIONS */}
      <h2 style={sectionTitle}>Actions</h2>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button onClick={() => { adminTriggerScrape('series'); setConfigMsg('Scraping série déclenché'); }} style={{ padding: '0.625rem 1.25rem', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
          Lancer scraping séries
        </button>
        <button onClick={() => { adminTriggerScrape('films'); setConfigMsg('Scraping films déclenché'); }} style={{ padding: '0.625rem 1.25rem', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
          Lancer scraping films
        </button>
        <button onClick={() => { adminClearCache(); setConfigMsg('Cache TMDB vidé'); }} style={{ padding: '0.625rem 1.25rem', borderRadius: 10, border: '1px solid #6366f1', background: 'transparent', color: '#6366f1', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}>
          Vider cache TMDB
        </button>
      </div>
      {configMsg && <p style={{ color: '#22c55e', fontSize: '0.875rem', marginTop: '0.75rem' }}>{configMsg}</p>}
    </div>
  );
}
