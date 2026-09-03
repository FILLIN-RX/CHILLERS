import { httpJson } from './http';
import { UserProfile } from '../stores/useAuthStore';

interface AuthResponse {
  success: boolean;
  token?: string;
  user?: UserProfile;
  message?: string;
}

export const authService = {
  async register(email: string, password: string, username?: string, deviceId?: string, deviceName?: string): Promise<AuthResponse> {
    try {
      return await httpJson<AuthResponse>('/auth/register', {
        method: 'POST',
        body: { email, password, username, deviceId, deviceName },
      });
    } catch (error: any) {
      let message = 'Erreur lors de l\'inscription';
      if (error.body) {
        try {
          const parsed = JSON.parse(error.body);
          if (parsed.message) message = parsed.message;
        } catch { }
      }
      return { success: false, message };
    }
  },

  async login(
    email: string,
    password: string,
    deviceId?: string,
    deviceName?: string,
    forceDisconnectOthers?: boolean
  ): Promise<AuthResponse & { code?: string }> {
    try {
      return await httpJson<AuthResponse & { code?: string }>('/auth/login', {
        method: 'POST',
        body: { email, password, deviceId, deviceName, forceDisconnectOthers },
      });
    } catch (error: any) {
      let message = 'Identifiants invalides';
      let code: string | undefined;
      if (error.body) {
        try {
          const parsed = JSON.parse(error.body);
          if (parsed.message) message = parsed.message;
          if (parsed.code) code = parsed.code;
        } catch { }
      }
      return { success: false, message, code };
    }
  },

  async getProfile(token: string): Promise<AuthResponse> {
    try {
      return await httpJson<AuthResponse>('/auth/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error: any) {
      let message = 'Token invalide';
      if (error.body) {
        try {
          const parsed = JSON.parse(error.body);
          if (parsed.message) message = parsed.message;
        } catch { }
      }
      return { success: false, message };
    }
  },

  async revokeSession(token: string, deviceId: string): Promise<{ success: boolean; message?: string }> {
    try {
      return await httpJson<{ success: boolean; message?: string }>('/auth/revoke-session', {
        method: 'POST',
        body: { deviceId },
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error: any) {
      return { success: false, message: 'Erreur lors de la déconnexion de l\'appareil' };
    }
  },

  async revokeOtherSessions(token: string): Promise<{ success: boolean; message?: string }> {
    try {
      return await httpJson<{ success: boolean; message?: string }>('/auth/revoke-other-sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error: any) {
      return { success: false, message: 'Erreur lors de la déconnexion des autres appareils' };
    }
  }
};
