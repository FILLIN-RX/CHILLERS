import { httpJson } from './http';

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
  }
};
