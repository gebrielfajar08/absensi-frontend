import axios from 'axios';

// 🔥 AUTO SWITCH: LOCAL vs PRODUCTION
const BASE_URL =
  import.meta.env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://127.0.0.1:8000/api';

  console.log('🔥 API BASE URL:', BASE_URL);

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// 🔐 Attach token otomatis kalau ada
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ❗ Optional: global error handler (biar gampang debug)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ERR_NETWORK') {
      console.error('❌ Network error: backend tidak bisa diakses');
    }

    if (error.response?.status === 401) {
      console.warn('⚠️ Unauthorized - token mungkin expired');
    }

    return Promise.reject(error);
  }
);

export default api;