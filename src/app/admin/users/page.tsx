'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Input,
  Select,
  Button,
  Modal,
  Form,
  DatePicker,
  Typography,
  message,
  Avatar,
  Spin,
} from '@/components/admin/ui';
import {
  SearchOutlined,
  EditOutlined,
  UserOutlined,
  ReloadOutlined,
  CrownOutlined,
} from '@/components/admin/icons';
import dayjs from 'dayjs';
import {
  adminGetUsers,
  adminUpdateUserSubscription,
  AdminUser,
} from '@/services/admin';

const { Title, Text } = Typography;
const { Option } = Select;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [page, setPage] = useState(1);


  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [profileUser, setProfileUser] = useState<AdminUser | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
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
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Erreur lors de la récupération des utilisateurs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) return fetchUsers(submittedSearch, page); });
    return () => { active = false; };
  }, [fetchUsers, page, submittedSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSubmittedSearch(search.trim());
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
        fetchUsers(submittedSearch, page);
      } else {
        message.error(res?.message || 'Erreur lors de la mise à jour');
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Erreur formulaire');
    } finally {
      setSubmitting(false);
    }
  };

  const planLabel = (plan: string) => plan === 'premium' ? 'Premium' : plan === 'standard' ? 'Standard' : 'Gratuit';
  const subscriptionState = (user: AdminUser) => {
    const status = user.subscription?.status || 'inactive';
    const expired = user.subscription?.expiresAt && dayjs(user.subscription.expiresAt).isBefore(dayjs());
    if (user.subscription?.plan === 'free') return { label: 'Gratuit', state: 'neutral' };
    if (expired) return { label: 'Expiré', state: 'danger' };
    if (status === 'active') return { label: 'Actif', state: 'good' };
    if (status === 'cancelled') return { label: 'Résilié', state: 'danger' };
    return { label: 'Inactif', state: 'muted' };
  };
  const lastSession = (user: AdminUser) => {
    const timestamps = (user.activeSessions || []).map(session => new Date(session.lastLogin).getTime()).filter(Number.isFinite);
    return timestamps.length ? dayjs(Math.max(...timestamps)).format('DD MMM YYYY · HH:mm') : 'Donnée indisponible';
  };

  return (
    <div className="admin-users-page">
      <header className="admin-list-heading admin-users-heading">
        <div><span className="admin-list-eyebrow">COMMUNAUTÉ CHILLERS</span><Title level={2}>Fiches utilisateurs</Title><Text type="secondary">Chaque fiche rassemble le compte, l’ancienneté et l’historique d’abonnement connu.</Text></div>
        <Button icon={<ReloadOutlined />} onClick={() => fetchUsers(submittedSearch, page)} loading={loading}>Actualiser</Button>
      </header>

      <section className="admin-list-toolbar admin-users-toolbar">
        <form onSubmit={handleSearch} className="admin-users-search">
          <Input placeholder="Nom ou adresse e-mail" prefix={<SearchOutlined />} value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} allowClear />
          <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>Rechercher</Button>
        </form>
        <span className="admin-list-total"><strong>{total.toLocaleString('fr-FR')}</strong> membres</span>
      </section>

      <section className="admin-user-list" aria-label="Liste des utilisateurs">
        {loading && users.length === 0 ? <div className="admin-list-empty"><Spin /></div> : users.length ? users.map(user => {
          const membership = subscriptionState(user);
          return <button type="button" className={`admin-user-row is-plan-${user.subscription?.plan || 'free'}`} key={user._id} onClick={() => { setProfileUser(user); setProfileModalVisible(true); }}>
            <Avatar src={user.avatarUrl} size={42}><UserOutlined /></Avatar>
            <span className="admin-user-row-identity"><strong>{user.username || user.email.split('@')[0]}</strong><small>{user.email}</small></span>
            <span className={`admin-user-row-plan is-${user.subscription?.plan || 'free'}`}>{user.subscription?.plan === 'premium' && <CrownOutlined />}{planLabel(user.subscription?.plan || 'free')}</span>
            <span className={`admin-user-state is-${membership.state}`}>{membership.label}</span>
            <span className="admin-user-row-date"><small>{user.subscription?.startedAt ? 'Abonné depuis' : 'Inscrit le'}</small><strong>{user.subscription?.startedAt ? dayjs(user.subscription.startedAt).format('DD MMM YYYY') : user.createdAt ? dayjs(user.createdAt).format('DD MMM YYYY') : '—'}</strong></span>
            <span className="admin-user-row-open">Voir la fiche <b>›</b></span>
          </button>;
        }) : <div className="admin-list-empty">Aucun utilisateur trouvé.</div>}
      </section>

      {total > 25 && <nav className="admin-user-mobile-pagination" aria-label="Pagination utilisateurs"><Button size="small" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</Button><span>Page {page} / {Math.ceil(total / 25)}</span><Button size="small" disabled={page >= Math.ceil(total / 25)} onClick={() => setPage(page + 1)}>Suivant</Button></nav>}

      <Modal
        title={profileUser ? `Fiche utilisateur · ${profileUser.username || profileUser.email}` : 'Fiche utilisateur'}
        open={profileModalVisible}
        onCancel={() => setProfileModalVisible(false)}
        footer={null}
        width={620}
      >
        {profileUser && (() => {
          const plan = profileUser.subscription?.plan || 'free';
          const membership = subscriptionState(profileUser);
          return <div className={`admin-user-profile is-plan-${plan}`}>
            <div className="admin-user-profile-head"><Avatar src={profileUser.avatarUrl} size={58}><UserOutlined /></Avatar><div><strong>{profileUser.username || profileUser.email.split('@')[0]}</strong><span>{profileUser.email}</span></div><span className={`admin-user-row-plan is-${plan}`}>{plan === 'premium' && <CrownOutlined />}{planLabel(plan)}</span></div>
            <section className="admin-user-profile-subscription"><div><span>ÉTAT DE L’ABONNEMENT</span><strong className={`admin-user-state is-${membership.state}`}>{membership.label}</strong></div><div><span>ABONNÉ DEPUIS</span><strong>{profileUser.subscription?.startedAt ? dayjs(profileUser.subscription.startedAt).format('DD MMMM YYYY') : plan === 'free' ? 'Aucun abonnement connu' : 'Date inconnue'}</strong></div><div><span>ÉCHÉANCE</span><strong>{plan === 'free' ? '—' : profileUser.subscription?.expiresAt ? dayjs(profileUser.subscription.expiresAt).format('DD MMMM YYYY') : 'Sans échéance'}</strong></div><div><span>COMPTE CRÉÉ LE</span><strong>{profileUser.createdAt ? dayjs(profileUser.createdAt).format('DD MMMM YYYY') : '—'}</strong></div></section>
            <section className="admin-user-profile-activity"><span>ACTIVITÉ DU COMPTE</span><div><strong>{profileUser.favorites?.length ?? 0}</strong><small>Favoris</small></div><div><strong>{profileUser.watchHistory?.length ?? 0}</strong><small>Vus</small></div><div><strong>{profileUser.continueWatching?.length ?? 0}</strong><small>En cours</small></div><div><strong>{profileUser.activeSessions?.length ?? 0}</strong><small>Sessions</small></div></section>
            <div className="admin-user-profile-last"><span>DERNIÈRE ACTIVITÉ DE SESSION</span><strong>{lastSession(profileUser)}</strong></div>
            <Button type="primary" block icon={<EditOutlined />} onClick={() => { setProfileModalVisible(false); openEditModal(profileUser); }}>Gérer l’abonnement et le rôle</Button>
          </div>;
        })()}
      </Modal>

      {/* Modal d'édition de l'abonnement */}
      <Modal
        title={`Modifier l’abonnement de ${editingUser?.email || 'cet utilisateur'}`}
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
