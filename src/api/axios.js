import axios from 'axios';

const api = axios.create({
    // Menggunakan environment variable. Jika tidak ada, gunakan localhost Laragon sebagai default.
    // Buat file .env di root folder dan isi: VITE_API_URL=https://link-baru-kamu.trycloudflare.com/api
    baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api', 
    timeout: 120000, // ✨ 120 detik (2 menit) sangat penting untuk Cloudflare Tunnel
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

console.log("ENV:", import.meta.env);
console.log("API URL:", import.meta.env.VITE_API_URL);
export default api;