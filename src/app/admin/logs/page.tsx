'use client';

import { useEffect, useRef, useState } from 'react';
import { adminGetLogs, adminGetLogsStreamUrl } from '@/app/api';

export default function AdminLogs() {
  const [logs, setLogs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('all');
  const [streamLines, setStreamLines] = useState<string[]>([]);
  const streamRef = useRef<EventSource | null>(null);
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    setLoading(true);
    adminGetLogs(type, 200).then(res => {
      if (res.success) setLogs(res.data);
      setLoading(false);
    });
  }, [type]);

  useEffect(() => {
    const url = adminGetLogsStreamUrl();
    const es = new EventSource(url);
    streamRef.current = es;
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

  const tabStyle = (t: string): React.CSSProperties => ({
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    border: 'none',
    background: type === t ? '#6366f1' : '#2a2a2a',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.8125rem',
    fontWeight: type === t ? 600 : 400,
  });

  return (
    <div>
      <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Logs</h1>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button onClick={() => setType('all')} style={tabStyle('all')}>Tous</button>
        <button onClick={() => setType('series')} style={tabStyle('series')}>Séries TMDB</button>
        <button onClick={() => setType('movies')} style={tabStyle('movies')}>Films TMDB</button>
        <button onClick={() => setType('cron')} style={tabStyle('cron')}>Cron</button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <span style={{ color: '#22c55e', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
          Temps réel
        </span>
        <button
          onClick={() => setStreamLines([])}
          style={{ background: 'transparent', border: '1px solid #444', color: '#888', borderRadius: '6px', padding: '0.25rem 0.75rem', cursor: 'pointer', fontSize: '0.75rem' }}
        >
          Effacer
        </button>
      </div>

      <pre
        ref={preRef}
        style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '1rem', color: '#e2e8f0', fontSize: '0.75rem', maxHeight: '600px', overflow: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.5, fontFamily: 'monospace' }}
      >
        {streamLines.length === 0
          ? <span style={{ color: '#666' }}>En attente de logs...</span>
          : streamLines.map((line, i) => (
              <div key={i} style={{
                color: line.includes('ERREUR') ? '#ef4444' :
                       line.includes('succès') ? '#22c55e' :
                       line.includes('[Cron]') ? '#6366f1' :
                       line.includes('[Scraping') ? '#f59e0b' : '#e2e8f0'
              }}>{line}</div>
            ))
        }
      </pre>

      {loading ? (
        <p style={{ color: '#888', marginTop: '1rem' }}>Chargement...</p>
      ) : logs ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '2rem' }}>
          {logs.series && (
            <div>
              <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Erreurs TMDB - Séries</h2>
              <pre style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '1rem', color: '#f87171', fontSize: '0.75rem', maxHeight: '400px', overflow: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {logs.series.length > 0 ? logs.series.join('\n') : 'Aucune erreur'}
              </pre>
            </div>
          )}
          {logs.movies && (
            <div>
              <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Erreurs TMDB - Films</h2>
              <pre style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '1rem', color: '#f87171', fontSize: '0.75rem', maxHeight: '400px', overflow: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {logs.movies.length > 0 ? logs.movies.join('\n') : 'Aucune erreur'}
              </pre>
            </div>
          )}
          {logs.cron && (
            <div>
              <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Logs Cron</h2>
              <pre style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '1rem', color: '#22c55e', fontSize: '0.75rem', maxHeight: '400px', overflow: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {logs.cron.length > 0 ? logs.cron.join('\n') : 'Aucun log'}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <p style={{ color: '#ef4444', marginTop: '1rem' }}>Erreur de chargement</p>
      )}
    </div>
  );
}
