import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { dashboardPathForRole } from '../utils/authSession';

const GoogleCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    useEffect(() => {
        const token = searchParams.get('token');
        const userStr = searchParams.get('user');
        const error = searchParams.get('error');

        if (error) {
            alert('Login gagal: ' + error);
            navigate('/');
            return;
        }

        if (token && userStr) {
            try {
                const user = JSON.parse(decodeURIComponent(userStr));
                const normalized = {
                    ...user,
                    role: String(user.role || '')
                        .toLowerCase()
                        .trim(),
                };
                localStorage.setItem('token', token);
                localStorage.setItem('user', JSON.stringify(normalized));

                alert('Login berhasil dengan Google!');
                navigate(dashboardPathForRole(normalized.role), { replace: true });
            } catch (err) {
                alert('Error memproses data');
                navigate('/');
            }
        }
    }, [searchParams, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="text-center">
                <div className="text-blue-600 text-xl mb-2">⏳ Memproses login...</div>
                <p className="text-gray-600">Mohon tunggu</p>
            </div>
        </div>
    );
};

export default GoogleCallback;