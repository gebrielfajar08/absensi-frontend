import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api',
  withCredentials: false,
  timeout: 60000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
});

// REQUEST INTERCEPTOR
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const url = config.url || '';

  // ✅ DAFTAR ENDPOINT PUBLIK (tidak perlu token)
  const publicEndpoints = [
    '/login', 
    '/register', 
    '/auth/login',
    '/auth/register',
    '/forgot-password',
    '/siswa/attendance/scan', 
    '/attendance/teacher/manual', 
    '/attendance/student/manual',
    '/attendance/izin',
    '/public/settings',
    '/public/stats',
    '/public/events',
    '/public/scan',
    '/public/attendance',
    '/health',
    '/events'
  ];
  
  const isPublic = publicEndpoints.some((p) => url.includes(p));

  // Handle FormData (upload file)
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
    delete config.headers['content-type'];
  }

  // Tambahkan token jika ada dan bukan endpoint publik
  if (token && !isPublic) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Logging untuk debugging (opsional, bisa dihapus)
  if (import.meta.env.DEV) {
    console.log(`📤 ${config.method?.toUpperCase()} ${url}`, {
      hasToken: !!token,
      isPublic,
      timeout: config.timeout
    });
  }

  return config;
}, (error) => {
  console.error('❌ Request Error:', error);
  return Promise.reject(error);
});

// FLAG ANTI LOOP
let isRedirecting = false;

// RESPONSE INTERCEPTOR
api.interceptors.response.use(
  (response) => {
    // Logging untuk debugging (opsional)
    if (import.meta.env.DEV) {
      const url = response.config?.url || '';
      console.log(`✅ Response ${response.status} from ${url}`);
    }
    return response;
  },
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || '';

    // ✅ DAFTAR ENDPOINT PUBLIK (sama seperti di request interceptor)
    const publicEndpoints = [
      '/login',
      '/register',
      '/auth/login',
      '/auth/register',
      '/public/settings',
      '/public/stats',
      '/public/events',
      '/public/attendance',
      '/health'
    ];

    const isPublic = publicEndpoints.some((p) => url.includes(p));

    // Logging error untuk debugging
    if (import.meta.env.DEV) {
      console.error(`❌ API Error ${status || 'Network'} on ${url}:`, {
        message: error?.message,
        data: error?.response?.data,
        isPublic
      });
    }

    // Handle 401/403 - Redirect ke login
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
    }

    // Handle Network Error (backend tidak jalan)
    if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
      console.error('🌐 Network Error: Backend tidak terjangkau atau CORS issue');
      
      // Tampilkan notifikasi jika ini pertama kali
      if (!window.__networkErrorShown) {
        window.__networkErrorShown = true;
        console.warn('⚠️ Backend tidak terjangkau. Pastikan server Laravel berjalan di http://127.0.0.1:8000');
        
        // Reset flag setelah 10 detik
        setTimeout(() => {
          window.__networkErrorShown = false;
        }, 10000);
      }
    }

    // Handle Timeout
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      console.error(`⏱️ Timeout Error: Request ke ${url} melebihi batas waktu`);
    }

    // Handle 500 Server Error
    if (status === 500) {
      console.error('💥 Server Error 500:', error?.response?.data?.message || 'Internal Server Error');
    }

    return Promise.reject(error);
  }
);

export default api;