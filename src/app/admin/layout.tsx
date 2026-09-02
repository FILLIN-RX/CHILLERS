'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { adminVerify, adminLogout, adminScrapperHealth } from '@/services/admin';
import { ConfigProvider, Layout, Menu, Button, Drawer, Badge, Typography, type MenuProps } from 'antd';
import { useHydrated } from '@/hooks/useHydrated';
import {
  DashboardOutlined,
  PlusOutlined,
  VideoCameraOutlined,
  UnorderedListOutlined,
  SettingOutlined,
  LogoutOutlined,
  AppstoreOutlined,
  BugOutlined,
  MenuOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { adminTheme } from './theme';

const { Sider } = Layout;
const { Text } = Typography;

const NAV_ITEMS: MenuProps['items'] = [
  { key: '/admin', icon: <DashboardOutlined />, label: <Link href="/admin">Dashboard</Link> },
  { key: '/admin/add-media', icon: <PlusOutlined />, label: <Link href="/admin/add-media">Ajouter</Link> },
  { key: '/admin/movies', icon: <VideoCameraOutlined />, label: <Link href="/admin/movies">Films</Link> },
  { key: '/admin/series', icon: <VideoCameraOutlined />, label: <Link href="/admin/series">Séries</Link> },
  { key: '/admin/animes', icon: <VideoCameraOutlined />, label: <Link href="/admin/animes">Animes</Link> },
  { key: '/admin/affiches', icon: <RobotOutlined />, label: <Link href="/admin/affiches">Assistant IA</Link> },
  { key: '/admin/tmdb', icon: <AppstoreOutlined />, label: <Link href="/admin/tmdb">TMDB</Link> },
  { key: '/admin/scrapper', icon: <BugOutlined />, label: <Link href="/admin/scrapper">Scrapper</Link> },
  { key: '/admin/logs', icon: <UnorderedListOutlined />, label: <Link href="/admin/logs">Logs</Link> },
  { key: '/admin/dead-links', icon: <BugOutlined />, label: <Link href="/admin/dead-links">Liens morts</Link> },
  { key: '/admin/liens', icon: <UnorderedListOutlined />, label: <Link href="/admin/liens">Liens</Link> },
  { key: '/admin/maintenance-liens', icon: <BugOutlined />, label: <Link href="/admin/maintenance-liens">Maint. Liens</Link> },
  { key: '/admin/uqload', icon: <UnorderedListOutlined />, label: <Link href="/admin/uqload">Uqload</Link> },
  { key: '/admin/live', icon: <UnorderedListOutlined />, label: <Link href="/admin/live">Live TV</Link> },
  { key: '/admin/cron', icon: <SettingOutlined />, label: <Link href="/admin/cron">Tâches</Link> },
  { key: '/admin/settings', icon: <SettingOutlined />, label: <Link href="/admin/settings">Paramètres</Link> },
];

const SIDER_W = 256;

function SidebarContent({ onNav }: { onNav?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [scrapperOnline, setScrapperOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await adminScrapperHealth();
        if (active) setScrapperOnline(res.success === true);
      } catch {
        if (active) setScrapperOnline(false);
      }
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => { active = false; clearInterval(id); };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '1.25rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg, #6c5ce7, #9b59f6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: '1.125rem',
        }}>
          C
        </div>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.9375rem', letterSpacing: '0.02em' }}>
            CHILLERS
          </div>
          <Text type="secondary" style={{ textTransform: 'uppercase', fontSize: '0.625rem', letterSpacing: '0.08em' }}>
            Administration
          </Text>
        </div>
      </div>

      <div style={{ margin: '0 1rem 0.75rem', padding: '0.5rem 0.75rem', borderRadius: 8, background: '#0a0d14', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Badge
          status={scrapperOnline === null ? 'default' : scrapperOnline ? 'success' : 'error'}
          style={{ flexShrink: 0 }}
        />
        <span style={{ fontSize: '0.75rem', color: '#8b93a7' }}>
          Scrapper {scrapperOnline === null ? '...' : scrapperOnline ? 'en ligne' : 'hors ligne'}
        </span>
      </div>

      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[pathname]}
        items={NAV_ITEMS}
        onClick={() => onNav?.()}
        style={{ flex: 1, borderInlineEnd: 'none' }}
      />

      <div style={{ padding: '0.75rem 1rem' }}>
        <Button
          type="text"
          danger
          icon={<LogoutOutlined />}
          onClick={() => { adminLogout(); router.push('/admin/login'); }}
          block
          style={{ justifyContent: 'flex-start', height: 40 }}
        >
          Déconnexion
        </Button>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  if (pathname === '/admin/login') return <>{children}</>;

  if (loading) {
    return (
      <ConfigProvider theme={adminTheme}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c0e14', flexDirection: 'column', gap: '1rem' }}>
          <div className="admin-loading-spinner" />
          <span style={{ color: '#6b7488', fontSize: '0.875rem' }}>Vérification...</span>
          <style>{`
            .admin-loading-spinner {
              width: 36px; height: 36px; border: 3px solid #1c2230;
              border-top-color: #6c5ce7; border-radius: 50%;
              animation: spin 0.8s linear infinite;
            }
            @keyframes spin { to { transform: rotate(360deg); } }
          `}</style>
        </div>
      </ConfigProvider>
    );
  }

  if (!authed) return null;

  // Don't render until hydrated to avoid SSR/client mismatch on isMobile state
  if (!hydrated) {
    return null;
  }

  const sidebarContent = <SidebarContent />;

  return (
    <ConfigProvider theme={adminTheme}>
      <Layout style={{ minHeight: '100vh', background: '#0c0e14' }}>
        {!isMobile && (
          <Sider
            width={SIDER_W}
            collapsedWidth={0}
            trigger={null}
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              bottom: 0,
              zIndex: 100,
              borderInlineEnd: '1px solid #1c2230',
            }}
          >
            {sidebarContent}
          </Sider>
        )}

        <Drawer
          placement="left"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          width={SIDER_W}
          styles={{ body: { padding: 0, background: '#0f1219' }, header: { display: 'none' } }}
          zIndex={200}
          closable={false}
        >
          <SidebarContent />
        </Drawer>

        <Layout style={{ marginLeft: isMobile ? 0 : SIDER_W, background: '#0c0e14' }}>
          {isMobile && (
            <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#141821', borderBottom: '1px solid #1c2230', padding: '0.75rem 1rem' }}>
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setMobileOpen(true)}
                style={{ color: '#e6e9f0', fontSize: '1.125rem', width: 40, height: 40 }}
              />
            </div>
          )}
          <main style={{ padding: isMobile ? '0.75rem' : '1.5rem', overflowY: 'auto', minHeight: isMobile ? 'calc(100vh - 57px)' : '100vh' }}>
            {children}
          </main>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
