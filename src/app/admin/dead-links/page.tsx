'use client';

import { useEffect, useState, useRef } from 'react';
import { adminGetDeadLinks, adminAppealDeadLink, adminRescrapeDeadLink, adminGetLogsStreamUrl } from '@/app/api';

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
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    adminGetDeadLinks().then(res => {
      if (res.success) setLinks(res.data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [modal?.logs]);

  async function handleAppeal(id: string) {
    const res = await adminAppealDeadLink(id);
    if (res.success) {
      setLinks(prev => prev.filter(l => l._id !== id));
    }
  }

  async function handleRescrape(link: DeadLink) {
    setModal({ link, logs: [`[Rescrape] Lancement du rescrape pour "${link.titre}"...`], status: 'launching' });

    const evtSource = new EventSource(adminGetLogsStreamUrl());
    evtSource.onmessage = (e) => {
      try {
        const { line } = JSON.parse(e.data);
        if (line.includes('[Rescrape]')) {
          setModal(prev => prev ? {
            ...prev,
            logs: [...prev.logs, line],
            status: line.includes('✅') ? 'success' : line.includes('❌') ? 'error' : 'running',
          } : prev);
        }
      } catch { }
    };

    try {
      setModal(prev => prev ? { ...prev, status: 'running' } : prev);
      const res = await adminRescrapeDeadLink(link._id, headless);
      if (!res.success) {
        setModal(prev => prev ? { ...prev, logs: [...prev.logs, `[Erreur] ${res.message}`], status: 'error' } : prev);
      }
    } catch (e: any) {
      setModal(prev => prev ? { ...prev, logs: [...prev.logs, `[Erreur] ${e.message}`], status: 'error' } : prev);
    }

    // Keep listening for a bit then close
    await new Promise(r => setTimeout(r, 5000));
    evtSource.close();
  }

  function closeModal() {
    if (modal && modal.status === 'success') {
      setLinks(prev => prev.filter(l => l._id !== modal.link._id));
    }
    setModal(null);
  }

  return (
    <div>
      <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Liens morts</h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <label style={{ color: '#aaa', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={headless} onChange={e => setHeadless(e.target.checked)}
            style={{ accentColor: '#6366f1' }} />
          Headless
        </label>
      </div>

      {loading ? (
        <p style={{ color: '#888' }}>Chargement...</p>
      ) : links.length === 0 ? (
        <p style={{ color: '#22c55e' }}>Aucun lien mort détecté</p>
      ) : (
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr 120px', gap: '0.5rem', padding: '0.75rem 1rem', background: '#2a2a2a', color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            <span>Titre</span>
            <span>Épisode</span>
            <span>Lien</span>
            <span></span>
          </div>
          {links.map((link) => (
            <div key={link._id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr 120px', gap: '0.5rem', padding: '0.75rem 1rem', borderBottom: '1px solid #2a2a2a', color: '#ccc', fontSize: '0.8125rem', wordBreak: 'break-all', alignItems: 'center' }}>
              <span>{link.titre}</span>
              <span style={{ color: '#f87171' }}>{link.episode}</span>
              <span style={{ color: '#ef4444', fontFamily: 'monospace', fontSize: '0.75rem' }}>{link.lien}</span>
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                <button onClick={() => handleAppeal(link._id)}
                  style={{ padding: '0.3rem 0.6rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                  Appeal
                </button>
                <button onClick={() => handleRescrape(link)}
                  disabled={modal?.link._id === link._id}
                  style={{ padding: '0.3rem 0.6rem', background: modal?.link._id === link._id ? '#555' : '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', cursor: modal?.link._id === link._id ? 'default' : 'pointer', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                  Rescrape
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
                  {modal.link.episode && (
                    <span style={{ color: '#f87171' }}>{modal.link.episode}</span>
                  )}
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