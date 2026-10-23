'use client';

import { useEffect, useState } from 'react';
import { userService, type PushPreferences } from '@/services/user';
import { useAuthStore } from '@/stores/useAuthStore';

const categories: { key: keyof PushPreferences; label: string; description: string }[] = [
  { key: 'announcements', label: 'Annonces générales', description: 'Actualités et campagnes CHILLERS' },
  { key: 'favorites', label: 'Favoris', description: 'Disponibilité, nouveaux épisodes et saisons' },
  { key: 'matches', label: 'Matchs', description: 'Rappels 15 minutes avant le coup d’envoi' },
  { key: 'subscriptions', label: 'Abonnement', description: 'Activation, changements et échéances' },
  { key: 'reminders', label: 'Reprise', description: 'Un rappel quotidien au maximum' },
];
const defaults: PushPreferences = { announcements: true, favorites: true, matches: true, subscriptions: true, reminders: true };
const decodeKey = (key: string) => {
  const padded = key + '='.repeat((4 - key.length % 4) % 4);
  return Uint8Array.from(atob(padded.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
};

export default function PushNotificationSettings() {
  const token = useAuthStore(s => s.token);
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState('');
  const [preferences, setPreferences] = useState<PushPreferences>(defaults);
  const [teams, setTeams] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    const init = async () => {
      const ok = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
      if (!active) return;
      setSupported(ok);
      if (!ok) { setPermission('unsupported'); return; }
      setPermission(Notification.permission);
      try {
        const cfg = await userService.getPushConfig();
        if (active) setPublicKey(cfg.data?.publicKey || null);
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          const currentEndpoint = subscription.endpoint;
          await userService.subscribePush(subscription.toJSON(), token || undefined);
          const prefs = await userService.getPushPreferences(token || undefined, currentEndpoint);
          if (active) {
            setEndpoint(currentEndpoint);
            setEnabled(true);
            if (prefs.data?.[0]) {
              setPreferences({ ...defaults, ...prefs.data[0].preferences });
              setTeams((prefs.data[0].followedTeams || []).join(', '));
            }
          }
        }
      } catch { /* The settings remain usable after a temporary API failure. */ }
    };
    void init();
    return () => { active = false; };
  }, [token]);

  const activate = async () => {
    setBusy(true); setMessage('');
    try {
      if (!publicKey) throw new Error('Les notifications ne sont pas encore configurées sur le serveur.');
      if (Notification.permission === 'denied') {
        setPermission('denied');
        setMessage('Le navigateur a bloqué cette permission. Clique sur l’icône à gauche de l’adresse du site, ouvre les paramètres du site, puis règle « Notifications » sur « Autoriser ». Recharge ensuite CHILLERS.');
        return;
      }
      const granted = await Notification.requestPermission();
      setPermission(granted);
      if (granted !== 'granted') throw new Error('Autorisez les notifications dans les réglages de votre navigateur.');
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(publicKey) });
      await userService.subscribePush(subscription.toJSON(), token || undefined);
      const currentEndpoint = subscription.endpoint;
      const prefs = await userService.getPushPreferences(token || undefined, currentEndpoint);
      setEndpoint(currentEndpoint); setEnabled(true);
      if (prefs.data?.[0]) {
        setPreferences({ ...defaults, ...prefs.data[0].preferences });
        setTeams((prefs.data[0].followedTeams || []).join(', '));
      }
      setMessage('Notifications activées sur cet appareil.');
    } catch (error: any) { setMessage(error?.message || 'Impossible d’activer les notifications.'); }
    finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true); setMessage('');
    try {
      await userService.updatePushPreferences({ endpoint, preferences, followedTeams: teams.split(',').map(x => x.trim()).filter(Boolean) }, token || undefined);
      setMessage('Préférences enregistrées.');
    } catch (error: any) { setMessage(error?.message || 'Enregistrement impossible.'); }
    finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await userService.unsubscribePush(sub.endpoint); await sub.unsubscribe(); }
      setEnabled(false); setEndpoint(''); setMessage('Notifications désactivées sur cet appareil.');
    } catch { setMessage('Impossible de désactiver les notifications.'); }
    finally { setBusy(false); }
  };

  const test = async () => {
    setBusy(true);
    try { await userService.sendPushTest(endpoint, token || undefined); setMessage('Notification de test envoyée.'); }
    catch (error: any) { setMessage(error?.message || 'Échec de la notification de test.'); }
    finally { setBusy(false); }
  };

  return <section className="rounded-3xl border border-white/10 bg-zinc-900/60 p-6 sm:p-8 text-white">
    <h3 className="text-lg font-bold">Notifications web</h3>
    <p className="mt-2 text-sm text-zinc-400">Le navigateur propose automatiquement l’autorisation après votre première interaction avec CHILLERS. Vous pouvez aussi la demander ici. Les alertes personnalisées demandent un compte connecté.</p>
    {!supported ? <p className="mt-4 rounded-xl bg-white/5 p-3 text-sm text-zinc-300">Ce navigateur ne prend pas en charge les notifications push.</p> : !enabled ? <>
      {permission === 'denied' && <p className="mt-3 text-sm text-amber-300">L’autorisation est bloquée dans le navigateur. Réactivez-la dans les réglages du site.</p>}
      <button data-push-permission-manual disabled={busy || !publicKey} onClick={activate} className="mt-5 rounded-full bg-brand-primary px-5 py-3 font-bold disabled:opacity-50">{busy ? 'Activation…' : permission === 'denied' ? 'Réautoriser dans le navigateur' : 'Activer les notifications'}</button>
      {!publicKey && <p className="mt-2 text-xs text-zinc-500">La configuration serveur des notifications est en attente.</p>}
      <p className="mt-3 text-xs text-zinc-500">Sur iPhone/iPad, ajoutez d’abord CHILLERS à l’écran d’accueil (iOS/iPadOS 16.4 ou ultérieur).</p>
    </> : <>
      <div className="mt-5 space-y-3">{categories.map(item => <label key={item.key} className="flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-white/5 p-3">
        <span><span className="block text-sm font-semibold">{item.label}</span><span className="block text-xs text-zinc-400">{item.description}</span></span>
        <input type="checkbox" checked={preferences[item.key]} onChange={e => setPreferences(p => ({ ...p, [item.key]: e.target.checked }))} className="h-5 w-5 accent-pink-500" />
      </label>)}</div>
      <label className="mt-5 block text-sm font-semibold">Équipes à suivre <span className="font-normal text-zinc-400">(séparées par des virgules)</span>
        <input value={teams} onChange={e => setTeams(e.target.value)} placeholder="Ex. PSG, Manchester City" className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-zinc-600" />
      </label>
      <div className="mt-5 flex flex-wrap gap-3">
        <button disabled={busy} onClick={save} className="rounded-full bg-brand-primary px-5 py-2.5 font-bold disabled:opacity-50">Enregistrer</button>
        {token && <button disabled={busy} onClick={test} className="rounded-full border border-white/15 px-5 py-2.5 font-semibold disabled:opacity-50">Tester</button>}
        <button disabled={busy} onClick={disable} className="rounded-full border border-white/15 px-5 py-2.5 text-zinc-300 disabled:opacity-50">Désactiver</button>
      </div>
    </>}
    {message && <p role="status" className="mt-4 text-sm text-zinc-300">{message}</p>}
  </section>;
}
