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

const SUPPORTED_ROLES = ['siswa', 'guru', 'admin'];

const Register = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        role: 'siswa',
        class_name: '',
        nis: '',
        nip: '',
        gender: '',
        phone: '',
        parent_name: '',
        parent_phone: ''
    });
    const [photo, setPhoto] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [schoolSettings, setSchoolSettings] = useState({ name: 'UISOCIAL', logo: null });
    const [logoError, setLogoError] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    
    const navigate = useNavigate();

    const backgroundImages = [
        'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1920&q=80',
        'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80',
        'https://images.unsplash.com/photo-1419242902214-27276334a370?w=1920&q=80',
        'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1920&q=80'
    ];

    // Background slideshow (tetap jalan tapi visual terkunci di kiri)
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentImageIndex((prevIndex) => (prevIndex + 1) % backgroundImages.length);
        }, 6000);
        return () => clearInterval(interval);
    }, [backgroundImages.length]);

    // Reset field saat role berubah
    useEffect(() => {
        if (formData.role === 'admin') {
            setFormData(prev => ({ ...prev, class_name: '', nis: '', nip: '', gender: '', phone: '', parent_name: '', parent_phone: '' }));
        } else if (formData.role === 'guru') {
            setFormData(prev => ({ ...prev, nis: '', parent_name: '', parent_phone: '' }));
        }
    }, [formData.role]);

    // Load school settings
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

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Optional: Add file size validation (e.g., max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert("Ukuran foto terlalu besar! Maksimal 2MB.");
        return;
      }
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (formData.password.length < 8) throw new Error('Kata sandi minimal 8 karakter!');
            if (formData.password !== formData.password_confirmation) throw new Error('Konfirmasi kata sandi tidak cocok!');

            // Gunakan FormData untuk mendukung pengiriman file foto
            const data = new FormData();
            data.append('name', formData.name.trim());
            data.append('email', formData.email.trim());
            data.append('password', formData.password);
            data.append('password_confirmation', formData.password_confirmation);
            data.append('role', formData.role);

            const username = (formData.role === 'siswa' ? formData.nis : formData.nip) || formData.email.split('@')[0];
            data.append('username', username);

            if (formData.role === 'siswa') {
                if (!formData.class_name || !formData.nis || !formData.gender || !formData.phone || !formData.parent_name || !formData.parent_phone) {
                    throw new Error('Semua data profil siswa wajib diisi!');
                }
                data.append('nis', formData.nis);
                data.append('user_id', formData.nis);
                data.append('class_id', formData.class_name);
                data.append('class_name', `Kelas ${formData.class_name}`);
                data.append('gender', formData.gender);
                data.append('phone', formData.phone);
                data.append('parent_name', formData.parent_name);
                data.append('parent_phone', formData.parent_phone);
            } else if (formData.role === 'guru') {
                if (!formData.nip || !formData.gender || !formData.phone || !formData.class_name) {
                    throw new Error('Data NIP, Jenis Kelamin, No. Telepon, dan Wali Kelas wajib diisi!');
                }
                data.append('nip', formData.nip);
                data.append('nis', formData.nip);
                data.append('user_id', formData.nip);
                data.append('class_id', formData.class_name);
                data.append('class_name', `Kelas ${formData.class_name}`);
                data.append('gender', formData.gender);
                data.append('phone', formData.phone);
            }

            // Tambahkan file foto jika ada
            if (photo) {
                data.append('photo', photo);
            }

            await api.post('/register', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert('Registrasi berhasil! Silakan login.');
            setIsExiting(true);
            setTimeout(() => navigate('/', { replace: true }), 600);
        } catch (err) {
            console.error("Register error:", err);
            const msg = err.response?.data?.message || err.response?.data?.errors ? 
                Object.values(err.response.data.errors).flat().join('\n') : 
                err.message || 'Registrasi gagal!';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-shell min-h-screen relative flex items-center justify-center p-3 sm:p-4 overflow-hidden bg-white dark:bg-slate-950 transition-colors duration-500">
            {/* Background Mobile */}
            <div className="absolute inset-0 z-0 lg:hidden">
                {backgroundImages.map((img, index) => (
                    <div key={index} className={`absolute inset-0 transition-opacity duration-[2000ms] ${index === currentImageIndex ? 'opacity-100' : 'opacity-0'}`}
                        style={{ backgroundImage: `url(${img})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                ))}
                <div className="absolute inset-0 bg-black/40" />
            </div>

            {/* Background Desktop - Left Panel (Locked Visual) */}
            <div className="absolute left-0 top-0 w-1/2 h-full z-0 hidden lg:block">
                {backgroundImages.map((img, index) => (
                    <div key={index} className={`absolute inset-0 transition-opacity duration-[2000ms] ${index === currentImageIndex ? 'opacity-100' : 'opacity-0'}`}
                        style={{ backgroundImage: `url(${img})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                ))}
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
            </div>

            <div className={`auth-card bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-2xl shadow-lg w-full max-w-md sm:max-w-4xl flex flex-col lg:flex-row overflow-hidden relative z-10 border border-transparent dark:border-slate-800 transition-all duration-500 ${
                !isMounted ? 'opacity-0 scale-95' : isExiting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
            }`} style={{ minHeight: 'auto', maxHeight: '95vh' }}>
                
                {/* Left Panel - Desktop Only (Static/Locked Visual) */}
                <div className="hidden lg:flex lg:w-5/12 relative bg-black">
                    <div className="absolute inset-0 z-10">
                        {backgroundImages.map((img, index) => (
                            <div key={index} className={`absolute inset-0 transition-opacity duration-[2000ms] ${index === currentImageIndex ? 'opacity-100' : 'opacity-0'}`}
                                style={{ backgroundImage: `url(${img})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                        ))}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                    </div>
                    <div className="relative z-20 flex flex-col justify-between w-full p-6 text-white">
                        <div className="flex items-center space-x-2">
                            <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
                                {schoolSettings.logo && !logoError ? (
                                    <img src={resolvePhotoUrl(schoolSettings.logo)} alt="Logo" className="w-5 h-5 object-contain" onError={() => setLogoError(true)} />
                                ) : (
                                    <span className="text-base font-bold">{schoolSettings.name.charAt(0).toUpperCase()}</span>
                                )}
                            </div>
                            <span className="font-semibold text-xs">{schoolSettings.name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                                <span className="text-xs">✨</span>
                            </div>
                            <div>
                                <p className="text-xs font-semibold">Daftar Sekarang</p>
                                <p className="text-xs text-gray-300">Bergabung dengan kami</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side - Register Form (Scrollable) */}
                <div className="w-full lg:w-7/12 p-4 sm:p-6 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
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
                        <span className="text-base font-bold text-gray-900 auth-heading">{schoolSettings.name}</span>
                    </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1">
                        <div className="max-w-sm w-full mx-auto">
                            <div className="mb-4">
                                <h1 className="text-xl font-black text-slate-900 dark:text-white mb-1 auth-heading uppercase tracking-tighter">Buat Akun</h1>
                                <p className="text-slate-500 dark:text-slate-400 text-xs auth-text font-bold">Lengkapi data untuk mendaftar di {schoolSettings.name}</p>
                            </div>

                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg mb-3 text-xs whitespace-pre-line">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleRegister} className="space-y-3">
                                {/* Role Selection */}
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">Daftar Sebagai</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {SUPPORTED_ROLES.map((role) => (
                                            <button key={role} type="button" onClick={() => setFormData(prev => ({ ...prev, role }))}
                                                className={`px-2 py-2 rounded-lg text-xs font-medium transition-all border ${
                                                    formData.role === role ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                                }`}>
                                                {role === 'siswa' ? '🧑‍🎓' : role === 'guru' ? '👨‍🏫' : '👨‍💼'} {role.charAt(0).toUpperCase() + role.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Input Foto Profil */}
                                <div className="mb-4">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                                        Foto Profil (Opsional)
                                    </label>
                                    <div className="flex items-center gap-4 p-3 bg-blue-50/50 dark:bg-slate-800/50 rounded-xl border border-blue-100 dark:border-slate-700">
                                        <div className="w-16 h-16 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden border-2 border-blue-200 dark:border-slate-700 shadow-sm flex-shrink-0">
                                            {photoPreview ? (
                                                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-2xl text-blue-200">👤</span>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <input type="file" accept="image/*" onChange={handlePhotoChange} className="w-full text-[10px] text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 transition-all cursor-pointer" />
                                            <p className="text-[10px] text-gray-400 mt-1">Format: JPG, PNG. Maksimal 2MB.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Nama */}
                                <input type="text" name="name" value={formData.name} onChange={handleChange}
                                    className="auth-input w-full px-3 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    placeholder="Nama Lengkap *" required />

                                {/* Email */}
                                <input type="email" name="email" value={formData.email} onChange={handleChange}
                                    className="auth-input w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    placeholder="Email *" required />

                                {/* NIS/NIP */}
                                {(formData.role === 'siswa' || formData.role === 'guru') && (
                                    <input type="text" name={formData.role === 'siswa' ? 'nis' : 'nip'} 
                                        value={formData.role === 'siswa' ? formData.nis : formData.nip} onChange={handleChange}
                                        className="auth-input w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                        placeholder={`${formData.role === 'siswa' ? 'NIS' : 'NIP'} *`} required />
                                )}

                                {/* Kelas */}
                                {(formData.role === 'siswa' || formData.role === 'guru') && (
                                    <select name="class_name" value={formData.class_name} onChange={handleChange}
                                        className="auth-input w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" required>
                                        <option value="">Pilih Kelas *</option>
                                        <option value="1">Kelas 1</option>
                                        <option value="2">Kelas 2</option>
                                        <option value="3">Kelas 3</option>
                                    </select>
                                )}

                                {/* Gender & Phone */}
                                {(formData.role === 'siswa' || formData.role === 'guru') && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <select name="gender" value={formData.gender} onChange={handleChange}
                                            className="auth-input px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" required>
                                            <option value="">Jenis Kelamin *</option>
                                            <option value="Laki-laki">Laki-laki</option>
                                            <option value="Perempuan">Perempuan</option>
                                        </select>
                                        <input type="tel" name="phone" value={formData.phone} onChange={handleChange}
                                            className="px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                            placeholder="No. Telepon *" required />
                                    </div>
                                )}

                                {/* Parent Info - Siswa Only */}
                                {formData.role === 'siswa' && (
                                    <>
                                        <input type="text" name="parent_name" value={formData.parent_name} onChange={handleChange}
                                            className="auth-input w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                            placeholder="Nama Orang Tua *" required />
                                        <input type="tel" name="parent_phone" value={formData.parent_phone} onChange={handleChange}
                                            className="auth-input w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                            placeholder="No. Telepon Orang Tua *" required />
                                    </>
                                )}

                                {/* Password */}
                                <div className="relative">
                                    <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleChange}
                                        className="auth-input w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm pr-10"
                                        placeholder="Kata Sandi *" required minLength={8} />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{showPassword ? '🙈' : '👁️'}</button>
                                </div>

                                {/* Confirm Password */}
                                <div className="relative">
                                    <input type={showConfirmPassword ? 'text' : 'password'} name="password_confirmation" value={formData.password_confirmation} onChange={handleChange}
                                        className="auth-input w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm pr-10"
                                        placeholder="Konfirmasi Kata Sandi *" required />
                                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{showConfirmPassword ? '🙈' : '👁️'}</button>
                                </div>

                                <button type="submit" disabled={loading}
                                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg transition-all text-sm disabled:bg-gray-300">
                                    {loading ? 'Memproses...' : 'Daftar Sekarang'}
                                </button>
                            </form>

                            <p className="mt-5 text-center text-xs text-gray-600">
                                Sudah punya akun?{' '}
                                <Link to="/" onClick={(e) => handleNavigateWithAnimation('/', e)} className="font-semibold text-blue-500 hover:text-blue-600">
                                    Masuk
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @media (max-width: 640px) {
                    input, select, button { -webkit-tap-highlight-color: transparent; }
                    input:focus { font-size: 16px !important; }
                }
            `}</style>
        </div>
    );
};

export default Register;