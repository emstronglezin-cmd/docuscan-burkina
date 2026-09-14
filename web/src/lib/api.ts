/**
 * Client API pour le backend DocuScan Burkina.
 * L'URL du backend vient d'une variable d'environnement Vite (jamais codée en dur),
 * pour permettre un déploiement Vercel pointant vers le backend Render.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

function getAccessToken() {
  return localStorage.getItem('docuscan_access_token');
}
function getRefreshToken() {
  return localStorage.getItem('docuscan_refresh_token');
}
export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('docuscan_access_token', accessToken);
  localStorage.setItem('docuscan_refresh_token', refreshToken);
}
export function clearTokens() {
  localStorage.removeItem('docuscan_access_token');
  localStorage.removeItem('docuscan_refresh_token');
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401 && retry) {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setTokens(data.accessToken, data.refreshToken);
        return request<T>(path, options, false);
      }
      clearTokens();
    }
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(json.message || 'Erreur serveur', json.code, res.status, json);
  }
  return json as T;
}

export class ApiError extends Error {
  code?: string;
  status: number;
  body: unknown;
  constructor(message: string, code: string | undefined, status: number, body: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.body = body;
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
