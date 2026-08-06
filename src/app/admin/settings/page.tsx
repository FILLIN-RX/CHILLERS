'use client';

import { useEffect, useState } from 'react';
import { adminGetSettings, adminUpdateSettings } from '@/app/api';
import {
  Card, Typography, Form, Input, Button, Descriptions, Spin, Alert, Space,
} from 'antd';
import { SaveOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

const { Title } = Typography;

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    adminGetSettings().then(res => {
      if (res.success) setSettings(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async (values: { corsOrigin?: string; notificationEmail?: string }) => {
    setSaving(true);
    setMsg('');
    const res = await adminUpdateSettings({
      corsOrigin: values.corsOrigin || '',
      notificationEmail: values.notificationEmail || '',
    });
    setSaving(false);
    if (res.success) {
      setMsg('ok');
      adminGetSettings().then(r => { if (r.success) setSettings(r.data); });
    } else {
      setMsg('err');
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#6b7488', padding: '2rem' }}>
      <Spin /> Chargement...
    </div>
  );
  if (!settings) return <Alert type="error" showIcon message="Erreur de chargement" />;

  const valueColor = (v: string) => {
    if (String(v).startsWith('✓')) return '#34d399';
    if (String(v).startsWith('✗')) return '#f87171';
    return undefined;
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <Title level={3} style={{ marginTop: 0, marginBottom: '1.25rem' }}>Paramètres</Title>

      <Card title="Configuration actuelle" size="small" style={{ marginBottom: '1.5rem' }}>
        <Descriptions column={1} size="small" labelStyle={{ color: '#8b93a7' }}>
          {Object.entries(settings).map(([key, value]) => (
            <Descriptions.Item key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}>
              <span style={{
                fontFamily: 'monospace',
                fontSize: 13,
                color: valueColor(value),
                wordBreak: 'break-all',
              }}>
                {value}
              </span>
            </Descriptions.Item>
          ))}
        </Descriptions>
      </Card>

      <Card title="Modifier" size="small">
        <Form
          layout="vertical"
          initialValues={{ corsOrigin: settings.corsOrigin || '', notificationEmail: settings.notificationEmail || '' }}
          onFinish={handleSave}
          requiredMark={false}
          style={{ maxWidth: 420 }}
        >
          <Form.Item name="corsOrigin" label="CORS Origin">
            <Input placeholder="https://example.com" />
          </Form.Item>
          <Form.Item name="notificationEmail" label="Email notification">
            <Input placeholder="admin@example.com" />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
            {msg && (
              <Alert
                type={msg === 'ok' ? 'success' : 'error'}
                showIcon
                icon={msg === 'ok' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                message={msg === 'ok' ? 'Paramètres mis à jour' : 'Erreur lors de la sauvegarde'}
              />
            )}
          </Space>
        </Form>
      </Card>
    </div>
  );
}
