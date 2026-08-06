'use client';

import { useEffect, useState } from 'react';
import { adminUqloadStatus, adminUqloadPending, adminUqloadPendingBoth, adminUqloadUploadMovies, adminUqloadUploadSeries, adminUqloadStop } from '@/app/api';
import {
  Card, Statistic, Row, Col, Button, Space, Typography, Alert, Spin, Empty, Tag, Segmented,
} from 'antd';
import {
  CloudUploadOutlined, StopOutlined, ReloadOutlined, CheckCircleOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

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

  if (loading && !status) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#6b7488', padding: '2rem' }}>
      <Spin /> Chargement...
    </div>
  );

  if (status && !status.configured) return (
    <Alert type="warning" showIcon message="UQLOAD_API_KEY non configurée dans le .env" style={{ maxWidth: 480 }} />
  );

  const renderPendingList = ({ items, empty }: { items: any[]; empty: string }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      {items.length === 0 ? (
        <Alert type="success" showIcon icon={<CheckCircleOutlined />} message={empty} />
      ) : items.slice(0, 50).map((m, i) => (
        <div key={i} style={{
          background: '#141821', border: '1px solid #1c2230', borderRadius: 8,
          padding: '0.5rem 0.75rem', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ color: '#e6e9f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '0.5rem' }}>
            {m.titre || `${m.serieTitre} — ${m.episode || `S${m.season}E${m.episodeNumber}`}`}
          </span>
          <span style={{ flexShrink: 0 }}>
            {m.fileCode ? <Tag color="success">DoodStream ✓</Tag> : m.lien ? <Tag>Lien OK</Tag> : m.tmdbId ? <Tag color="cyan">TMDB ✓</Tag> : <Tag>Direct</Tag>}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Uqload</Title>
          <Text type="secondary">Upload automatique des vidéos vers Uqload</Text>
        </div>
        <Space>
          <Segmented
            value={tab}
            onChange={(v) => setTab(v as typeof tab)}
            options={[
              { label: 'Statut', value: 'status' },
              { label: 'En attente', value: 'pending' },
              { label: 'Manquants', value: 'missing' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading} />
        </Space>
      </div>

      {status?.isUploading && (
        <Alert type="warning" showIcon message="Upload en cours sur le serveur" style={{ marginBottom: '1rem' }} />
      )}

      {tab === 'status' && status && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: '1.5rem' }}>
            <Col xs={12} md={6}>
              <Card size="small"><Statistic title="Stockage utilisé" value={formatBytes(status.account?.storageUsed)} prefix={<CloudUploadOutlined />} /></Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small"><Statistic title="Stockage restant" value={formatBytes(status.account?.storageLeft)} prefix={<CloudUploadOutlined />} /></Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small"><Statistic title="Compte" value={status.account?.login ?? '—'} /></Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic
                  title="Premium"
                  value={status.account?.premium ? 'Oui' : 'Non'}
                  valueStyle={{ color: status.account?.premium ? '#34d399' : '#f87171' }}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: '1.5rem' }}>
            <Col xs={12} md={6}>
              <Card size="small"><Statistic title="Films en attente Uqload" value={status.pending?.movies ?? '?'} /></Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small"><Statistic title="Épisodes en attente Uqload" value={status.pending?.series ?? '?'} /></Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic
                  title="Ni Uqload ni DoodStream"
                  value={`${status.pendingBoth?.movies ?? 0} films`}
                  valueStyle={{ color: (status.pendingBoth?.movies ?? 0) > 0 ? '#fbbf24' : '#34d399', fontSize: 20 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>{status.pendingBoth?.series ?? 0} épisodes</Text>
              </Card>
            </Col>
          </Row>

          <Space wrap>
            <Button type="primary" icon={<CloudUploadOutlined />} loading={uploading} disabled={uploading || status.isUploading} onClick={() => handleUpload('movies')}>
              Upload films (lot de 100)
            </Button>
            <Button type="primary" icon={<CloudUploadOutlined />} loading={uploading} disabled={uploading || status.isUploading} onClick={() => handleUpload('series')}>
              Upload séries (lot de 100)
            </Button>
            <Button danger icon={<StopOutlined />} disabled={!status.isUploading} onClick={async () => { await adminUqloadStop(); setTimeout(fetchData, 1000); }}>
              Arrêter l&apos;upload
            </Button>
          </Space>
        </>
      )}

      {tab === 'pending' && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: '1.25rem' }}>
            <Col xs={12} md={6}>
              <Card size="small"><Statistic title="Films sans Uqload" value={pending?.totalMovies ?? 0} /></Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small"><Statistic title="Épisodes sans Uqload" value={pending?.totalEpisodes ?? 0} /></Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card size="small" title={`Films en attente (${pending?.movies?.length || 0} affichés)`} styles={{ body: { padding: '0.75rem' } }}>
                {renderPendingList({ items: pending?.movies || [], empty: "Tous les films sont uploadés ✓" })}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card size="small" title={`Épisodes en attente (${pending?.series?.length || 0} affichés)`} styles={{ body: { padding: '0.75rem' } }}>
                {renderPendingList({ items: pending?.series || [], empty: "Tous les épisodes sont uploadés ✓" })}
              </Card>
            </Col>
          </Row>
        </>
      )}

      {tab === 'missing' && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: '1rem' }}>
            <Col xs={12} md={6}>
              <Card size="small"><Statistic title="Films sur aucun service" value={pendingBoth?.totalMovies ?? 0} valueStyle={{ color: '#fbbf24' }} /></Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small"><Statistic title="Épisodes sur aucun service" value={pendingBoth?.totalEpisodes ?? 0} valueStyle={{ color: '#fbbf24' }} /></Card>
            </Col>
          </Row>

          <Alert
            type="info"
            showIcon
            style={{ marginBottom: '1rem', maxWidth: 900 }}
            message="Ces contenus ne sont ni sur Uqload ni sur DoodStream. Utilisez le script CLI npm run upload-uqload pour les uploader."
          />

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card size="small" title={`Films manquants (${pendingBoth?.movies?.length || 0} affichés)`} styles={{ body: { padding: '0.75rem' } }}>
                {renderPendingList({ items: pendingBoth?.movies || [], empty: "Tous les films sont sur au moins un service ✓" })}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card size="small" title={`Épisodes manquants (${pendingBoth?.series?.length || 0} affichés)`} styles={{ body: { padding: '0.75rem' } }}>
                {renderPendingList({ items: pendingBoth?.series || [], empty: "Tous les épisodes sont sur au moins un service ✓" })}
              </Card>
            </Col>
          </Row>
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
