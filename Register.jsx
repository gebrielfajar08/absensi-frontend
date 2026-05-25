import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';

const resolvePhotoUrl = (photo, fallbackBase = 'http://127.0.0.1:8000') => {
  if (!photo || typeof photo !== 'string') return null;
  const trimmed = photo.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http') || trimmed.startsWith('data:')) return trimmed;
  const base = api.defaults.baseURL?.replace(/\/api\/?$/, '') || fallbackBase;
  return `${base}/${trimmed.replace(/^\//, '')}`;
};

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
  const [isExiting, setIsExiting] = useState(false);
  const [schoolSettings, setSchoolSettings] = useState({ name: 'UISOCIAL', logo: null });
  const [logoError, setLogoError] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [classes, setClasses] = useState([]);

  const navigate = useNavigate();

  const backgroundImages = [
    'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1920&q=80',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80',
    'https://images.unsplash.com/photo-1419242902214-27276334a370?w=1920&q=80',
    'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1920&q=80'
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % backgroundImages.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [backgroundImages.length]);

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
    const fetchClasses = async () => {
      try {
        const response = await api.get('/public/classes');
        setClasses(Array.isArray(response.data) ? response.data : response.data.data || []);
      } catch (err) {
        console.error("Gagal memuat kelas", err);
      }
    };
    fetchClasses();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (formData.password.length < 8) {
        throw new Error('Kata sandi minimal 8 karakter!');
      }
      if (formData.password !== formData.password_confirmation) {
        throw new Error('Konfirmasi kata sandi tidak cocok!');
      }

      const data = new FormData();
      data.append('name', formData.name.trim());
      data.append('email', formData.email.trim());
      data.append('password', formData.password);
      data.append('password_confirmation', formData.password_confirmation);
      data.append('role', formData.role);
      
      // Cari objek kelas berdasarkan ID yang dipilih di dropdown
      const selectedClass = classes.find(c => c.id.toString() === formData.class_name.toString());

      if (formData.role === 'siswa') {
        data.append('nis', formData.nis);
        data.append('user_id', formData.nis);
        data.append('class_id', formData.class_name); // Mengirim ID Kelas
        // Simpan Nama Kelas asli dari database untuk sinkronisasi filtering
        data.append('class_name', selectedClass ? selectedClass.name : (formData.class_name ? `Kelas ${formData.class_name}` : ''));
        data.append('gender', formData.gender);
        data.append('phone', formData.phone);
        data.append('parent_name', formData.parent_name);
        data.append('parent_phone', formData.parent_phone);
      } else if (formData.role === 'guru') {
        data.append('nip', formData.nip);
        data.append('user_id', formData.nip);
        data.append('class_id', formData.class_name);
        // Samakan logika nama kelas dengan siswa agar tidak terjadi duplikasi data di dashboard
        data.append('class_name', selectedClass ? selectedClass.name : (formData.class_name ? `Kelas ${formData.class_name}` : ''));
        data.append('gender', formData.gender);
        data.append('phone', formData.phone);
      }

      if (photo) {
        data.append('photo', photo);
      }

      await api.post('/register', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      alert('Registrasi berhasil! Silakan login.');
      setIsExiting(true);
      setTimeout(() => navigate('/login'), 600);
    } catch (err) {
      console.error('Register error:', err);
      const msg = err.response?.data?.message || (err.response?.data?.errors ? Object.values(err.response.data.errors).flat().join('\n') : err.message) || 'Registrasi gagal!';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-3 sm:p-4 overflow-hidden bg-gray-50">
      {/* Background (Animated) */}
      <div className="absolute inset-0 z-0 lg:hidden">
        {backgroundImages.map((img, index) => (
          <div key={index} className={`absolute inset-0 transition-opacity duration-[2000ms] ${index === currentImageIndex ? 'opacity-100' : 'opacity-0'}`} style={{ backgroundImage: `url(${img})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        ))}
        <div className="absolute inset-0 bg-black/40" />
      </div>

      <div className={`bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg w-full max-w-md sm:max-w-4xl flex flex-col lg:flex-row overflow-hidden relative z-10 transition-all duration-500 ${isExiting ? 'opacity-0 scale-95' : 'opacity-100'}`} style={{ maxHeight: '95vh' }}>
        {/* Left Side Panel */}
        <div className="hidden lg:flex lg:w-5/12 relative bg-black">
          <div className="absolute inset-0 z-10">
            {backgroundImages.map((img, index) => (
              <div key={index} className={`absolute inset-0 transition-opacity duration-[2000ms] ${index === currentImageIndex ? 'opacity-100' : 'opacity-0'}`} style={{ backgroundImage: `url(${img})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          </div>
          <div className="relative z-20 flex flex-col justify-between w-full p-6 text-white">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                {schoolSettings.logo && !logoError ? <img src={resolvePhotoUrl(schoolSettings.logo)} className="w-5 h-5 object-contain" onError={() => setLogoError(true)} /> : <span className="text-base font-bold">{schoolSettings.name.charAt(0).toUpperCase()}</span>}
              </div>
              <span className="font-semibold text-xs">{schoolSettings.name}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center"><span className="text-xs">✨</span></div>
              <div><p className="text-xs font-semibold">Bergabung Sekarang</p><p className="text-xs text-gray-300">Buat akun untuk akses penuh</p></div>
            </div>
          </div>
        </div>

        {/* Form Side */}
        <div className="w-full lg:w-7/12 p-5 sm:p-8 flex flex-col">
          <div className="mb-4 flex items-center space-x-2">
            <div className="w-7 h-7 bg-gray-900 rounded-lg flex items-center justify-center"><span className="text-white font-bold text-sm">{schoolSettings.name.charAt(0).toUpperCase()}</span></div>
            <span className="text-base font-bold text-gray-900">{schoolSettings.name}</span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
            <div className="max-w-sm w-full mx-auto">
              <div className="mb-4">
                <h1 className="text-xl font-bold text-gray-900 mb-1">Daftar Akun</h1>
                <p className="text-gray-500 text-xs">Silakan lengkapi profil Anda</p>
              </div>

              {error && <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-3 py-2 rounded-lg mb-3 text-xs whitespace-pre-line">{error}</div>}

              <form onSubmit={handleRegister} className="space-y-3">
                {/* Role Selection */}
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {['siswa', 'guru', 'admin'].map((r) => (
                    <button key={r} type="button" onClick={() => setFormData({ ...formData, role: r })} className={`py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${formData.role === r ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>{r}</button>
                  ))}
                </div>

                {/* Photo Upload Section */}
                <div className="flex items-center gap-4 p-3 bg-blue-50 border border-blue-100 rounded-xl mb-2">
                  <div className="w-14 h-14 rounded-full bg-white border-2 border-blue-200 overflow-hidden flex-shrink-0">
                    {photoPreview ? <img src={photoPreview} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl">👤</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-[10px] font-bold text-blue-900 uppercase mb-1">Foto Profil</label>
                    <input type="file" accept="image/*" onChange={handlePhotoChange} className="w-full text-[10px] file:hidden cursor-pointer" />
                    <p className="text-[10px] text-gray-400 mt-1">Ketuk untuk pilih foto</p>
                  </div>
                </div>

                <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" placeholder="Nama Lengkap *" required />
                <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" placeholder="Email *" required />
                
                {(formData.role === 'siswa' || formData.role === 'guru') && (
                  <>
                    <input type="text" name={formData.role === 'siswa' ? 'nis' : 'nip'} value={formData.role === 'siswa' ? formData.nis : formData.nip} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" placeholder={formData.role === 'siswa' ? "Nomor Induk Siswa (NIS) *" : "Nomor Induk Pegawai (NIP) *"} required />
                    <select name="class_name" value={formData.class_name} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white" required>
                      <option value="">Pilih Kelas *</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <select name="gender" value={formData.gender} onChange={handleChange} className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white" required><option value="">Gender *</option><option value="Laki-laki">Laki-laki</option><option value="Perempuan">Perempuan</option></select>
                      <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" placeholder="No. HP *" required />
                    </div>
                  </>
                )}

                {formData.role === 'siswa' && (
                  <div className="space-y-2">
                    <input type="text" name="parent_name" value={formData.parent_name} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" placeholder="Nama Orang Tua *" required />
                    <input type="tel" name="parent_phone" value={formData.parent_phone} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" placeholder="No. HP Orang Tua *" required />
                  </div>
                )}

                <input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" placeholder="Password (Min 8 Karakter) *" required />
                <input type="password" name="password_confirmation" value={formData.password_confirmation} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" placeholder="Konfirmasi Password *" required />

                <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all disabled:bg-gray-300 text-sm mt-2 shadow-lg active:scale-95">{loading ? 'Memproses...' : 'Daftar Sekarang'}</button>
              </form>
              <p className="mt-4 text-center text-xs text-gray-500">Sudah punya akun? <Link to="/login" className="text-blue-600 font-bold hover:underline">Masuk</Link></p>
            </div>
          </div>
        </div>
      </div>
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }`}</style>
    </div>
  );
};

export default Register;