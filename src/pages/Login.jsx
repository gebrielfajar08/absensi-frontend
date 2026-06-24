import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { persistAuthResponse, dashboardPathForRole } from '../utils/authSession';

const resolvePhotoUrl = (photo, fallbackBase = 'http://127.0.0.1:8000') => {
  if (!photo || typeof photo !== 'string') return null;
  const trimmed = photo.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http') || trimmed.startsWith('data:')) return trimmed;
  const base = api.defaults.baseURL?.replace(/\/api\/?$/, '') || fallbackBase;
  return `${base}/${trimmed.replace(/^\//, '')}`;
};

// ➕ TAMBAHAN: Fungsi retry untuk menangani timeout/koneksi bermasalah
const fetchWithRetry = async (apiCall, maxRetries = 3, delay = 1500) => {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) break;
      if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK' || error.message?.includes('timeout')) {
        console.warn(`🔄 Retry attempt ${attempt}/${maxRetries} due to network/timeout issue...`);
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

const LoginUnified = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [schoolSettings, setSchoolSettings] = useState({ name: 'UISOCIAL', logo: null });
  const [logoError, setLogoError] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const backgroundImages = [
    'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1920&q=80',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80',
    'https://images.unsplash.com/photo-1419242902214-27276334a370?w=1920&q=80',
    'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1920&q=80'
  ];

  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % backgroundImages.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [backgroundImages.length]);

  useEffect(() => {
    const loadSettings = () => {
      try {
        const saved = localStorage.getItem('school_settings');
        if (saved) {
          const settings = JSON.parse(saved);
          setSchoolSettings({
            name: settings.schoolName || settings.nama_sekolah || 'UISOCIAL',
            logo: settings.schoolLogo || settings.logo || null
          });
        }
      } catch (err) {
        console.error("Gagal memuat pengaturan sekolah", err);
      }
    };
    loadSettings();
    window.addEventListener('storage', loadSettings);
    return () => window.removeEventListener('storage', loadSettings);
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleNavigateWithAnimation = (path, e) => {
    if (e) e.preventDefault();
    setIsExiting(true);
    setTimeout(() => navigate(path), 600);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const id = identifier.trim();
      
      // Validasi input
      if (!id || !password) {
        throw new Error('NIS/NIP/Email/Username dan kata sandi harus diisi!');
      }

const payload = {
  password
};

if (id.includes('@')) {
  payload.email = id;
} else {
  payload.nis = id;
}

      // Deteksi tipe identifier untuk kompatibilitas backend
      if (id.includes('@')) {
        payload.email = id;
      } else if (/^\d+$/.test(id)) {
        // Angka - kirim semua kemungkinan field ID numerik
        payload.nis = id;
        payload.nip = id;
        payload.user_id = id;
      } else {
        // Teks selain email - asumsikan username
        payload.username = id;
      }

      console.log('📤 Sending login request:', payload);

      const response = await fetchWithRetry(() => 
        api.post('/auth/login', payload, { 
        timeout: 60000, // Tingkatkan ke 60 detik
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }));

      console.log('✅ Login response:', response.data);

      // Simpan auth response
      persistAuthResponse(response);

      // Ambil data user dari response
      const userData = response.data?.user || response.data?.data?.user || response.data;
      const userRole = userData.role;

      if (!userRole) {
        throw new Error('Role tidak dikenali. Hubungi administrator.');
      }

      setIsExiting(true);
      
      // Redirect ke dashboard sesuai role
      setTimeout(() => {
        const targetPath = dashboardPathForRole(userRole);
        console.log('🎯 Redirecting to:', targetPath);
        navigate(targetPath, { replace: true });
      }, 600);

    } catch (err) {
      console.error('❌ Login error:', err);

      let errorMsg = 'Login gagal! Periksa kembali akun Anda.';

      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errorMsg = 'Koneksi timeout. Server atau Tunnel sedang lambat. Silakan coba lagi.';
      } else if (err.response) {
        const status = err.response.status;
        const data = err.response.data;

        console.log('Error response:', status, data);

        if (status === 403) {
          errorMsg = 'Akses ditolak. Akun Anda tidak memiliki izin untuk masuk.';
        } else if (status === 401) {
          errorMsg = 'Kredensial salah! Periksa kembali Email dan kata sandi Anda.';
        } else if (status === 404) {
          errorMsg = 'Akun tidak ditemukan. Silakan daftar terlebih dahulu.';
        } else if (data?.message) {
          errorMsg = data.message;
        } else if (data?.errors) {
          const errors = Object.values(data.errors).flat();
          errorMsg = errors.join('\n');
        }
      } else if (err.request) {
        errorMsg = 'Tidak ada respons dari server. Pastikan server backend berjalan.';
      } else {
        errorMsg = err.message || 'Terjadi kesalahan. Silakan coba lagi.';
      }

      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell min-h-screen relative flex items-center justify-center p-3 sm:p-4 overflow-hidden bg-white dark:bg-slate-950 transition-colors duration-500">
      {/* Background untuk mobile */}
      <div className="absolute inset-0 z-0 lg:hidden">
        {backgroundImages.map((img, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-[2000ms] ease-in-out ${
              index === currentImageIndex ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              backgroundImage: `url(${img})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        ))}
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Background untuk desktop - kiri saja */}
      <div className="absolute left-0 top-0 w-1/2 h-full z-0 hidden lg:block">
        {backgroundImages.map((img, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-[2000ms] ease-in-out ${
              index === currentImageIndex ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              backgroundImage: `url(${img})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
      </div>

      <div 
        className={`auth-card bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-2xl shadow-lg w-full max-w-md sm:max-w-4xl flex flex-col lg:flex-row overflow-hidden relative z-10 border border-transparent dark:border-slate-800 transition-all duration-500 ease-in-out ${
          !isMounted ? 'opacity-0 scale-95' : isExiting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
        }`} 
        style={{ minHeight: 'auto', maxHeight: '95vh' }}
      >
        {/* Left Panel - Desktop Only */}
        <div className="hidden lg:flex lg:w-5/12 relative bg-black">
          <div className="absolute inset-0 z-10">
            {backgroundImages.map((img, index) => (
              <div
                key={index}
                className={`absolute inset-0 transition-opacity duration-[2000ms] ease-in-out ${
                  index === currentImageIndex ? 'opacity-100' : 'opacity-0'
                }`}
                style={{
                  backgroundImage: `url(${img})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          </div>

          <div className="relative z-20 flex flex-col justify-between w-full p-6 text-white">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                  {schoolSettings.logo && !logoError ? (
                    <img src={resolvePhotoUrl(schoolSettings.logo)} alt="Logo" className="w-5 h-5 object-contain" onError={() => setLogoError(true)} />
                  ) : (
                    <span className="text-base font-bold">{schoolSettings.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <span className="font-semibold text-xs">{schoolSettings.name}</span>
              </div>
            </div>

            <div className="flex items-end justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                  <span className="text-xs">👤</span>
                </div>
                <div>
                  <p className="text-xs font-semibold">Portal Login</p>
                  <p className="text-xs text-gray-300">Masuk untuk melanjutkan</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form (Responsive) */}
        <div className="w-full lg:w-7/12 p-5 sm:p-8 flex flex-col">
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <button
              type="button"
              onClick={(e) => handleNavigateWithAnimation('/', e)}
              className="auth-back-button inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black transition-all bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
              <span className="uppercase tracking-tighter">Beranda</span>
            </button>
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 bg-slate-900 dark:bg-blue-600 rounded-lg flex items-center justify-center shadow-lg transition-colors">
                <span className="text-white font-black text-sm">{schoolSettings.name.charAt(0).toUpperCase()}</span>
              </div>
              <span className="text-base sm:text-lg font-bold text-gray-900 auth-heading">{schoolSettings.name}</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto">
            <div className="mb-4 sm:mb-6">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-1 auth-heading uppercase tracking-tighter">Selamat Datang</h1>
              <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm auth-text font-bold">Masuk ke akun Anda</p>
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-3 py-2 rounded-lg mb-3 sm:mb-4 text-xs whitespace-pre-line">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">
                  Email
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="auth-input w-full px-3 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                  placeholder="Masukkan Email"
                  required
                  autoComplete="username"
                />
              </div>

              <div className="relative">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Kata Sandi</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                  placeholder="Masukkan kata sandi"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-8 text-gray-400 hover:text-gray-600 transition-colors text-xs"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>

              <div className="flex justify-end">
                <Link to="/forgot-password" onClick={(e) => handleNavigateWithAnimation('/forgot-password', e)} className="text-xs text-blue-500 hover:text-blue-600 font-medium">
                  Lupa kata sandi?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk</span>
                  </>
                )}
              </button>
            </form>

            <p className="mt-5 sm:mt-6 text-center text-xs text-gray-600">
              Belum punya akun?{' '}
              <Link to="/register" onClick={(e) => handleNavigateWithAnimation('/register', e)} className="font-semibold text-blue-500 hover:text-blue-600">
                Daftar sekarang
              </Link>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          input, button {
            -webkit-tap-highlight-color: transparent;
          }
          input:focus {
            font-size: 16px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default LoginUnified;