'use client';

import { useEffect, useState } from 'react';
import { adminGetSettings, adminUpdateSettings } from '@/services/admin';
import {
  adminGetOtakuSession, adminSetOtakuSession, adminRefreshOtakuSession, adminClearOtakuSession,
  type OtakuSessionStatus,
} from '@/services/admin';
import {
  Card, Typography, Form, Input, Button, Descriptions, Spin, Alert, Space,
} from '@/components/admin/ui';
import { SaveOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, DeleteOutlined } from '@/components/admin/icons';

const { Title } = Typography;

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [otaku, setOtaku] = useState<OtakuSessionStatus | null>(null);
  const [otakuCookie, setOtakuCookie] = useState('');
  const [otakuLoading, setOtakuLoading] = useState(true);
  const [otakuSaving, setOtakuSaving] = useState(false);
  const [otakuMsg, setOtakuMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    adminGetSettings().then(res => {
      if (res.success && res.data) setSettings(res.data as Record<string, string>);
      setLoading(false);
    }).catch(() => setLoading(false));
    adminGetOtakuSession()
      .then(res => { if (res.success && res.data) setOtaku(res.data as OtakuSessionStatus); })
      .finally(() => setOtakuLoading(false));
  }, []);

  const handleSaveOtaku = async () => {
    const cookie = otakuCookie.trim();
    if (!cookie) { setOtakuMsg({ type: 'error', text: 'Colle le cookie de session.' }); return; }
    setOtakuSaving(true); setOtakuMsg(null);
    const res = await adminSetOtakuSession(cookie);
    setOtakuSaving(false);
    if (res.success && res.data) {
      setOtaku(res.data as OtakuSessionStatus);
      setOtakuCookie('');
      setOtakuMsg({ type: 'success', text: res.message || 'Session enregistrée' });
    } else {
      if (res.data) setOtaku(res.data as OtakuSessionStatus);
      setOtakuMsg({ type: 'error', text: res.message || 'Session invalide' });
    }
  };

  const handleRefreshOtaku = async () => {
    setOtakuSaving(true); setOtakuMsg(null);
    const res = await adminRefreshOtakuSession();
    setOtakuSaving(false);
    if (res.success && res.data) setOtaku(res.data as OtakuSessionStatus);
    setOtakuMsg({ type: res.success ? 'success' : 'error', text: res.message || (res.success ? 'OK' : 'Échec') });
  };

  const handleClearOtaku = async () => {
    setOtakuSaving(true); setOtakuMsg(null);
    const res = await adminClearOtakuSession();
    setOtakuSaving(false);
    if (res.success && res.data) setOtaku(res.data as OtakuSessionStatus);
    setOtakuMsg({ type: res.success ? 'success' : 'error', text: res.message || 'Session supprimée' });
  };

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
      adminGetSettings().then(r => { if (r.success && r.data) setSettings(r.data as Record<string, string>); });
    } else {
      setMsg('err');
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#667085', padding: '2rem' }}>
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
        <Descriptions column={1} size="small" labelStyle={{ color: '#667085' }}>
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

      <Card title="Session OpenOtaku" size="small" style={{ marginTop: '1.5rem' }}>
        {otakuLoading ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#667085' }}><Spin /> Chargement…</div>
        ) : (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="Récupérer le cookie"
              description="https://open-otaku.me → connecte-toi → F12 → Network → recharge → clique la requête open-otaku.me → Headers → Request Headers → copie toute la valeur de « cookie: » (sans le préfixe)."
            />
            <Descriptions column={1} size="small" labelStyle={{ color: '#667085' }} style={{ marginBottom: 12 }}>
              <Descriptions.Item label="Statut">
                <span style={{ color: otaku?.isValid ? '#34d399' : otaku?.configured ? '#f87171' : '#9ca3af', fontWeight: 600 }}>
                  {otaku?.isValid ? '✓ Valide' : otaku?.configured ? '✗ Invalide / expirée' : 'Non configurée'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Cookie"><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{otaku?.cookiePreview || '—'}</span></Descriptions.Item>
              <Descriptions.Item label="Expiration">{otaku?.expiresAt ? new Date(otaku.expiresAt).toLocaleString('fr-FR') : '—'}</Descriptions.Item>
              <Descriptions.Item label="Dernier test">{otaku?.lastCheckedAt ? new Date(otaku.lastCheckedAt).toLocaleString('fr-FR') : '—'}</Descriptions.Item>
              {otaku?.lastError && <Descriptions.Item label="Erreur"><span style={{ color: '#f87171' }}>{otaku.lastError}</span></Descriptions.Item>}
            </Descriptions>
            <Input.TextArea
              rows={3}
              value={otakuCookie}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setOtakuCookie(e.target.value)}
              placeholder="__Host-oo_session=...; __Host-oo_preauth=..."
              style={{ marginBottom: 10, fontFamily: 'monospace', fontSize: 12 }}
            />
            <Space wrap>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveOtaku} loading={otakuSaving}>Enregistrer & tester</Button>
              <Button icon={<ReloadOutlined />} onClick={handleRefreshOtaku} loading={otakuSaving} disabled={!otaku?.configured}>Rafraîchir</Button>
              <Button danger icon={<DeleteOutlined />} onClick={handleClearOtaku} loading={otakuSaving} disabled={!otaku?.configured}>Supprimer</Button>
              {otakuMsg && (
                <Alert type={otakuMsg.type} showIcon message={otakuMsg.text} />
              )}
            </Space>
          </>
        )}
      </Card>
    </div>
  );
}
