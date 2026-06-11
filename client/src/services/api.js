import axios from 'axios';

export const apiBase = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: apiBase,
  headers: { 'Content-Type': 'application/json' },
});

// Attach auth token to every request
let getTokenFn = null;

export function setTokenProvider(fn) {
  getTokenFn = fn;
}

api.interceptors.request.use(async (config) => {
  if (getTokenFn) {
    const token = await getTokenFn();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// --- Auth (self-issued sessions) ---
export const authApi = {
  providers: () => api.get('/auth/providers').then(r => r.data),
  login: (password) => api.post('/auth/login', { password }).then(r => r.data),
  // Exchanges the one-time grant id from an OIDC redirect for a session token.
  redeem: (grantId) => api.post('/auth/redeem', { grantId }).then(r => r.data),
  me: () => api.get('/auth/me').then(r => r.data),
  // OIDC sign-in is a full-page navigation, not an XHR.
  oidcStartUrl: (provider) => `${apiBase}/auth/login/${provider}`,
};

// --- Posts ---
export const postsApi = {
  list: (status) => api.get('/posts', { params: { status } }).then(r => r.data),
  get: (id) => api.get(`/posts/${id}`).then(r => r.data),
  create: (data) => api.post('/posts', data).then(r => r.data),
  update: (id, data) => api.put(`/posts/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/posts/${id}`).then(r => r.data),
  publish: (id) => api.post(`/posts/${id}/publish`).then(r => r.data),
};

// --- Media ---
export const mediaApi = {
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
};

// --- Social Accounts ---
export const accountsApi = {
  list: () => api.get('/accounts').then(r => r.data),
  connect: (platform) => api.get(`/accounts/connect/${platform}`).then(r => r.data),
  disconnect: (id) => api.delete(`/accounts/${id}`).then(r => r.data),
  // Completes an OAuth connection: the anonymous provider callback stages a
  // pending record and redirects to the app with ?finalize=<id>; the app then
  // calls this authenticated endpoint so the connection is bound to the
  // signed-in user (see api/src/functions/accounts.js).
  finalize: (finalizeId) => api.post('/accounts/finalize', { finalizeId }).then(r => r.data),
};

export default api;
