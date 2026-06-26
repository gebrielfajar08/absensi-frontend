import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

// Helper function to resolve photo URL
const resolvePhotoUrl = (photo, fallbackBase = 'http://127.0.0.1:8000') => {
  if (!photo || typeof photo !== 'string') return null;
  const trimmed = photo.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http') || trimmed.startsWith('data:')) return trimmed;
  const base = api.defaults.baseURL?.replace(/\/api\/?$/, '') || fallbackBase;
  return `${base}/${trimmed.replace(/^\//, '')}`;
};

// Helper functions matching Admin Dashboard
const formatToIndonesiaTime = (utcDate) => {
  if (!utcDate) return '-';
  let input = utcDate;
  if (typeof input !== 'string' && typeof input !== 'number') {
    input = String(input);
  }
  input = input.toString().trim();
  const timeOnlyPattern = /^\d{1,2}:\d{2}(:\d{2})?$/;
  if (timeOnlyPattern.test(input)) {
    const today = new Date();
    const [hour, minute, second] = input.split(':').map(p => Number(p));
    today.setHours(hour || 0, minute || 0, second || 0, 0);
    input = today.toISOString();
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(input)) {
    input = input.replace(' ', 'T');
  }
  const date = new Date(input);
  if (isNaN(date.getTime()) || date.toString() === 'Invalid Date') {
    return utcDate.toString();
  }
  const options = {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };
  try {
    return new Intl.DateTimeFormat('id-ID', options).format(date);
  } catch (err) {
    return utcDate.toString();
  }
};

// Helper matching Admin for robust class name resolution
const resolveClassName = (user, classInfo) => {
  if (user?.class_name) return user.class_name;
  if (user?.kelas) return user.kelas;
  if (classInfo?.name) return classInfo.name;
  if (typeof classInfo === 'string') return classInfo;
  return '-';
};

// ➕ TAMBAHAN: Fungsi retry untuk menangani timeout/koneksi bermasalah
const fetchWithRetry = async (apiCall, maxRetries = 3, delay = 1500) => {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) break;
      // Retry jika error timeout atau masalah jaringan
      if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK' || error.message?.includes('timeout')) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

// ✨ Helper untuk waktu lokal
const getLocalTimestamp = (date) => {
  const pad = (n) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const DashboardSiswa = ({ theme, toggleTheme }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ringkasan');
  const [isExiting, setIsExiting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate();
  const [riwayatMonthFilter, setRiwayatMonthFilter] = useState('');
  const [riwayatStatusFilter, setRiwayatStatusFilter] = useState('');

  // ✨ TAMBAHAN: State untuk media cycling (foto berkedip ganti sendiri)
  const [activePhotoIndex, setActivePhotoIndex] = useState(1);
  useEffect(() => {
    const timer = setInterval(() => setActivePhotoIndex((prev) => (prev % 3) + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  // State data siswa
  const [stats, setStats] = useState({
    totalAttendance: 0,
    presentDays: 0,
    lateDays: 0,
    absentDays: 0,
    percentage: 0,
  });
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [classInfo, setClassInfo] = useState(null);
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [myQRCode, setMyQRCode] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);

  const [attendanceSettings, setAttendanceSettings] = useState({
    schoolName: 'SMPK DON BOSCO',
    schoolLogo: null,
    attendanceStartTime: '07:00',
    attendanceEndTime: '08:00',
    lateThreshold: '08:00',
    schoolEndTime: '15:30',
    dashboardPhoto1: null,
    dashboardPhoto2: null,
    dashboardPhoto3: null,
    dashboardVideo: null,
    limitOneScanPerDay: true,
    disableAttendanceOnHolidays: true,
    attendanceSessionOpen: true,
    startSound: null,
    endSound: null,
    activeDays: 'Senin,Selasa,Rabu,Kamis,Jumat,Sabtu'
  });

  const addNotification = (message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  // ✨ TAMBAHAN: State Event
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (!token || !userStr) {
      navigate('/');
      return;
    }
    try {
      const userData = JSON.parse(userStr);
      if (userData.role !== 'siswa') {
        navigate(`/dashboard/${userData.role}`);
        return;
      }
      setUser(userData);
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/');
    }
  }, [navigate]);

  // Load Settings (Nama & Logo Sekolah) agar sinkron dengan Admin
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/public/settings');
        if (res.data) {
          const settings = res?.data?.data ?? res?.data ?? null;

          if (!settings || typeof settings !== 'object') {
            console.warn('Settings API kosong / salah format:', res);
            return;
          }
          const mappedSettings = {
            schoolName: settings.schoolName || settings.nama_sekolah || 'SMPK DON BOSCO',
            schoolLogo: settings.schoolLogo || settings.logo || settings.logo_url || null,
            dashboardPhoto1: settings.dashboard_photo_1 || settings.dashboardPhoto1 || settings.photo1_url || null,
            dashboardPhoto2: settings.dashboard_photo_2 || settings.dashboardPhoto2 || settings.photo2_url || null,
            dashboardPhoto3: settings.dashboard_photo_3 || settings.dashboardPhoto3 || settings.photo3_url || null,
            dashboardVideo: settings.dashboardVideo || settings.dashboard_video || settings.video_url || null,
            limitOneScanPerDay: settings.limit_one_scan_per_day || settings.limitOneScanPerDay || false,
            disableAttendanceOnHolidays: settings.disableAttendanceOnHolidays ?? settings.disable_attendance_on_holidays ?? true,
            attendanceSessionOpen: settings.attendanceSessionOpen ?? settings.attendance_session_open ?? true,
            startSound: settings.start_sound_url || settings.startSound || null,
            endSound: settings.end_sound_url || settings.endSound || null,
            activeDays: settings.activeDays || settings.active_days || 'Senin,Selasa,Rabu,Kamis,Jumat,Sabtu'
          };
          setAttendanceSettings(mappedSettings);
          localStorage.setItem('school_settings', JSON.stringify(mappedSettings));
        }
      } catch (err) {
        console.error('❌ Settings API gagal:', err?.message || err);
        loadSettings(); // fallback tetap jalan tapi jelas errornya
      }
    };

    const loadSettings = () => {
      const savedSettings = localStorage.getItem('school_settings');
      if (savedSettings) {
        try {
          const settings = JSON.parse(savedSettings);
          setAttendanceSettings({
            schoolName: settings.schoolName || settings.nama_sekolah || 'SMPK DON BOSCO',
            schoolLogo: settings.schoolLogo || settings.logo || null,
            dashboardPhoto1: settings.dashboard_photo_1 || settings.dashboardPhoto1 || null,
            dashboardPhoto2: settings.dashboard_photo_2 || settings.dashboardPhoto2 || null,
            dashboardPhoto3: settings.dashboard_photo_3 || settings.dashboardPhoto3 || null,
            dashboardVideo: settings.dashboardVideo || settings.dashboard_video || null,
            limitOneScanPerDay: settings.limit_one_scan_per_day || settings.limitOneScanPerDay || false,
            disableAttendanceOnHolidays: settings.disableAttendanceOnHolidays ?? settings.disable_attendance_on_holidays ?? true,
            attendanceSessionOpen: settings.attendanceSessionOpen ?? settings.attendance_session_open ?? true,
            startSound: settings.startSound || null,
            endSound: settings.endSound || null,
            activeDays: settings.activeDays || settings.active_days || 'Senin,Selasa,Rabu,Kamis,Jumat,Sabtu'
          });
        } catch (err) {
          console.error("Error parsing settings", err);
        }
      }
    };

    loadSettings(); // Memuat cache segera saat aplikasi dijalankan
    fetchSettings();
    // Listen jika ada perubahan di tab lain (misal admin baru save)
    window.addEventListener('storage', loadSettings);
    return () => window.removeEventListener('storage', loadSettings);
  }, []);

  // ✨ KONFIGURASI BACKGROUND DINAMIS (LANDING STYLE)
  const lakeBackgrounds = [
    'https://images.unsplash.com/photo-1549880338-65ddcdfd017b?w=1280&q=80',
    'https://images.unsplash.com/photo-1500534623283-312aade485b7?w=1280&q=80',
    'https://images.unsplash.com/photo-1476610182048-b716b8518aae?w=1280&q=80',
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1280&q=80'
  ];

  const holidayBackgrounds = {
    '01-01': { name: 'Tahun Baru Masehi', image: 'https://images.unsplash.com/photo-1483721310020-03333e577078?w=1280&q=80' },
    '05-01': { name: 'Hari Buruh Internasional', image: 'https://images.unsplash.com/photo-1514474959185-08fb602660ef?w=1280&q=80' },
    '06-01': { name: 'Hari Lahir Pancasila', image: 'https://images.unsplash.com/photo-1520923302269-6990cb8d0a23?w=1280&q=80' },
    '08-17': { name: 'Hari Kemerdekaan RI', image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=1280&q=80' },
    '11-10': { name: 'Hari Pahlawan', image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1280&q=80' },
    '12-25': { name: 'Hari Raya Natal', image: 'https://images.unsplash.com/photo-1511993226959-0f2ecb18f6a5?w=1280&q=80' }
  };

  const getHolidayInfo = (date) => {
    if (!date) return null;
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return holidayBackgrounds[`${month}-${day}`] || null;
  };

  const getSectionBackground = (date) => {
    const holiday = getHolidayInfo(date);
    if (holiday) return { image: holiday.image, label: holiday.name, isHoliday: true };
    return { image: lakeBackgrounds[date.getDate() % lakeBackgrounds.length], label: 'Hari Biasa', isHoliday: false };
  };

  // ✨ Helper hitung mundur hari (Normalisasi ke Midnight agar akurat)
  const getDaysRemaining = (dateString) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateString);
    target.setHours(0, 0, 0, 0);
    const diffTime = target - today;
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  };

  // Update waktu real-time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 🔊 LOGIKA AUTO-PLAY BEL SEKOLAH (DITAMBAHKAN AGAR SOUND BERFUNGSI DI SISWA)
  const [lastRungMinute, setLastRungMinute] = useState('');

  useEffect(() => {
    const now = new Date();
    const currentMinute = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':');

    if (currentMinute === lastRungMinute) return;

    // Cek Bel Masuk
    if (attendanceSettings.attendanceStartTime && currentMinute === attendanceSettings.attendanceStartTime.substring(0, 5)) {
      if (attendanceSettings.startSound) {
        new Audio(attendanceSettings.startSound).play().catch(e => console.warn("Autoplay bell blocked", e));
        setLastRungMinute(currentMinute);
        addNotification("🔊 Bel Masuk Sekolah Berbunyi!", "info");
      }
    }

    // Cek Bel Pulang
    if (attendanceSettings.schoolEndTime && currentMinute === attendanceSettings.schoolEndTime.substring(0, 5)) {
      if (attendanceSettings.endSound) {
        new Audio(attendanceSettings.endSound).play().catch(e => console.warn("Autoplay bell blocked", e));
        setLastRungMinute(currentMinute);
        addNotification("🔊 Bel Pulang Sekolah Berbunyi!", "info");
      }
    }
  }, [currentTime, attendanceSettings, lastRungMinute]);

  // Fetch data siswa
  useEffect(() => {
    if (user?.id) {
      fetchStudentData();
      generateLocalQRCode();
    }
  }, [user?.id]);

  // ➕ TAMBAHAN: Auto fetch jadwal saat tab aktif
  useEffect(() => {
    if (user && activeTab === 'jadwal') {
      fetchSchedules();
    }
  }, [activeTab, user]);

  // Listen broadcast dari guru dashboard
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'attendance_updated') {
        fetchStudentData(true);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

const fetchStudentData = async (silent = true) => {
  if (!silent) setLoading(true);
  try {
    const token = localStorage.getItem('token');
    
    // ✅ PERBAIKAN: Gabungkan headers jadi satu, jangan duplikat
    const config = { 
      headers: { 
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 120000
    };

    // Tambahkan timestamp untuk menghindari cache
    const timestamp = Date.now();
    
    const results = await Promise.allSettled([
      fetchWithRetry(() => api.get(`/siswa/stats?t=${timestamp}`, config)).catch(e => { console.warn("Stats API fail", e); throw e; }),
      fetchWithRetry(() => api.get(`/siswa/attendance?t=${timestamp}`, config)).catch(e => { console.warn("History API fail", e); throw e; }),
      fetchWithRetry(() => api.get(`/siswa/class?t=${timestamp}`, config)).catch(e => { console.warn("Class API fail", e); throw e; })
    ]);

    const eventRes = await api.get('/public/events', config).catch(() => ({ data: [] }));
    setEvents(Array.isArray(eventRes.data) ? eventRes.data : []);

    const statsData = results[0].status === 'fulfilled' ? results[0].value.data : {};
    setStats({
      totalAttendance: statsData.total_pertemuan || 0,
      presentDays: (statsData.hadir || 0) + (statsData.terlambat || 0),
      lateDays: statsData.terlambat || 0,
      absentDays: statsData.absen || 0,
      izinDays: statsData.izin || 0,
      sakitDays: statsData.sakit || 0,
      percentage: statsData.persentase || 0,
    });

    // ✅ PERBAIKAN: Pastikan data attendance diambil dengan benar
    if (results[1].status === 'fulfilled') {
      const attendanceData = results[1].value.data;
      console.log('📊 Raw attendance data:', attendanceData);
      
      // Handle berbagai format response
      const normalizedData = Array.isArray(attendanceData) 
        ? attendanceData 
        : attendanceData.data || attendanceData.attendances || attendanceData.records || [];
      
      console.log('✅ Normalized attendance data:', normalizedData);
      setAttendanceHistory(normalizedData);
    }
    
    if (results[2].status === 'fulfilled') {
      setClassInfo(results[2].value.data.class);
      setTeacherInfo(results[2].value.data.teacher);
    }
    
  } catch (err) {
    console.error('❌ Gagal mengambil data siswa:', err);
    if (!silent) alert('⚠️ Gagal memuat data. Periksa koneksi server.');
  } finally {
    setLoading(false);
  }
};

  // ➕ TAMBAHAN: Fetch Jadwal Pelajaran
  const fetchSchedules = async () => {
    setScheduleLoading(true);
    try {
      const token = localStorage.getItem('token');
      // Gunakan fetchWithRetry untuk menangani gangguan jaringan/timeout
      const res = await fetchWithRetry(() => api.get('/siswa/schedules', {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      }));
      setSchedules(res.data || []);
    } catch (err) {
      const msg = err.response?.status === 500 ? 'Server Error (Database)' : err.message;
      console.error('❌ Gagal memuat jadwal:', msg);
      setSchedules([]);
    } finally {
      setScheduleLoading(false);
    }
  };

  // Generate QR Code lokal (fallback jika API error)
  const generateLocalQRCode = () => {
    try {
      const qrData = {
        type: 'student_qr',
        nis: user.nis || user.user_id || '',
        user_id: user.nis || user.user_id || '',
        nama: user.name || '',
        name: user.name || '',
        role: user.role || 'siswa',
        generated_at: new Date().toISOString() // Sesuai dengan format Dashboard Admin
      };
      const qrString = JSON.stringify(qrData);
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrString)}`;
      setMyQRCode(qrUrl);
      console.log('✅ QR Code lokal berhasil di-generate');
    } catch (err) {
      console.error('❌ Gagal generate QR Code:', err);
    }
  };

  // Fetch QR Code dari backend (dengan fallback)
  const fetchMyQRCode = async () => {
    setQrLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await api.get('/siswa/qrcode', {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const qrCodeUrl = URL.createObjectURL(res.data);
      setMyQRCode(qrCodeUrl);
      console.log('✅ QR Code dari API berhasil dimuat');
    } catch (err) {
      console.error('❌ Gagal mengambil QR Code dari API, menggunakan fallback:', err);
      generateLocalQRCode();
    } finally {
      setQrLoading(false);
    }
  };

  // Download QR Code
  const downloadQRCode = async () => {
    if (!myQRCode) {
      addNotification('QR Code belum tersedia', 'error');
      return;
    }
    
    try {
      const fileName = `qr-code-${user.nis || user.id}.png`;
      
      // Jika QR dari external URL (api.qrserver.com)
      if (myQRCode.includes('api.qrserver.com')) {
        const response = await fetch(myQRCode);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        // Jika QR dari blob URL
        const link = document.createElement('a');
        link.href = myQRCode;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      
      addNotification('QR Code berhasil diunduh!', 'success');
      console.log('✅ QR Code berhasil diunduh:', fileName);
    } catch (err) {
      console.error('❌ Gagal download QR Code:', err);
      addNotification('Gagal mengunduh QR Code', 'error');
    }
  };

  const handleLogout = () => {
    setIsExiting(true);
    setTimeout(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/');
    }, 600);
  };

  // Format waktu Indonesia
  const formatTime = (date) => {
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const formatDate = (dateInput) => {
    if (!dateInput) return '-';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return dateInput;
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Check if today is a holiday (Sunday)
  const checkIsHoliday = () => {
    if (attendanceSettings.disableAttendanceOnHolidays) {
      const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const currentDay = dayNames[currentTime.getDay()];
      const activeDays = attendanceSettings.activeDays ? attendanceSettings.activeDays.split(',') : ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      return !activeDays.includes(currentDay);
    }
    return false;
  };

  // Helper matching Admin for categorized activity
  const isLateStatus = (status, act) => {
    const s = (status || '').toString().toLowerCase();
    const note = (act?.note || '').toString().toLowerCase();
    return status === 'terlambat' || s.includes('terlambat') || note.includes('terlambat');
  };

  const isOnTimeStatus = (status, act) => {
    const s = (status || '').toString().toLowerCase();
    return ['hadir', 'tepat_waktu', 'on_time', 'present'].includes(s);
  };

  const getLateActivities = () => attendanceHistory.filter(act => isLateStatus(act.status, act));
  const getOnTimeActivities = () => attendanceHistory.filter(act => !isLateStatus(act.status, act) && isOnTimeStatus(act.status, act));


  const statusBadgeClass = (status) => {
    switch (status) {
      case 'hadir':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'terlambat':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'izin':
        return 'bg-sky-100 text-sky-700 border-sky-200';
      case 'sakit':
        return 'bg-violet-100 text-violet-700 border-violet-200';
      case 'pending':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-red-100 text-red-700 border-red-200';
    }
  };

  const statusLabel = (status) => {
    switch (status) {
      case 'hadir':
        return '✓ Hadir';
      case 'terlambat':
        return '⚠ Terlambat';
      case 'izin':
        return '📋 Izin';
      case 'sakit':
        return '🏥 Sakit';
      case 'pending':
        return '⏳ Menunggu';
      case 'alpha':
      case 'absen':
        return '✗ Absen';
      default:
        return status || '-';
    }
  };

  const menuItems = [
    { id: 'ringkasan', label: 'Ringkasan', icon: '📊' },
    { id: 'absensi', label: 'Absensi', icon: '✅' },
    { id: 'jadwal', label: 'Jadwal', icon: '📚' },
    { id: 'riwayat', label: 'Riwayat', icon: '📅' },
    { id: 'profil', label: 'Profil', icon: '👤' },
  ];

  if (loading || !user) {
    return (
      <div className="theme-loader-screen min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="theme-loader-spinner w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="theme-loader-text font-medium">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen bg-white transition-opacity duration-500 flex flex-col overflow-hidden ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
      <div className="flex flex-1 overflow-hidden">
        {/* ✨ Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-[50] lg:hidden backdrop-blur-sm" 
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar - Redesigned to match hugeicons style */}
        <aside className={`fixed lg:static inset-y-0 left-0 z-50 bg-white border-r border-gray-200 flex flex-col shadow-sm transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0 w-72' : sidebarCollapsed ? '-translate-x-full lg:translate-x-0 w-20' : '-translate-x-full lg:translate-x-0 w-72'
        }`}>
          {/* Logo Section */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-50 border border-gray-200 flex items-center justify-center">
                  <img
                    src={attendanceSettings.schoolLogo ? resolvePhotoUrl(attendanceSettings.schoolLogo) : "/logo sekolah.jpeg"}
                    alt="Logo Sekolah"
                    className="w-8 h-8 object-contain"
                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/40/2563eb/ffffff?text=S'; }}
                  />
                </div>
                {!sidebarCollapsed && (
                  <div>
                    <h1 className="text-lg font-bold text-gray-900 leading-tight">
                      {attendanceSettings.schoolName || 'SMPK DON BOSCO'}
                    </h1>
                  </div>
                )}
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 p-4 overflow-y-auto">
            <div className="mb-2">
              {!sidebarCollapsed && (
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">MENU</div>
              )}
              <div className="space-y-1">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                    className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-3 py-3' : 'gap-3 px-3 py-2.5'} rounded-lg text-left transition-all duration-200 ${
                      activeTab === item.id
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    title={sidebarCollapsed ? item.label : ""}
                  >
                    <span className="text-xl flex-shrink-0">{item.icon}</span>
                    {!sidebarCollapsed && (
                      <span className="text-sm font-medium flex-1">{item.label}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </nav>

          {/* Bottom Section - User Profile & Logout */}
          <div className="p-4 border-t border-gray-100">
            {!sidebarCollapsed && (
              <div className="mb-3 bg-gray-50 rounded-xl p-3 border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm flex-shrink-0 border border-gray-200 overflow-hidden">
                    <img
                      src={resolvePhotoUrl(user.photo) || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email || 'Siswa')}&background=3b82f6&color=ffffff`}
                      alt="User Avatar"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email || 'Siswa')}&background=3b82f6&color=ffffff`; }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate" title={user.name}>{user.name || 'Siswa'}</p>
                    <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                      🧑‍🎓 Siswa
                    </span>
                  </div>
                </div>
              </div>
            )}
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-3 py-3' : 'gap-3 px-3 py-2.5'} text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all text-sm font-medium border border-transparent hover:border-red-200`}
              title="Keluar"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {!sidebarCollapsed && <span className="flex-1 text-left">Keluar</span>}
            </button>
          </div>
        </aside>

        {/* Main UI Column */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* ✨ TOAST NOTIFICATION CONTAINER (RIGHT TOP) */}
          <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-[calc(100%-2rem)] sm:w-72 max-w-[18rem] pointer-events-none">
            {notifications.map((n) => (
              <div key={n.id} className={`pointer-events-auto flex items-center p-4 rounded-xl shadow-2xl border-l-4 transform transition-all duration-300 animate-slide-in-right ${
                n.type === 'success' ? 'bg-white border-emerald-500 text-emerald-800' :
                n.type === 'error' ? 'bg-white border-red-500 text-red-800' :
                n.type === 'warning' ? 'bg-white border-amber-500 text-amber-800' :
                'bg-white border-blue-500 text-blue-800'
              }`}>
                <div className="flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider mb-0.5">{n.type === 'success' ? 'Berhasil' : n.type === 'error' ? 'Error' : 'Info'}</p>
                  <p className="text-sm opacity-90">{n.message}</p>
                </div>
                <button onClick={() => setNotifications(prev => prev.filter(i => i.id !== n.id))} className="ml-2 text-gray-400 hover:text-gray-600">✕</button>
              </div>
            ))}
          </div>

          <style>{`
            @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            .animate-slide-in-right { animation: slideInRight 0.3s ease-out; }
          `}</style>

          {attendanceSettings.attendanceSessionOpen === false && (
            <div className="bg-amber-100 border-b-2 border-amber-300 px-4 py-2 text-center text-sm text-amber-900 flex-shrink-0">
              Sesi absensi sedang ditutup oleh administrator. Absensi QR/manual tidak dapat dilakukan hingga dibuka kembali.
            </div>
          )}

          {/* Header */}
          <header className="bg-white border-b-2 border-blue-100 sticky top-0 z-40 shadow-sm h-[70px] flex items-center w-full transition-all duration-300 flex-shrink-0">
            <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                {/* ✨ TOMBOL HAMBURGER UNTUK MEMBUKA SIDEBAR */}
                <button
                  onClick={() => {
                    if (window.innerWidth >= 1024) {
                      setSidebarCollapsed(prev => !prev);
                    } else {
                      setSidebarOpen(true);
                    }
                  }}
                  className="p-2 text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all"
                  title="Toggle Sidebar"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>

                {/* ✨ Judul dinamis mengikuti fitur yang diklik */}
                <h1 className="text-lg md:text-xl font-bold text-blue-900 tracking-tight ml-2">
                  {menuItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
                </h1>
              </div>

              <div className="flex items-center gap-2 md:gap-6">
                <div className="flex flex-col items-end border-l-2 border-blue-50 pl-3 md:pl-6">
                  <p className="hidden md:block text-[11px] font-bold text-blue-400 uppercase tracking-widest leading-none mb-1">
                    {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  <p className="text-sm md:text-lg font-black text-blue-900 font-mono leading-none">
                    {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="p-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-all"
                  aria-label="Toggle tema"
                >
                  {theme === 'dark' ? '🌙' : '☀️'}
                </button>
              </div>
            </div>
          </header>

          {(loading || scheduleLoading || qrLoading) && (
            <div className="theme-loader-overlay fixed top-[70px] inset-x-0 bottom-0 z-30 flex items-center justify-center backdrop-blur-sm">
              <div className="text-center">
                <div className="theme-loader-spinner animate-spin rounded-full h-12 w-12 border-4 mx-auto mb-4"></div>
                <p className="theme-loader-text text-base font-bold">Memuat</p>
              </div>
            </div>
          )}

          {/* Page Content Area - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-8 responsive-container">
            <div className="max-w-7xl mx-auto w-full">
            <div className="animate-fade-in">
              {/* TAB: Ringkasan */}
              {activeTab === 'ringkasan' && (
                <div className="space-y-6">
                  {/* ✨ BANNER SELAMAT DATANG (Paling Atas) */}
<div className="bg-blue-600 border-2 border-blue-400 rounded-3xl p-3 sm:p-6 mb-2 shadow-lg flex flex-row items-center gap-3 sm:gap-5 relative overflow-hidden transition-all hover:border-blue-300">
  {/* Ornamen Dekoratif */}
  <div className="absolute right-0 top-0 w-32 h-full bg-white/10 -skew-x-12 translate-x-16 pointer-events-none"></div>
  <div className="absolute right-10 top-1/2 -translate-y-1/2 opacity-10 pointer-events-none hidden md:block">
    <span className="text-8xl">
      {user?.gender === 'Laki-laki' || user?.gender === 'L' ? '👨‍🎓' : 
       user?.gender === 'Perempuan' || user?.gender === 'P' ? '👩‍🎓' : '🧑‍🎓'}
    </span>
  </div>

  <div className="relative z-10 flex-shrink-0">
    <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 sm:border-4 border-white shadow-md bg-white">
      <img
        src={resolvePhotoUrl(user?.photo) || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Siswa')}&background=3b82f6&color=ffffff`}
        alt="Profile"
        className="w-full h-full object-cover"
      />
    </div>
  </div>
  
  <div className="text-left relative z-10">
    <h2 className="text-sm sm:text-xl lg:text-2xl font-black text-white leading-tight">
      Halo, {user?.name}! {
        user?.gender === 'Laki-laki' || user?.gender === 'L' ? '👋' : 
        user?.gender === 'Perempuan' || user?.gender === 'P' ? '👋' : '👋'
      }
    </h2>
    <p className="text-blue-100 text-[10px] sm:text-sm mt-0.5 sm:mt-1 font-medium">
      {user?.gender === 'Laki-laki' || user?.gender === 'L' 
        ? 'Tetap semangat belajar ya, Bro! Jangan lupa untuk selalu disiplin dalam presensi.' 
        : user?.gender === 'Perempuan' || user?.gender === 'P'
        ? 'Tetap semangat belajar ya, Sis! Jangan lupa untuk selalu disiplin dalam presensi.'
        : 'Tetap semangat belajar ya! Jangan lupa untuk selalu disiplin dalam presensi.'}
    </p>
  </div>
</div>

                  {/* 📅 Grid Kalender & Event (Sama dengan Admin) */}
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-2">
                  {(() => {
                    const sectionBg = getSectionBackground(currentTime);
                    return (
                        <div className="relative overflow-hidden rounded-2xl border-2 border-blue-100 p-3 sm:p-5 text-white shadow-lg flex flex-col justify-center min-h-[160px] sm:min-h-[220px]"
                          style={{ backgroundImage: `linear-gradient(rgba(15,23,42,0.75), rgba(15,23,42,0.65)), url(${sectionBg.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                        <div className="relative">
                            <p className="text-[8px] sm:text-[10px] uppercase tracking-[0.2em] text-blue-200/90 mb-1 sm:mb-2 font-black">{sectionBg.isHoliday ? `HARI BESAR: ${sectionBg.label}` : sectionBg.label}</p>
                            <h3 className="text-xs sm:text-lg md:text-xl font-black mb-1 tracking-tight">{currentTime.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}</h3>
                            <div className="inline-flex items-center gap-1.5 sm:gap-3 rounded-full bg-white/10 backdrop-blur-md px-2 sm:px-4 py-1 sm:py-1.5 text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.15em] text-white border border-white/20 mt-2 sm:mt-4">
                              <span>{currentTime.getFullYear()}</span>
                              <span className="inline-block h-1 w-1 rounded-full bg-blue-400" />
                              <span>{currentTime.getDate()} {new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(currentTime)}</span>
                            </div>
                        </div>
                      </div>
                    );
                  })()}

                    <div className="bg-green-800 rounded-2xl border-2 border-green-700 p-3 sm:p-4 shadow-lg flex flex-col min-h-[160px] sm:min-h-[220px]">
                      <h3 className="font-black text-white mb-3 flex items-center justify-between text-[10px] uppercase tracking-wider">
                        <span className="flex items-center gap-2">📅 Agenda & Event</span>
                        <span className="text-[10px] bg-white text-green-800 px-2 py-0.5 rounded-full border border-green-200 font-bold">{events.length} Hari Besar</span>
                      </h3>
                      <div className="flex-1">
                        {events.length > 0 ? (
                          (() => {
                            const sortedUpcoming = [...events].filter(e => getDaysRemaining(e.date) >= 0).sort((a, b) => new Date(a.date) - new Date(b.date));
                            if (sortedUpcoming.length === 0) return (
                              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <span className="text-2xl mb-1 opacity-20">📅</span>
                                <p className="text-[10px] font-bold uppercase">Belum ada agenda</p>
                              </div>
                            );
                            const mainEvent = sortedUpcoming[0];
                            const otherEvents = sortedUpcoming.slice(1);
                            const days = getDaysRemaining(mainEvent.date);
                            return (
                              <div className="flex flex-col h-full">
                                <div className="relative bg-gray-300 rounded-xl border border-blue-100 overflow-hidden mb-3">
                                  <img src={resolvePhotoUrl(mainEvent.image)} alt={mainEvent.title} className="w-full h-24 sm:h-40 object-contain bg-gray-300" onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/400x200/cccccc/ffffff?text=AGENDA'; }} />
                                  <div className="p-3 bg-white/80 backdrop-blur-sm border-t border-blue-50">
                                    <div className="flex justify-between items-center">
                                      <h4 className="font-black text-blue-900 text-[10px] sm:text-xs uppercase truncate pr-2">{mainEvent.title}</h4>
                                      <span className={`${days === 0 ? 'bg-red-600' : 'bg-blue-600'} text-white text-[8px] font-black px-2 py-0.5 rounded-full shadow-sm`}>{days === 0 ? 'HARI INI' : `H-${days}`}</span>
                                    </div>
                                  </div>
                                </div>
                                {otherEvents.length > 0 && (
                                  <div className="mt-auto flex items-center gap-2 pt-2 border-t border-blue-50">
                                    <span className="text-[10px] font-black text-slate-400 uppercase">Lainnya:</span>
                                    <div className="flex -space-x-2 overflow-hidden">
                                      {otherEvents.map((event) => (
                                        <img key={event.id} src={resolvePhotoUrl(event.image)} className="w-8 h-8 rounded-full border-2 border-white object-cover shadow-sm bg-white" title={event.title} />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })() 
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <span className="text-2xl mb-1 opacity-20">📅</span>
                            <p className="text-[10px] font-bold uppercase">Belum ada agenda</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Seksi Media & Kegiatan (Simple Style) */}
                  {loading ? (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      {[1,2,3,4].map((i) => (
                        <div key={i} className="bg-white rounded-xl p-5 border-2 border-blue-200 animate-pulse">
                          <div className="h-4 bg-blue-200 rounded w-20 mb-3"></div>
                          <div className="h-8 bg-blue-200 rounded w-12"></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6 overflow-hidden">
                      {[
                        { label: 'Total', value: stats.totalAttendance, color: 'indigo', icon: '📅' },
                        { label: 'Hadir', value: stats.presentDays, color: 'emerald', icon: '✓' },
                        { label: 'Terlambat', value: stats.lateDays, color: 'amber', icon: '⚠' },
                        { label: 'Izin', value: stats.izinDays, color: 'sky', icon: '📋' },
                        { label: 'Sakit', value: stats.sakitDays, color: 'violet', icon: '🏥' },
                        { label: 'Absen', value: stats.absentDays, color: 'rose', icon: '✗' },
                      ].map((stat, idx) => (
                      <div key={idx} className={`rounded-2xl p-4 md:p-5 border-2 shadow-md hover:shadow-xl transition-all group ${
                        stat.color === 'indigo' ? 'bg-indigo-600 border-indigo-400' :
                        stat.color === 'emerald' ? 'bg-emerald-600 border-emerald-400' :
                        stat.color === 'amber' ? 'bg-amber-500 border-amber-300' :
                        stat.color === 'sky' ? 'bg-sky-500 border-sky-300' :
                        stat.color === 'violet' ? 'bg-violet-600 border-violet-400' :
                        'bg-rose-600 border-rose-400'
                      }`}>
                        <div className="flex items-center justify-between mb-1 md:mb-3">
                          <span className="text-lg md:text-2xl group-hover:scale-110 transition-transform">{stat.icon}</span>
                          <span className={`hidden md:block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter bg-white/20 text-white border border-white/30`}>
                            Semester Ini
                          </span>
                        </div>
                        <p className="text-xs md:text-3xl font-black text-white">{stat.value}</p>
                        <p className="text-white/90 text-[10px] md:text-sm mt-0.5 md:mt-1 truncate font-bold leading-tight">{stat.label}</p>
                      </div>
                      ))}
                    </div>
                  )}

                  <div className="bg-white rounded-xl border-2 border-blue-200 p-6 mb-6 shadow-lg">
                    <h3 className="font-semibold text-blue-800 mb-4">Progress Kehadiran</h3>
                    <div className="flex flex-row items-center gap-4 sm:gap-8">
                      <div className="relative w-20 h-20 sm:w-32 sm:h-32 group flex-shrink-0">
                        {/* ✨ Lingkaran Progres dengan Warna Dinamis */}
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="15.9155" fill="none" className="text-slate-100" stroke="currentColor" strokeWidth="3.5" />
                          <circle
                            cx="18"
                            cy="18"
                            r="15.9155"
                            fill="none"
                            className={`${stats.percentage >= 80 ? 'text-emerald-500' : stats.percentage >= 60 ? 'text-amber-500' : 'text-rose-500'} transition-all duration-1000 ease-out`}
                            stroke="currentColor"
                            strokeWidth="3.5"
                            strokeDasharray={`${stats.percentage}, 100`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className={`text-sm sm:text-2xl font-black ${stats.percentage >= 80 ? 'text-emerald-600' : stats.percentage >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {Math.round(stats.percentage)}%
                          </span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Hadir</span>
                        </div>
                      </div>
                      <div className="flex-1 w-full">
                        <p className="text-xs sm:text-sm text-blue-600 mb-2">
                          Kamu hadir <span className="font-bold text-blue-600">{stats.presentDays}</span> dari <span className="font-bold">{stats.totalAttendance}</span> pertemuan
                        </p>
                        <div className="space-y-1 sm:space-y-2 text-xs sm:text-sm">
                          <div className="flex justify-between">
                            <span className="flex items-center gap-2"><span className="w-3 h-3 bg-emerald-500 rounded-full"></span> Hadir</span>
                            <span className="font-medium">{stats.presentDays}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="flex items-center gap-2"><span className="w-3 h-3 bg-amber-500 rounded-full"></span> Terlambat</span>
                            <span className="font-medium">{stats.lateDays}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="flex items-center gap-2"><span className="w-3 h-3 bg-sky-500 rounded-full"></span> Izin</span>
                            <span className="font-medium">{stats.izinDays}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="flex items-center gap-2"><span className="w-3 h-3 bg-violet-500 rounded-full"></span> Sakit</span>
                            <span className="font-medium">{stats.sakitDays}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="flex items-center gap-2"><span className="w-3 h-3 bg-rose-500 rounded-full"></span> Absen</span>
                            <span className="font-medium">{stats.absentDays}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border-2 border-blue-200 shadow-lg">
                    <div className="px-6 py-4 border-b-2 border-blue-100 flex justify-between items-center">
                      <h3 className="font-semibold text-blue-800">5 Absensi Terakhir</h3>
                      <button onClick={() => setActiveTab('riwayat')} className="text-xs text-blue-600 hover:underline">Lihat Semua →</button>
                    </div>
                    <div className="divide-y-2 divide-blue-50">
                      {loading ? (
                        <div className="p-6 text-center text-blue-600">Memuat...</div>
                      ) : attendanceHistory.length === 0 ? (
                        <div className="p-6 text-center text-blue-600">
                          <p className="text-3xl mb-2">📭</p>
                          <p>Belum ada data absensi</p>
                        </div>
                      ) : (
                        attendanceHistory.slice(0, 5).map((item) => (
                          <div key={item.id} className="p-4 flex items-center justify-between">
                            <div>
                              <p className="font-medium text-blue-800">{formatDate(item.date)}</p>
                              <p className="text-sm text-blue-600">{classInfo?.name}</p>
                            </div>
                            <span className={`px-3 py-1 text-xs font-bold rounded-full border-2 ${statusBadgeClass(item.status)}`}>
                              {statusLabel(item.status)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Seksi Media (Sama dengan Admin) */}
                  <div className="bg-green-800 rounded-2xl border-2 border-green-700 p-5 shadow-md mt-2">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-sm"><span>🖼️</span> Media & Kegiatan Sekolah</h3>
                    <div className="grid grid-cols-2 gap-3 sm:gap-6">
                      <div className="overflow-hidden relative w-full aspect-video rounded-xl border-2 border-blue-100 bg-slate-900/50 shadow-inner">
                        <div key={activePhotoIndex} className="animate-fade-in w-full h-full">
                          {attendanceSettings[`dashboardPhoto${activePhotoIndex}`] ? (
                            <img src={resolvePhotoUrl(attendanceSettings[`dashboardPhoto${activePhotoIndex}`])} alt={`Sekolah ${activePhotoIndex}`} className="w-full h-full object-cover" />
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                              <span className="text-lg sm:text-xl">📸</span>
                              <p className="text-[10px] mt-1 font-medium">Foto {activePhotoIndex}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="rounded-xl overflow-hidden border-2 border-blue-50 bg-black shadow-inner aspect-video">
                        {attendanceSettings.dashboardVideo ? (
                          <video src={resolvePhotoUrl(attendanceSettings.dashboardVideo)} controls className="w-full h-full object-contain" />
                        ) : (
                          <div className="h-full min-h-[100px] sm:min-h-[160px] bg-slate-900 flex flex-col items-center justify-center text-slate-500">
                            <span className="text-lg sm:text-2xl">🎥</span>
                            <p className="text-[10px] mt-1">Belum ada video terbaru</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

{/* TAB: Absensi */}
{activeTab === 'absensi' && (
  <div className="animate-fade-in space-y-6">
    {/* 🎨 Hero Header */}
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-6 md:p-8 shadow-2xl">
      <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
      <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-pink-300/20 rounded-full blur-3xl"></div>
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full border border-white/30 mb-3">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
            <span className="text-[10px] font-black text-white uppercase tracking-widest">Aktif</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white mb-1 tracking-tight">
            🪪 Kartu Presensi Digital
          </h2>
          <p className="text-blue-100 text-sm md:text-base">Scan QR Code untuk mencatat kehadiran</p>
        </div>
        <button 
          onClick={downloadQRCode}
          className="px-6 py-3 bg-white text-blue-600 rounded-2xl text-sm font-black hover:bg-blue-50 transition-all shadow-xl hover:shadow-2xl flex items-center gap-2 border-2 border-white"
        >
          <span className="text-lg">📥</span>
          <span className="uppercase tracking-wider">Unduh QR</span>
        </button>
      </div>
    </div>

    <div className="max-w-5xl mx-auto">
      {/* 🎯 Main QR Card */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border-2 border-slate-100 dark:border-slate-700 shadow-2xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          
          {/* Kiri: QR Code Area dengan Background Pattern */}
          <div className="relative p-8 md:p-12 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-700 dark:to-slate-800 flex flex-col items-center justify-center border-b-2 lg:border-b-0 lg:border-r-2 border-slate-100 dark:border-slate-700">
            {/* Decorative dots */}
            <div className="absolute inset-0 opacity-5 dark:opacity-10" style={{
              backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }}></div>
            
            <div className="relative z-10 flex flex-col items-center">
              {/* QR Frame dengan Glow Effect */}
              <div className="relative group">
                {/* Outer glow ring */}
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-[2rem] blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-500"></div>
                
                {/* Main QR Container */}
                <div className="relative bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-2xl border-4 border-white dark:border-slate-800 group-hover:scale-105 transition-transform duration-500">
                  {/* Corner decorations */}
                  <div className="absolute top-2 left-2 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
                  <div className="absolute top-2 right-2 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
                  <div className="absolute bottom-2 left-2 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
                  <div className="absolute bottom-2 right-2 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></div>
                  
                  {/* QR Code */}
                  {qrLoading ? (
                    <div className="w-56 h-56 flex items-center justify-center">
                      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : (
                    <img src={myQRCode} alt="QR Saya" className="w-56 h-56 object-contain" />
                  )}
                </div>
              </div>

              {/* Label di bawah QR */}
              <div className="mt-6 text-center">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em]">
                  Scan untuk Presensi
                </p>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <div className="h-px w-8 bg-gradient-to-r from-transparent to-blue-300 dark:to-blue-600"></div>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">KARTU DIGITAL</span>
                  <div className="h-px w-8 bg-gradient-to-l from-transparent to-blue-300 dark:to-blue-600"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Kanan: Info Detail */}
          <div className="p-8 md:p-10 flex flex-col">
            <div className="mb-6">
              <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Informasi Siswa
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Data yang terdaftar di sistem
              </p>
            </div>

            {/* Info Cards */}
            <div className="space-y-3 flex-1">
              {/* Nama */}
              <div className="group relative overflow-hidden bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-700 dark:to-slate-700 rounded-2xl p-4 border-2 border-blue-100 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-600 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white dark:bg-slate-600 rounded-xl flex items-center justify-center text-lg shadow-sm border border-blue-100 dark:border-slate-500 flex-shrink-0">
                    👤
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Nama Lengkap</p>
                    <p className="text-base font-bold text-slate-800 dark:text-slate-100 truncate">{user.name || '-'}</p>
                  </div>
                </div>
              </div>

              {/* NIS */}
              <div className="group relative overflow-hidden bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-slate-700 dark:to-slate-700 rounded-2xl p-4 border-2 border-emerald-100 dark:border-slate-600 hover:border-emerald-300 dark:hover:border-emerald-600 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white dark:bg-slate-600 rounded-xl flex items-center justify-center text-lg shadow-sm border border-emerald-100 dark:border-slate-500 flex-shrink-0">
                    🆔
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Nomor Induk Siswa</p>
                    <p className="text-base font-black text-emerald-700 dark:text-emerald-300 font-mono">{user.nis || user.user_id || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Kelas */}
              <div className="group relative overflow-hidden bg-gradient-to-r from-violet-50 to-purple-50 dark:from-slate-700 dark:to-slate-700 rounded-2xl p-4 border-2 border-violet-100 dark:border-slate-600 hover:border-violet-300 dark:hover:border-violet-600 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white dark:bg-slate-600 rounded-xl flex items-center justify-center text-lg shadow-sm border border-violet-100 dark:border-slate-500 flex-shrink-0">
                    🏫
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest">Kelas</p>
                    <p className="text-base font-bold text-slate-800 dark:text-slate-100">
                      {typeof resolveClassName === 'function' ? resolveClassName(user, classInfo) : (user.class_name || user.kelas || '-')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Role Badge */}
              <div className="flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 dark:from-slate-700 dark:to-slate-700 rounded-2xl p-4 border-2 border-amber-100 dark:border-slate-600">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white dark:bg-slate-600 rounded-xl flex items-center justify-center text-lg shadow-sm border border-amber-100 dark:border-slate-500">
                    🎓
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Status</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Peserta Didik Aktif</p>
                  </div>
                </div>
                <span className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] font-black rounded-full uppercase tracking-wider shadow-md">
                  ✓ Aktif
                </span>
              </div>
            </div>

            {/* Download Button - Main CTA */}
            <button 
              onClick={downloadQRCode}
              className="mt-6 w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black rounded-2xl transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-blue-500/30 flex items-center justify-center gap-3 uppercase tracking-widest text-sm group"
            >
              <span className="text-xl group-hover:scale-110 transition-transform">📥</span>
              <span>Unduh Kartu QR</span>
            </button>
          </div>
        </div>
      </div>

      {/* 💡 Tips Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-amber-200 dark:border-amber-800/50 rounded-2xl p-5 flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center text-xl shadow-lg flex-shrink-0">
            💡
          </div>
          <div>
            <p className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wide mb-1">Tips Offline</p>
            <p className="text-xs text-amber-800 dark:text-amber-100 leading-relaxed font-medium">
              Simpan QR Code ke galeri HP agar tetap bisa presensi meski tanpa internet.
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800/50 rounded-2xl p-5 flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center text-xl shadow-lg flex-shrink-0">
            🔒
          </div>
          <div>
            <p className="text-xs font-black text-blue-900 dark:text-blue-200 uppercase tracking-wide mb-1">Keamanan</p>
            <p className="text-xs text-blue-800 dark:text-blue-100 leading-relaxed font-medium">
              Jangan bagikan QR Code ini kepada orang lain karena bersifat pribadi.
            </p>
          </div>
        </div>
      </div>

      {/* 📊 Quick Stats */}
      <div className="mt-6 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-slate-700 p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <span className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white text-sm shadow-md">📊</span>
            Statistik Kehadiran
          </h4>
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">Bulan Ini</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Hadir', value: typeof attendanceHistory !== 'undefined' ? attendanceHistory.filter(a => a.status === 'hadir').length : 0, icon: '✓', color: 'emerald' },
            { label: 'Terlambat', value: typeof attendanceHistory !== 'undefined' ? attendanceHistory.filter(a => a.status === 'terlambat').length : 0, icon: '⚠', color: 'amber' },
            { label: 'Izin', value: typeof attendanceHistory !== 'undefined' ? attendanceHistory.filter(a => a.status === 'izin').length : 0, icon: '📋', color: 'sky' },
            { label: 'Sakit', value: typeof attendanceHistory !== 'undefined' ? attendanceHistory.filter(a => a.status === 'sakit').length : 0, icon: '🏥', color: 'violet' },
          ].map((stat, idx) => (
            <div key={idx} className={`bg-gradient-to-br ${
              stat.color === 'emerald' ? 'from-emerald-500 to-teal-600' :
              stat.color === 'amber' ? 'from-amber-500 to-orange-600' :
              stat.color === 'sky' ? 'from-sky-500 to-blue-600' :
              'from-violet-500 to-purple-600'
            } rounded-xl p-3 text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-lg">{stat.icon}</span>
                <span className="text-[8px] font-bold bg-white/20 px-1.5 py-0.5 rounded-full uppercase">{stat.label}</span>
              </div>
              <p className="text-2xl font-black">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)}

              {/* TAB: Jadwal Pelajaran */}
              {activeTab === 'jadwal' && (
                <div className="animate-fade-in">
                  <div className="bg-white rounded-xl border-2 border-blue-200 p-6 mb-6 shadow-lg">
                    <h2 className="text-xl font-bold text-blue-800 mb-1">📚 Jadwal Pelajaran</h2>
                    <p className="text-blue-600 text-sm">Kegiatan belajar mengajar kelas {classInfo?.name || user?.class_name || '-'}</p>
                  </div>
                  
                  {scheduleLoading ? (
                    <div className="bg-white rounded-2xl border-2 border-blue-100 p-20 text-center shadow-lg">
                      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-blue-600 font-bold">Sinkronisasi jadwal dengan Wali Kelas...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-10">
                      {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map(day => {
                        const daySchedules = schedules.filter(s => s.day === day);
                        const isToday = new Date().toLocaleDateString('id-ID', { weekday: 'long' }) === day;
                        
                        return (
                          <div key={day} className={`bg-white rounded-2xl border-2 shadow-md overflow-hidden flex flex-col hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 ${isToday ? 'border-blue-500 ring-2 ring-blue-200' : 'border-blue-100'}`}>
                            <div className={`px-5 py-3 font-bold flex items-center justify-between ${isToday ? 'bg-blue-600 text-white' : 'bg-slate-50 text-blue-800 border-b-2 border-blue-50'}`}>
                              <span className="flex items-center gap-2">
                                {isToday && <span className="w-2 h-2 bg-white rounded-full animate-ping"></span>}
                                {day}
                              </span>
                              <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase ${isToday ? 'bg-white/20' : 'bg-blue-100 text-blue-600'}`}>
                                {daySchedules.length} Mapel
                              </span>
                            </div>
                            <div className="p-4 flex-1 bg-white">
                              {daySchedules.length === 0 ? (
                                <div className="h-24 flex flex-col items-center justify-center text-slate-400 text-xs italic">
                                  <span className="text-xl mb-1 opacity-50">☕</span>
                                  <span>Libur / Tidak ada mapel</span>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {daySchedules.map((s, idx) => (
                                    <div key={idx} className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl hover:bg-blue-50 transition-colors group">
                                      <p className="font-bold text-blue-900 text-sm group-hover:text-blue-600">{s.subject_name}</p>
                                      <div className="flex items-center justify-between mt-1">
                                        <p className="text-[10px] text-blue-500 font-semibold flex items-center gap-1">
                                          <span>🕒</span> {s.start_time} - {s.end_time}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

{/* TAB: Profil Saya - Modern Redesign with Dark Mode */}
{activeTab === 'profil' && (
  <div className="animate-fade-in space-y-6">
    {/* 🎨 Hero Profile Card */}
    <div className="relative overflow-hidden rounded-3xl shadow-2xl">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.15),_transparent_50%)]"></div>
      <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
      <div className="absolute -top-10 -left-10 w-48 h-48 bg-pink-300/20 rounded-full blur-3xl"></div>

      {/* Content */}
      <div className="relative z-10 p-8 md:p-10">
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Avatar dengan ring decoration */}
          <div className="relative">
            {/* Outer glow ring */}
            <div className="absolute -inset-2 bg-gradient-to-r from-yellow-300 via-pink-300 to-blue-300 rounded-full blur-md opacity-60"></div>
            {/* Main avatar */}
            <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full bg-white dark:bg-slate-800 p-1.5 shadow-2xl">
              <div className="w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center border-4 border-white dark:border-slate-800">
                {user.photo ? (
                  <img src={resolvePhotoUrl(user.photo)} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl md:text-6xl font-black bg-gradient-to-br from-blue-500 to-purple-600 bg-clip-text text-transparent">
                    {user.name?.charAt(0) || 'S'}
                  </span>
                )}
              </div>
            </div>
            {/* Status badge */}
            <div className="absolute bottom-2 right-2 w-8 h-8 bg-emerald-500 rounded-full border-4 border-white dark:border-slate-800 flex items-center justify-center shadow-lg">
              <span className="text-white text-xs font-black">✓</span>
            </div>
          </div>

          {/* Name & Info */}
          <div className="text-center md:text-left flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full border border-white/30 mb-3">
              <span className="text-xs font-black text-white uppercase tracking-widest">
                {user.role || 'Siswa'}
              </span>
              <span className="w-1 h-1 bg-white rounded-full"></span>
              <span className="text-xs text-white/80 font-medium">Aktif</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-2 drop-shadow-sm">
              {user.name || 'Siswa'}
            </h2>
            <p className="text-blue-100 text-base md:text-lg font-medium mb-4">
              {resolveClassName(user, classInfo) || '-'}
            </p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-xl border border-white/20">
                <span className="text-sm">📧</span>
                <span className="text-xs font-bold text-white truncate max-w-[180px]">
                  {user.email || '-'}
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-xl border border-white/20">
                <span className="text-sm">🆔</span>
                <span className="text-xs font-black text-white font-mono">
                  {user.nis || user.user_id || '-'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* 📊 Quick Stats - 4 Kartu Statistik */}
    {(() => {
      const history = typeof attendanceHistory !== 'undefined' ? attendanceHistory : [];
      const totalHadir = history.filter(a => ['hadir', 'tepat_waktu'].includes((a.status || '').toLowerCase())).length;
      const totalTerlambat = history.filter(a => ['terlambat', 'late'].includes((a.status || '').toLowerCase())).length;
      const totalIzin = history.filter(a => ['izin', 'sakit'].includes((a.status || '').toLowerCase())).length;
      const total = history.length;
      const percent = total > 0 ? Math.round(((totalHadir + totalTerlambat) / total) * 100) : 0;

      const stats = [
        { label: 'Total Hadir', value: totalHadir, icon: '✓', color: 'emerald', gradient: 'from-emerald-500 to-teal-600' },
        { label: 'Terlambat', value: totalTerlambat, icon: '⚠', color: 'amber', gradient: 'from-amber-500 to-orange-600' },
        { label: 'Izin/Sakit', value: totalIzin, icon: '📋', color: 'sky', gradient: 'from-sky-500 to-blue-600' },
        { label: 'Kehadiran', value: `${percent}%`, icon: '📈', color: 'violet', gradient: 'from-violet-500 to-purple-600' },
      ];

      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${stat.gradient} p-5 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group`}
            >
              <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-xl border border-white/30">
                    {stat.icon}
                  </div>
                  <span className="text-[9px] font-black text-white/80 uppercase tracking-widest">
                    {stat.label}
                  </span>
                </div>
                <p className="text-3xl md:text-4xl font-black text-white">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      );
    })()}

    {/* 📋 Detail Information - Two Column Layout */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Main Info - 2 Columns */}
      <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-slate-700 shadow-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-700 dark:to-slate-700 border-b-2 border-blue-100 dark:border-slate-600 flex items-center justify-between">
          <h3 className="font-black text-blue-900 dark:text-blue-200 flex items-center gap-2 text-sm uppercase tracking-wider">
            <span className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white text-sm shadow-md">
              👤
            </span>
            Informasi Pribadi
          </h3>
          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-600 px-2.5 py-1 rounded-full border border-blue-200 dark:border-slate-500">
            DATA RESMI
          </span>
        </div>

        {/* Content Grid */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Nama Lengkap', value: user.name, icon: '👤', accent: 'blue' },
              { label: 'Email', value: user.email, icon: '📧', accent: 'indigo' },
              { label: 'NIS / ID Siswa', value: user.nis || user.user_id, icon: '🆔', accent: 'purple' },
              { label: 'Kelas', value: resolveClassName(user, classInfo), icon: '🏫', accent: 'emerald' },
              { label: 'Jenis Kelamin', value: user.gender, icon: '⚧', accent: 'pink' },
              { label: 'No. Telepon', value: user.phone, icon: '📱', accent: 'sky' },
            ].map((item, idx) => {
              const accentMap = {
                blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
                indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800' },
                purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800' },
                emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
                pink: { bg: 'bg-pink-50 dark:bg-pink-900/20', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-800' },
                sky: { bg: 'bg-sky-50 dark:bg-sky-900/20', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-200 dark:border-sky-800' },
              };
              const colors = accentMap[item.accent];

              return (
                <div
                  key={idx}
                  className={`group relative overflow-hidden rounded-xl ${colors.bg} border-2 ${colors.border} p-4 hover:shadow-md transition-all`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg ${colors.text} bg-white dark:bg-slate-700 flex items-center justify-center text-lg shadow-sm flex-shrink-0`}>
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
                        {item.label}
                      </p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                        {item.value || '-'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 📞 Parent Info - 1 Column (Side Panel) */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-slate-700 shadow-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-rose-50 to-pink-50 dark:from-slate-700 dark:to-slate-700 border-b-2 border-rose-100 dark:border-slate-600">
          <h3 className="font-black text-rose-900 dark:text-rose-200 flex items-center gap-2 text-sm uppercase tracking-wider">
            <span className="w-8 h-8 bg-rose-500 rounded-lg flex items-center justify-center text-white text-sm shadow-md">
              👨‍👩‍👦
            </span>
            Data Orang Tua
          </h3>
          <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1">Kontak darurat & wali</p>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 space-y-4">
          {/* Parent Name */}
          <div className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 rounded-xl border-2 border-rose-100 dark:border-rose-800/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">👤</span>
              <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">
                Nama Orang Tua
              </p>
            </div>
            <p className="text-sm font-bold text-rose-900 dark:text-rose-100">
              {user.parent_name || '-'}
            </p>
          </div>

          {/* Parent Phone */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border-2 border-emerald-100 dark:border-emerald-800/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📱</span>
              <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                No. WhatsApp
              </p>
            </div>
            <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100 font-mono mb-3">
              {user.parent_phone || '-'}
            </p>
            {user.parent_phone && (
              <a
                href={`https://wa.me/${user.parent_phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
              >
                <span>💬</span>
                <span>Hubungi via WA</span>
              </a>
            )}
          </div>

          {/* QR Code Quick Access */}
          <button
            onClick={() => {
              if (typeof handleShowQR === 'function') {
                handleShowQR(user, 'siswa');
              }
            }}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl p-4 shadow-lg transition-all hover:shadow-xl group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center text-xl border border-white/30">
                  📱
                </div>
                <div className="text-left">
                  <p className="text-xs font-black uppercase tracking-widest">QR Code Absensi</p>
                  <p className="text-[10px] text-blue-100">Tampilkan untuk scan</p>
                </div>
              </div>
              <span className="text-xl group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </button>
        </div>
      </div>
    </div>

    {/* 💡 Info Card */}
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl border-2 border-amber-200 dark:border-amber-800/50 p-5 shadow-md flex items-start gap-4">
      <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center text-2xl shadow-lg flex-shrink-0">
        💡
      </div>
      <div className="flex-1">
        <h4 className="font-black text-amber-900 dark:text-amber-200 text-sm mb-1.5 uppercase tracking-wider">
          Informasi Penting
        </h4>
        <p className="text-sm text-amber-800 dark:text-amber-100 leading-relaxed">
          Informasi profil ini diambil dari data resmi yang terdaftar di sistem. Jika ada kesalahan atau perubahan data,
          silakan hubungi <span className="font-bold">administrator sekolah</span> untuk melakukan pembaruan.
        </p>
      </div>
    </div>
  </div>
)}

{/* TAB: Riwayat */}
{activeTab === 'riwayat' && (
  <div className="animate-fade-in space-y-6">
    {/* 🎯 Header dengan Statistik Ringkas */}
    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 shadow-xl text-white relative overflow-hidden">
      <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
      <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black mb-1 flex items-center gap-2">
            <span>📅</span> Riwayat Absensiku
          </h2>
          <p className="text-blue-100 text-sm">Catatan lengkap kehadiran sepanjang semester</p>
        </div>
        <button
          onClick={() => fetchStudentData(false)}
          className="px-5 py-2.5 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border border-white/30"
        >
          <span>🔄</span> Refresh Data
        </button>
      </div>
    </div>

    {/* 📊 Statistik Kehadiran - Cards */}
    {attendanceHistory.length > 0 && (() => {
      const stats = {
        hadir: attendanceHistory.filter(a => a.status === 'hadir').length,
        terlambat: attendanceHistory.filter(a => a.status === 'terlambat').length,
        izin: attendanceHistory.filter(a => a.status === 'izin').length,
        sakit: attendanceHistory.filter(a => a.status === 'sakit').length,
        absen: attendanceHistory.filter(a => ['absen', 'alpha', 'tidak hadir'].includes((a.status || '').toLowerCase())).length,
      };
      const total = attendanceHistory.length;
      const presentRate = total > 0 ? Math.round(((stats.hadir + stats.terlambat) / total) * 100) : 0;

      const statCards = [
        { label: 'Hadir', value: stats.hadir, icon: '✓', color: 'emerald', bg: 'from-emerald-500 to-emerald-600' },
        { label: 'Terlambat', value: stats.terlambat, icon: '⚠', color: 'amber', bg: 'from-amber-500 to-amber-600' },
        { label: 'Izin', value: stats.izin, icon: '📋', color: 'sky', bg: 'from-sky-500 to-sky-600' },
        { label: 'Sakit', value: stats.sakit, icon: '🏥', color: 'violet', bg: 'from-violet-500 to-violet-600' },
        { label: 'Absen', value: stats.absen, icon: '✗', color: 'rose', bg: 'from-rose-500 to-rose-600' },
      ];

      return (
        <>
          {/* Progress Kehadiran */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-blue-100 dark:border-slate-700 p-5 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center gap-5">
              <div className="relative w-24 h-24 flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9155" fill="none" className="text-slate-100 dark:text-slate-700" stroke="currentColor" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.9155" fill="none"
                    className={`${presentRate >= 80 ? 'text-emerald-500' : presentRate >= 60 ? 'text-amber-500' : 'text-rose-500'} transition-all duration-1000`}
                    stroke="currentColor" strokeWidth="3"
                    strokeDasharray={`${presentRate}, 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-xl font-black ${presentRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : presentRate >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {presentRate}%
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Hadir</span>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">
                  Persentase Kehadiran: <span className="text-blue-600 dark:text-blue-400">{presentRate}%</span> dari {total} hari
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {statCards.map((s, idx) => (
                    <div key={idx} className={`bg-gradient-to-br ${s.bg} rounded-xl p-2.5 text-white shadow-md`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-lg">{s.icon}</span>
                        <span className="text-[9px] font-bold bg-white/20 px-1.5 py-0.5 rounded-full">{s.label}</span>
                      </div>
                      <p className="text-2xl font-black">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 🔍 Filter Bar */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-blue-100 dark:border-slate-700 p-4 shadow-md">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">📅 Filter Bulan</label>
                <select
                  value={riwayatMonthFilter || ''}
                  onChange={(e) => setRiwayatMonthFilter?.(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-200 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                >
                  <option value="">Semua Bulan</option>
                  {Array.from({ length: 12 }, (_, i) => {
                    const d = new Date();
                    d.setMonth(d.getMonth() - i);
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    const label = d.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
                    return <option key={key} value={key}>{label}</option>;
                  })}
                </select>
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">🎯 Filter Status</label>
                <select
                  value={riwayatStatusFilter || ''}
                  onChange={(e) => setRiwayatStatusFilter?.(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-200 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                >
                  <option value="">Semua Status</option>
                  <option value="hadir">✓ Hadir</option>
                  <option value="terlambat">⚠ Terlambat</option>
                  <option value="izin">📋 Izin</option>
                  <option value="sakit">🏥 Sakit</option>
                  <option value="absen">✗ Absen</option>
                </select>
              </div>
            </div>
          </div>
        </>
      );
    })()}

    {/* 📋 Tabel Riwayat */}
    <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-blue-100 dark:border-slate-700 overflow-hidden shadow-xl">
      {loading ? (
        <div className="p-12 text-center">
          <div className="w-14 h-14 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-blue-600 dark:text-blue-400 font-bold">Memuat riwayat absensi...</p>
        </div>
      ) : attendanceHistory.length === 0 ? (
        <div className="p-16 text-center">
          <div className="w-24 h-24 mx-auto mb-4 bg-blue-50 dark:bg-slate-700 rounded-full flex items-center justify-center">
            <span className="text-5xl">📭</span>
          </div>
          <p className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">Belum ada data absensi</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Silakan lakukan absensi terlebih dahulu</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-700 dark:to-slate-700 border-b-2 border-blue-200 dark:border-slate-600">
                <tr>
                  <th className="px-5 py-4 text-left text-[10px] font-black text-blue-700 dark:text-blue-300 uppercase tracking-widest">Tanggal</th>
                  <th className="px-5 py-4 text-left text-[10px] font-black text-blue-700 dark:text-blue-300 uppercase tracking-widest">Status</th>
                  <th className="px-5 py-4 text-left text-[10px] font-black text-blue-700 dark:text-blue-300 uppercase tracking-widest">Jam Datang</th>
                  <th className="px-5 py-4 text-left text-[10px] font-black text-blue-700 dark:text-blue-300 uppercase tracking-widest">Jam Pulang</th>
                  <th className="px-5 py-4 text-left text-[10px] font-black text-blue-700 dark:text-blue-300 uppercase tracking-widest">Durasi</th>
                  <th className="px-5 py-4 text-left text-[10px] font-black text-blue-700 dark:text-blue-300 uppercase tracking-widest">Metode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {[...attendanceHistory]
                  .sort((a, b) => {
                    const dateA = new Date(a.date || a.created_at || a.attendance_time);
                    const dateB = new Date(b.date || b.created_at || b.attendance_time);
                    return dateB - dateA;
                  })
                  .map((item, index) => {
                    // 🕐 Helper: Extract time dari berbagai format
                    const extractTime = (datetimeStr) => {
                      if (!datetimeStr) return null;
                      const str = String(datetimeStr).trim();
                      // Format HH:MM atau HH:MM:SS
                      if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
                        return str.substring(0, 5);
                      }
                      try {
                        const date = new Date(str);
                        if (!isNaN(date.getTime())) {
                          return date.toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          });
                        }
                      } catch (e) {}
                      return null;
                    };

                    // 🚪 Helper: Cari jam pulang dari BANYAK kemungkinan field
                    const findTimeOut = (item) => {
                      const candidates = [
                        item.time_out,
                        item.departure,
                        item.exit_time,
                        item.pulang_time,
                        item.jam_pulang,
                        item.check_out,
                        item.clock_out,
                        item.end_time,
                        item.time_out_actual,
                      ];
                      for (const c of candidates) {
                        const t = extractTime(c);
                        if (t) return t;
                      }
                      return null;
                    };

                    const timeIn = extractTime(item.time_in || item.attendance_time || item.scan_time || item.created_at);
                    const timeOut = findTimeOut(item);
                    
                    // ⏱️ Hitung durasi
                    let duration = '-';
                    if (timeIn && timeOut) {
                      const [h1, m1] = timeIn.split(':').map(Number);
                      const [h2, m2] = timeOut.split(':').map(Number);
                      const mins1 = h1 * 60 + m1;
                      const mins2 = h2 * 60 + m2;
                      const diff = mins2 - mins1;
                      if (diff > 0) {
                        const hours = Math.floor(diff / 60);
                        const mins = diff % 60;
                        duration = hours > 0 ? `${hours}j ${mins}m` : `${mins}m`;
                      }
                    }

                    const dateValue = item.date || item.created_at;
                    const dateObj = dateValue ? new Date(dateValue) : null;
                    const formattedDate = dateObj && !isNaN(dateObj.getTime()) ? 
                      dateObj.toLocaleDateString('id-ID', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      }) : '-';
                    const dayName = dateObj && !isNaN(dateObj.getTime()) ?
                      dateObj.toLocaleDateString('id-ID', { weekday: 'short' }) : '';
                    const dayNum = dateObj && !isNaN(dateObj.getTime()) ?
                      String(dateObj.getDate()).padStart(2, '0') : '--';
                    const monthName = dateObj && !isNaN(dateObj.getTime()) ?
                      dateObj.toLocaleDateString('id-ID', { month: 'short' }) : '';
                    
                    const method = (item.created_via || item.method || item.type || 'manual').toLowerCase();
                    const methodLabel = method === 'qr_scan' || method === 'qr' ? { icon: '📱', text: 'QR Code' } : 
                                       method === 'fingerprint' ? { icon: '👆', text: 'Fingerprint' } : 
                                       { icon: '✍️', text: 'Manual' };

                    // Status styling
                    const statusConfig = {
                      hadir: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-300 dark:border-emerald-700', icon: '✓', label: 'Hadir' },
                      terlambat: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-700', icon: '⚠', label: 'Terlambat' },
                      izin: { bg: 'bg-sky-100 dark:bg-sky-900/40', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-300 dark:border-sky-700', icon: '📋', label: 'Izin' },
                      sakit: { bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-300 dark:border-violet-700', icon: '🏥', label: 'Sakit' },
                    };
                    const status = (item.status || 'absen').toLowerCase();
                    const sc = statusConfig[status] || { bg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-300 dark:border-rose-700', icon: '✗', label: 'Absen' };

                    return (
                      <tr key={item.id || index} className="hover:bg-blue-50/50 dark:hover:bg-slate-700/50 transition-colors group">
                        {/* Tanggal - dengan visual calendar */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex flex-col items-center justify-center shadow-md flex-shrink-0">
                              <span className="text-[9px] font-bold uppercase leading-none">{dayName}</span>
                              <span className="text-xl font-black leading-tight">{dayNum}</span>
                              <span className="text-[8px] font-bold uppercase leading-none opacity-80">{monthName}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate capitalize">{formattedDate}</p>
                            </div>
                          </div>
                        </td>
                        {/* Status */}
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-full border-2 ${sc.bg} ${sc.text} ${sc.border}`}>
                            <span>{sc.icon}</span>
                            <span>{sc.label}</span>
                          </span>
                        </td>
                        {/* Jam Datang */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                              <span className="text-sm">🕐</span>
                            </div>
                            <span className="text-sm font-mono font-black text-emerald-700 dark:text-emerald-300">
                              {timeIn || '--:--'}
                            </span>
                          </div>
                        </td>
                        {/* Jam Pulang */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center flex-shrink-0">
                              <span className="text-sm">🏁</span>
                            </div>
                            <span className={`text-sm font-mono font-black ${timeOut ? 'text-rose-700 dark:text-rose-300' : 'text-slate-400 dark:text-slate-500 italic'}`}>
                              {timeOut || 'Belum absen'}
                            </span>
                          </div>
                        </td>
                        {/* Durasi */}
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2.5 py-1.5 rounded-lg">
                            <span>⏱️</span>
                            <span>{duration}</span>
                          </span>
                        </td>
                        {/* Metode */}
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600">
                            <span>{methodLabel.icon}</span>
                            <span>{methodLabel.text}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* 📱 Mobile Card View */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
            {[...attendanceHistory]
              .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
              .map((item, index) => {
                const extractTime = (datetimeStr) => {
                  if (!datetimeStr) return null;
                  const str = String(datetimeStr).trim();
                  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) return str.substring(0, 5);
                  try {
                    const date = new Date(str);
                    if (!isNaN(date.getTime())) {
                      return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
                    }
                  } catch (e) {}
                  return null;
                };
                const findTimeOut = (item) => {
                  const candidates = [item.time_out, item.departure, item.exit_time, item.pulang_time, item.jam_pulang, item.check_out, item.clock_out, item.end_time];
                  for (const c of candidates) {
                    const t = extractTime(c);
                    if (t) return t;
                  }
                  return null;
                };
                const timeIn = extractTime(item.time_in || item.attendance_time || item.scan_time || item.created_at);
                const timeOut = findTimeOut(item);
                const dateValue = item.date || item.created_at;
                const dateObj = dateValue ? new Date(dateValue) : null;
                const formattedDate = dateObj && !isNaN(dateObj.getTime()) ? 
                  dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }) : '-';
                
                const statusConfig = {
                  hadir: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', icon: '✓' },
                  terlambat: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', icon: '⚠' },
                  izin: { bg: 'bg-sky-100 dark:bg-sky-900/40', text: 'text-sky-700 dark:text-sky-300', icon: '📋' },
                  sakit: { bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-700 dark:text-violet-300', icon: '🏥' },
                };
                const status = (item.status || 'absen').toLowerCase();
                const sc = statusConfig[status] || { bg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-700 dark:text-rose-300', icon: '✗' };

                return (
                  <div key={item.id || index} className="p-4 hover:bg-blue-50/50 dark:hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex flex-col items-center justify-center shadow-md">
                          <span className="text-lg font-black leading-none">{dateObj ? String(dateObj.getDate()).padStart(2, '0') : '--'}</span>
                          <span className="text-[8px] font-bold uppercase">{dateObj ? dateObj.toLocaleDateString('id-ID', { month: 'short' }) : ''}</span>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 capitalize">{formattedDate}</p>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black rounded-full ${sc.bg} ${sc.text} mt-1`}>
                            <span>{sc.icon}</span>
                            <span className="uppercase">{status}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2.5 border border-emerald-200 dark:border-emerald-800">
                        <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-0.5">🕐 Datang</p>
                        <p className="text-sm font-mono font-black text-emerald-700 dark:text-emerald-300">{timeIn || '--:--'}</p>
                      </div>
                      <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-2.5 border border-rose-200 dark:border-rose-800">
                        <p className="text-[9px] font-bold text-rose-600 dark:text-rose-400 uppercase mb-0.5">🏁 Pulang</p>
                        <p className={`text-sm font-mono font-black ${timeOut ? 'text-rose-700 dark:text-rose-300' : 'text-slate-400 italic'}`}>
                          {timeOut || 'Belum'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Footer Info */}
          <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-700 dark:to-slate-700 border-t-2 border-blue-100 dark:border-slate-600 flex flex-col sm:flex-row justify-between items-center gap-2">
            <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">
              Menampilkan <span className="font-black text-blue-600 dark:text-blue-400">{attendanceHistory.length}</span> data absensi
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">📊 Diurutkan dari yang terbaru</span>
          </div>
        </>
      )}
    </div>
  </div>
)}
            </div>
            </div>
          </div>
        </main>
        </div>

      {/* MODAL KONFIRMASI LOGOUT */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border-2 border-blue-200 animate-fade-in-up">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🚪</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Konfirmasi Keluar</h3>
              <p className="text-gray-600 text-sm">Yakin anda ingin logout dari akun ini?</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl text-sm font-medium hover:from-red-600 hover:to-red-700 transition-all shadow-md border-2 border-red-300"
              >
                Ya, Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardSiswa;