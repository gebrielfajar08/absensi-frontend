import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { persistAuthResponse, dashboardPathForRole } from '../utils/authSession';

const resolvePhotoUrl = (photo) => {
  if (!photo) return null;
  if (typeof photo !== 'string') return null;
  const trimmed = photo.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http') || trimmed.startsWith('data:')) return trimmed;
  // ✨ DIPERBAIKI: Tambahkan fallback URL jika api.defaults.baseURL kosong
  const base = api.defaults.baseURL?.replace(/\/api\/?$/, '') || 'http://127.0.0.1:8000';
  return `${base}/${trimmed.replace(/^\//, '')}`;
};

const LoginSiswa = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isExiting, setIsExiting] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [schoolSettings, setSchoolSettings] = useState({ name: 'AbsensiPro', logo: null });
    const [logoError, setLogoError] = useState(false);

    useEffect(() => {
        const loadSettings = () => {
            const savedSettings = localStorage.getItem('school_settings');
            if (savedSettings) {
                try {
                    const settings = JSON.parse(savedSettings);
                    setSchoolSettings({
                        name: settings.schoolName || settings.nama_sekolah || 'AbsensiPro',
                        logo: settings.schoolLogo || settings.logo || null
                    });
                } catch (err) {
                    console.error("Error parsing settings", err);
                }
            }
        };
        loadSettings();
        window.addEventListener('storage', loadSettings);
        return () => window.removeEventListener('storage', loadSettings);
    }, []);
    
    const navigate = useNavigate();
     // Background images (logic tetap ada, tapi tidak ditampilkan)
    const backgroundImages = [
        'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1920&q=80',
        'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1920&q=80',
        'https://images.unsplash.com/photo-1427504746696-ea5abd7dfe89?w=1920&q=80',
    ];
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
        const id = email.trim();
        const payload = { password, role: 'siswa' };
        if (id.includes('@')) {
            payload.email = id;
        } else {
            payload.user_id = id;
        }

        const res = await api.post('/login', payload);

        persistAuthResponse(res);

        setIsExiting(true);

        setTimeout(() => {
            navigate(dashboardPathForRole('siswa'), { replace: true });
        }, 600);
        
    } catch (err) {
        setError(err.response?.data?.message || 'Email atau password salah!');
    } finally {
        setLoading(false);
    }
};

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-slate-50 to-blue-100">
            <div 
                className={`bg-white rounded-2xl shadow-xl w-full max-w-4xl flex overflow-hidden relative z-10 transition-all duration-500 ease-in-out transform border-2 border-blue-400 ${
                    !isMounted 
                        ? 'opacity-0 scale-95 -translate-x-10'
                        : isExiting 
                            ? 'opacity-0 scale-95 translate-x-10'
                            : 'opacity-100 scale-100 translate-x-0'
                }`} 
                style={{ minHeight: '500px' }}
            >
                
                {/* Left Side - Simple Blue Theme untuk Siswa */}
                <div className="hidden lg:flex lg:w-5/12 bg-blue-600 p-6">
                    <div className="flex flex-col justify-between w-full">
                        <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center overflow-hidden">
                                {/* ✨ DIPERBAIKI: Gunakan state logoError untuk fallback ke SVG jika URL gambar rusak */}
                                {schoolSettings.logo && !logoError ? (
                                    <img 
                                        src={resolvePhotoUrl(schoolSettings.logo)} 
                                        alt="Logo" 
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
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-xl mb-3">
                                <span className="text-4xl">🧑‍🎓</span>
                            </div>
                            <p className="text-white text-sm font-medium">Portal Siswa</p>
                        </div>

                        <div className="text-white/90 text-xs">
                            <p className="font-medium">📖 Pantau kehadiran</p>
                        </div>
                    </div>
                </div>

                {/* Right Side - Login Form */}
                <div className="w-full lg:w-7/12 p-8 flex items-center">
                    <div className="max-w-sm w-full mx-auto">
                        <div className="mb-6 animate-fade-in">
                            <h2 className="text-xl font-bold text-gray-900 mb-1.5">Halo, Siswa! 👋</h2>
                            <p className="text-gray-600 text-sm">Masuk untuk melihat kehadiran dan jadwal</p>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg mb-4 text-sm animate-fade-in">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-4 animate-fade-in">
                            <div className="animate-fade-in">
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email atau NIS</label>
                                <input
                                    type="text"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                                    placeholder="siswa@sekolah.sch.id atau NIS"
                                    required
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
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        {showPassword ? '🙈' : '👁️'}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between animate-fade-in">
                                <label className="flex items-center cursor-pointer">
                                    <input type="checkbox" className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                                    <span className="ml-1.5 text-sm text-gray-600">Ingat saya</span>
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
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                            >
                                {loading ? 'Memuat...' : 'Masuk sebagai Siswa'}
                            </button>
                        </form>

                        <p className="mt-6 text-center text-sm text-gray-600 animate-fade-in">
                            Bukan siswa?{' '}
                            <Link to="/" className="font-semibold text-blue-600 hover:text-blue-700 hover:underline">
                                Kembali ke beranda
                            </Link>
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

export default LoginSiswa;