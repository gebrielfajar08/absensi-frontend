import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api',
  withCredentials: false,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
});

// INTERCEPTOR REQUEST
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  const url = config.url || '';

  // ❗ HANYA endpoint auth yang benar-benar public
  const publicEndpoints = ['/login', '/register'];

  const isPublic = publicEndpoints.some((p) => url.includes(p));

  if (token && !isPublic) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// FLAG ANTI LOOP
let isRedirecting = false;

// INTERCEPTOR RESPONSE
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || '';

    const publicEndpoints = ['/login', '/register'];
    const isPublic = publicEndpoints.some((p) => url.includes(p));

    if ((status === 401 || status === 403) && !isPublic && !isRedirecting) {
      isRedirecting = true;

      const userStr = localStorage.getItem('user');
      let role = 'admin';

      try {
        if (userStr) {
          const userData = JSON.parse(userStr);
          role = userData.role?.toLowerCase() || 'admin';
        }
      } catch {}

      localStorage.removeItem('token');
      localStorage.removeItem('user');

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