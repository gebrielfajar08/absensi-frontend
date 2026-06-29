import axios from 'axios';

// ✅ KONFIGURASI TIMEOUT BERDASARKAN TIPE REQUEST
const TIMEOUT_CONFIG = {
  DEFAULT: 30000,        // 30 detik untuk request biasa
  UPLOAD: 120000,        // 2 menit untuk upload file
  EXPORT: 180000,        // 3 menit untuk export data
  REPORT: 120000,        // 2 menit untuk generate report
  BULK: 180000,          // 3 menit untuk bulk operations
};

// ✅ CUSTOM ERROR CLASS
class ApiError extends Error {
  constructor(message, status, data, url) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.url = url;
  }
}

// ✅ REQUEST QUEUE MANAGER
class RequestQueue {
  constructor() {
    this.pendingRequests = new Map();
  }

  generateKey(config) {
    const method = config.method?.toUpperCase() || 'GET';
    const url = config.url || '';
    const params = JSON.stringify(config.params || {});
    const data = JSON.stringify(config.data || {});
    return `${method}:${url}:${params}:${data}`;
  }

  addRequest(config) {
    const key = this.generateKey(config);
    
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }

    const promise = new Promise((resolve, reject) => {
      config._resolve = resolve;
      config._reject = reject;
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  removeRequest(config) {
    const key = this.generateKey(config);
    this.pendingRequests.delete(key);
  }

  resolveRequest(config, response) {
    const key = this.generateKey(config);
    const pending = this.pendingRequests.get(key);
    if (pending && config._resolve) {
      config._resolve(response);
    }
    this.removeRequest(config);
  }

  rejectRequest(config, error) {
    const key = this.generateKey(config);
    const pending = this.pendingRequests.get(key);
    if (pending && config._reject) {
      config._reject(error);
    }
    this.removeRequest(config);
  }
}

const requestQueue = new RequestQueue();

// ✅ RETRY CONFIGURATION
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000,
  retryStatusCodes: [408, 429, 500, 502, 503, 504],
  shouldRetry: (error) => {
    const status = error?.response?.status;
    const isNetworkError = error.code === 'ERR_NETWORK' || error.message?.includes('Network Error');
    const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
    
    return isNetworkError || isTimeout || (status && RETRY_CONFIG.retryStatusCodes.includes(status));
  }
};

// ✅ CREATE AXIOS INSTANCE
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api',
  withCredentials: false,
  timeout: TIMEOUT_CONFIG.DEFAULT,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
});

// ✅ DAFTAR ENDPOINT PUBLIK
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
  '/public/attendance',
  '/public/attendance/student',
  '/public/attendance/teacher',
  '/public/attendance/izin',
  '/siswa/attendance/scan',
  '/attendance/teacher/manual',
  '/attendance/student/manual',
  '/attendance/izin',
  '/health',
  '/events'
];

// ✅ HELPER FUNCTIONS
const isPublicEndpoint = (url) => {
  if (!url) return false;
  return PUBLIC_ENDPOINTS.some((p) => url.includes(p));
};

const getTimeoutForRequest = (config) => {
  const url = config.url || '';
  
  if (url.includes('/upload') || url.includes('/store') && config.data instanceof FormData) {
    return TIMEOUT_CONFIG.UPLOAD;
  }
  if (url.includes('/export') || url.includes('/download')) {
    return TIMEOUT_CONFIG.EXPORT;
  }
  if (url.includes('/report') || url.includes('/generate')) {
    return TIMEOUT_CONFIG.REPORT;
  }
  if (url.includes('/bulk') || url.includes('/batch')) {
    return TIMEOUT_CONFIG.BULK;
  }
  
  return config.timeout || TIMEOUT_CONFIG.DEFAULT;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ✅ REQUEST INTERCEPTOR
api.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem('token');
    const url = config.url || '';
    const isPublic = isPublicEndpoint(url);

    // Set timeout berdasarkan tipe request
    config.timeout = getTimeoutForRequest(config);

    // Handle FormData
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
    }

    // Add token
    if (token && !isPublic) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add retry config
    config._retryCount = config._retryCount || 0;
    config._retry = config._retry !== false;

    // Add timestamp untuk tracking
    config._timestamp = Date.now();

    // Logging
    if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_AXIOS === 'true') {
      console.log(`📤 [${config._timestamp}] ${config.method?.toUpperCase()} ${url}`, {
        hasToken: !!token,
        isPublic,
        timeout: config.timeout,
        retryCount: config._retryCount
      });
    }

    // Check for duplicate requests (only for GET)
    if (config.method?.toUpperCase() === 'GET') {
      const existingRequest = requestQueue.addRequest(config);
      if (existingRequest && !config._resolve) {
        // Request sudah ada, return existing promise
        return Promise.reject({ 
          message: 'Duplicate request cancelled', 
          isDuplicate: true,
          existingRequest 
        });
      }
    }

    return config;
  },
  (error) => {
    if (import.meta.env.DEV) {
      console.error('❌ Request Error:', error);
    }
    return Promise.reject(error);
  }
);

// ✅ FLAG ANTI LOOP
let isRedirecting = false;
let networkErrorCount = 0;
const MAX_NETWORK_ERRORS = 3;

// ✅ RESPONSE INTERCEPTOR
api.interceptors.response.use(
  (response) => {
    const url = response.config?.url || '';
    const duration = Date.now() - (response.config._timestamp || Date.now());

    // Resolve duplicate requests
    if (response.config.method?.toUpperCase() === 'GET') {
      requestQueue.resolveRequest(response.config, response);
    }

    // Logging
    if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_AXIOS === 'true') {
      console.log(`✅ [${duration}ms] Response ${response.status} from ${url}`);
    }

    // Reset network error count on success
    networkErrorCount = 0;

    return response;
  },
  async (error) => {
    const config = error.config;
    const status = error?.response?.status;
    const url = config?.url || '';
    const isPublic = isPublicEndpoint(url);
    const duration = Date.now() - (config?._timestamp || Date.now());

    // Handle duplicate request
    if (error.isDuplicate && error.existingRequest) {
      return error.existingRequest;
    }

    // Logging
    if (import.meta.env.DEV) {
      console.error(`❌ [${duration}ms] API Error ${status || 'Network'} on ${url}:`, {
        message: error?.message,
        data: error?.response?.data,
        isPublic,
        retryCount: config?._retryCount || 0
      });
    }

    // ✅ RETRY LOGIC
    if (config && config._retry && RETRY_CONFIG.shouldRetry(error)) {
      if (config._retryCount < RETRY_CONFIG.maxRetries) {
        config._retryCount++;
        const delay = RETRY_CONFIG.retryDelay * Math.pow(2, config._retryCount - 1);
        
        if (import.meta.env.DEV) {
          console.log(`🔄 Retry ${config._retryCount}/${RETRY_CONFIG.maxRetries} for ${url} in ${delay}ms`);
        }

        await sleep(delay);
        return api(config);
      }
    }

    // Reject duplicate requests
    if (config?.method?.toUpperCase() === 'GET') {
      requestQueue.rejectRequest(config, error);
    }

    // ✅ HANDLE 401/403 - REDIRECT TO LOGIN
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

      setTimeout(() => {
        isRedirecting = false;
      }, 3000);
    }

    // ✅ HANDLE NETWORK ERROR
    if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
      networkErrorCount++;
      
      if (networkErrorCount <= MAX_NETWORK_ERRORS) {
        if (import.meta.env.DEV) {
          console.warn(`⚠️ Network error (${networkErrorCount}/${MAX_NETWORK_ERRORS}). Pastikan server Laravel berjalan di http://127.0.0.1:8000`);
        }
      }

      if (networkErrorCount >= MAX_NETWORK_ERRORS) {
        if (import.meta.env.DEV) {
          console.error('🚨 Multiple network errors detected. Backend mungkin down.');
        }
      }
    }

    // ✅ HANDLE TIMEOUT
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      if (import.meta.env.DEV) {
        console.warn(`⏱️ Timeout setelah ${config?.timeout}ms: ${url}`);
      }
    }

    // ✅ HANDLE 500 SERVER ERROR
    if (status === 500 && import.meta.env.DEV) {
      console.error('💥 Server Error 500:', error?.response?.data?.message || 'Internal Server Error');
    }

    // ✅ CREATE CUSTOM ERROR
    const apiError = new ApiError(
      error?.response?.data?.message || error?.message || 'Unknown error',
      status,
      error?.response?.data,
      url
    );

    return Promise.reject(apiError);
  }
);

// ✅ EXPORT HELPER METHODS
export const healthCheck = async () => {
  try {
    const response = await api.get('/health', { timeout: 5000 });
    return response.data?.status === 'ok';
  } catch (error) {
    return false;
  }
};

export const cancelAllRequests = () => {
  // Cancel all pending requests
  requestQueue.pendingRequests.forEach((promise, key) => {
    promise.cancel?.();
  });
  requestQueue.pendingRequests.clear();
};

export default api; 