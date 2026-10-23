'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { adminLogin } from '@/services/admin';
import { Card, Form, Input, Button, Alert, Typography, Row, Col } from '@/components/admin/ui';
import { LockOutlined, UserOutlined } from '@/components/admin/icons';

const { Title, Text, Paragraph } = Typography;

export default function AdminLogin() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(values: { username: string; password: string }) {
    setError('');
    setLoading(true);
    const res = await adminLogin(values.username, values.password);
    setLoading(false);
    if (res.success) router.push('/admin');
    else setError(res.message || 'Identifiants invalides');
  }

  return <>
    <div className="admin-shell" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: 'radial-gradient(circle at 12% 8%, #272126 0, #111012 50%, #0b0b0d 100%)' }}>
      <Card style={{ width: '100%', maxWidth: 920, overflow: 'hidden', border: '1px solid #e5ddd7', boxShadow: '0 22px 60px rgba(50,37,42,.10)' }} styles={{ body: { padding: 0 } }}>
        <Row>
          <Col xs={24} md={11}>
            <div style={{ height: '100%', minHeight: 430, padding: '38px 34px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: '#fff', background: '#49343f' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Image src="/logo-centered.png" alt="Logo CHILLERS" width={48} height={48} style={{ objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,.18))' }} /><div><Text strong style={{ color: '#fff', letterSpacing: '.08em' }}>CHILLERS</Text><div><Text style={{ color: '#e5d9f4', fontSize: 12 }}>Centre de pilotage</Text></div></div></div>
              <div><Text style={{ color: '#e9d8f5', letterSpacing: '.14em', fontSize: 11 }}>DANS LES COULISSES</Text><Title level={2} style={{ color: '#fff', margin: '10px 0' }}>Le plaisir de découvrir, bien orchestré.</Title><Paragraph style={{ color: '#eadff2', lineHeight: 1.7, margin: 0 }}>Catalogue, communauté et diffusion : retrouvez les outils CHILLERS réunis dans un seul espace.</Paragraph></div>
              <Text style={{ color: '#e9d8f5', fontSize: 12 }}>Un accès réservé à l’équipe d’administration.</Text>
            </div>
          </Col>
          <Col xs={24} md={13}>
            <div style={{ maxWidth: 410, margin: '0 auto', padding: '52px 36px' }}>
              <Text type="secondary" style={{ fontSize: 11, letterSpacing: '.12em' }}>BON RETOUR</Text>
              <Title level={2} style={{ margin: '7px 0 4px' }}>Connexion admin</Title>
              <Text type="secondary">Connectez-vous pour gérer votre espace.</Text>
              {error && <Alert type="error" showIcon description={error} style={{ margin: '22px 0 14px' }} />}
              <Form layout="vertical" onFinish={handleSubmit} requiredMark={false} style={{ marginTop: 26 }}>
                <Form.Item name="username" label="Nom d’utilisateur" rules={[{ required: true, message: 'Entrez votre nom d’utilisateur' }]}>
                  <Input prefix={<UserOutlined />} placeholder="Nom d’utilisateur" autoComplete="username" size="large" />
                </Form.Item>
                <Form.Item name="password" label="Mot de passe" rules={[{ required: true, message: 'Entrez votre mot de passe' }]}>
                  <Input.Password prefix={<LockOutlined />} placeholder="Mot de passe" autoComplete="current-password" size="large" />
                </Form.Item>
                <Button type="primary" htmlType="submit" block size="large" loading={loading} style={{ marginTop: 8 }}>Ouvrir mon espace</Button>
              </Form>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  </>;
}
