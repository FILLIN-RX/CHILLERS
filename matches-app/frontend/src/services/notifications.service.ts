export interface MatchNotificationInput {
  title: string;
  body: string;
  tag: string;
  matchId?: string;
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch (err) {
    console.warn('[Notifications] Demande de permission impossible:', err);
    return false;
  }
}

export function showMatchNotification(input: MatchNotificationInput): boolean {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false;
  try {
    const notification = new Notification(input.title, {
      body: input.body,
      tag: input.tag,
      icon: `${window.location.origin}/favicon.svg`,
      badge: `${window.location.origin}/favicon.svg`,
    });
    if (input.matchId) {
      const matchId = input.matchId;
      notification.onclick = () => {
        window.focus();
        window.location.assign(`/match/${matchId}`);
        notification.close();
      };
    }
    return true;
  } catch (err) {
    console.warn('[Notifications] Affichage impossible:', err);
    return false;
  }
}
