'use client';

import { useEffect, useState, useRef } from 'react';
import { adminGetLogsStreamUrl, adminRunMaintenance } from '@/app/api';

interface LogEntry {
  line: string;
  ts: number;
}

export default function AdminMaintenanceLiens() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const evtSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const startSSE = () => {
    if (evtSourceRef.current) evtSourceRef.current.close();
    const es = new EventSource(adminGetLogsStreamUrl());
    evtSourceRef.current = es;
    setConnected(true);

    es.onmessage = (e) => {
      try {
        const { line } = JSON.parse(e.data);
        if (!line.includes('[CheckLinks]') && !line.includes('[Maintenance]') && !line.includes('[LinkCheck]') && !line.includes('[Rescrape]') && !line.includes('[Cron]')) return;
        setLogs(prev => [...prev, { line, ts: Date.now() }]);
      } catch {}
    };

    es.onerror = () => {
      setConnected(false);
    };
  };

  const launch = async (type: string) => {
    setRunning(type);
    setLogs([]);
    startSSE();
    try {
      await adminRunMaintenance(type);
    } catch (e: any) {
      setLogs(prev => [...prev, { line: `[Erreur] ${e.message}`, ts: Date.now() }]);
    } finally {
      setRunning(null);
    }
  };

  const stopSSE = () => {
    if (evtSourceRef.current) {
      evtSourceRef.current.close();
      evtSourceRef.current = null;
    }
    setConnected(false);
  };

  const lineColor = (line: string) => {
    if (line.includes('✅') || line.includes('Succès') || line.includes('OK')) return '#22c55e';
    if (line.includes('❌') || line.includes('Erreur') || line.includes('FAIL') || line.includes('FATAL')) return '#ef4444';
    if (line.includes('🔍') || line.includes('Détecté') || line.includes('mort') || line.includes('Dead link')) return '#f59e0b';
    return '#c0c0d0';
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
          Maintenance des liens
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: connected ? '#22c55e' : '#ef4444',
          }} />
          <span style={{ color: '#6b6b80', fontSize: '0.75rem' }}>
            {connected ? 'Connecté' : 'Déconnecté'}
          </span>
        </div>
      </div>
      <p style={{ color: '#6b6b80', fontSize: '0.8125rem', marginBottom: '1.5rem' }}>
        Vérifie tous les liens et répare ceux qui sont morts
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => launch('check-all-links')}
          disabled={!!running}
          style={{
            padding: '0.625rem 1.25rem', borderRadius: 10, border: 'none',
            background: running ? '#444' : '#6366f1', color: '#fff',
            cursor: running ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}
        >
          {running === 'check-all-links' ? '⏳' : '🔍'} Détecter les liens morts
        </button>
        <button
          onClick={() => launch('dead-links')}
          disabled={!!running}
          style={{
            padding: '0.625rem 1.25rem', borderRadius: 10, border: 'none',
            background: running ? '#444' : '#22c55e', color: '#fff',
            cursor: running ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}
        >
          {running === 'dead-links' ? '⏳' : '🔧'} Réparer les séries
        </button>
        <button
          onClick={() => launch('repair-movies')}
          disabled={!!running}
          style={{
            padding: '0.625rem 1.25rem', borderRadius: 10, border: 'none',
            background: running ? '#444' : '#f59e0b', color: '#fff',
            cursor: running ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}
        >
          {running === 'repair-movies' ? '⏳' : '🎬'} Réparer les films
        </button>
        {logs.length > 0 && (
          <button
            onClick={() => { setLogs([]); stopSSE(); }}
            style={{
              padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid #333',
              background: 'transparent', color: '#6b6b80', cursor: 'pointer', fontSize: '0.8125rem',
            }}
          >
            Effacer
          </button>
        )}
      </div>

      <div style={{
        background: '#0d0d14', border: '1px solid #1e1e2a', borderRadius: 12,
        padding: '1rem', minHeight: 300, maxHeight: '70vh', overflowY: 'auto',
        fontFamily: 'monospace', fontSize: '0.8125rem', lineHeight: 1.6,
      }}>
        {logs.length === 0 ? (
          <p style={{ color: '#555', textAlign: 'center', marginTop: '4rem' }}>
            Lance une détection ou une réparation pour voir les résultats en temps réel
          </p>
        ) : (
          logs.map((entry, i) => {
            const isTransition = entry.line.includes('→') || entry.line.includes('Réparé') || entry.line.includes('Succès');
            return (
              <div
                key={i}
                style={{
                  color: lineColor(entry.line),
                  background: isTransition ? 'rgba(34,197,94,0.06)' : 'transparent',
                  padding: '0.125rem 0',
                  borderLeft: isTransition ? '2px solid #22c55e' : '2px solid transparent',
                  paddingLeft: '0.5rem',
                }}
              >
                {entry.line}
              </div>
            );
          })
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}