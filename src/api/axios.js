import axios from 'axios';

const api = axios.create({
    baseURL: 'http://127.0.0.1:8000/api',
    timeout: 60000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

// Interceptor kirim token (kecuali untuk scan QR)
api.interceptors.request.use((config) => {

    const token = localStorage.getItem('token');

    // endpoint yang tidak butuh login
    const publicEndpoints = [
        '/scan',
        '/login',
        '/register'
    ];

    const isPublic = publicEndpoints.some(url => config.url.includes(url));

    if (token && !isPublic) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

// Interceptor global untuk 401/403: otomatis logout dan redirect sesuai role
api.interceptors.response.use(
    response => response,
    (error) => {
        const status = error?.response?.status;
        if (status === 401 || status === 403) {
            // 🔑 Ambil role SEBELUM hapus localStorage
            const userStr = localStorage.getItem('user');
            let role = 'admin';
            
            if (userStr) {
                try {
                    const userData = JSON.parse(userStr);
                    role = userData.role?.toLowerCase() || 'admin';
                } catch (e) {
                    role = 'admin';
                }
            }
            
            // Hapus token & user
            localStorage.removeItem('token');
            localStorage.removeItem('user');

            // 🔑 Redirect sesuai role (INI KUNCI UTAMA!)
            if (role === 'siswa') {
                window.location.href = '/login/siswa';
            } else if (role === 'guru') {
                window.location.href = '/login/guru';
            } else {
                window.location.href = '/login/admin';
            }
            
            return Promise.reject(new Error('Session habis, silakan login ulang.'));
        }
        return Promise.reject(error);
    }
);

export default api;