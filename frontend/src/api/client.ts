import axios, { type AxiosError, type AxiosInstance } from 'axios';
import { useAuthStore } from '@/stores/auth';

const SESSION_COOKIE = 'ctf_oj_session';

export function hasSessionCookie(): boolean {
  return document.cookie
    .split(';')
    .some((part) => part.trim().startsWith(`${SESSION_COOKIE}=`));
}

export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

const client: AxiosInstance = axios.create({
  baseURL: '/api/v1',
  timeout: 15_000,
  withCredentials: true,
});

let refreshPromise: Promise<boolean> | null = null;

export async function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const resp = await axios.post<ApiResponse<unknown>>(
        '/auth/refresh',
        undefined,
        { baseURL: '/api/v1', timeout: 10_000, withCredentials: true },
      );
      if (resp.data.code !== 0) throw new Error(resp.data.message);
      return true;
    } catch {
      useAuthStore.getState().clear();
      return false;
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
      const refreshed = await refreshSession();
      if (refreshed) {
        original._retried = true;
        return client(original);
      }
    }

    const payload = err.response?.data;
    if (payload && typeof payload === 'object' && 'code' in payload) {
      if (payload.code === 40310) {
        useAuthStore.getState().clear();
      }
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

export async function apiPost<T>(
  url: string,
  body?: unknown,
  params?: Record<string, unknown>,
): Promise<T> {
  const resp = await client.post<ApiResponse<T>>(url, body, { params });
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
