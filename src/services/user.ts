import { httpJson } from './http';

export type PushCategory = 'announcements' | 'favorites' | 'matches' | 'subscriptions' | 'reminders';
export interface PushPreferences { announcements: boolean; favorites: boolean; matches: boolean; subscriptions: boolean; reminders: boolean; }

// Chemin relatif : dans le navigateur il part sur l'origine du site, que la
// rewrite de next.config proxifie vers le backend. Une URL absolue du domaine
// Railway serait rejetée par le connect-src de la CSP.
async function notificationRequest<T>(path: string, token?: string, options: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown } = {}) {
  return httpJson<T>(`/api/notifications${path}`, {
    method: options.method || 'GET', body: options.body,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

interface FavoriteData {
  mediaType: 'movie' | 'series' | 'anime';
  tmdbId: string;
  title: string;
  posterPath?: string;
}

interface ProgressData {
  tmdbId: string;
  mediaType: 'movie' | 'series' | 'anime';
  season?: number;
  episode?: number;
  progress: number;
  duration: number;
  title: string;
  posterPath?: string;
  backdropPath?: string;
}

interface HistoryData {
  tmdbId: string;
  mediaType: 'movie' | 'series' | 'anime';
  season?: number;
  episode?: number;
  title: string;
  posterPath?: string;
}

export const userService = {
  getPushConfig() {
    return notificationRequest<{ success: boolean; data: { enabled: boolean; publicKey: string | null } }>('/config');
  },
  getPushPreferences(token?: string, endpoint?: string) {
    const query = endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : '';
    return notificationRequest<{ success: boolean; data: Array<{ preferences: PushPreferences; followedTeams: string[] }> }>(`/preferences${query}`, token);
  },
  subscribePush(subscription: PushSubscriptionJSON, token?: string) {
    return notificationRequest<{ success: boolean; data: { linkedToAccount: boolean } }>('/subscriptions', token, { method: 'POST', body: { subscription } });
  },
  unsubscribePush(endpoint: string) {
    return notificationRequest<{ success: boolean }>('/subscriptions', undefined, { method: 'DELETE', body: { endpoint } });
  },
  updatePushPreferences(payload: { endpoint?: string; preferences?: Partial<PushPreferences>; followedTeams?: string[] }, token?: string) {
    return notificationRequest<{ success: boolean; data: { preferences: PushPreferences; followedTeams: string[] } | null }>('/preferences', token, { method: 'PUT', body: payload });
  },
  sendPushTest(endpoint?: string, token?: string) {
    return notificationRequest<{ success: boolean; data: { delivered: number } }>('/test', token, { method: 'POST', body: { endpoint } });
  },
  async getProfile(token: string) {
    return await httpJson<{ success: boolean; user: any }>('/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async toggleFavorite(token: string, data: FavoriteData) {
    return await httpJson<{ success: boolean; favorites: any[] }>('/user/favorites', {
      method: 'POST',
      body: data,
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async updateProgress(token: string, data: ProgressData) {
    return await httpJson<{ success: boolean; continueWatching: any[]; watchHistory?: any[] }>('/user/progress', {
      method: 'PUT',
      body: data,
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async markAsWatched(token: string, data: HistoryData) {
    return await httpJson<{ success: boolean; watchHistory: any[] }>('/user/history', {
      method: 'POST',
      body: data,
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async updatePreferences(token: string, preferences: { defaultQuality?: string; defaultSubtitle?: string }) {
    return await httpJson<{ success: boolean; preferences: any }>('/user/preferences', {
      method: 'PUT',
      body: preferences,
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async toggleWatchLater(token: string, data: { mediaType: string; tmdbId: string; title: string; posterPath?: string }) {
    return await httpJson<{ success: boolean; watchLater: any[] }>('/user/watch-later', {
      method: 'POST',
      body: data,
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async createPlaylist(token: string, data: { title: string; description?: string; isPublic?: boolean }) {
    return await httpJson<{ success: boolean; playlist: any; playlists: any[] }>('/user/playlists', {
      method: 'POST',
      body: data,
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async addMediaToPlaylist(token: string, playlistId: string, data: { mediaType: string; tmdbId: string; title: string; posterPath?: string; backdropPath?: string }) {
    return await httpJson<{ success: boolean; playlist: any; playlists: any[] }>(`/user/playlists/${playlistId}/items`, {
      method: 'POST',
      body: data,
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async removeMediaFromPlaylist(token: string, playlistId: string, tmdbId: string) {
    return await httpJson<{ success: boolean; playlist: any; playlists: any[] }>(`/user/playlists/${playlistId}/items/${tmdbId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  async deletePlaylist(token: string, playlistId: string) {
    return await httpJson<{ success: boolean; playlists: any[] }>(`/user/playlists/${playlistId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
  }
};
