'use client';

import { useEffect, useState } from 'react';
import { adminUqloadStatus, adminUqloadPending, adminUqloadPendingBoth, adminUqloadUploadMovies, adminUqloadUploadSeries, adminUqloadStop } from '@/app/api';

export default function AdminUqload() {
  const [status, setStatus] = useState<any>(null);
  const [pending, setPending] = useState<any>(null);
  const [pendingBoth, setPendingBoth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<'status' | 'pending' | 'missing'>('status');

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      adminUqloadStatus().then(d => setStatus(d.data)),
      adminUqloadPending().then(d => setPending(d.data)),
      adminUqloadPendingBoth().then(d => setPendingBoth(d.data)),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleUpload = async (type: 'movies' | 'series') => {
    setUploading(true);
    try {
      if (type === 'movies') await adminUqloadUploadMovies();
      else await adminUqloadUploadSeries();
      setTimeout(fetchData, 2000);
    } finally {
      setUploading(false);
    }
  };

  const card = { background: '#181825', border: '1px solid #252535', borderRadius: 12, padding: '1.25rem' };
  const label = { color: '#6b6b80', fontSize: '0.75rem', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '0.25rem' };
  const value = { color: '#fff', fontSize: '1.25rem', fontWeight: 600 };
  const btnBase = { padding: '0.5rem 1rem', borderRadius: 8, border: 'none', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease' };

  if (loading && !status) return (
    <div style={{ padding: '2rem', color: '#6b6b80' }}>Chargement...</div>
  );

  if (status && !status.configured) return (
    <div style={{ padding: '2rem', color: '#6b6b80' }}>
      UQLOAD_API_KEY non configurée dans le .env
    </div>
  );

  return (
    <div style={{ padding: '1.5rem 2rem', color: '#fff', maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Uqload</h1>
          <p style={{ color: '#6b6b80', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
            Upload automatique des vidéos vers Uqload
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setTab('status')} style={{ ...btnBase, background: tab === 'status' ? '#6366f1' : '#252535', color: '#fff' }}>Statut</button>
          <button onClick={() => setTab('pending')} style={{ ...btnBase, background: tab === 'pending' ? '#6366f1' : '#252535', color: '#fff' }}>En attente</button>
          <button onClick={() => setTab('missing')} style={{ ...btnBase, background: tab === 'missing' ? '#f59e0b' : '#252535', color: '#fff' }}>Manquants</button>
          <button onClick={fetchData} style={{ ...btnBase, background: '#252535', color: '#fff' }}>⟳</button>
        </div>
      </div>

      {status?.isUploading && (
        <div style={{ background: '#2d1b1b', border: '1px solid #ef444455', borderRadius: 12, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#fca5a5', fontSize: '0.875rem' }}>
          ⚠ Upload en cours sur le serveur
        </div>
      )}

      {tab === 'status' && status && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={card}>
              <div style={label}>Stockage utilisé</div>
              <div style={value}>{formatBytes(status.account?.storageUsed)}</div>
            </div>
            <div style={card}>
              <div style={label}>Stockage restant</div>
              <div style={value}>{formatBytes(status.account?.storageLeft)}</div>
            </div>
            <div style={card}>
              <div style={label}>Compte</div>
              <div style={value}>{status.account?.login}</div>
            </div>
            <div style={card}>
              <div style={label}>Premium</div>
              <div style={{ ...value, color: status.account?.premium ? '#4ade80' : '#f87171' }}>
                {status.account?.premium ? 'Oui' : 'Non'}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={card}>
              <div style={label}>Films en attente Uqload</div>
              <div style={value}>{status.pending?.movies ?? '?'}</div>
            </div>
            <div style={card}>
              <div style={label}>Épisodes en attente Uqload</div>
              <div style={value}>{status.pending?.series ?? '?'}</div>
            </div>
            <div style={{ ...card, borderColor: (status.pendingBoth?.movies ?? 0) > 0 ? '#f59e0b55' : '#252535' }}>
              <div style={label}>Ni Uqload ni DoodStream</div>
              <div style={{ ...value, color: (status.pendingBoth?.movies ?? 0) > 0 ? '#fbbf24' : '#4ade80' }}>
                {status.pendingBoth?.movies ?? 0} films
              </div>
              <div style={{ color: '#6b6b80', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {status.pendingBoth?.series ?? 0} épisodes
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button onClick={() => handleUpload('movies')} disabled={uploading || status.isUploading}
              style={{ ...btnBase, background: '#6366f1', color: '#fff', opacity: uploading ? 0.6 : 1 }}>
              {uploading ? 'Upload en cours...' : 'Upload films (lot de 100)'}
            </button>
            <button onClick={() => handleUpload('series')} disabled={uploading || status.isUploading}
              style={{ ...btnBase, background: '#6366f1', color: '#fff', opacity: uploading ? 0.6 : 1 }}>
              {uploading ? 'Upload en cours...' : 'Upload séries (lot de 100)'}
            </button>
            <button onClick={async () => { await adminUqloadStop(); setTimeout(fetchData, 1000); }} disabled={!status.isUploading}
              style={{ ...btnBase, background: '#ef4444', color: '#fff', opacity: status.isUploading ? 1 : 0.4 }}>
              Arrêter l'upload
            </button>
          </div>
        </>
      )}

      {tab === 'pending' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={card}>
              <div style={label}>Films sans Uqload</div>
              <div style={value}>{pending?.totalMovies ?? 0}</div>
            </div>
            <div style={card}>
              <div style={label}>Épisodes sans Uqload</div>
              <div style={value}>{pending?.totalEpisodes ?? 0}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 400px' }}>
              <h3 style={{ color: '#6b6b80', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 0.75rem 0' }}>
                Films en attente ({pending?.movies?.length || 0} affichés)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {(pending?.movies || []).slice(0, 50).map((m: any, i: number) => (
                  <div key={i} style={{ background: '#181825', border: '1px solid #252535', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.8125rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{m.titre}</span>
                    <span style={{ color: m.fileCode ? '#22c55e' : '#6b6b80', fontSize: '0.6875rem', marginLeft: '0.5rem', flexShrink: 0 }}>
                      {m.fileCode ? 'DoodStream ✓' : m.lien?.includes('doodstream') ? 'DoodStream' : 'Direct'}
                    </span>
                  </div>
                ))}
                {(!pending?.movies || pending.movies.length === 0) && (
                  <div style={{ color: '#6b6b80', fontSize: '0.875rem' }}>Tous les films sont uploadés ✓</div>
                )}
              </div>
            </div>

            <div style={{ flex: '1 1 400px' }}>
              <h3 style={{ color: '#6b6b80', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 0.75rem 0' }}>
                Épisodes en attente ({pending?.series?.length || 0} affichés)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {(pending?.series || []).slice(0, 50).map((e: any, i: number) => (
                  <div key={i} style={{ background: '#181825', border: '1px solid #252535', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.8125rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {e.serieTitre} — {e.episode}
                    </span>
                    <span style={{ color: e.fileCode ? '#22c55e' : '#6b6b80', fontSize: '0.6875rem', marginLeft: '0.5rem', flexShrink: 0 }}>
                      {e.fileCode ? 'DoodStream ✓' : 'Lien OK'}
                    </span>
                  </div>
                ))}
                {(!pending?.series || pending.series.length === 0) && (
                  <div style={{ color: '#6b6b80', fontSize: '0.875rem' }}>Tous les épisodes sont uploadés ✓</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'missing' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ ...card, borderColor: '#f59e0b55' }}>
              <div style={label}>Films sur aucun service</div>
              <div style={{ ...value, color: '#fbbf24' }}>{pendingBoth?.totalMovies ?? 0}</div>
            </div>
            <div style={{ ...card, borderColor: '#f59e0b55' }}>
              <div style={label}>Épisodes sur aucun service</div>
              <div style={{ ...value, color: '#fbbf24' }}>{pendingBoth?.totalEpisodes ?? 0}</div>
            </div>
          </div>

          <p style={{ color: '#6b6b80', fontSize: '0.8125rem', marginBottom: '1rem' }}>
            Ces contenus ne sont ni sur Uqload ni sur DoodStream. Utilisez le script CLI <code style={{ background: '#252535', padding: '0.125rem 0.375rem', borderRadius: 4 }}>npm run upload-uqload</code> pour les uploader.
          </p>

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 400px' }}>
              <h3 style={{ color: '#6b6b80', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 0.75rem 0' }}>
                Films manquants ({pendingBoth?.movies?.length || 0} affichés)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {(pendingBoth?.movies || []).slice(0, 50).map((m: any, i: number) => (
                  <div key={i} style={{ background: '#181825', border: '1px solid #252535', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.8125rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{m.titre}</span>
                    <span style={{ color: '#6b6b80', fontSize: '0.6875rem', marginLeft: '0.5rem', flexShrink: 0 }}>
                      {m.tmdbId ? 'TMDB ✓' : '—'}
                    </span>
                  </div>
                ))}
                {(!pendingBoth?.movies || pendingBoth.movies.length === 0) && (
                  <div style={{ color: '#4ade80', fontSize: '0.875rem' }}>Tous les films sont sur au moins un service ✓</div>
                )}
              </div>
            </div>

            <div style={{ flex: '1 1 400px' }}>
              <h3 style={{ color: '#6b6b80', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 0.75rem 0' }}>
                Épisodes manquants ({pendingBoth?.series?.length || 0} affichés)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {(pendingBoth?.series || []).slice(0, 50).map((e: any, i: number) => (
                  <div key={i} style={{ background: '#181825', border: '1px solid #252535', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.8125rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {e.serieTitre} — S{e.season}E{e.episodeNumber}
                    </span>
                    <span style={{ color: '#6b6b80', fontSize: '0.6875rem', marginLeft: '0.5rem', flexShrink: 0 }}>
                      {e.lien ? 'Lien OK' : 'Aucun lien'}
                    </span>
                  </div>
                ))}
                {(!pendingBoth?.series || pendingBoth.series.length === 0) && (
                  <div style={{ color: '#4ade80', fontSize: '0.875rem' }}>Tous les épisodes sont sur au moins un service ✓</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function formatBytes(bytes: number | string): string {
  const n = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (!n || isNaN(n)) return '?';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  let i = 0;
  let size = n;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(1)} ${units[i]}`;
}
