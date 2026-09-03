'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Card,
  Input,
  Select,
  Tag,
  Button,
  Modal,
  Form,
  DatePicker,
  Typography,
  Space,
  message,
  Avatar,
  Badge,
  Tabs,
  Image,
} from 'antd';
import {
  SearchOutlined,
  EditOutlined,
  UserOutlined,
  ReloadOutlined,
  CrownOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileProtectOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  adminGetUsers,
  adminUpdateUserSubscription,
  AdminUser,
  adminGetPaymentProofs,
  adminReviewPaymentProof,
  AdminPaymentProof,
} from '@/services/admin';

const { Title, Text } = Typography;
const { Option } = Select;

export default function AdminUsersPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'proofs'>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Preuves de paiement
  const [proofs, setProofs] = useState<AdminPaymentProof[]>([]);
  const [loadingProofs, setLoadingProofs] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const fetchUsers = useCallback(async (searchQuery = '', currentPage = 1) => {
    setLoading(true);
    try {
      const res = await adminGetUsers({
        search: searchQuery,
        page: currentPage,
        limit: 25,
      });
      if (res?.success) {
        setUsers(res.users || []);
        setTotal(res.total || 0);
      } else {
        message.error('Impossible de charger les utilisateurs');
      }
    } catch (err: any) {
      message.error(err.message || 'Erreur lors de la récupération des utilisateurs');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProofs = useCallback(async () => {
    setLoadingProofs(true);
    try {
      const res = await adminGetPaymentProofs();
      if (res?.success) {
        setProofs(res.proofs || []);
      }
    } catch (err: any) {
      message.error('Erreur chargement des preuves');
    } finally {
      setLoadingProofs(false);
    }
  }, []);

  const handleReview = async (proofId: string, status: 'approved' | 'rejected') => {
    setActionLoading(proofId);
    try {
      const res = await adminReviewPaymentProof(proofId, status);
      if (res?.success) {
        message.success(res.message);
        fetchProofs();
        fetchUsers(search, page);
      } else {
        message.error('Erreur lors du traitement de la preuve');
      }
    } catch (err: any) {
      message.error(err.message || 'Erreur');
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    fetchUsers(search, page);
    fetchProofs();
  }, [fetchUsers, fetchProofs, page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers(search, 1);
  };

  const openEditModal = (user: AdminUser) => {
    setEditingUser(user);
    form.setFieldsValue({
      plan: user.subscription?.plan || 'free',
      status: user.subscription?.status || 'active',
      role: user.role || 'user',
      expiresAt: user.subscription?.expiresAt ? dayjs(user.subscription.expiresAt) : null,
    });
    setModalVisible(true);
  };

  const handleUpdate = async () => {
    try {
      const values = await form.validateFields();
      if (!editingUser) return;
      setSubmitting(true);

      const res = await adminUpdateUserSubscription(editingUser._id, {
        plan: values.plan,
        status: values.status,
        role: values.role,
        expiresAt: values.expiresAt ? values.expiresAt.toISOString() : null,
      });

      if (res?.success) {
        message.success(`Abonnement de ${editingUser.email} mis à jour avec succès !`);
        setModalVisible(false);
        fetchUsers(search, page);
      } else {
        message.error(res?.message || 'Erreur lors de la mise à jour');
      }
    } catch (err: any) {
      message.error(err.message || 'Erreur formulaire');
    } finally {
      setSubmitting(false);
    }
  };

  const planTag = (plan: string) => {
    switch (plan) {
      case 'premium':
        return (
          <Tag icon={<CrownOutlined />} color="gold">
            PREMIUM
          </Tag>
        );
      case 'standard':
        return <Tag color="blue">STANDARD</Tag>;
      default:
        return <Tag color="default">GRATUIT</Tag>;
    }
  };

  const statusTag = (status: string) => {
    switch (status) {
      case 'active':
        return <Tag color="green">ACTIF</Tag>;
      case 'inactive':
        return <Tag color="volcano">INACTIF</Tag>;
      case 'cancelled':
        return <Tag color="red">RÉSILIÉ</Tag>;
      default:
        return <Tag color="default">{status}</Tag>;
    }
  };

  const columns = [
    {
      title: 'Utilisateur',
      key: 'user',
      render: (_: any, record: AdminUser) => (
        <Space direction="horizontal" size="middle">
          <Avatar
            src={record.avatarUrl}
            icon={<UserOutlined />}
            style={{ backgroundColor: record.role === 'admin' ? '#d70466' : '#6c5ce7' }}
          />
          <div>
            <div style={{ fontWeight: 600, color: '#fff' }}>
              {record.username || record.email.split('@')[0]}
              {record.role === 'admin' && (
                <Tag color="magenta" style={{ marginLeft: 6, fontSize: 10 }}>
                  ADMIN
                </Tag>
              )}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.email}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Formule Actuelle',
      key: 'plan',
      render: (_: any, record: AdminUser) => planTag(record.subscription?.plan || 'free'),
    },
    {
      title: 'Statut',
      key: 'status',
      render: (_: any, record: AdminUser) => statusTag(record.subscription?.status || 'active'),
    },
    {
      title: 'Expiration',
      key: 'expiresAt',
      render: (_: any, record: AdminUser) => {
        if (!record.subscription?.expiresAt) {
          return <Text type="secondary">— (Permanent)</Text>;
        }
        const exp = dayjs(record.subscription.expiresAt);
        const isExpired = exp.isBefore(dayjs());
        return (
          <span style={{ color: isExpired ? '#ff4d4f' : '#52c41a' }}>
            {exp.format('DD/MM/YYYY')} {isExpired ? '(Expiré)' : ''}
          </span>
        );
      },
    },
    {
      title: 'Inscrit le',
      key: 'createdAt',
      render: (_: any, record: AdminUser) =>
        record.createdAt ? dayjs(record.createdAt).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: AdminUser) => (
        <Button
          type="primary"
          ghost
          icon={<EditOutlined />}
          size="small"
          onClick={() => openEditModal(record)}
        >
          Modifier l&apos;Abonnement
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1200, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <Title level={3} style={{ color: '#fff', margin: 0 }}>
            Gestion des Utilisateurs & Abonnements
          </Title>
          <Text type="secondary">
            Consultez tous les utilisateurs inscrits sur CHILLERS et modifiez directement leur formule
          </Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => fetchUsers(search, page)}
          loading={loading}
        >
          Actualiser
        </Button>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as 'users' | 'proofs')}
        style={{ marginBottom: '1.5rem' }}
        items={[
          {
            key: 'users',
            label: (
              <span>
                <UserOutlined /> Utilisateurs ({total})
              </span>
            ),
            children: (
              <>
                <Card style={{ background: '#141414', border: '1px solid #262626', marginBottom: '1.5rem' }}>
                  <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem' }}>
                    <Input
                      placeholder="Rechercher par email ou nom d'utilisateur..."
                      prefix={<SearchOutlined />}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      allowClear
                      style={{ maxWidth: 400 }}
                    />
                    <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                      Rechercher
                    </Button>
                  </form>
                </Card>

                <Table
                  dataSource={users}
                  columns={columns}
                  rowKey="_id"
                  loading={loading}
                  pagination={{
                    current: page,
                    pageSize: 25,
                    total,
                    onChange: (p) => setPage(p),
                    showTotal: (tot) => `${tot} utilisateurs au total`,
                  }}
                  style={{ background: '#141414', borderRadius: 8, overflow: 'hidden' }}
                />
              </>
            ),
          },
          {
            key: 'proofs',
            label: (
              <span>
                <FileProtectOutlined /> Preuves Mobile Money ({proofs.filter(p => p.status === 'pending').length} en attente)
              </span>
            ),
            children: (
              <Table
                dataSource={proofs}
                rowKey="_id"
                loading={loadingProofs}
                style={{ background: '#141414', borderRadius: 8, overflow: 'hidden' }}
                columns={[
                  {
                    title: 'Utilisateur',
                    key: 'user',
                    render: (_: any, r: AdminPaymentProof) => (
                      <div>
                        <div style={{ fontWeight: 600, color: '#fff' }}>{r.userEmail}</div>
                        {r.senderPhone && <Text type="secondary" style={{ fontSize: 11 }}>Tél: {r.senderPhone}</Text>}
                        {r.transactionRef && <div style={{ fontSize: 11, color: '#888' }}>Réf: {r.transactionRef}</div>}
                      </div>
                    ),
                  },
                  {
                    title: 'Formule & Montant',
                    key: 'plan',
                    render: (_: any, r: AdminPaymentProof) => (
                      <div>
                        <Tag color={r.planCode === 'premium' ? 'gold' : 'blue'}>{r.planName}</Tag>
                        <div style={{ fontWeight: 700, color: '#fff', marginTop: 4 }}>{r.amount} FCFA</div>
                      </div>
                    ),
                  },
                  {
                    title: 'Moyen de Dépôt',
                    key: 'method',
                    render: (_: any, r: AdminPaymentProof) => (
                      <Tag color={r.paymentMethod === 'orange' ? 'orange' : 'gold'}>
                        {r.paymentMethod === 'orange' ? 'Orange Money' : 'MTN MoMo'}
                      </Tag>
                    ),
                  },
                  {
                    title: 'Capture d\'écran',
                    key: 'screenshot',
                    render: (_: any, r: AdminPaymentProof) => (
                      <Image
                        src={r.screenshotUrl}
                        alt="Preuve"
                        width={64}
                        height={64}
                        style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid #333' }}
                      />
                    ),
                  },
                  {
                    title: 'Statut',
                    key: 'status',
                    render: (_: any, r: AdminPaymentProof) => {
                      if (r.status === 'approved') return <Tag color="green">VALIDÉ</Tag>;
                      if (r.status === 'rejected') return <Tag color="red">REJETÉ</Tag>;
                      return <Tag color="warning">EN ATTENTE</Tag>;
                    },
                  },
                  {
                    title: 'Date',
                    key: 'createdAt',
                    render: (_: any, r: AdminPaymentProof) =>
                      r.createdAt ? dayjs(r.createdAt).format('DD/MM/YYYY HH:mm') : '—',
                  },
                  {
                    title: 'Validation',
                    key: 'actions',
                    render: (_: any, r: AdminPaymentProof) => (
                      <Space>
                        {r.status === 'pending' ? (
                          <>
                            <Button
                              type="primary"
                              size="small"
                              icon={<CheckCircleOutlined />}
                              loading={actionLoading === r._id}
                              onClick={() => handleReview(r._id, 'approved')}
                              style={{ backgroundColor: '#52c41a' }}
                            >
                              Valider
                            </Button>
                            <Button
                              danger
                              size="small"
                              icon={<CloseCircleOutlined />}
                              loading={actionLoading === r._id}
                              onClick={() => handleReview(r._id, 'rejected')}
                            >
                              Rejeter
                            </Button>
                          </>
                        ) : (
                          <Text type="secondary" style={{ fontSize: 12 }}>Traité</Text>
                        )}
                      </Space>
                    ),
                  },
                ]}
              />
            ),
          },
        ]}
      />

      {/* Modal d'édition de l'abonnement */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CrownOutlined style={{ color: '#faad14' }} />
            <span>Modifier l&apos;abonnement de {editingUser?.email}</span>
          </div>
        }
        open={modalVisible}
        onOk={handleUpdate}
        confirmLoading={submitting}
        onCancel={() => setModalVisible(false)}
        okText="Enregistrer les modifications"
        cancelText="Annuler"
      >
        <Form form={form} layout="vertical" style={{ marginTop: '1rem' }}>
          <Form.Item name="plan" label="Formule d'abonnement" rules={[{ required: true }]}>
            <Select>
              <Option value="free">Gratuit (Free)</Option>
              <Option value="standard">Standard (720p / 1080p Standard)</Option>
              <Option value="premium">Premium (1080p Ultra HD / Prioritaire / Pas de pub)</Option>
            </Select>
          </Form.Item>

          <Form.Item name="status" label="Statut de l'abonnement" rules={[{ required: true }]}>
            <Select>
              <Option value="active">Actif</Option>
              <Option value="inactive">Inactif</Option>
              <Option value="cancelled">Résilié</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="expiresAt"
            label="Date d'expiration de l'abonnement"
            help="Laissez vide pour un accès à vie ou permanent"
          >
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" showNow />
          </Form.Item>

          <Form.Item name="role" label="Rôle de l'utilisateur">
            <Select>
              <Option value="user">Utilisateur standard</Option>
              <Option value="admin">Administrateur</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
