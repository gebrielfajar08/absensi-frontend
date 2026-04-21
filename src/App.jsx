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
    return (
        <BrowserRouter>
            <Routes>
                {/* ← Public Routes */}
                <Route path="/" element={<Landing />} />
                
                {/* ← Unified Login (login.jsx) */}
                <Route path="/login" element={<LoginUnified />} />
                
                {/* ← Login Terpisah per Role */}
                <Route path="/login/guru" element={<LoginGuru />} />
                <Route path="/login/siswa" element={<LoginSiswa />} />
                <Route path="/login/admin" element={<LoginAdmin />} />
                
                {/* ← Other Public Routes */}
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/auth/google/callback" element={<GoogleCallback />} />
                
                {/* Protected Routes - Dashboard per Role */}
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
                
                {/* Fallback: Redirect /dashboard */}
                <Route 
                    path="/dashboard" 
                    element={
                        <ProtectedRoute>
                            <DashboardRedirect />
                        </ProtectedRoute>
                    } 
                />
                
                {/* Fallback Route */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
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