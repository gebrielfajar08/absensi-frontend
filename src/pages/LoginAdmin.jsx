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
  const base = api.defaults.baseURL?.replace(/\/api\/?$/, '') || 'http://127.0.0.1:8000';
  return `${base}/${trimmed.replace(/^\//, '')}`;
};

const LoginAdmin = () => {
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

    const backgroundImages = [
        'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80',
        'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1920&q=80',
        'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1920&q=80',
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentImageIndex((prevIndex) => 
                (prevIndex + 1) % backgroundImages.length
            );
        }, 8000);
        return () => clearInterval(interval);
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
            const res = await api.post('/login', {
                email: email.trim(),
                password,
                role: 'admin',
            });

            persistAuthResponse(res);

            setIsExiting(true);

            setTimeout(() => {
                navigate(dashboardPathForRole('admin'), { replace: true });
            }, 100);
            
        } catch (err) {
            if (!err.response) {
                setError('❌ Gagal terhubung ke server! Cek apakah Cloudflare Tunnel kamu masih aktif di terminal.');
            } else {
                setError(err.response?.data?.message || 'Email atau password salah!');
            }
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
                
                {/* Left Side - Simple Blue Theme */}
                <div className="hidden lg:flex lg:w-5/12 bg-blue-600 p-6">
                    <div className="flex flex-col justify-between w-full">
                        <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center overflow-hidden">
                                {schoolSettings.logo && !logoError ? (
                                    <img 
                                        src={resolvePhotoUrl(schoolSettings.logo)} 
                                        alt="Logo" 
                                        className="w-full h-full object-contain p-1"
                                        onError={() => setLogoError(true)} 
                                    />
                                ) : (
                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                )}
                            </div>
                            <span className="text-white text-lg font-bold">{schoolSettings.name}</span>
                        </div>

                        <div className="text-center py-8">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-xl mb-3">
                                <span className="text-4xl">👮</span>
                            </div>
                            <p className="text-white text-sm font-medium">Portal Administrator</p>
                        </div>

                        <div className="text-white/90 text-xs">
                            <p className="font-medium">🔐 Kontrol sistem</p>
                        </div>
                    </div>
                </div>

                {/* Right Side - Login Form */}
                <div className="w-full lg:w-7/12 p-8 flex items-center">
                    <div className="max-w-sm w-full mx-auto">
                        <div className="mb-6 animate-fade-in">
                            <h2 className="text-xl font-bold text-gray-900 mb-1.5">Admin Login 🔐</h2>
                            <p className="text-gray-600 text-sm">Masuk untuk mengelola sistem</p>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg mb-4 text-sm animate-fade-in">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-4 animate-fade-in">
                            <div className="animate-fade-in">
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Admin</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                                    placeholder="admin@sekolah.sch.id"
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
                                {loading ? 'Memuat...' : 'Masuk sebagai Admin'}
                            </button>
                        </form>

                        <p className="mt-6 text-center text-sm text-gray-600 animate-fade-in">
                            Bukan admin?{' '}
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

export default LoginAdmin;