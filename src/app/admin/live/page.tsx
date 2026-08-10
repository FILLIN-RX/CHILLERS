'use client';

import { useEffect, useState } from 'react';
import {
  adminLiveList, adminLiveSync, adminLiveCreate, adminLiveUpdate, adminLiveDelete,
} from '@/services/admin';
import {
  Typography, Table, Button, Space, Tag, Switch, Input, Select, Modal, Form, Popconfirm, Alert,
} from 'antd';
import {
  ReloadOutlined, PlusOutlined, SyncOutlined, PlayCircleOutlined, EditOutlined, DeleteOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { LiveChannel, LiveChannelInput, LiveChannelType } from '@/types/live';

const { Title, Text } = Typography;

const TYPE_LABEL: Record<LiveChannelType, string> = {
  hls: 'HLS',
  youtube: 'YouTube',
  dailymotion: 'Dailymotion',
};

const CATEGORY_OPTIONS = [
  'news', 'politics', 'business', 'general', 'documentary', 'sports', 'music', 'kids', 'entertainment',
].map((c) => ({ label: c, value: c }));

type FormValues = LiveChannelInput;

export default function AdminLive() {
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LiveChannel | null>(null);
  const [form] = Form.useForm<FormValues>();

  const fetchData = () => {
    setLoading(true);
    adminLiveList()
      .then((res) => setChannels(res.data ?? []))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ type: 'hls', enabled: true, categories: [] });
    setModalOpen(true);
  };

  const openEdit = (ch: LiveChannel) => {
    setEditing(ch);
    form.resetFields();
    form.setFieldsValue({
      ...ch,
      categories: ch.categories ?? [],
      enabled: ch.enabled,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload: LiveChannelInput = {
      name: values.name,
      type: values.type ?? 'hls',
      streamUrl: values.streamUrl || '',
      ytVideoId: values.ytVideoId || '',
      categories: values.categories ?? [],
      country: values.country || '',
      language: values.language || '',
      logo: values.logo || '',
      referer: values.referer || '',
      userAgent: values.userAgent || '',
      enabled: values.enabled ?? true,
      order: Number(values.order ?? 0),
    };
    if (editing) {
      await adminLiveUpdate(editing._id, payload);
    } else {
      await adminLiveCreate(payload);
    }
    setModalOpen(false);
    await fetchData();
  };

  const handleSync = async (updateStreams: boolean) => {
    setSyncing(true);
    try {
      const res = await adminLiveSync(updateStreams);
      const d = res.data;
      if (d) alert(`Sync terminé : ${d.added} ajoutée(s), ${d.updated} mise(s) à jour.`);
      await fetchData();
    } finally {
      setSyncing(false);
    }
  };

  const handleToggle = async (ch: LiveChannel, enabled: boolean) => {
    const next = [...channels];
    const idx = next.findIndex((c) => c._id === ch._id);
    if (idx >= 0) next[idx] = { ...ch, enabled };
    setChannels(next);
    try {
      await adminLiveUpdate(ch._id, { enabled });
    } catch {
      await fetchData();
    }
  };

  const handleDelete = async (id: string) => {
    await adminLiveDelete(id);
    await fetchData();
  };

  const columns: ColumnsType<LiveChannel> = [
    {
      title: 'Chaîne',
      dataIndex: 'name',
      render: (_, ch) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {ch.logo ? (
            <img src={ch.logo} alt={ch.name} style={{ width: 34, height: 34, objectFit: 'contain', borderRadius: 8, background: '#0a0d14', padding: 2 }} />
          ) : (
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#1c2230' }} />
          )}
          <div>
            <div style={{ color: '#e6e9f0', fontWeight: 600 }}>{ch.name}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>/{ch.slug}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      width: 110,
      render: (t: LiveChannelType) => <Tag color={t === 'hls' ? 'blue' : t === 'youtube' ? 'red' : 'cyan'}>{TYPE_LABEL[t]}</Tag>,
    },
    {
      title: 'Catégories',
      dataIndex: 'categories',
      width: 180,
      render: (cats: string[]) => (cats || []).map((c) => <Tag key={c}>{c}</Tag>),
    },
    {
      title: 'Pays',
      dataIndex: 'country',
      width: 70,
      render: (c: string) => <span style={{ textTransform: 'uppercase', fontSize: 12 }}>{c}</span>,
    },
    {
      title: 'Ordre',
      dataIndex: 'order',
      width: 70,
    },
    {
      title: 'Actif',
      dataIndex: 'enabled',
      width: 80,
      render: (_, ch) => (
        <Switch checked={ch.enabled} size="small" onChange={(v) => handleToggle(ch, v)} />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 150,
      render: (_, ch) => (
        <Space>
          <Button size="small" icon={<PlayCircleOutlined />} href={`/live/${ch.slug}`} target="_blank" />
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(ch)} />
          <Popconfirm title="Supprimer cette chaîne ?" onConfirm={() => handleDelete(ch._id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Live TV</Title>
          <Text type="secondary">Module isolé — chaînes gratuites/publiques (base dédiée LIVE_MONGO_URI)</Text>
        </div>
        <Space>
          <Button icon={<SyncOutlined />} loading={syncing} onClick={() => handleSync(false)}>Sync seed</Button>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={fetchData} />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Ajouter</Button>
        </Space>
      </div>

      {syncing && <Alert type="info" showIcon message="Synchronisation du seed avec iptv-org…" style={{ marginBottom: '1rem' }} />}

      <Table<LiveChannel>
        rowKey="_id"
        columns={columns}
        dataSource={channels}
        loading={loading}
        pagination={{ pageSize: 25, showSizeChanger: false }}
        size="small"
      />

      <Modal
        title={editing ? `Modifier — ${editing.name}` : 'Ajouter une chaîne'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="Enregistrer"
        cancelText="Annuler"
        destroyOnClose
      >
        <Form<FormValues> form={form} layout="vertical" style={{ marginTop: '0.5rem' }}>
          <Form.Item name="name" label="Nom" rules={[{ required: true, message: 'Nom requis' }]}>
            <Input placeholder="France 24 Français" />
          </Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'HLS (.m3u8)', value: 'hls' },
                { label: 'YouTube', value: 'youtube' },
                { label: 'Dailymotion', value: 'dailymotion' },
              ]}
            />
          </Form.Item>
          <Form.Item name="streamUrl" label="URL du flux HLS">
            <Input placeholder="https://…/live_web.m3u8" />
          </Form.Item>
          <Form.Item name="ytVideoId" label="ID vidéo (YouTube / Dailymotion)">
            <Input placeholder="dQw4w9WgXcQ" />
          </Form.Item>
          <Form.Item name="logo" label="Logo (URL)">
            <Input placeholder="https://…/logo.png" />
          </Form.Item>
          <Form.Item name="categories" label="Catégories">
            <Select mode="multiple" options={CATEGORY_OPTIONS} allowClear />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
            <Form.Item name="country" label="Pays">
              <Input placeholder="FR" />
            </Form.Item>
            <Form.Item name="language" label="Langue">
              <Input placeholder="fra" />
            </Form.Item>
          </div>
          <Form.Item name="referer" label="Referer (proxy)">
            <Input placeholder="https://…" />
          </Form.Item>
          <Form.Item name="userAgent" label="User-Agent (proxy)">
            <Input placeholder="Laisser vide = UA par défaut" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
            <Form.Item name="order" label="Ordre">
              <Input type="number" />
            </Form.Item>
            <Form.Item name="enabled" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
