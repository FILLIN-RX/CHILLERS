'use client';

import { useEffect, useState } from 'react';
import { adminGetTmdbStats, adminTriggerTmdbLink, adminGetLogs } from '@/app/api';
import {
  Card, Statistic, Row, Col, Button, Space, Typography, Spin, Segmented, Alert,
} from 'antd';
import { LinkOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

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
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minHeight: '40vh', color: '#6b7488' }}>
      <Spin /> Chargement...
    </div>
  );

  const linkRate = (linked: number, total: number) =>
    total > 0 ? `${Math.round((linked / total) * 100)}%` : '—';

  const errors = logType === 'series' ? logs?.series : logs?.movies;

  return (
    <div>
      <Title level={3} style={{ marginTop: 0, marginBottom: '1.25rem' }}>Liaison TMDB</Title>

      {msg && (
        <Alert
          type={msg.includes('Erreur') ? 'error' : msg === 'Liaison films terminée' || msg === 'Liaison séries terminée' ? 'success' : 'info'}
          showIcon
          message={msg}
          style={{ marginBottom: '1rem', maxWidth: 480 }}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: '1.75rem' }}>
        <Col xs={24} md={12} lg={8}>
          <Card size="small">
            <Statistic title={<span style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Films</span>} value={stats?.movies?.total || 0} />
            <Space split={<Text type="secondary">·</Text>} style={{ fontSize: 12, marginTop: 4 }}>
              <Text style={{ color: '#34d399', fontSize: 12 }}>✓ {stats?.movies?.linked || 0} liés</Text>
              <Text style={{ color: '#f87171', fontSize: 12 }}>✗ {stats?.movies?.unlinked || 0} non liés</Text>
              <Text style={{ color: '#a99bf0', fontSize: 12 }}>{linkRate(stats?.movies?.linked, stats?.movies?.total)}</Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={12} lg={8}>
          <Card size="small">
            <Statistic title={<span style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Séries</span>} value={stats?.series?.total || 0} />
            <Space split={<Text type="secondary">·</Text>} style={{ fontSize: 12, marginTop: 4 }}>
              <Text style={{ color: '#34d399', fontSize: 12 }}>✓ {stats?.series?.linked || 0} liées</Text>
              <Text style={{ color: '#f87171', fontSize: 12 }}>✗ {stats?.series?.unlinked || 0} non liées</Text>
              <Text style={{ color: '#a99bf0', fontSize: 12 }}>{linkRate(stats?.series?.linked, stats?.series?.total)}</Text>
            </Space>
          </Card>
        </Col>
      </Row>

      <Title level={5} style={{ marginBottom: '0.75rem' }}>Liaison</Title>
      <Space wrap style={{ marginBottom: '1.75rem' }}>
        <Button
          type="primary"
          icon={<LinkOutlined />}
          onClick={async () => {
            setMsg('Liaison TMDB films en cours...');
            const res = await adminTriggerTmdbLink('movies');
            setMsg(res.data?.status === 'done' ? 'Liaison films terminée' : `Erreur: ${res.data?.message || 'Inconnue'}`);
          }}
        >
          Lier les films (TMDB)
        </Button>
        <Button
          type="primary"
          icon={<LinkOutlined />}
          onClick={async () => {
            setMsg('Liaison TMDB séries en cours...');
            const res = await adminTriggerTmdbLink('series');
            setMsg(res.data?.status === 'done' ? 'Liaison séries terminée' : `Erreur: ${res.data?.message || 'Inconnue'}`);
          }}
        >
          Lier les séries (TMDB)
        </Button>
      </Space>

      <Title level={5} style={{ marginBottom: '0.75rem' }}>Erreurs de liaison</Title>
      <Segmented
        value={logType}
        onChange={(v) => setLogType(v as string)}
        options={[
          { label: 'Séries', value: 'series' },
          { label: 'Films', value: 'movies' },
        ]}
        style={{ marginBottom: '1rem' }}
      />
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <pre style={{
          background: '#0f1219', border: 'none', borderRadius: 8, padding: '0.875rem',
          color: '#f87171', fontSize: 12, maxHeight: 500, overflow: 'auto',
          whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: 0, fontFamily: 'monospace',
        }}>
          {errors?.length ? errors.join('\n') : 'Aucune erreur'}
        </pre>
      </Card>
    </div>
  );
}
