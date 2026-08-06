'use client';

import { useEffect, useState, useRef } from 'react';
import { adminGetDeadLinks, adminAppealDeadLink, adminRescrapeDeadLink, adminGetLogsStreamUrl, adminRunMaintenance, adminUpdateDeadLink } from '@/app/api';
import {
  Table, Button, Modal, Switch, Input, Space, Typography, Tag, Spin, Alert,
} from 'antd';
import {
  SearchOutlined, EditOutlined, SyncOutlined, CheckOutlined, CloudUploadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

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

const lineColor = (l: string) => l.includes('❌') || l.includes('Erreur') ? '#f87171' : l.includes('✅') ? '#34d399' : '#a5adc0';

function LogBox({ lines, height }: { lines: string[]; height: number | string }) {
  const logEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);
  return (
    <div style={{
      background: '#0f1219', border: '1px solid #1c2230', borderRadius: 10,
      padding: '0.75rem', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5,
      maxHeight: height, overflowY: 'auto', textAlign: 'left', marginBottom: '1rem',
    }}>
      {lines.map((l, i) => (
        <div key={i} style={{ color: lineColor(l), whiteSpace: 'pre-wrap' }}>{l}</div>
      ))}
      <div ref={logEndRef} />
    </div>
  );
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

  useEffect(() => {
    adminGetDeadLinks().then(res => {
      if (res.success) setLinks(res.data);
      setLoading(false);
    });
  }, []);

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

  const columns: ColumnsType<DeadLink> = [
    {
      title: 'Titre',
      dataIndex: 'titre',
      key: 'titre',
      render: (t: string) => <span style={{ fontWeight: 500, color: '#e6e9f0' }}>{t}</span>,
    },
    {
      title: 'Épisode',
      dataIndex: 'episode',
      key: 'episode',
      render: (e: string) => e ? <Tag color="error">{e}</Tag> : '—',
    },
    {
      title: 'Lien',
      dataIndex: 'lien',
      key: 'lien',
      render: (l: string) => (
        <Text style={{ color: '#f87171', fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{l}</Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 240,
      render: (_, link) => (
        <Space size={4}>
          <Button size="small" type="primary" onClick={() => handleAppeal(link._id)}>Appeal</Button>
          <Button size="small" style={{ background: '#2b1d0a', borderColor: '#53350d', color: '#fbbf24' }} onClick={() => { setEditLink(link); setEditValue(link.lien); }}>
            Edit
          </Button>
          <Button
            size="small"
            loading={modal?.link._id === link._id}
            disabled={modal?.link._id === link._id}
            style={{ background: '#0d2b1a', borderColor: '#14532d', color: '#34d399' }}
            onClick={() => handleRescrape(link)}
          >
            Rescrape
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <Title level={3} style={{ margin: 0 }}>
          Liens morts{' '}
          <Text type="secondary" style={{ fontWeight: 400, fontSize: '0.875rem' }}>
            {links.filter(l => l.type === 'series').length} séries · {links.filter(l => l.type !== 'series').length} films
          </Text>
        </Title>
        <Button type="primary" danger icon={<SearchOutlined />} loading={detecting} onClick={handleDetect}>
          {detecting ? 'Détection en cours...' : 'Détecter'}
        </Button>
      </div>

      <Space wrap style={{ marginBottom: '1rem' }}>
        <Space size="small">
          <Text type="secondary">Headless</Text>
          <Switch checked={headless} onChange={setHeadless} />
        </Space>
        <Text type="secondary">Upload DoodStream :</Text>
        <Button size="small" icon={<CloudUploadOutlined />} onClick={() => adminRunMaintenance('upload-movies')} style={{ background: '#0d2b1a', borderColor: '#14532d', color: '#34d399' }}>
          Films
        </Button>
        <Button size="small" icon={<CloudUploadOutlined />} onClick={() => adminRunMaintenance('upload-series')} style={{ background: '#0d2b1a', borderColor: '#14532d', color: '#34d399' }}>
          Séries
        </Button>
      </Space>

      <Table<DeadLink>
        rowKey="_id"
        loading={loading}
        dataSource={links}
        columns={columns}
        scroll={{ x: 800 }}
        locale={{ emptyText: detecting ? <Spin /> : <Alert type="success" showIcon icon={<CheckOutlined />} message="Aucun lien mort détecté" /> }}
        pagination={links.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
      />

      {detectLogs.length > 0 && detecting && (
        <div style={{ marginTop: '1.5rem' }}>
          <LogBox lines={detectLogs} height={300} />
        </div>
      )}

      {/* Edit modal */}
      <Modal
        open={!!editLink}
        title={editLink ? (
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 600 }}>{editLink.titre}</div>
            <Space size="small" style={{ marginTop: 4 }}>
              <Tag>{editLink.type === 'series' ? 'Série' : 'Film'}</Tag>
              {editLink.episode && <Tag color="error">{editLink.episode}</Tag>}
            </Space>
          </div>
        ) : ''}
        onCancel={() => setEditLink(null)}
        footer={null}
        width={560}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: '0.375rem', fontSize: 12 }}>Nouveau lien</Text>
        <Input
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          placeholder="https://..."
          style={{ fontFamily: 'monospace', marginBottom: '1rem' }}
        />
        <Space style={{ justifyContent: 'flex-end', display: 'flex' }}>
          <Button onClick={() => setEditLink(null)}>Annuler</Button>
          <Button type="primary" disabled={!editValue.trim()} icon={<EditOutlined />} onClick={handleEditSave}>
            Sauvegarder
          </Button>
        </Space>
      </Modal>

      {/* Rescrape modal */}
      <Modal
        open={!!modal}
        onCancel={closeModal}
        footer={null}
        width={640}
        title={modal ? (
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 600 }}>{modal.link.titre}</div>
            <Space size="small" style={{ marginTop: 4 }}>
              <Tag>{modal.link.type === 'series' ? 'Série' : 'Film'}</Tag>
              {modal.link.episode && <Tag color="error">{modal.link.episode}</Tag>}
            </Space>
          </div>
        ) : ''}
      >
        {modal?.status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>✅</div>
            <div style={{ color: '#34d399', fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Lien récupéré avec succès
            </div>
            <div style={{ color: '#8b93a7', fontSize: 13, wordBreak: 'break-all', marginBottom: '1.5rem' }}>
              {modal.logs.find(l => l.includes('Nouveau lien'))?.replace(/.*✅ Nouveau lien: /, '')}
            </div>
            <Button type="primary" onClick={closeModal}>Fermer</Button>
          </div>
        ) : modal?.status === 'error' ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>❌</div>
            <div style={{ color: '#f87171', fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
              Échec du rescrape
            </div>
            <LogBox lines={modal.logs} height={200} />
            <Button danger onClick={closeModal}>Fermer</Button>
          </div>
        ) : (
          <div>
            <LogBox lines={modal?.logs ?? []} height={360} />
            <Text type="secondary" style={{ display: 'block', textAlign: 'center', fontSize: 12 }}>
              Scraping en cours...
            </Text>
          </div>
        )}
      </Modal>
    </div>
  );
}
