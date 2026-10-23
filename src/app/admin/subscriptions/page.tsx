'use client';

import React, { useEffect, useState } from 'react';
import { FloppyDisk, PencilSimple, Check, X, Crown, UsersThree } from '@phosphor-icons/react';
import GlobalSubscriptionToggle from '@/components/admin/GlobalSubscriptionToggle';
import { adminGetSubscriptionPlans, adminGetSubscriptionAuditHistory, adminUpdateSubscriptionPlan, type AdminSubscriptionPlan } from '@/services/admin';

const toast = { error: (msg: string) => window.dispatchEvent(new CustomEvent('chillers-admin-toast', { detail: { kind: 'error', text: msg } })), success: (msg: string) => window.dispatchEvent(new CustomEvent('chillers-admin-toast', { detail: { kind: 'success', text: msg } })) };

interface AuditLog {
  id: string;
  adminEmail: string;
  previousState: boolean;
  newState: boolean;
  timestamp: string;
  httpStatusCode: number;
  requestIpAddress: string;
}

export default function AdminSubscriptionsPage() {
  const [plans, setPlans] = useState<AdminSubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AdminSubscriptionPlan | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const fetchPlans = async () => {
    try {
      const res = await adminGetSubscriptionPlans();
      if (res?.success) {
        setPlans(res.plans || []);
      } else toast.error(res.message || 'Impossible de charger les formules.');
    } catch (err) {
      console.warn('Erreur de récupération des abonnements:', err);
      toast.error('Impossible de charger les formules. Vérifiez la connexion au serveur.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditHistory = async () => {
    setLoadingAudit(true);
    try {
      const res = await adminGetSubscriptionAuditHistory(20);
      if (res?.success) {
        setAuditLogs(res.auditLogs || []);
      }
    } catch (err) {
      console.warn('Erreur ou non autorisé pour l\'historique d\'audit:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchPlans(); void fetchAuditHistory(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleEdit = (plan: AdminSubscriptionPlan) => {
    setEditingId(plan._id);
    setEditForm({ ...plan });
  };

  const handleSave = async () => {
    try {
      const res = await adminUpdateSubscriptionPlan(editingId!, editForm);
      if (res?.success) {
        toast.success('Abonnement mis à jour');
        setEditingId(null);
        fetchPlans();
      } else toast.error(res?.message || 'La formule n’a pas pu être enregistrée.');
    } catch {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setEditForm(current => {
        if (!current) return current;
        if (name.startsWith('features.')) {
          const featureName = name.split('.')[1] as keyof NonNullable<AdminSubscriptionPlan['features']>;
          return { ...current, features: { ...current.features, [featureName]: checked } };
        }
        return { ...current, [name]: checked };
      });
    } else {
      setEditForm(current => {
        if (!current) return current;
        const parsed = type === 'number' ? Number(value) : value;
        if (name.startsWith('features.')) {
          const featureName = name.split('.')[1] as keyof NonNullable<AdminSubscriptionPlan['features']>;
          return { ...current, features: { ...current.features, [featureName]: parsed as never } };
        }
        return { ...current, [name]: parsed };
      });
    }
  };

  if (loading) return <div className="admin-subscriptions-page"><div className="admin-subscription-loading">Chargement des formules…</div></div>;

  return (
    <div className="admin-subscriptions-page">
      <header className="admin-list-heading">
        <div><span className="admin-list-eyebrow">OFFRES & ACCÈS</span><h1>Abonnements</h1><p>Gérez vos formules et contrôlez l’accès Premium.</p></div>
      </header>

      <section className="subscription-control-section">
        <div><span className="admin-list-eyebrow">RÈGLE GÉNÉRALE</span><h2>Contrôle des abonnements</h2><p>Activez ou suspendez globalement le système d’abonnement.</p></div>
        <GlobalSubscriptionToggle onToggle={() => fetchAuditHistory()} />
      </section>

      <section className="subscription-plans-section">
        <div className="subscription-section-heading"><div><span className="admin-list-eyebrow">CONFIGURATION</span><h2>Formules disponibles</h2></div><span>{plans.length} formule{plans.length > 1 ? 's' : ''}</span></div>
        {plans.length ? <div className="subscription-plan-grid">{plans.map(plan => (
          <article className={`subscription-plan-card ${plan.isActive ? '' : 'is-disabled'}`} key={plan._id}>
            {editingId === plan._id && editForm ? <form className="subscription-edit-form" onSubmit={event => { event.preventDefault(); void handleSave(); }}>
              <label>Nom de la formule<input type="text" name="name" value={editForm.name || ''} onChange={handleChange} /></label>
              <div className="subscription-edit-pair"><label>Prix<input type="number" name="price" value={editForm.price ?? 0} onChange={handleChange} /></label><label>Durée (mois)<input type="number" name="durationMonths" value={editForm.durationMonths ?? 0} onChange={handleChange} /></label></div>
              <label>Résolution maximale<select name="features.maxResolution" value={editForm.features?.maxResolution || '720p'} onChange={handleChange}><option value="720p">720p</option><option value="1080p">1080p</option><option value="4K">4K</option></select></label>
              <label>Écrans simultanés<input type="number" name="features.maxDevices" value={editForm.features?.maxDevices ?? 1} onChange={handleChange} /></label>
              <div className="subscription-checks">
                <label><input type="checkbox" name="features.hasContinueWatching" checked={!!editForm.features?.hasContinueWatching} onChange={handleChange} /> Reprise de lecture</label>
                <label><input type="checkbox" name="features.hasWatchHistory" checked={!!editForm.features?.hasWatchHistory} onChange={handleChange} /> Historique complet</label>
                <label><input type="checkbox" name="isActive" checked={!!editForm.isActive} onChange={handleChange} /> Formule active</label>
              </div>
              <div className="subscription-edit-actions"><button type="submit" className="subscription-save"><FloppyDisk size={17} /> Enregistrer</button><button type="button" className="subscription-cancel" onClick={() => setEditingId(null)}>Annuler</button></div>
            </form> : <>
              <div className="subscription-plan-top"><span className="subscription-plan-icon"><Crown size={18} /></span><button type="button" className="subscription-edit-button" onClick={() => handleEdit(plan)} aria-label={`Modifier la formule ${plan.name}`}><PencilSimple size={17} /></button></div>
              <div className="subscription-plan-name">{plan.name}</div><div className="subscription-plan-code">{plan.code}</div>
              <div className="subscription-plan-price">{plan.price}<span> €</span><small> / {plan.durationMonths} mois</small></div>
              <div className="subscription-plan-status"><i className={plan.isActive ? 'is-active' : ''} />{plan.isActive ? 'Disponible' : 'Désactivée'}</div>
              <ul className="subscription-feature-list">
                <li><Check size={16} /> Résolution jusqu’à {plan.features?.maxResolution || '720p'}</li>
                <li><UsersThree size={16} /> {plan.features?.maxDevices || 1} écran{(plan.features?.maxDevices ?? 1) > 1 ? 's' : ''} simultané{(plan.features?.maxDevices ?? 1) > 1 ? 's' : ''}</li>
                <li>{plan.features?.hasContinueWatching ? <Check size={16} /> : <X size={16} />} Reprise de lecture</li>
                <li>{plan.features?.hasWatchHistory ? <Check size={16} /> : <X size={16} />} Historique de visionnage</li>
              </ul>
            </>}
          </article>
        ))}</div> : <div className="subscription-empty">Aucune formule disponible.</div>}
      </section>

      {(loadingAudit || auditLogs.length > 0) && <section className="subscription-audit-section">
        <div className="subscription-section-heading"><div><span className="admin-list-eyebrow">SUIVI</span><h2>Historique des changements</h2></div><span>{loadingAudit ? 'Chargement…' : `${auditLogs.length} entrées`}</span></div>
        <div className="subscription-audit-list">{auditLogs.map((log, index) => <article className="subscription-audit-item" key={log.id || index}>
          <div className="subscription-audit-admin"><strong>{log.adminEmail}</strong><span>{new Date(log.timestamp).toLocaleString('fr-FR')}</span></div>
          <div className="subscription-audit-change"><span className={log.previousState ? 'is-enabled' : 'is-disabled'}>{log.previousState ? 'Activés' : 'Désactivés'}</span><span aria-hidden="true">→</span><span className={log.newState ? 'is-enabled' : 'is-disabled'}>{log.newState ? 'Activés' : 'Désactivés'}</span></div>
          <small>{log.requestIpAddress}</small>
        </article>)}</div>
      </section>}
    </div>
  );
}
