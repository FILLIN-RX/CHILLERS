import PushNotificationSettings from '@/components/pwa/PushNotificationSettings';

export default function NotificationsPage() {
  return <main className="mx-auto min-h-[70vh] w-full max-w-4xl px-4 py-12 sm:px-8">
    <h1 className="mb-3 text-3xl font-black text-white">Notifications CHILLERS</h1>
    <p className="mb-8 max-w-2xl text-sm leading-relaxed text-zinc-400">Activez les alertes sur cet appareil et choisissez ce que vous souhaitez recevoir. Les annonces générales sont disponibles sans compte.</p>
    <PushNotificationSettings />
  </main>;
}
