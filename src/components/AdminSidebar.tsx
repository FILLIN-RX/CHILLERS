'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { adminLogout } from '@/app/api';
import { IconDashboard, IconMovie, IconTv, IconLogs, IconLink, IconSettings, IconLogout, IconBack, IconCron, IconTmdb, IconUqload } from '@/components/Icons';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: IconDashboard },
  { href: '/admin/movies', label: 'Films', icon: IconMovie },
  { href: '/admin/series', label: 'Séries', icon: IconTv },
  { href: '/admin/tmdb', label: 'TMDB', icon: IconTmdb },
  { href: '/admin/logs', label: 'Logs', icon: IconLogs },
  { href: '/admin/dead-links', label: 'Liens morts', icon: IconLink },
  { href: '/admin/liens', label: 'Liens', icon: IconLink },
  { href: '/admin/maintenance-liens', label: 'Maint. Liens', icon: IconCron },
  { href: '/admin/uqload', label: 'Uqload', icon: IconUqload },
  { href: '/admin/cron', label: 'Tâches', icon: IconCron },
  { href: '/admin/settings', label: 'Paramètres', icon: IconSettings },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AdminSidebar({ open, onClose }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      <style>{`
        .admin-sidebar {
          width: 240px; height: 100vh; background: #111118;
          border-right: 1px solid #1e1e2a; display: flex; flex-direction: column;
          flex-shrink: 0; position: fixed; top: 0; left: 0; z-index: 50;
          transition: transform 0.25s ease;
        }
        @media (max-width: 768px) {
          .admin-sidebar { transform: translateX(-100%); }
          .admin-sidebar.open { transform: translateX(0); }
        }
      `}</style>
      <aside className={`admin-sidebar ${open ? 'open' : ''}`}>
        <div style={{ padding: '1.5rem 1.25rem', borderBottom: '1px solid #1e1e2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: '1.125rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
              CHILLERS
            </h1>
            <p style={{ color: '#6366f1', fontSize: '0.6875rem', margin: '0.25rem 0 0 0', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              Administration
            </p>
          </div>
          <button onClick={onClose} style={{
            display: 'none', background: 'none', border: 'none', color: '#6b6b80',
            cursor: 'pointer', fontSize: '1.25rem', padding: '0.25rem',
          }} className="admin-sidebar-close">✕</button>
          <style>{`@media (max-width: 768px) { .admin-sidebar-close { display: block !important; } }`}</style>
        </div>

        <nav style={{ flex: 1, padding: '0.75rem', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
          {NAV_ITEMS.map(item => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  padding: '0.625rem 0.75rem',
                  borderRadius: 10,
                  color: isActive ? '#fff' : '#6b6b80',
                  background: isActive ? 'rgba(99,102,241,0.12)' : 'transparent',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#c0c0d0'; } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b6b80'; } }}
              >
                <span style={{ width: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <item.icon />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '0.75rem', borderTop: '1px solid #1e1e2a' }}>
          <button
            onClick={() => { adminLogout(); router.push('/admin/login'); }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              padding: '0.625rem 0.75rem',
              borderRadius: 10,
              border: 'none',
              background: 'transparent',
              color: '#6b6b80',
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b6b80'; }}
          >
            <span style={{ width: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconLogout />
            </span>
            Déconnexion
          </button>
          <Link href="/" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            padding: '0.625rem 0.75rem',
            borderRadius: 10,
            color: '#6b6b80',
            textDecoration: 'none',
            fontSize: '0.875rem',
            marginTop: '0.125rem',
            transition: 'all 0.15s ease',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#c0c0d0'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b6b80'; }}
          >
            <span style={{ width: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconBack />
            </span>
            Retour au site
          </Link>
        </div>
      </aside>
    </>
  );
}