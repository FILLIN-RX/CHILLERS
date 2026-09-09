'use client';

import React, { useEffect, useState } from 'react';
import { httpJson } from '@/app/api';
import { FloppyDisk, PencilSimple, Check, X } from '@phosphor-icons/react';
import { message } from 'antd';
import { useAuthStore } from '@/stores/useAuthStore';
import GlobalSubscriptionToggle from '@/components/admin/GlobalSubscriptionToggle';

const toast = {
  error: (msg: string) => message.error(msg),
  success: (msg: string) => message.success(msg),
};

interface AuditLog {
  id: string;
  adminEmail: string;
  previousState: boolean;
  newState: boolean;
  timestamp: string;
  httpStatusCode: number;
  requestIpAddress: string;
}

interface AuditHistoryResponse {
  success: boolean;
  auditLogs: AuditLog[];
}

export default function AdminSubscriptionsPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const { token } = useAuthStore();

  const fetchPlans = async () => {
    if (!token) return;
    try {
      const res = await httpJson<{ success: boolean; plans: any[] }>('/admin/subscriptions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res?.success) {
        setPlans(res.plans);
      }
    } catch (err) {
      toast.error('Erreur lors de la récupération des abonnements');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditHistory = async () => {
    if (!token) return;
    setLoadingAudit(true);
    try {
      const res = await httpJson<AuditHistoryResponse>('/admin/subscriptions/audit-history?limit=20', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res?.success) {
        setAuditLogs(res.auditLogs);
      }
    } catch (err) {
      console.error('Erreur lors de la récupération de l\'historique d\'audit', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    fetchPlans();
    fetchAuditHistory();
  }, [token]);

  const handleEdit = (plan: any) => {
    setEditingId(plan._id);
    setEditForm({ ...plan });
  };

  const handleSave = async () => {
    if (!token) return;
    try {
      const res = await httpJson<{ success: boolean }>(`/admin/subscriptions/${editingId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: editForm
      });
      if (res?.success) {
        toast.success('Abonnement mis à jour');
        setEditingId(null);
        fetchPlans();
      }
    } catch (err) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      if (name.startsWith('features.')) {
        const featureName = name.split('.')[1];
        setEditForm({ ...editForm, features: { ...editForm.features, [featureName]: checked } });
      } else {
        setEditForm({ ...editForm, [name]: checked });
      }
    } else {
      if (name.startsWith('features.')) {
        const featureName = name.split('.')[1];
        setEditForm({ ...editForm, features: { ...editForm.features, [featureName]: type === 'number' ? Number(value) : value } });
      } else {
        setEditForm({ ...editForm, [name]: type === 'number' ? Number(value) : value });
      }
    }
  };

  if (loading) return <div className="p-8 text-white">Chargement...</div>;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Gestion des Abonnements</h1>
        <p className="text-gray-400">Gérez les plans d'abonnement, basculez l'état global des abonnements et consultez l'historique des modifications.</p>
      </div>

      {/* Global Subscription Toggle Section */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Contrôle Global</h2>
        <GlobalSubscriptionToggle onToggle={() => fetchAuditHistory()} />
      </div>

      {/* Audit History Section */}
      {auditLogs.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">Historique des modifications</h2>
          <div className="bg-dark-paper border border-dark-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-border bg-dark-bg">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Admin</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">État Précédent</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Nouvel État</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Date/Heure</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log, idx) => (
                    <tr key={log.id || idx} className="border-b border-dark-border hover:bg-dark-bg/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-300">{log.adminEmail}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                          log.previousState
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {log.previousState ? 'ACTIVÉ' : 'DÉSACTIVÉ'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                          log.newState
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {log.newState ? 'ACTIVÉ' : 'DÉSACTIVÉ'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        {new Date(log.timestamp).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{log.requestIpAddress}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Plans Section */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Plans d'abonnement</h2>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {plans.map(plan => (
            <div key={plan._id} className="bg-dark-paper border border-dark-border rounded-xl p-6 relative">
              {editingId === plan._id ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Nom du plan</label>
                    <input type="text" name="name" value={editForm.name} onChange={handleChange} className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Prix (€)</label>
                      <input type="number" name="price" value={editForm.price} onChange={handleChange} className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Durée (Mois)</label>
                      <input type="number" name="durationMonths" value={editForm.durationMonths} onChange={handleChange} className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Résolution Max</label>
                    <select name="features.maxResolution" value={editForm.features.maxResolution} onChange={handleChange} className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white">
                      <option value="720p">720p</option>
                      <option value="1080p">1080p</option>
                      <option value="4K">4K</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Écrans simultanés</label>
                    <input type="number" name="features.maxDevices" value={editForm.features.maxDevices} onChange={handleChange} className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-white" />
                  </div>
                  <div className="space-y-2 pt-2">
                    <label className="flex items-center gap-2 text-sm text-white">
                      <input type="checkbox" name="features.hasContinueWatching" checked={editForm.features.hasContinueWatching} onChange={handleChange} />
                      Reprise de lecture (Continue Watching)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-white">
                      <input type="checkbox" name="features.hasWatchHistory" checked={editForm.features.hasWatchHistory} onChange={handleChange} />
                      Historique de visionnage
                    </label>
                    <label className="flex items-center gap-2 text-sm text-white">
                      <input type="checkbox" name="isActive" checked={editForm.isActive} onChange={handleChange} />
                      Plan actif
                    </label>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button onClick={handleSave} className="flex-1 bg-primary hover:bg-primary/90 text-white py-2 rounded font-medium flex items-center justify-center gap-2">
                      <FloppyDisk className="w-4 h-4" /> Enregistrer
                    </button>
                    <button onClick={() => setEditingId(null)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded font-medium">
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <button onClick={() => handleEdit(plan)} className="absolute top-4 right-4 text-gray-400 hover:text-white bg-dark-bg p-2 rounded-full">
                    <PencilSimple className="w-4 h-4" />
                  </button>
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name} <span className="text-sm font-normal text-gray-400 ml-2">({plan.code})</span></h3>
                  <div className="text-3xl font-extrabold text-primary mb-6">{plan.price}€ <span className="text-lg text-gray-400 font-normal">/ {plan.durationMonths} mois</span></div>
                  
                  <ul className="space-y-3 text-gray-300">
                    <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /> Résolution: {plan.features.maxResolution}</li>
                    <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /> Appareils: {plan.features.maxDevices}</li>
                    <li className="flex items-center gap-3">
                      {plan.features.hasContinueWatching ? <Check className="w-5 h-5 text-primary" /> : <X className="w-5 h-5 text-red-500" />} 
                      Reprise de lecture
                    </li>
                    <li className="flex items-center gap-3">
                      {plan.features.hasWatchHistory ? <Check className="w-5 h-5 text-primary" /> : <X className="w-5 h-5 text-red-500" />} 
                      Historique complet
                    </li>
                  </ul>
                  {!plan.isActive && <div className="mt-4 text-red-500 text-sm font-bold">Désactivé</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
