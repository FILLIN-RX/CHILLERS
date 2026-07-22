'use client';

import { useEffect, useState, useRef } from 'react';
import { adminGetDeadLinks, adminAppealDeadLink, adminRescrapeDeadLink, adminGetLogsStreamUrl, adminRunMaintenance, adminUpdateDeadLink } from '@/app/api';

interface DeadLink {
  _id: string;
  titre: string;
  episode: string;
  lien: string;
  type?: string;
}

interface RescrapeModal {
  link: DeadLink;
  logs: string[];
  status: 'launching' | 'running' | 'success' | 'error';
}

export default function AdminDeadLinks() {
  const [links, setLinks] = useState<DeadLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [headless, setHeadless] = useState(true);
  const [modal, setModal] = useState<RescrapeModal | null>(null);
  const [editLink, setEditLink] = useState<DeadLink | null>(null);
  const [editValue, setEditValue] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [detectLogs, setDetectLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    adminGetDeadLinks().then(res => {
      if (res.success) setLinks(res.data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [modal?.logs, detectLogs]);

  async function handleAppeal(id: string) {
    const res = await adminAppealDeadLink(id);
    if (res.success) {
      setLinks(prev => prev.filter(l => l._id !== id));
    }
  }

  async function handleRescrape(link: DeadLink) {
    setModal({ link, logs: [`[Rescrape] Lancement du rescrape pour "${link.titre}"...`], status: 'launching' });

    const evtSource = new EventSource(adminGetLogsStreamUrl());
    let done = false;

    evtSource.onmessage = (e) => {
      try {
        const { line } = JSON.parse(e.data);
        if (!line.includes('[Rescrape]')) return;
        setModal(prev => {
          if (!prev) return prev;
          const isSuccess = line.includes('✅ FINI');
          const isError = line.includes('❌ FINI');
          if (isSuccess || isError) done = true;
          return {
            ...prev,
            logs: [...prev.logs, line],
            status: isSuccess ? 'success' : isError ? 'error' : prev.status,
          };
        });
      } catch { }
    };

    try {
      setModal(prev => prev ? { ...prev, status: 'running' } : prev);
      const res = await adminRescrapeDeadLink(link._id, headless);
      if (!res.success) {
        setModal(prev => prev ? { ...prev, logs: [...prev.logs, `[Erreur] ${res.message}`], status: 'error' } : prev);
        done = true;
      }
    } catch (e: any) {
      setModal(prev => prev ? { ...prev, logs: [...prev.logs, `[Erreur] ${e.message}`], status: 'error' } : prev);
      done = true;
    }

    // Wait for FINI marker, timeout after 60s
    for (let i = 0; i < 120; i++) {
      if (done) break;
      await new Promise(r => setTimeout(r, 500));
    }
    evtSource.close();
  }

  async function handleDetect() {
    setDetecting(true);
    setDetectLogs(['[Détection] Lancement de la vérification des liens morts...']);

    const evtSource = new EventSource(adminGetLogsStreamUrl());
    let done = false;

    evtSource.onmessage = (e) => {
      try {
        const { line } = JSON.parse(e.data);
        setDetectLogs(prev => [...prev, line]);
      } catch { }
    };

    try {
      await adminRunMaintenance('check-all-links');
      setDetectLogs(prev => [...prev, '[Détection] Vérification lancée, attente des résultats...']);
    } catch (e: any) {
      setDetectLogs(prev => [...prev, `[Erreur] ${e.message}`]);
      done = true;
    }

    // Wait up to 120s then refresh list
    for (let i = 0; i < 240; i++) {
      if (done) break;
      await new Promise(r => setTimeout(r, 500));
    }
    evtSource.close();
    const res = await adminGetDeadLinks();
    if (res.success) setLinks(res.data);
    setDetecting(false);
  }

  async function handleEditSave() {
    if (!editLink || !editValue.trim()) return;
    try {
      const res = await adminUpdateDeadLink(editLink._id, editValue.trim());
      if (res.success) {
        setLinks(prev => prev.filter(l => l._id !== editLink._id));
        setEditLink(null);
      }
    } catch { }
  }

  function closeModal() {
    if (modal && modal.status === 'success') {
      setLinks(prev => prev.filter(l => l._id !== modal.link._id));
    }
    setModal(null);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
          Liens morts
          <span style={{ color: '#6b6b80', fontSize: '0.875rem', fontWeight: 400, marginLeft: '0.5rem' }}>
            {links.filter(l => l.type === 'series').length} séries · {links.filter(l => l.type !== 'series').length} films
          </span>
        </h1>
        <button onClick={handleDetect} disabled={detecting} style={{
          padding: '0.5rem 1rem', background: detecting ? '#555' : '#ef4444', color: '#fff',
          border: 'none', borderRadius: 8, cursor: detecting ? 'default' : 'pointer',
          fontSize: '0.8125rem', fontWeight: 600,
        }}>
          {detecting ? 'Détection en cours...' : '🔍 Détecter'}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <label style={{ color: '#aaa', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={headless} onChange={e => setHeadless(e.target.checked)}
            style={{ accentColor: '#6366f1' }} />
          Headless
        </label>
        <span style={{ color: '#333', fontSize: '0.75rem' }}>|</span>
        <span style={{ color: '#6b6b80', fontSize: '0.75rem' }}>Upload DoodStream :</span>
        <button onClick={() => adminRunMaintenance('upload-movies')} style={{
          padding: '0.35rem 0.75rem', background: '#22c55e', color: '#000', border: 'none',
          borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
        }}>
          Films
        </button>
        <button onClick={() => adminRunMaintenance('upload-series')} style={{
          padding: '0.35rem 0.75rem', background: '#22c55e', color: '#000', border: 'none',
          borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
        }}>
          Séries
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#888' }}>Chargement...</p>
      ) : links.length === 0 && !detecting ? (
        <p style={{ color: '#22c55e' }}>Aucun lien mort détecté</p>
      ) : (
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr 170px', gap: '0.5rem', padding: '0.75rem 1rem', background: '#2a2a2a', color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            <span>Titre</span>
            <span>Épisode</span>
            <span>Lien</span>
            <span></span>
          </div>
          {links.map((link) => (
            <div key={link._id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr 170px', gap: '0.5rem', padding: '0.75rem 1rem', borderBottom: '1px solid #2a2a2a', color: '#ccc', fontSize: '0.8125rem', wordBreak: 'break-all', alignItems: 'center' }}>
              <span>{link.titre}</span>
              <span style={{ color: '#f87171' }}>{link.episode}</span>
              <span style={{ color: '#ef4444', fontFamily: 'monospace', fontSize: '0.75rem' }}>{link.lien}</span>
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                <button onClick={() => handleAppeal(link._id)}
                  style={{ padding: '0.3rem 0.5rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                  Appeal
                </button>
                <button onClick={() => { setEditLink(link); setEditValue(link.lien); }}
                  style={{ padding: '0.3rem 0.5rem', background: '#f59e0b', color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                  Edit
                </button>
                <button onClick={() => handleRescrape(link)}
                  disabled={modal?.link._id === link._id}
                  style={{ padding: '0.3rem 0.5rem', background: modal?.link._id === link._id ? '#555' : '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', cursor: modal?.link._id === link._id ? 'default' : 'pointer', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                  {modal?.link._id === link._id ? '...' : 'Rescrape'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {detectLogs.length > 0 && detecting && (
        <div style={{
          marginTop: '1.5rem', background: '#0d0d1a', border: '1px solid #2a2a4e', borderRadius: 12,
          padding: '1rem', maxHeight: 300, overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: 1.6,
        }}>
          {detectLogs.map((l, i) => {
            const isError = l.includes('❌') || l.includes('Erreur');
            const isSuccess = l.includes('✅');
            return (
              <div key={i} style={{
                color: isError ? '#ef4444' : isSuccess ? '#22c55e' : '#aaa',
                whiteSpace: 'pre-wrap',
              }}>{l}</div>
            );
          })}
          <div ref={logEndRef} />
        </div>
      )}

      {/* Edit modal */}
      {editLink && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        }} onClick={() => setEditLink(null)}>
          <div style={{
            background: '#1a1a2e', border: '1px solid #2a2a4e', borderRadius: 16,
            padding: '1.5rem', width: 560, maxWidth: '90vw',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ color: '#fff', fontSize: '1.125rem', margin: 0 }}>{editLink.titre}</h2>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem', fontSize: '0.8125rem' }}>
                  <span style={{ color: '#6b6b80' }}>
                    {editLink.type === 'series' ? 'Série' : 'Film'}
                  </span>
                  {editLink.episode && <span style={{ color: '#f87171' }}>{editLink.episode}</span>}
                </div>
              </div>
              <button onClick={() => setEditLink(null)} style={{
                background: 'none', border: 'none', color: '#6b6b80', cursor: 'pointer',
                fontSize: '1.25rem', padding: '0.25rem',
              }}>✕</button>
            </div>

            <label style={{ color: '#888', fontSize: '0.75rem', marginBottom: '0.375rem', display: 'block' }}>Nouveau lien</label>
            <input
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '0.75rem', borderRadius: 10,
                border: '1px solid #333', background: '#111', color: '#fff',
                fontSize: '0.8125rem', fontFamily: 'monospace', outline: 'none', marginBottom: '1rem',
              }}
              placeholder="https://..."
            />

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditLink(null)}
                style={{ padding: '0.5rem 1rem', background: '#333', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.8125rem' }}>
                Annuler
              </button>
              <button onClick={handleEditSave} disabled={!editValue.trim()}
                style={{ padding: '0.5rem 1rem', background: editValue.trim() ? '#22c55e' : '#555', color: '#000', border: 'none', borderRadius: 8, cursor: editValue.trim() ? 'pointer' : 'default', fontSize: '0.8125rem', fontWeight: 600 }}>
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rescrape modal */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        }} onClick={closeModal}>
          <div style={{
            background: '#1a1a2e', border: modal.status === 'success' ? '1px solid #22c55e' : modal.status === 'error' ? '1px solid #ef4444' : '1px solid #2a2a4e',
            borderRadius: 16, padding: '1.5rem', width: 600, maxWidth: '90vw', maxHeight: '80vh',
            display: 'flex', flexDirection: 'column',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ color: '#fff', fontSize: '1.125rem', margin: 0 }}>{modal.link.titre}</h2>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem', fontSize: '0.8125rem' }}>
                  <span style={{ color: '#6b6b80' }}>
                    {modal.link.type === 'series' ? 'Série' : 'Film'}
                  </span>
                  {modal.link.episode && <span style={{ color: '#f87171' }}>{modal.link.episode}</span>}
                </div>
              </div>
              <button onClick={closeModal} style={{
                background: 'none', border: 'none', color: '#6b6b80', cursor: 'pointer',
                fontSize: '1.25rem', padding: '0.25rem',
              }}>✕</button>
            </div>

            {modal.status === 'success' ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>✅</div>
                <div style={{ color: '#22c55e', fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                  Lien récupéré avec succès
                </div>
                <div style={{ color: '#6b6b80', fontSize: '0.8125rem', wordBreak: 'break-all', marginBottom: '1.5rem' }}>
                  {modal.logs.find(l => l.includes('Nouveau lien'))?.replace(/.*✅ Nouveau lien: /, '')}
                </div>
                <button onClick={closeModal} style={{
                  padding: '0.625rem 1.5rem', background: '#22c55e', color: '#000', border: 'none',
                  borderRadius: 8, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
                }}>
                  Fermer
                </button>
              </div>
            ) : modal.status === 'error' ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>❌</div>
                <div style={{ color: '#ef4444', fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
                  Échec du rescrape
                </div>
                <div style={{
                  background: '#0d0d1a', border: '1px solid #2a2a3e', borderRadius: 10,
                  padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: 1.5,
                  maxHeight: 200, overflowY: 'auto', textAlign: 'left', marginBottom: '1rem',
                }}>
                  {modal.logs.map((l, i) => (
                    <div key={i} style={{
                      color: l.includes('❌') || l.includes('Erreur') ? '#ef4444' : l.includes('✅') ? '#22c55e' : '#aaa',
                      whiteSpace: 'pre-wrap',
                    }}>{l}</div>
                  ))}
                  <div ref={logEndRef} />
                </div>
                <button onClick={closeModal} style={{
                  padding: '0.625rem 1.5rem', background: '#ef4444', color: '#fff', border: 'none',
                  borderRadius: 8, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
                }}>
                  Fermer
                </button>
              </div>
            ) : (
              <div style={{
                flex: 1, overflowY: 'auto', minHeight: 0,
                background: '#0d0d1a', border: '1px solid #2a2a3e', borderRadius: 10,
                padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: 1.5,
              }}>
                {modal.logs.map((l, i) => {
                  const isError = l.includes('❌') || l.includes('Erreur');
                  const isSuccess = l.includes('✅');
                  return (
                    <div key={i} style={{
                      color: isError ? '#ef4444' : isSuccess ? '#22c55e' : '#aaa',
                      whiteSpace: 'pre-wrap',
                    }}>{l}</div>
                  );
                })}
                <div ref={logEndRef} />
                <span style={{ color: '#6b6b80', display: 'block', marginTop: '0.5rem' }}>Scraping en cours...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}