'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { adminVerify, adminLogout } from '@/services/admin';
import { AutoComplete, Button, Drawer, Input, Layout, ToastViewport, Typography } from '@/components/admin/ui';
import Image from 'next/image';
import { useHydrated } from '@/hooks/useHydrated';
import {
  AppstoreOutlined, BarChartOutlined, BellOutlined, BugOutlined, DashboardOutlined, DollarOutlined,
  FileSearchOutlined, LinkOutlined, LogoutOutlined, MenuOutlined, PlaySquareOutlined, PlusOutlined,
  RobotOutlined, SettingOutlined, TeamOutlined, ThunderboltOutlined, UserOutlined, VideoCameraOutlined,
} from '@/components/admin/icons';
import './admin.css';

const { Sider } = Layout;
const { Text } = Typography;
const SIDEBAR_WIDTH = 244;

const NAV_GROUPS = [
  { label: 'Vue générale', items: [['/admin', 'Dashboard', DashboardOutlined]] },
  { label: 'Gestion', items: [['/admin/transactions', 'Transactions', DollarOutlined], ['/admin/users', 'Utilisateurs', TeamOutlined], ['/admin/subscriptions', 'Abonnements', UserOutlined], ['/admin/analytics', 'Fréquentation', BarChartOutlined], ['/admin/notifications', 'Notifications', BellOutlined]] },
  { label: 'Catalogue', items: [['/admin/movies', 'Films', VideoCameraOutlined], ['/admin/series', 'Séries', PlaySquareOutlined], ['/admin/animes', 'Animes', PlaySquareOutlined], ['/admin/add-media', 'Ajouter un média', PlusOutlined], ['/admin/tmdb', 'Liaison TMDB', AppstoreOutlined], ['/admin/catalogue', 'Catalogue à lier', LinkOutlined], ['/admin/affiches', 'Studio éditorial', RobotOutlined], ['/admin/requests', 'Demandes utilisateurs', ThunderboltOutlined]] },
  { label: 'Exploitation', items: [['/admin/uqload', 'Hébergement vidéo', PlaySquareOutlined], ['/admin/dead-links', 'Liens à réparer', BugOutlined], ['/admin/liens', 'Liens convertis', LinkOutlined], ['/admin/maintenance-liens', 'Vérification des liens', FileSearchOutlined], ['/admin/scrapper', 'Scraper', RobotOutlined], ['/admin/cron', 'Tâches planifiées', SettingOutlined], ['/admin/live', 'Live TV', PlaySquareOutlined]] },
  { label: 'Système', items: [['/admin/settings', 'Paramètres', SettingOutlined]] },
] as const;

const NAV_LINKS = ([
  ['/admin', 'Dashboard'], ['/admin/transactions', 'Transactions'], ['/admin/users', 'Utilisateurs'],
  ['/admin/subscriptions', 'Abonnements'], ['/admin/analytics', 'Fréquentation'],
  ['/admin/notifications', 'Notifications push'], ['/admin/movies', 'Films'], ['/admin/series', 'Séries'],
  ['/admin/animes', 'Animes'], ['/admin/add-media', 'Ajouter un média'], ['/admin/tmdb', 'Liaison TMDB'],
  ['/admin/catalogue', 'Catalogue à lier'], ['/admin/affiches', 'Assistant affiches'],
  ['/admin/requests', 'Demandes utilisateurs'], ['/admin/uqload', 'Hébergement vidéo'],
  ['/admin/dead-links', 'Liens à réparer'], ['/admin/liens', 'Liens convertis'],
  ['/admin/maintenance-liens', 'Vérification des liens'], ['/admin/scrapper', 'Scraper'],
  ['/admin/cron', 'Tâches planifiées'], ['/admin/live', 'Live TV'], ['/admin/settings', 'Paramètres'],
  ['/admin/logs', 'Journaux de diagnostic'],
] as const).map(([key, label]) => ({ key, label }));

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const router = useRouter();
  const selectedKey = useMemo(() => {
    const match = NAV_LINKS.filter(item => item.key !== '/admin' && pathname.startsWith(item.key))
      .sort((a, b) => b.key.length - a.key.length)[0];
    return match?.key || '/admin';
  }, [pathname]);

  return <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: '#111113' }}>
    <div className="admin-sidebar-brand" style={{ padding: '22px 20px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Image src="/logo-centered.png" alt="Logo CHILLERS" width={46} height={46} priority style={{ objectFit: 'contain', flexShrink: 0 }} />
        <div style={{ lineHeight: 1.05 }}><Text strong style={{ color: '#F42A7C', letterSpacing: '.11em', fontSize: 15 }}>CHILLERS</Text><div style={{ marginTop: 6, color: '#aaa2a8', fontSize: 10, letterSpacing: '.13em', textTransform: 'uppercase' }}>Back office</div></div>
      </div>
      <div style={{ marginTop: 16, height: 2, width: 42, borderRadius: 2, background: '#F42A7C' }} />
    </div>
    <nav aria-label="Navigation admin" style={{ flex: 1, padding: '12px 12px 18px' }}>
      {NAV_GROUPS.map(group => <section key={group.label} style={{ marginBottom: 16 }}>
        <div style={{ padding: '8px 10px 6px', color: '#a0959f', fontSize: 10, fontWeight: 650, letterSpacing: '.12em', textTransform: 'uppercase' }}>{group.label}</div>
        {group.items.map(([key, label, Icon]) => <button className="admin-nav-link" key={key} type="button" onClick={() => { router.push(key); onNavigate?.(); }} aria-current={selectedKey === key ? 'page' : undefined} style={{ position: 'relative', display: 'flex', width: '100%', alignItems: 'center', gap: 10, minHeight: 37, padding: '0 11px 0 14px', border: 0, borderRadius: 7, background: selectedKey === key ? '#39202b' : 'transparent', color: selectedKey === key ? '#ff78aa' : '#b8b0b7', font: 'inherit', fontSize: 12.5, fontWeight: selectedKey === key ? 620 : 450, textAlign: 'left', cursor: 'pointer', transition: 'color 140ms ease, background 140ms ease, transform 140ms ease' }}>
          {selectedKey === key && <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 2, borderRadius: 2, background: '#F42A7C' }} />}<Icon aria-hidden="true" style={{ fontSize: 14, flexShrink: 0 }} />{label}
        </button>)}
      </section>)}
    </nav>
    <div style={{ padding: '12px 14px' }}>
      <Button type="text" danger icon={<LogoutOutlined />} onClick={() => { adminLogout(); router.push('/admin/login'); }} block style={{ justifyContent: 'flex-start', height: 40 }}>Déconnexion</Button>
    </div>
  </div>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(true);
  const [search, setSearch] = useState('');
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    setIsMobile(mq.matches);
    const handler = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (pathname === '/admin/login') { setLoading(false); return; }
    let active = true;
    adminVerify().then(res => {
      if (!active) return;
      if (res.success) setAuthed(true);
      else { localStorage.removeItem('admin-token'); router.push('/admin/login'); }
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      localStorage.removeItem('admin-token'); router.push('/admin/login'); setLoading(false);
    });
    return () => { active = false; };
  }, [pathname, router]);

  useEffect(() => { setMobileOpen(false); setSearch(''); }, [pathname]);

  if (pathname === '/admin/login') return <>{children}</>;
  if (loading) return <div className="admin-shell" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#aaa2a8', background: '#0b0b0d' }}>Vérification de la session…</div>;
  if (!authed || !hydrated) return null;

  const searchOptions = search.trim() ? NAV_LINKS.filter(item => item.label.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr'))).map(item => ({ value: item.key, label: item.label })) : [];
  const current = NAV_LINKS.filter(item => item.key !== '/admin' && pathname.startsWith(item.key)).sort((a, b) => b.key.length - a.key.length)[0];

  return <>
    <ToastViewport />
    <div className="admin-shell">
    <Layout style={{ minHeight: '100vh', background: '#f2efeb' }}>
      {!isMobile && <Sider width={SIDEBAR_WIDTH} theme="light" trigger={null} style={{ position: 'fixed', insetBlock: 0, insetInlineStart: 0, zIndex: 100, overflowY: 'auto', borderRight: 0, background: '#111113' }}>
        <SidebarContent pathname={pathname} />
      </Sider>}
      <Drawer placement="left" open={mobileOpen} onClose={() => setMobileOpen(false)} size={SIDEBAR_WIDTH} styles={{ body: { padding: 0, background: '#f8f6f3' }, header: { display: 'none' } }} zIndex={200} closable={false}>
        <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
      </Drawer>
      <Layout style={{ marginLeft: isMobile ? 0 : SIDEBAR_WIDTH, background: '#f2efeb' }}>
        <header className="admin-topbar" style={{ height: 68, position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '0 26px', backdropFilter: 'blur(12px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 130 }}>
            {isMobile && <Button type="text" icon={<MenuOutlined />} onClick={() => setMobileOpen(true)} />}
            <Text strong style={{ color: '#344054' }}>{current?.label || 'Dashboard'}</Text>
          </div>
          <AutoComplete options={searchOptions} value={search} onChange={setSearch} onSelect={(key) => router.push(key)} style={{ width: 'min(360px, 55vw)' }}>
            <Input.Search allowClear placeholder="Rechercher une page…" aria-label="Rechercher une page d’administration" />
          </AutoComplete>
          <Text type="secondary" style={{ minWidth: 115, textAlign: 'right', fontSize: 12 }}>Espace admin</Text>
        </header>
        <main className="admin-content" style={{ padding: isMobile ? '14px 10px' : '18px 18px', minHeight: 'calc(100vh - 68px)' }}>{children}</main>
      </Layout>
    </Layout>
    </div>
  </>;
}
