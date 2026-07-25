'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { adminVerify } from '@/app/api';
import AdminSidebar from '@/components/AdminSidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/admin/login') {
      setLoading(false);
      return;
    }
    adminVerify().then(res => {
      if (res.success) {
        setAuthed(true);
      } else {
        localStorage.removeItem('admin-token');
        router.push('/admin/login');
      }
      setLoading(false);
    }).catch(() => {
      localStorage.removeItem('admin-token');
      router.push('/admin/login');
      setLoading(false);
    });
  }, [pathname, router]);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  if (pathname === '/admin/login') return <>{children}</>;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f', color: '#888' }}>
        Vérification...
      </div>
    );
  }

  if (!authed) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f0f0f' }}>
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} className="admin-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40,
        }} />
      )}
      <main className="admin-main" style={{ flex: 1, padding: '1rem', overflowY: 'auto', minHeight: '100vh' }}>
        <button
          onClick={() => setSidebarOpen(true)}
          className="admin-menu-btn"
          style={{
            display: 'none', background: '#1a1a2a', border: '1px solid #2a2a3a', color: '#fff', cursor: 'pointer',
            fontSize: '1.25rem', padding: '0.5rem 0.75rem', borderRadius: 8, marginBottom: '0.75rem',
            lineHeight: 1,
          }}
          aria-label="Menu"
        >
          ☰
        </button>
        <style>{`
          .admin-main { margin-left: 240px; }
          .admin-overlay { display: none; }
          @media (max-width: 1024px) {
            .admin-main { margin-left: 0; padding: 0.75rem !important; }
            .admin-menu-btn { display: inline-flex !important; align-items: center; justify-content: center; }
            .admin-overlay { display: block !important; }
          }
          @media (max-width: 480px) {
            .admin-main { padding: 0.5rem !important; }
          }
        `}</style>
        {children}
      </main>
    </div>
  );
}
