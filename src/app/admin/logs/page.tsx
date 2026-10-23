'use client';

import { useEffect, useRef, useState } from 'react';
import { adminGetLogs, adminGetLogsStreamUrl } from '@/services/admin';
import { Typography, Segmented, Space, Button, Card, Spin, Alert, Badge } from '@/components/admin/ui';
import { ClearOutlined } from '@/components/admin/icons';

const { Title, Text } = Typography;

const LINE_COLOR = (line: string) => {
  if (line.includes('ERREUR')) return '#f87171';
  if (line.includes('succès')) return '#34d399';
  if (line.includes('[Cron]')) return '#6554c0';
  if (line.includes('[Scraping')) return '#fbbf24';
  return '#475467';
};

function LogBlock({ title, lines, color }: { title: string; lines: string[]; color: string }) {
  return (
    <Card title={title} size="small">
      <pre style={{
        background: '#f9f7f4', border: '1px solid #e9edf3', borderRadius: 8, padding: '0.875rem',
        color, fontSize: 12, maxHeight: 400, overflow: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.5,
        margin: 0, fontFamily: 'monospace',
      }}>
        {lines.length > 0 ? lines.join('\n') : 'Aucune entrée'}
      </pre>
    </Card>
  );
}

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

  return (
    <div>
      <Text type="secondary" style={{ fontSize: 11, letterSpacing: '.12em' }}>SYSTÈME · DIAGNOSTIC</Text>
      <Title level={2} style={{ margin: '4px 0' }}>Journaux d’activité</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 18 }}>Suivez les tâches en direct et consultez les erreurs récentes du catalogue.</Text>

      <Space wrap style={{ marginBottom: '1.25rem' }}>
        <Segmented
          value={type}
          onChange={(v) => setType(v as string)}
          options={[
            { label: 'Tous', value: 'all' },
            { label: 'Séries TMDB', value: 'series' },
            { label: 'Films TMDB', value: 'movies' },
            { label: 'Cron', value: 'cron' },
          ]}
        />
        <Space size="small">
          <Badge color="#34d399" text={<Text type="secondary" style={{ fontSize: 12 }}>Temps réel</Text>} />
          {streamLines.length > 0 && (
            <Button size="small" icon={<ClearOutlined />} onClick={() => setStreamLines([])}>
              Effacer
            </Button>
          )}
        </Space>
      </Space>

      <Card size="small" styles={{ body: { padding: 0 } }} style={{ marginBottom: '1.5rem' }}>
        <pre
          ref={preRef}
          style={{
            background: '#f9f7f4', border: 'none', borderRadius: 8, padding: '0.875rem',
            color: '#475467', fontSize: 12, maxHeight: 500, overflow: 'auto',
            whiteSpace: 'pre-wrap', lineHeight: 1.5, margin: 0, fontFamily: 'monospace',
          }}
        >
          {streamLines.length === 0
            ? <span style={{ color: '#667085' }}>En attente de logs...</span>
            : streamLines.map((line, i) => (
              <div key={i} style={{ color: LINE_COLOR(line) }}>{line}</div>
            ))
          }
        </pre>
      </Card>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#667085' }}>
          <Spin /> Chargement...
        </div>
      ) : logs ? (
        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
          {logs.series && <LogBlock title="Erreurs TMDB - Séries" lines={logs.series} color="#f87171" />}
          {logs.movies && <LogBlock title="Erreurs TMDB - Films" lines={logs.movies} color="#f87171" />}
          {logs.cron && <LogBlock title="Logs Cron" lines={logs.cron} color="#34d399" />}
        </Space>
      ) : (
        <Alert type="error" showIcon message="Erreur de chargement" />
      )}
    </div>
  );
}
