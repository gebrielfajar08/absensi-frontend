import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api',
  withCredentials: false,
  timeout: 10000, // ✅ TURUNKAN dari 60000 ke 10000 (10 detik) - lebih cepat
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
});

// ✅ DAFTAR ENDPOINT PUBLIK (tidak perlu token)
const PUBLIC_ENDPOINTS = [
  '/login',
  '/register',
  '/auth/login',
  '/auth/register',
  '/forgot-password',
  '/public/settings',
  '/public/stats',
  '/public/events',
  '/public/scan',
  '/public/health',
  '/public/attendance',       // ← ✅ INI YANG HILANG! Untuk QR scan siswa & guru
  '/public/attendance/student', // ← ✅ Absensi siswa manual/QR
  '/public/attendance/teacher', // ← ✅ Absensi guru manual/QR
  '/public/attendance/izin',    // ← ✅ Pengajuan izin
  '/siswa/attendance/scan',
  '/attendance/teacher/manual',
  '/attendance/student/manual',
  '/attendance/izin',
  '/health',
  '/events'
];

const isPublicEndpoint = (url) => {
  if (!url) return false;
  return PUBLIC_ENDPOINTS.some((p) => url.includes(p));
};

// REQUEST INTERCEPTOR
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const url = config.url || '';
  const isPublic = isPublicEndpoint(url);

  // Handle FormData (upload file) - hapus Content-Type agar browser set otomatis
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
    delete config.headers['content-type'];
  }

  // Tambahkan token jika ada dan bukan endpoint publik
  if (token && !isPublic) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // ✅ Logging HANYA saat development (tidak spam production)
  if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_AXIOS === 'true') {
    console.log(`📤 ${config.method?.toUpperCase()} ${url}`, {
      hasToken: !!token,
      isPublic,
      timeout: config.timeout
    });
  }

  return config;
}, (error) => {
  if (import.meta.env.DEV) {
    console.error('❌ Request Error:', error);
  }
  return Promise.reject(error);
});

// FLAG ANTI LOOP - mencegah redirect berkali-kali
let isRedirecting = false;

// RESPONSE INTERCEPTOR
api.interceptors.response.use(
  (response) => {
    // ✅ Logging response HANYA saat debug aktif
    if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_AXIOS === 'true') {
      const url = response.config?.url || '';
      console.log(`✅ Response ${response.status} from ${url}`);
    }
    return response;
  },
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || '';
    const isPublic = isPublicEndpoint(url);

    // ✅ Logging error hanya saat development
    if (import.meta.env.DEV) {
      console.error(`❌ API Error ${status || 'Network'} on ${url}:`, {
        message: error?.message,
        data: error?.response?.data,
        isPublic
      });
    }

    // Handle 401/403 - Redirect ke login (hanya untuk endpoint yang butuh auth)
    if (
      (status === 401 || status === 403) &&
      !isPublic &&
      !isRedirecting &&
      window.location.pathname !== '/' &&
      !url.includes('/attendance/stats')
    ) {
      isRedirecting = true;

      const userStr = localStorage.getItem('user');
      let role = 'admin';

      try {
        if (userStr) {
          const userData = JSON.parse(userStr);
          role = userData.role?.toLowerCase() || 'admin';
        }
      } catch (e) {
        console.error('Error parsing user data:', e);
      }

      // Clear token jika error dari endpoint auth
      if (url.includes('/auth') || url.includes('/login')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }

      // Redirect ke halaman login yang sesuai role
      if (!window.location.pathname.includes('/login')) {
        if (role === 'siswa') {
          window.location.href = '/login/siswa';
        } else if (role === 'guru') {
          window.location.href = '/login/guru';
        } else {
          window.location.href = '/login/admin';
        }
      }

      // Reset flag setelah 3 detik agar bisa redirect lagi jika perlu
      setTimeout(() => {
        isRedirecting = false;
      }, 3000);
    }

    // Handle Network Error (backend tidak jalan) - anti spam
    if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
      if (!window.__networkErrorShown) {
        window.__networkErrorShown = true;
        if (import.meta.env.DEV) {
          console.warn('⚠️ Backend tidak terjangkau. Pastikan server Laravel berjalan di http://127.0.0.1:8000');
        }
        setTimeout(() => {
          window.__networkErrorShown = false;
        }, 10000);
      }
    }

    // Handle Timeout - anti spam
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      if (import.meta.env.DEV) {
        console.warn(`⏱️ Timeout: ${url}`);
      }
    }

    // Handle 500 Server Error - anti spam
    if (status === 500 && import.meta.env.DEV) {
      console.warn('💥 Server Error 500:', error?.response?.data?.message || 'Internal Server Error');
    }

    return Promise.reject(error);
  }
);

export default api;