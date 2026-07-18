'use client';

import { useEffect, useState } from 'react';
import { adminGetDeadLinks } from '@/app/api';

interface DeadLink {
  titre: string;
  episode: string;
  lien: string;
}

export default function AdminDeadLinks() {
  const [links, setLinks] = useState<DeadLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminGetDeadLinks().then(res => {
      if (res.success) setLinks(res.data);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Liens morts</h1>

      {loading ? (
        <p style={{ color: '#888' }}>Chargement...</p>
      ) : links.length === 0 ? (
        <p style={{ color: '#22c55e' }}>Aucun lien mort détecté</p>
      ) : (
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: '0.5rem', padding: '0.75rem 1rem', background: '#2a2a2a', color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            <span>Série</span>
            <span>Épisode</span>
            <span>Lien</span>
          </div>
          {links.map((link, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: '0.5rem', padding: '0.75rem 1rem', borderBottom: '1px solid #2a2a2a', color: '#ccc', fontSize: '0.8125rem', wordBreak: 'break-all' }}>
              <span>{link.titre}</span>
              <span style={{ color: '#f87171' }}>{link.episode}</span>
              <span style={{ color: '#ef4444', fontFamily: 'monospace', fontSize: '0.75rem' }}>{link.lien}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
