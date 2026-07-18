'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { adminVerify } from '@/app/api';
import AdminSidebar from '@/components/AdminSidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
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
      <AdminSidebar />
      <main style={{ flex: 1, marginLeft: 240, padding: '2rem', overflowY: 'auto', minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  );
}
