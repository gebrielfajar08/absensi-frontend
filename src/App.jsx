import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// ← TAMBAHAN: Import Landing & Login terpisah per role
import Landing from './pages/Landing';
import LoginGuru from './pages/LoginGuru';
import LoginSiswa from './pages/LoginSiswa';
import LoginAdmin from './pages/LoginAdmin';
import LoginUnified from './pages/Login';

import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import GoogleCallback from './pages/GoogleCallback';

// ← TAMBAHAN: Import dashboard per role
import DashboardGuru from './pages/DashboardGuru';
import DashboardSiswa from './pages/DashboardSiswa';
import DashboardAdmin from './pages/DashboardAdmin';
import CustomCursor from "./components/CustomCursor";

// Komponen untuk proteksi halaman
const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    if (!token) {
        return <Navigate to="/" replace />;
    }
    return children;
};

// ← Komponen proteksi dengan cek role
const ProtectedRouteWithRole = ({ children, allowedRole }) => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!token || !userStr) {
        return <Navigate to="/" replace />;
    }
    
    try {
        const user = JSON.parse(userStr);
        const role = String(user.role || '')
            .toLowerCase()
            .trim();
        const allowed = String(allowedRole || '')
            .toLowerCase()
            .trim();
        if (role !== allowed) {
            return <Navigate to={role ? `/dashboard/${role}` : '/'} replace />;
        }
        return children;
    } catch {
        return <Navigate to="/" replace />;
    }
};

function App() {
    const [theme, setTheme] = useState(() => {
        if (typeof window === 'undefined') return 'light';
        const savedTheme = window.localStorage.getItem('theme');
        if (savedTheme === 'light' || savedTheme === 'dark') {
            return savedTheme;
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        window.localStorage.setItem('theme', theme);
    }, [theme]);

    return (
        <div className="min-h-screen">
            <button
                type="button"
                onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                data-theme={theme}
                className="theme-toggle-btn fixed right-5 top-5 z-[70] flex items-center justify-center rounded-full px-3 py-2 shadow-lg backdrop-blur transition-all duration-300 hover:scale-[1.02]"
                aria-label="Toggle tema"
            >
                <span className="theme-toggle-icon">{theme === 'dark' ? '🌙' : '☀️'}</span>
            </button>

            <CustomCursor /> {/* ✅ cursor aktif */}

            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Landing />} />

                    <Route path="/login" element={<LoginUnified />} />
                    <Route path="/login/guru" element={<LoginGuru />} />
                    <Route path="/login/siswa" element={<LoginSiswa />} />
                    <Route path="/login/admin" element={<LoginAdmin />} />

                    <Route path="/register" element={<Register />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/auth/google/callback" element={<GoogleCallback />} />

                    <Route 
                        path="/dashboard/guru" 
                        element={
                            <ProtectedRouteWithRole allowedRole="guru">
                                <DashboardGuru />
                            </ProtectedRouteWithRole>
                        } 
                    />

                    <Route 
                        path="/dashboard/siswa" 
                        element={
                            <ProtectedRouteWithRole allowedRole="siswa">
                                <DashboardSiswa />
                            </ProtectedRouteWithRole>
                        } 
                    />

                    <Route 
                        path="/dashboard/admin" 
                        element={
                            <ProtectedRouteWithRole allowedRole="admin">
                                <DashboardAdmin />
                            </ProtectedRouteWithRole>
                        } 
                    />

                    <Route 
                        path="/dashboard" 
                        element={
                            <ProtectedRoute>
                                <DashboardRedirect />
                            </ProtectedRoute>
                        } 
                    />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </div>
    );
}

// ← Komponen helper untuk redirect
const DashboardRedirect = () => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            const r = String(user.role || '')
                .toLowerCase()
                .trim();
            if (['admin', 'guru', 'siswa'].includes(r)) {
                return <Navigate to={`/dashboard/${r}`} replace />;
            }
            return <Navigate to="/" replace />;
        } catch {
            return <Navigate to="/" replace />;
        }
    }
    return <Navigate to="/" replace />;
};

export default App;