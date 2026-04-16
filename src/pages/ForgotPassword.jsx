import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1 = email, 2 = new password
    const [token, setToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isExiting, setIsExiting] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const navigate = useNavigate();

    // Background images - pemandangan yang berbeda
    const backgroundImages = [
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80', // Mountains
        'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=1920&q=80', // Waterfall
        'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1920&q=80', // Lake
        'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&q=80', // Forest
        'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1920&q=80', // Autumn
        'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&q=80', // Sunrise
    ];

    // Auto change background every 8 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentImageIndex((prevIndex) => 
                (prevIndex + 1) % backgroundImages.length
            );
        }, 8000); // Change every 8 seconds

        return () => clearInterval(interval);
    }, [backgroundImages.length]);

    // Handle mount animation
    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Handle navigation with animation
    const handleNavigateToLogin = (e) => {
        e.preventDefault();
        setIsExiting(true);
        
        // Wait for exit animation to complete
        setTimeout(() => {
            navigate('/');
        }, 600); // Match this with CSS transition duration
    };

    const handleSendResetLink = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);

        try {
            const res = await api.post('/forgot-password', { email });
            setMessage(res.data.message);
            setStep(2);
        } catch (err) {
            setError(err.response?.data?.message || 'Email tidak ditemukan!');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (newPassword !== confirmPassword) {
            setError('Password dan konfirmasi password tidak cocok!');
            return;
        }

        setLoading(true);

        try {
            const res = await api.post('/reset-password', {
                email,
                token, // Di aplikasi nyata, token akan dikirim via email
                password: newPassword,
                password_confirmation: confirmPassword
            });
            
            setMessage(res.data.message);
            setIsExiting(true);
            
            setTimeout(() => {
                navigate('/');
            }, 600);
        } catch (err) {
            setError(err.response?.data?.message || 'Gagal reset password!');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
            {/* Background Slideshow */}
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
                {/* Overlay gelap agar text tetap terbaca */}
                <div className="absolute inset-0 bg-black/40" />
            </div>

            {/* Main Content dengan Animasi Enter & Exit */}
            <div 
                className={`bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl w-full max-w-4xl flex overflow-hidden relative z-10 transition-all duration-500 ease-in-out transform ${
                    !isMounted 
                        ? 'opacity-0 scale-95 -translate-x-10'  // Enter dari kiri
                        : isExiting 
                            ? 'opacity-0 scale-95 translate-x-10'  // Exit ke kanan
                            : 'opacity-100 scale-100 translate-x-0'  // Normal state
                }`} 
                style={{ minHeight: '500px' }}
            >
                
                {/* Left Side - Same as Login */}
                <div className="hidden lg:flex lg:w-5/12 bg-gradient-to-br from-blue-500 to-blue-600 p-6 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-8 left-8 w-24 h-24 bg-white rounded-full"></div>
                        <div className="absolute bottom-16 right-8 w-32 h-32 bg-white rounded-full"></div>
                        <div className="absolute top-1/2 left-1/2 w-20 h-20 bg-white rounded-full"></div>
                    </div>

                    <div className="relative z-10 flex flex-col justify-between w-full">
                        <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-lg">
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <span className="text-white text-lg font-bold">AbsensiPro</span>
                        </div>

                        <div className="flex-1 flex items-center justify-center py-4">
                            <div className="relative w-full max-w-xs">
                                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 shadow-2xl transform rotate-3">
                                    <div className="bg-white rounded-xl p-3 mb-3">
                                        <div className="flex items-center space-x-2.5 mb-2.5">
                                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <div className="h-2 bg-gray-200 rounded w-16 mb-1"></div>
                                                <div className="h-1.5 bg-gray-100 rounded w-12"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-white text-center text-sm">Reset Password</div>
                                </div>
                            </div>
                        </div>

                        <div className="text-white/90 text-xs">
                            <p className="font-medium">Amankan akun Anda</p>
                        </div>
                    </div>

                    <div className="absolute top-16 right-8 w-12 h-12 bg-white/10 rounded-full blur-xl"></div>
                    <div className="absolute bottom-24 left-6 w-20 h-20 bg-blue-400/20 rounded-full blur-2xl"></div>
                </div>

                {/* Right Side - Form */}
                <div className="w-full lg:w-7/12 p-8 flex items-center">
                    <div className="max-w-sm w-full mx-auto">
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-1.5">Lupa Kata Sandi</h2>
                            <p className="text-gray-600 text-sm">
                                {step === 1 ? 'Masukkan email Anda untuk reset password' : 'Masukkan password baru Anda'}
                            </p>
                        </div>

                        {message && (
                            <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg mb-4 text-sm animate-fade-in">
                                {message}
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg mb-4 text-sm animate-fade-in">
                                {error}
                            </div>
                        )}

                        {step === 1 ? (
                            <form onSubmit={handleSendResetLink} className="space-y-4 animate-fade-in">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        Alamat Email
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                                        placeholder="nama@email.com"
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30 text-sm"
                                >
                                    {loading ? 'Mengirim...' : 'Kirim Link Reset'}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleResetPassword} className="space-y-4 animate-fade-in">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        Token (dari email)
                                    </label>
                                    <input
                                        type="text"
                                        value={token}
                                        onChange={(e) => setToken(e.target.value)}
                                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                                        placeholder="Masukkan token"
                                        required
                                    />
                                    <p className="text-xs text-gray-500 mt-1">* Di aplikasi nyata, token dikirim via email</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        Password Baru
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                                            placeholder="Minimal 6 karakter"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                        >
                                            {showPassword ? (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        Konfirmasi Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                                            placeholder="Ulangi password baru"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                        >
                                            {showConfirmPassword ? (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30 text-sm"
                                >
                                    {loading ? 'Menyimpan...' : 'Reset Password'}
                                </button>
                            </form>
                        )}

                        <p className="mt-6 text-center text-sm text-gray-600">
                            Ingat password?{' '}
                            <Link 
                                to="/" 
                                onClick={handleNavigateToLogin}
                                className="font-semibold text-blue-600 hover:text-blue-700 transition-colors duration-200 hover:underline"
                            >
                                Kembali ke Login
                            </Link>
                        </p>
                    </div>
                </div>
            </div>

            {/* CSS untuk animasi fade-in */}
            <style>{`
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                .animate-fade-in {
                    animation: fadeIn 0.4s ease-out;
                }
            `}</style>
        </div>
    );
};

export default ForgotPassword;