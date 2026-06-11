import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api',
  withCredentials: false,
  timeout: 30000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
});

// REQUEST INTERCEPTOR
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const url = config.url || '';

  const publicEndpoints = ['/login', '/register'];
  const isPublic = publicEndpoints.some((p) => url.includes(p));

  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
    delete config.headers['content-type'];
  }

  if (token && !isPublic) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// FLAG ANTI LOOP
let isRedirecting = false;

// RESPONSE INTERCEPTOR
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || '';

    const publicEndpoints = ['/login', '/register'];
    const isPublic = publicEndpoints.some((p) => url.includes(p));

    if (
      (status === 401 || status === 403) &&
      !isPublic &&
      !isRedirecting &&
      !url.includes('/attendance/stats')
    ) {
      isRedirecting = true;

      const userStr = localStorage.getItem('user');
      let role = 'unknown';

      try {
        if (userStr) {
          const userData = JSON.parse(userStr);
          role = userData.role?.toLowerCase() || 'admin';
        }
      } catch (e) {}

      if (
        url.includes('/auth') ||
        url.includes('/login')
      ) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }

      if (!window.location.pathname.includes('/login')) {
        if (role === 'siswa') {
          window.location.href = '/login/siswa';
        } else if (role === 'guru') {
          window.location.href = '/login/guru';
        } else {
          window.location.href = '/login/admin';
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;