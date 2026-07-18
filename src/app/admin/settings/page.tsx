'use client';

import { useEffect, useState } from 'react';
import { adminGetSettings, adminUpdateSettings } from '@/app/api';

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

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    const res = await adminUpdateSettings({
      corsOrigin: settings?.corsOrigin || '',
      notificationEmail: settings?.notificationEmail || '',
    });
    setSaving(false);
    if (res.success) setMsg('Paramètres mis à jour');
    else setMsg('Erreur lors de la sauvegarde');
  };

  if (loading) return <p style={{ color: '#888' }}>Chargement...</p>;
  if (!settings) return <p style={{ color: '#ef4444' }}>Erreur de chargement</p>;

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 0',
    borderBottom: '1px solid #2a2a2a',
  };

  return (
    <div>
      <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Paramètres</h1>

      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
        {Object.entries(settings).map(([key, value]) => (
          <div key={key} style={rowStyle}>
            <span style={{ color: '#ccc', fontSize: '0.875rem' }}>
              {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
            </span>
            <span style={{
              fontSize: '0.8125rem',
              fontFamily: 'monospace',
              color: String(value).startsWith('✓') ? '#22c55e' : String(value).startsWith('✗') ? '#ef4444' : '#888'
            }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      <h2 style={{ color: '#fff', fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Modifier</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
        <div>
          <label style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CORS Origin</label>
          <input
            value={settings.corsOrigin || ''}
            onChange={e => setSettings({ ...settings, corsOrigin: e.target.value })}
            style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #333', background: '#222', color: '#fff', fontSize: '0.875rem', marginTop: '0.25rem' }}
          />
        </div>
        <div>
          <label style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email notification</label>
          <input
            value={settings.notificationEmail || ''}
            onChange={e => setSettings({ ...settings, notificationEmail: e.target.value })}
            style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #333', background: '#222', color: '#fff', fontSize: '0.875rem', marginTop: '0.25rem' }}
          />
        </div>
        <button onClick={handleSave} disabled={saving} style={{ padding: '0.75rem', borderRadius: '8px', border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
        {msg && <p style={{ color: msg.includes('Erreur') ? '#ef4444' : '#22c55e', fontSize: '0.875rem' }}>{msg}</p>}
      </div>
    </div>
  );
}
