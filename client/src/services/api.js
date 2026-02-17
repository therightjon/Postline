import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
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
  callback: (platform, params) => api.post(`/accounts/callback/${platform}`, params).then(r => r.data),
};

export default api;
