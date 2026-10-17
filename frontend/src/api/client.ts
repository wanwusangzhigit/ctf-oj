import axios, { type AxiosError, type AxiosInstance } from 'axios';
import { useAuthStore } from '@/stores/auth';

const STORAGE_KEY = 'ctf-oj.tokens';

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export function loadStoredTokens(): StoredTokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTokens;
    if (!parsed.accessToken || !parsed.refreshToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredTokens(tokens: StoredTokens): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export function clearStoredTokens(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

const client: AxiosInstance = axios.create({
  baseURL: '/api/v1',
  timeout: 15_000,
  withCredentials: false,
});

client.interceptors.request.use((config) => {
  const tokens = loadStoredTokens();
  if (tokens?.accessToken) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const tokens = loadStoredTokens();
  if (!tokens?.refreshToken) return null;
  refreshPromise = (async () => {
    try {
      const resp = await axios.post<ApiResponse<{ tokens: StoredTokens }>>(
        '/api/v1/auth/refresh',
        { refreshToken: tokens.refreshToken },
        { baseURL: '/api/v1', timeout: 10_000 },
      );
      const next = resp.data.data.tokens;
      saveStoredTokens(next);
      return next.accessToken;
    } catch {
      clearStoredTokens();
      useAuthStore.getState().clear();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

client.interceptors.response.use(
  (resp) => {
    const payload = resp.data as ApiResponse<unknown>;
    if (payload && typeof payload === 'object' && 'code' in payload) {
      if (payload.code !== 0) {
        return Promise.reject(new ApiClientError(payload.code, payload.message));
      }
    }
    return resp;
  },
  async (err: AxiosError<ApiResponse<unknown>>) => {
    const status = err.response?.status;
    const original = err.config as (typeof err.config) & { _retried?: boolean };

    if (status === 401 && original && !original._retried && !original.url?.includes('/auth/')) {
      const next = await refreshAccessToken();
      if (next) {
        original._retried = true;
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${next}`;
        return client(original);
      }
    }

    const payload = err.response?.data;
    if (payload && typeof payload === 'object' && 'code' in payload) {
      return Promise.reject(new ApiClientError(payload.code, payload.message));
    }
    return Promise.reject(new ApiClientError(-1, err.message || 'network error'));
  },
);

export class ApiClientError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
    this.name = 'ApiClientError';
  }
}

export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const resp = await client.get<ApiResponse<T>>(url, { params });
  return resp.data.data;
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const resp = await client.post<ApiResponse<T>>(url, body);
  return resp.data.data;
}

export async function apiPut<T>(url: string, body?: unknown): Promise<T> {
  const resp = await client.put<ApiResponse<T>>(url, body);
  return resp.data.data;
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const resp = await client.patch<ApiResponse<T>>(url, body);
  return resp.data.data;
}

export async function apiDelete<T>(url: string): Promise<T> {
  const resp = await client.delete<ApiResponse<T>>(url);
  return resp.data.data;
}

export { client };
