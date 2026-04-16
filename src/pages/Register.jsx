import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';

const Register = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        role: 'guru',
        class_name: '',
        nis: '',
        nip: '',
        gender: '',
        phone: '',
        parent_name: '',
        parent_phone: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isExiting, setIsExiting] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const navigate = useNavigate();

    // Background images (logic tetap ada, tapi tidak ditampilkan)
    const backgroundImages = [
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80',
        'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=1920&q=80',
        'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1920&q=80',
        'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&q=80',
        'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1920&q=80',
        'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&q=80',
    ];

    // Auto change background every 8 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentImageIndex((prevIndex) => 
                (prevIndex + 1) % backgroundImages.length
            );
        }, 8000);
        return () => clearInterval(interval);
    }, [backgroundImages.length]);

    // ✅ Reset field spesifik saat role berubah agar data tidak tercampur
    useEffect(() => {
        if (formData.role === 'admin') {
            setFormData(prev => ({ 
                ...prev, 
                class_name: '', nis: '', nip: '', gender: '', phone: '', parent_name: '', parent_phone: '' 
            }));
        } else if (formData.role === 'guru') {
            setFormData(prev => ({ 
                ...prev, 
                nis: '', parent_name: '', parent_phone: '' 
            }));
        }
    }, [formData.role]);

    // Handle mount animation (enter from left)
    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Handle navigation with exit animation to right
    const handleNavigateWithAnimation = (path, e) => {
        if (e) e.preventDefault();
        setIsExiting(true);
        setTimeout(() => {
            navigate(path);
        }, 600);
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (formData.password !== formData.password_confirmation) {
            setError('Kata sandi dan konfirmasi kata sandi tidak cocok!');
            setLoading(false);
            return;
        }

        // ✅ Validasi untuk Guru
        if (formData.role === 'guru' && (!formData.nip || !formData.gender || !formData.phone || !formData.class_name)) {
            setError('Data NIP, Jenis Kelamin, No. Telepon, dan Wali Kelas wajib diisi!');
            setLoading(false);
            return;
        }

        // ✅ Validasi kelas untuk siswa
        if (formData.role === 'siswa' && (!formData.class_name || !formData.nis || !formData.gender || !formData.phone || !formData.parent_name || !formData.parent_phone)) {
            setError('Semua data profil siswa wajib diisi!');
            setLoading(false);
            return;
        }

        try {
            await api.post('/register', formData);
            alert('Registrasi berhasil! Silakan login dengan akun Anda.');
            setIsExiting(true);
            setTimeout(() => {
                navigate('/');
            }, 600);
        } catch (err) {
            if (err.response?.data?.errors) {
                const errors = err.response.data.errors;
                const errorMsg = Object.values(errors).flat().join('\n');
                setError(errorMsg);
            } else {
                setError(err.response?.data?.message || 'Registrasi gagal!');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-slate-50 to-blue-100">
            
            <div 
                className={`bg-white rounded-2xl shadow-xl w-full max-w-3xl flex overflow-hidden relative z-10 transition-all duration-500 ease-in-out transform border-2 border-blue-400 ${
                    !isMounted 
                        ? 'opacity-0 scale-95 -translate-x-10'
                        : isExiting 
                            ? 'opacity-0 scale-95 translate-x-10'
                            : 'opacity-100 scale-100 translate-x-0'
                }`} 
                style={{ minHeight: '550px' }}
            >
                
                {/* Left Side - Simple Blue Theme (Lebih Kecil) */}
                <div className="hidden lg:flex lg:w-2/5 bg-blue-600 p-4">
                    <div className="flex flex-col justify-between w-full">
                        <div className="flex items-center space-x-2">
                            <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center">
                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <span className="text-white text-base font-bold">AbsensiPro</span>
                        </div>

                        <div className="text-center py-4">
                            <div className="inline-flex items-center justify-center w-12 h-12 bg-white/20 rounded-xl mb-2">
                                <span className="text-3xl">✨</span>
                            </div>
                            <p className="text-white text-xs font-medium">Buat Akun Baru</p>
                        </div>

                        <div className="text-white/90 text-xs">
                            <p className="font-medium">🚀 Bergabung sekarang</p>
                        </div>
                    </div>
                </div>

                {/* Right Side - Register Form (Lebih Kecil) */}
                <div className="w-full lg:w-3/5 p-5 flex items-center overflow-y-auto">
                    <div className="max-w-xs w-full mx-auto my-auto py-4">
                        <div className="mb-4 animate-fade-in">
                            <h2 className="text-lg font-bold text-gray-900 mb-1">Buat Akun Baru</h2>
                            <p className="text-gray-600 text-xs">Lengkapi form di bawah untuk mendaftar</p>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-2.5 py-2 rounded-lg mb-3 text-xs whitespace-pre-line animate-fade-in">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleRegister} className="space-y-3 animate-fade-in">
                            <div className="animate-fade-in">
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Nama Lengkap
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-xs"
                                    placeholder="Masukkan nama lengkap"
                                    required
                                />
                            </div>

                            <div className="animate-fade-in">
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Alamat Email
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-xs"
                                    placeholder="email@contoh.com"
                                    required
                                />
                            </div>

                            <div className="animate-fade-in">
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Daftar Sebagai
                                </label>
                                <select
                                    name="role"
                                    value={formData.role}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-xs"
                                >
                                    <option value="guru">Guru</option>
                                    <option value="admin">Admin</option>
                                    <option value="siswa">Siswa</option>
                                </select>
                            </div>

                            {/* ✅ Field Tambahan untuk Guru atau Siswa */}
                            {(formData.role === 'guru' || formData.role === 'siswa') && (
                                <>
                                    {formData.role === 'guru' ? (
                                        <div className="animate-fade-in">
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                                                NIP
                                            </label>
                                            <input
                                                type="text"
                                                name="nip"
                                                value={formData.nip}
                                                onChange={handleChange}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-xs"
                                                placeholder="Masukkan NIP"
                                                required
                                            />
                                        </div>
                                    ) : (
                                        <div className="animate-fade-in">
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                                                NIS
                                            </label>
                                            <input
                                                type="text"
                                                name="nis"
                                                value={formData.nis}
                                                onChange={handleChange}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-xs"
                                                placeholder="Masukkan NIS"
                                                required
                                            />
                                        </div>
                                    )}

                                    <div className="animate-fade-in">
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                                            {formData.role === 'guru' ? 'Wali Kelas (Pilih Kelas)' : 'Kelas'}
                                        </label>
                                        <select
                                            name="class_name"
                                            value={formData.class_name}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-xs"
                                            required
                                        >
                                            <option value="">Pilih Kelas</option>
                                            <option value="1">Kelas 1</option>
                                            <option value="2">Kelas 2</option>
                                            <option value="3">Kelas 3</option>
                                        </select>
                                    </div>

                                    <div className="animate-fade-in">
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                                            Jenis Kelamin
                                        </label>
                                        <select
                                            name="gender"
                                            value={formData.gender}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-xs"
                                            required
                                        >
                                            <option value="">Pilih Jenis Kelamin</option>
                                            <option value="Laki-laki">Laki-laki</option>
                                            <option value="Perempuan">Perempuan</option>
                                        </select>
                                    </div>

                                    <div className="animate-fade-in">
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                                            No. Telepon {formData.role === 'guru' ? 'Guru' : 'Siswa'}
                                        </label>
                                        <input
                                            type="tel"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-xs"
                                            placeholder="Contoh: 08123456789"
                                            required
                                        />
                                    </div>
                                </>
                            )}

                            {/* ✅ Field Khusus Siswa (Orang Tua) */}
                            {formData.role === 'siswa' && (
                                <>
                                    <div className="animate-fade-in">
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                                            Nama Orang Tua
                                        </label>
                                        <input
                                            type="text"
                                            name="parent_name"
                                            value={formData.parent_name}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-xs"
                                            placeholder="Masukkan nama orang tua"
                                            required
                                        />
                                    </div>
                                    <div className="animate-fade-in">
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                                            No. Telepon Orang Tua
                                        </label>
                                        <input
                                            type="tel"
                                            name="parent_phone"
                                            value={formData.parent_phone}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-xs"
                                            placeholder="Contoh: 08123456789"
                                            required
                                        />
                                    </div>
                                </>
                            )}

                            <div className="animate-fade-in">
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Kata Sandi
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-xs"
                                        placeholder="Minimal 6 karakter"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors text-xs"
                                    >
                                        {showPassword ? '🙈' : '👁️'}
                                    </button>
                                </div>
                            </div>

                            <div className="animate-fade-in">
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Konfirmasi Kata Sandi
                                </label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        name="password_confirmation"
                                        value={formData.password_confirmation}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-xs"
                                        placeholder="Ulangi kata sandi"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors text-xs"
                                    >
                                        {showConfirmPassword ? '🙈' : '👁️'}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded-lg transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed text-xs mt-3"
                            >
                                {loading ? 'Membuat Akun...' : 'Daftar Sekarang'}
                            </button>
                        </form>

                        <p className="mt-4 text-center text-xs text-gray-600 animate-fade-in">
                            Sudah punya akun?{' '}
                            <Link 
                                to="/" 
                                onClick={(e) => handleNavigateWithAnimation('/', e)}
                                className="font-semibold text-blue-600 hover:text-blue-700 transition-colors duration-200 hover:underline"
                            >
                                Masuk di sini
                            </Link>
                        </p>
                    </div>
                </div>
            </div>

            {/* CSS untuk animasi fade-in */}
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

export default Register;