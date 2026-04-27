import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import api from '../api/axios';
import { persistAuthResponse, dashboardPathForRole, getRoleDisplayName } from '../utils/authSession';

// Helper: Resolve URL foto/logo dengan fallback
const resolvePhotoUrl = (photo, fallbackBase = 'http://127.0.0.1:8000') => {
  if (!photo || typeof photo !== 'string') return null;
  const trimmed = photo.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http') || trimmed.startsWith('data:')) return trimmed;
  const base = api.defaults.baseURL?.replace(/\/api\/?$/, '') || fallbackBase;
  return `${base}/${trimmed.replace(/^\//, '')}`;
};

// Konfigurasi role yang didukung
const SUPPORTED_ROLES = ['siswa', 'guru', 'admin'];
const ROLE_ICONS = {
  siswa: '🧑‍🎓',
  guru: '👨‍🏫',
  admin: '👨‍💼'
};
const ROLE_LABELS = {
  siswa: 'Portal Siswa',
  guru: 'Portal Guru',
  admin: 'Panel Admin'
};

const LoginUnified = () => {
  const [identifier, setIdentifier] = useState(''); // Email/NIS/NIP/Username
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState(''); // Opsional: jika backend butuh hint role
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [schoolSettings, setSchoolSettings] = useState({ name: 'AbsensiPro', logo: null });
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [logoError, setLogoError] = useState(false);
  const [autoDetectedRole, setAutoDetectedRole] = useState(null); // Untuk UI dinamis
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const backgroundImages = [
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1920&q=80',
    'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1920&q=80',
    'https://images.unsplash.com/photo-1427504746696-ea5abd7dfe89?w=1920&q=80',
    'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1920&q=80'
  ];

  const navigate = useNavigate();
  const location = useLocation();

  // Auto change background setiap 6 detik
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % backgroundImages.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [backgroundImages.length]);

  // Menangkap role yang dikirim dari halaman Landing
  useEffect(() => {
    if (location.state?.role && SUPPORTED_ROLES.includes(location.state.role)) {
      setSelectedRole(location.state.role);
    }
  }, [location.state]);

  // Load school settings dari localStorage
  useEffect(() => {
    const loadSettings = () => {
      try {
        const saved = localStorage.getItem('school_settings');
        if (saved) {
          const settings = JSON.parse(saved);
          setSchoolSettings({
            name: settings.schoolName || settings.nama_sekolah || 'AbsensiPro',
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

  // Cek koneksi ke backend
  useEffect(() => {
  const verifyConnection = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // 🔥 PAKSA PING KE ENDPOINT YANG PASTI ADA
      const response = await fetch('http://127.0.0.1:8000', {
        method: 'GET',
        signal: controller.signal,
        mode: 'no-cors' // 🔥 INI BIKIN TIDAK ERROR CORS
      });

      clearTimeout(timeoutId);
      setConnectionStatus('connected');
    } catch (err) {
      console.warn('Backend tidak bisa dipastikan, tapi lanjut saja');
      setConnectionStatus('connected'); // 🔥 JANGAN BLOCK LOGIN
    }
  };

  verifyConnection();
  setIsMounted(true);
}, []);

  // Handle navigasi dengan animasi
  const handleNavigateWithAnimation = (path, e) => {
    if (e) e.preventDefault();
    setIsExiting(true);
    setTimeout(() => navigate(path), 600);
  };

  // Handle login universal
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const id = identifier.trim();
      const payload = { password };

      // Deteksi tipe identifier
      if (id.includes('@')) {
        payload.email = id;
      } else if (/^\d+$/.test(id)) {
        // Bisa NIS (siswa) atau NIP (guru)
        payload.user_id = id;
      } else {
        payload.username = id;
      }

      // Tambahkan role jika dipilih manual (opsional, tergantung backend)
      if (selectedRole && SUPPORTED_ROLES.includes(selectedRole)) {
        payload.role = selectedRole;
      }

      // ✨ Tambahkan timeout spesifik di sini juga
const res = await api.post('/login', payload, {
        timeout: 60000
      });

      // Simpan auth response (token, user info, role, dll)
      persistAuthResponse(res);

      // Auto-detect role dari response backend (lebih aman)
      const userData = res.data?.user || res.data?.data?.user || {};
      const userRole = userData.role || selectedRole || 'siswa';

      if (!SUPPORTED_ROLES.includes(userRole)) {
        throw new Error('Role tidak dikenali. Hubungi administrator.');
      }

      setAutoDetectedRole(userRole);
      setIsExiting(true);

      // Redirect ke dashboard sesuai role
      setTimeout(() => {
        const targetPath = dashboardPathForRole(userRole);
        navigate(targetPath, { replace: true });
      }, 600);

    } catch (err) {
      console.error('Login error:', err);
      const msg = err.response?.data?.message || err.message || 'Email/NIS/NIP atau password salah!';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Tentukan ikon & label berdasarkan role (auto atau selected)
  const displayRole = autoDetectedRole || selectedRole || 'siswa';
  const currentIcon = ROLE_ICONS[displayRole] || '🧑‍🎓';
  const currentLabel = ROLE_LABELS[displayRole] || 'Portal Pengguna';

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* Background Slideshow Layer */}
      <div className="absolute inset-0 z-0">
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
              backgroundRepeat: 'no-repeat',
            }}
          />
        ))}
        {/* Dark Overlay & Blur agar form tetap terbaca jelas */}
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" />
      </div>

      <div 
        className={`bg-white/95 backdrop-blur-md rounded-2xl shadow-xl w-full max-w-4xl flex overflow-hidden relative z-10 transition-all duration-500 ease-in-out transform border-2 border-blue-400 ${
          !isMounted 
            ? 'opacity-0 scale-95 -translate-x-10'
            : isExiting 
              ? 'opacity-0 scale-95 translate-x-10'
              : 'opacity-100 scale-100 translate-x-0'
        }`} 
        style={{ minHeight: '520px' }}
      >
        
        {/* Left Side - Dynamic Branding */}
        <div className="hidden lg:flex lg:w-5/12 bg-blue-600 p-6">
          <div className="flex flex-col justify-between w-full">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center overflow-hidden">
                {schoolSettings.logo && !logoError ? (
                  <img 
                    src={resolvePhotoUrl(schoolSettings.logo)} 
                    alt="Logo Sekolah" 
                    className="w-full h-full object-contain p-1"
                    onError={() => setLogoError(true)} 
                  />
                ) : (
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                )}
              </div>
              <span className="text-white text-lg font-bold">{schoolSettings.name}</span>
            </div>

            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-xl mb-3 transition-all duration-300">
                <span className="text-4xl animate-pulse">{currentIcon}</span>
              </div>
              <p className="text-white text-sm font-medium">{currentLabel}</p>
              {autoDetectedRole && (
                <p className="text-blue-100 text-xs mt-1">✓ Terdeteksi sebagai {getRoleDisplayName(autoDetectedRole)}</p>
              )}
            </div>

            <div className="text-white/90 text-xs space-y-1">
              <p className="font-medium">📊 Kelola data dengan mudah</p>
              <p className="opacity-80">• Absensi real-time</p>
              <p className="opacity-80">• Jadwal & notifikasi</p>
              <p className="opacity-80">• Laporan otomatis</p>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full lg:w-7/12 p-8 flex items-center">
          <div className="max-w-sm w-full mx-auto">
            <div className="mb-6 animate-fade-in">
              <h2 className="text-xl font-bold text-gray-900 mb-1.5">Selamat Datang! 👋</h2>
              <p className="text-gray-600 text-sm">Masuk sebagai Siswa, Guru, atau Admin</p>
            </div>

            {connectionStatus === 'disconnected' && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded-lg mb-4 text-[10px] animate-fade-in">
                ⚠️ <b>Server Offline / Tunnel Mati:</b><br/> 
                Jalankan ulang <code>cloudflared</code> di terminal dan update URL di <code>src/api/axios.js</code> atau file <code>.env</code>.
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg mb-4 text-sm animate-fade-in">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4 animate-fade-in">
              
              {/* Role Selector (Opsional - bisa di-hide jika backend auto-detect) */}
              <div className="animate-fade-in">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Masuk Sebagai</label>
                <div className="grid grid-cols-3 gap-2">
                  {SUPPORTED_ROLES.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setSelectedRole(role)}
                      className={`px-2 py-2 rounded-lg text-xs font-medium transition-all border ${
                        selectedRole === role
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {ROLE_ICONS[role]} {getRoleDisplayName(role)}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500 mt-1">* Opsional, backend akan mendeteksi otomatis</p>
              </div>

              <div className="animate-fade-in">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email / NIS / NIP / Username</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                  placeholder="siswa@gmail.com"
                  required
                  autoComplete="username"
                />
              </div>

              <div className="animate-fade-in">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Kata Sandi</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between animate-fade-in">
                <label className="flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" 
                    id="remember"
                  />
                  <span className="ml-1.5 text-sm text-gray-600" htmlFor="remember">Ingat saya</span>
                </label>
                <Link 
                  to="/forgot-password" 
                  onClick={(e) => handleNavigateWithAnimation('/forgot-password', e)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline"
                >
                  Lupa password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading || connectionStatus === 'disconnected'}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⏳</span> Memuat...
                  </>
                ) : (
                  <>Masuk sebagai {getRoleDisplayName(displayRole)}</>
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-600 animate-fade-in">
              Kembali Ke?{' '}
              <a href="/help" className="font-semibold text-blue-600 hover:text-blue-700 hover:underline">
                Halaman
              </a>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
      `}</style>
    </div>
  );
};

export default LoginUnified;