import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';

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
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isExiting, setIsExiting] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const navigate = useNavigate();

    // Background images (logic tetap ada)
    const backgroundImages = [
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80',
        'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=1920&q=80',
        'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1920&q=80',
        'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&q=80',
        'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1920&q=80',
        'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&q=80',
    ];

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

    useEffect(() => {
        setIsMounted(true);
    }, []);

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

        console.log("📤 Mengirim data registrasi dengan payload:", formData);
        try {
            if (formData.password.length < 8) {
                throw new Error('Kata sandi minimal harus 8 karakter!');
            }

            if (formData.password !== formData.password_confirmation) {
                throw new Error('Kata sandi dan konfirmasi kata sandi tidak cocok!');
            }

            const payload = {
                name: formData.name.trim(),
                email: formData.email.trim(),
                password: formData.password,
                password_confirmation: formData.password_confirmation,
                role: formData.role
            };

            payload.username = (formData.role === 'siswa' ? formData.nis : formData.nip) || formData.email.split('@')[0];

            if (formData.role === 'siswa') {
                if (!formData.class_name || !formData.nis || !formData.gender || !formData.phone || !formData.parent_name || !formData.parent_phone) {
                    throw new Error('Semua data profil siswa wajib diisi!');
                }
                payload.nis = formData.nis;
                payload.user_id = formData.nis;
                payload.class_id = parseInt(formData.class_name); 
                payload.class_name = `Kelas ${formData.class_name}`;
                payload.gender = formData.gender;
                payload.phone = formData.phone;
                payload.parent_name = formData.parent_name;
                payload.parent_phone = formData.parent_phone;
            } else if (formData.role === 'guru') {
                if (!formData.nip || !formData.gender || !formData.phone || !formData.class_name) {
                    throw new Error('Data NIP, Jenis Kelamin, No. Telepon, dan Wali Kelas wajib diisi!');
                }
                payload.nip = formData.nip;
                payload.nis = formData.nip;
                payload.user_id = formData.nip;
                payload.class_id = parseInt(formData.class_name);
                payload.class_name = `Kelas ${formData.class_name}`;
                payload.gender = formData.gender;
                payload.phone = formData.phone;
            }
            // ✅ Admin tidak perlu field tambahan

            await api.post('/register', payload);
            
            alert('Registrasi berhasil! Silakan login dengan akun Anda.');
            setIsExiting(true);
            setTimeout(() => {
                navigate('/');
            }, 600);
        } catch (err) {
            console.error("Detail Error Registrasi:", err.response?.data);
            const responseData = err.response?.data;

            if (!err.response) {
                setError(err.message || '❌ Gagal terhubung ke server!');
            } else if (responseData?.errors) {
                const errors = responseData.errors;
                const errorMsg = Object.entries(errors)
                    .map(([key, value]) => {
                        let message = Array.isArray(value) ? value[0] : value;
                        
                        if (message.toLowerCase().includes('taken')) {
                            message = "Sudah terdaftar! Gunakan nomor/email lain.";
                        }

                        const fieldName = (key === 'nis' || key === 'nip' || key === 'user_id') ? 'NIS/NIP' : key;
                        return `• ${fieldName}: ${message}`;
                    })
                    .join('\n');
                setError(errorMsg);
            } else {
                setError(responseData?.message || 'Registrasi gagal! Cek kembali data Anda.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-blue-100 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Slider (tetap ada tapi hidden) */}
            <div className="absolute inset-0 opacity-0">
                {backgroundImages.map((bg, index) => (
                    <div
                        key={index}
                        className={`absolute inset-0 transition-opacity duration-1000 ${
                            index === currentImageIndex ? 'opacity-100' : 'opacity-0'
                        }`}
                        style={{
                            backgroundImage: `url(${bg})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                        }}
                    />
                ))}
            </div>

            <div 
                className={`bg-white rounded-3xl shadow-2xl w-full max-w-2xl relative z-10 transition-all duration-500 ease-in-out transform border border-slate-200 ${
                    !isMounted 
                        ? 'opacity-0 scale-95 -translate-x-10'
                        : isExiting 
                            ? 'opacity-0 scale-95 translate-x-10'
                            : 'opacity-100 scale-100 translate-x-0'
                }`}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-3xl p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold mb-1">Buat Akun Baru</h1>
                            <p className="text-blue-100 text-sm">Lengkapi form di bawah untuk mendaftar</p>
                        </div>
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Form Content */}
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm whitespace-pre-line animate-fade-in">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleRegister} className="space-y-4">
                        {/* Role Selection - Button Style (3 Options: Siswa, Guru, Admin) */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-2">
                                Daftar Sebagai *
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {/* Siswa */}
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, role: 'siswa' }))}
                                    className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition-all flex flex-col items-center justify-center gap-1 border-2 ${
                                        formData.role === 'siswa'
                                            ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-md'
                                            : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-slate-50'
                                    }`}
                                >
                                    <span className="text-lg">🧑‍🎓</span>
                                    <span>Siswa</span>
                                </button>
                                
                                {/* Guru */}
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, role: 'guru' }))}
                                    className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition-all flex flex-col items-center justify-center gap-1 border-2 ${
                                        formData.role === 'guru'
                                            ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-md'
                                            : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-slate-50'
                                    }`}
                                >
                                    <span className="text-lg">👨‍🏫</span>
                                    <span>Guru</span>
                                </button>
                                
                                {/* Admin - NEW! */}
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, role: 'admin' }))}
                                    className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition-all flex flex-col items-center justify-center gap-1 border-2 ${
                                        formData.role === 'admin'
                                            ? 'border-purple-600 bg-purple-50 text-purple-700 shadow-md'
                                            : 'border-slate-200 text-slate-600 hover:border-purple-300 hover:bg-slate-50'
                                    }`}
                                >
                                    <span className="text-lg">👨‍💼</span>
                                    <span>Admin</span>
                                </button>
                            </div>
                        </div>

                        {/* Nama Lengkap */}
                        <div className="animate-fade-in">
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                Nama Lengkap *
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                                placeholder="Masukkan nama lengkap"
                                required
                            />
                        </div>

                        {/* Email */}
                        <div className="animate-fade-in">
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                Alamat Email *
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                                placeholder="email@contoh.com"
                                required
                            />
                        </div>

                        {/* NIS/NIP - Conditional (Hanya untuk Siswa & Guru) */}
                        {(formData.role === 'siswa' || formData.role === 'guru') && (
                            <div className="animate-fade-in">
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                    {formData.role === 'siswa' ? 'NIS' : 'NIP'} *
                                </label>
                                <input
                                    type="text"
                                    name={formData.role === 'siswa' ? 'nis' : 'nip'}
                                    value={formData.role === 'siswa' ? formData.nis : formData.nip}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                                    placeholder={`Masukkan ${formData.role === 'siswa' ? 'NIS' : 'NIP'}`}
                                    required
                                />
                            </div>
                        )}

                        {/* Kelas - Conditional (Hanya untuk Siswa & Guru) */}
                        {(formData.role === 'siswa' || formData.role === 'guru') && (
                            <div className="animate-fade-in">
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                    {formData.role === 'guru' ? 'Wali Kelas' : 'Kelas'} *
                                </label>
                                <select
                                    name="class_name"
                                    value={formData.class_name}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm bg-white"
                                    required
                                >
                                    <option value="">Pilih Kelas</option>
                                    <option value="1">Kelas 1</option>
                                    <option value="2">Kelas 2</option>
                                    <option value="3">Kelas 3</option>
                                </select>
                            </div>
                        )}

                        {/* Jenis Kelamin - Conditional (Hanya untuk Siswa & Guru) */}
                        {(formData.role === 'siswa' || formData.role === 'guru') && (
                            <div className="animate-fade-in">
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                    Jenis Kelamin *
                                </label>
                                <select
                                    name="gender"
                                    value={formData.gender}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm bg-white"
                                    required
                                >
                                    <option value="">Pilih Jenis Kelamin</option>
                                    <option value="Laki-laki">Laki-laki</option>
                                    <option value="Perempuan">Perempuan</option>
                                </select>
                            </div>
                        )}

                        {/* No. Telepon - Conditional (Hanya untuk Siswa & Guru) */}
                        {(formData.role === 'siswa' || formData.role === 'guru') && (
                            <div className="animate-fade-in">
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                    No. Telepon {formData.role === 'guru' ? 'Guru' : 'Siswa'} *
                                </label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                                    placeholder="08123456789"
                                    required
                                />
                            </div>
                        )}

                        {/* Orang Tua - Siswa Only */}
                        {formData.role === 'siswa' && (
                            <>
                                <div className="animate-fade-in">
                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                        Nama Orang Tua *
                                    </label>
                                    <input
                                        type="text"
                                        name="parent_name"
                                        value={formData.parent_name}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                                        placeholder="Masukkan nama orang tua"
                                        required
                                    />
                                </div>
                                <div className="animate-fade-in">
                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                        No. Telepon Orang Tua *
                                    </label>
                                    <input
                                        type="tel"
                                        name="parent_phone"
                                        value={formData.parent_phone}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                                        placeholder="08123456789"
                                        required
                                    />
                                </div>
                            </>
                        )}

                        {/* Info Khusus Admin */}
                        {formData.role === 'admin' && (
                            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 animate-fade-in">
                                <div className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div>
                                        <h4 className="font-semibold text-purple-900 text-sm mb-1">Info Akun Admin</h4>
                                        <p className="text-xs text-purple-700">
                                            Akun admin hanya memerlukan nama, email, dan password. 
                                            Akses penuh ke dashboard akan diberikan setelah verifikasi oleh super admin.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Password */}
                        <div className="animate-fade-in">
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                Kata Sandi *
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm pr-12"
                                    placeholder="Minimal 8 karakter"
                                    required
                                    minLength={8}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showPassword ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div className="animate-fade-in">
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                Konfirmasi Kata Sandi *
                            </label>
                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    name="password_confirmation"
                                    value={formData.password_confirmation}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm pr-12"
                                    placeholder="Ulangi kata sandi"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showConfirmPassword ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl mt-6 flex items-center justify-center gap-2 ${
                                formData.role === 'admin'
                                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'
                                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                            }`}
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <span>Membuat Akun...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                    </svg>
                                    <span>Daftar Sekarang</span>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Login Link */}
                    <p className="mt-6 text-center text-sm text-slate-600 animate-fade-in">
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

            {/* CSS untuk animasi */}
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