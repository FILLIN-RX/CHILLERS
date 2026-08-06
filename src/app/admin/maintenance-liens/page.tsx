'use client';

import { useEffect, useState, useRef } from 'react';
import { adminGetLogsStreamUrl, adminRunMaintenance } from '@/app/api';
import { Typography, Button, Space, Card, Badge } from 'antd';
import {
  SearchOutlined, ToolOutlined, VideoCameraOutlined, ClearOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

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
    if (line.includes('✅') || line.includes('Succès') || line.includes('OK')) return '#34d399';
    if (line.includes('❌') || line.includes('Erreur') || line.includes('FAIL') || line.includes('FATAL')) return '#f87171';
    if (line.includes('🔍') || line.includes('Détecté') || line.includes('mort') || line.includes('Dead link')) return '#fbbf24';
    return '#a5adc0';
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <Title level={3} style={{ margin: 0 }}>Maintenance des liens</Title>
        <Space size="small">
          <Badge status={connected ? 'success' : 'error'} text={<Text type="secondary" style={{ fontSize: 12 }}>{connected ? 'Connecté' : 'Déconnecté'}</Text>} />
        </Space>
      </div>
      <Text type="secondary" style={{ display: 'block', marginBottom: '1.25rem' }}>
        Vérifie tous les liens et répare ceux qui sont morts
      </Text>

      <Space wrap style={{ marginBottom: '1.25rem' }}>
        <Button
          type="primary"
          icon={<SearchOutlined />}
          loading={running === 'check-all-links'}
          disabled={!!running}
          onClick={() => launch('check-all-links')}
        >
          Détecter les liens morts
        </Button>
        <Button
          icon={<ToolOutlined />}
          loading={running === 'dead-links'}
          disabled={!!running}
          onClick={() => launch('dead-links')}
          style={{ background: '#0d2b1a', borderColor: '#14532d', color: '#34d399' }}
        >
          Réparer les séries
        </Button>
        <Button
          icon={<VideoCameraOutlined />}
          loading={running === 'repair-movies'}
          disabled={!!running}
          onClick={() => launch('repair-movies')}
          style={{ background: '#2b1d0a', borderColor: '#53350d', color: '#fbbf24' }}
        >
          Réparer les films
        </Button>
        {logs.length > 0 && (
          <Button icon={<ClearOutlined />} onClick={() => { setLogs([]); stopSSE(); }}>
            Effacer
          </Button>
        )}
      </Space>

      <Card
        size="small"
        styles={{ body: { padding: '0.75rem' } }}
      >
        <div style={{
          minHeight: 300, maxHeight: '70vh', overflowY: 'auto',
          fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6,
        }}>
          {logs.length === 0 ? (
            <p style={{ color: '#6b7488', textAlign: 'center', marginTop: '5rem', fontSize: 13 }}>
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
                    background: isTransition ? 'rgba(52,211,153,0.06)' : 'transparent',
                    padding: '0.125rem 0 0.125rem 0.5rem',
                    borderLeft: isTransition ? '2px solid #34d399' : '2px solid transparent',
                  }}
                >
                  {entry.line}
                </div>
              );
            })
          )}
          <div ref={logEndRef} />
        </div>
      </Card>
    </div>
  );
}
