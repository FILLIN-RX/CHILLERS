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
        <div onClick={() => setSidebarOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40,
        }} />
      )}
      <main className="admin-main" style={{ flex: 1, padding: '1rem', overflowY: 'auto', minHeight: '100vh' }}>
        <button
          onClick={() => setSidebarOpen(true)}
          style={{
            display: 'none', background: 'none', border: 'none', color: '#fff', cursor: 'pointer',
            fontSize: '1.5rem', padding: '0.25rem', marginBottom: '0.75rem',
          }}
          className="admin-menu-btn"
        >
          ☰
        </button>
        <style>{`
          .admin-main { margin-left: 240px; }
          @media (max-width: 768px) {
            .admin-main { margin-left: 0; }
            .admin-menu-btn { display: inline-flex !important; }
          }
        `}</style>
        {children}
      </main>
    </div>
  );
}
