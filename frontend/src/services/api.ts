import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON
} from '@simplewebauthn/browser';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';
const TOKEN_KEY = 'access_token';
const USER_KEY = 'user';

export type UserInfo = {
  id: number;
  username: string;
  role: 'user' | 'admin';
  deviceRestricted: boolean;
};

export type ApiError = {
  error: string;
  message: string;
};

export type LoginResponse =
  | {
      requiresWebAuthn: false;
      requiresDeviceRegistration?: false;
      accessToken: string;
      user: UserInfo;
    }
  | {
      requiresWebAuthn: true;
      requiresDeviceRegistration?: false;
      pendingToken: string;
      user: UserInfo;
    }
  | {
      requiresWebAuthn: false;
      requiresDeviceRegistration: true;
      pendingToken: string;
      user: UserInfo;
    };

async function buildHeaders(auth = false): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (auth) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
}

async function request<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const { auth, ...fetchOptions } = options;
  const headers = await buildHeaders(auth);

  const response = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers: {
      ...headers,
      ...(fetchOptions.headers ?? {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw { status: response.status, ...(data as ApiError) };
  }

  return data as T;
}

export function saveSession(accessToken: string, user: UserInfo) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): UserInfo | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserInfo;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem(TOKEN_KEY);
}

export const api = {
  login: (username: string, password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),

  webauthnOptions: (pendingToken: string) =>
    request<{ options: PublicKeyCredentialRequestOptionsJSON; challengeId: string; pendingToken: string }>(
      '/auth/webauthn/options',
      {
        method: 'POST',
        body: JSON.stringify({ pendingToken })
      }
    ),

  webauthnVerify: (pendingToken: string, challengeId: string, credential: unknown) =>
    request<{ accessToken: string; user: UserInfo }>('/auth/webauthn/verify', {
      method: 'POST',
      body: JSON.stringify({ pendingToken, challengeId, credential })
    }),

  loginRegisterOptions: (pendingToken: string, deviceName?: string) =>
    request<{ options: PublicKeyCredentialCreationOptionsJSON; challengeId: string; pendingToken: string }>(
      '/auth/webauthn/register/options',
      {
        method: 'POST',
        body: JSON.stringify({ pendingToken, deviceName })
      }
    ),

  loginRegisterVerify: (
    pendingToken: string,
    challengeId: string,
    credential: unknown,
    deviceName?: string
  ) =>
    request<{ status: string; message: string }>('/auth/webauthn/register/verify', {
      method: 'POST',
      body: JSON.stringify({ pendingToken, challengeId, credential, deviceName })
    }),

  me: () => request<UserInfo>('/auth/me', { auth: true }),

  dashboard: () => request<{ message: string }>('/dashboard', { auth: true }),

  registerOptions: (userId: number, deviceName: string) =>
    request<{ options: PublicKeyCredentialCreationOptionsJSON; challengeId: string; userId: number }>(
      '/webauthn/register/options',
      {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ userId, deviceName })
      }
    ),

  registerVerify: (
    userId: number,
    challengeId: string,
    credential: unknown,
    deviceName: string
  ) =>
    request<{ id: number; credentialId: string; deviceName: string; deviceType: string | null }>(
      '/webauthn/register/verify',
      {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ userId, challengeId, credential, deviceName })
      }
    ),

  getPendingDevices: () =>
    request<
      Array<{
        id: number;
        userId: number;
        username: string;
        deviceName: string;
        deviceType: string | null;
        approvalStatus: string;
        createdAt: string;
      }>
    >('/admin/devices/pending', { auth: true }),

  approveDevice: (deviceId: number) =>
    request<{ id: number; approvalStatus: string; message: string }>(`/admin/devices/${deviceId}/approve`, {
      method: 'POST',
      auth: true
    }),

  rejectDevice: (deviceId: number) =>
    request<{ success: boolean; message: string }>(`/admin/devices/${deviceId}/reject`, {
      method: 'POST',
      auth: true
    }),

  getUsers: () => request<Array<UserInfo & { created_at?: string }>>('/admin/users', { auth: true }),

  createUser: (payload: {
    username: string;
    password: string;
    deviceRestricted: boolean;
    role: 'user' | 'admin';
  }) =>
    request<UserInfo>('/admin/users', {
      method: 'POST',
      auth: true,
      body: JSON.stringify(payload)
    }),

  toggleDeviceRestricted: (userId: number, deviceRestricted: boolean) =>
    request<UserInfo>(`/admin/users/${userId}/device-restricted`, {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify({ deviceRestricted })
    }),

  getUserDevices: (userId: number) =>
    request<
      Array<{
        id: number;
        credentialId: string;
        deviceName: string;
        deviceType: string | null;
        approvalStatus: string;
        createdAt: string;
      }>
    >(`/admin/users/${userId}/devices`, { auth: true }),

  removeDevice: (deviceId: number) =>
    request<{ success: boolean }>(`/admin/devices/${deviceId}`, {
      method: 'DELETE',
      auth: true
    })
};
