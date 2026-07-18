'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { adminLogin } from '@/app/api';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await adminLogin(username, password);
    setLoading(false);
    if (res.success) {
      router.push('/admin');
    } else {
      setError(res.message || 'Identifiants invalides');
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f', padding: '1rem' }}>
      <form onSubmit={handleSubmit} style={{ background: '#1a1a1a', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '400px', border: '1px solid #333' }}>
        <h1 style={{ color: '#fff', fontSize: '1.5rem', marginBottom: '0.5rem', fontWeight: 700 }}>Admin</h1>
        <p style={{ color: '#888', marginBottom: '1.5rem', fontSize: '0.875rem' }}>Connectez-vous pour accéder au panneau d'administration</p>
        {error && <p style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</p>}
        <input type="text" placeholder="Nom d'utilisateur" value={username} onChange={e => setUsername(e.target.value)} required style={{ width: '100%', padding: '0.75rem', marginBottom: '0.75rem', borderRadius: '8px', border: '1px solid #333', background: '#222', color: '#fff', fontSize: '0.875rem' }} />
        <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '0.75rem', marginBottom: '1.5rem', borderRadius: '8px', border: '1px solid #333', background: '#222', color: '#fff', fontSize: '0.875rem' }} />
        <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: 'none', background: '#6366f1', color: '#fff', fontSize: '0.875rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}
