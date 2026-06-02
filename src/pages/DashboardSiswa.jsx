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

const DashboardSiswa = () => {
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
  const [permissionSubmitting, setPermissionSubmitting] = useState(false);
  const isSynchronizingData = loading || scheduleLoading || qrLoading;

  const [permissionForm, setPermissionForm] = useState({
    type: 'izin',
    reason: '',
    startDate: '',
    endDate: ''
  });

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
          const settings = res.data;
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
        console.warn('Gagal fetch settings dari API, menggunakan cache local');
        loadSettings();
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
      const config = { headers: { Authorization: `Bearer ${token}` }, timeout: 120000 };

      const results = await Promise.allSettled([
        fetchWithRetry(() => api.get('/siswa/stats', config)).catch(e => { console.warn("Stats API fail", e); throw e; }),
        fetchWithRetry(() => api.get('/siswa/attendance', config)).catch(e => { console.warn("History API fail", e); throw e; }),
        fetchWithRetry(() => api.get('/siswa/class', config)).catch(e => { console.warn("Class API fail", e); throw e; })
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

    if (results[1].status === 'fulfilled') setAttendanceHistory(results[1].value.data);
    if (results[2].status === 'fulfilled') {
      setClassInfo(results[2].value.data.class);
      setTeacherInfo(results[2].value.data.teacher);
    }

    // Sinkronisasi data user dari database ke state
    const dbUser = (results[0].status === 'fulfilled' ? results[0].value.data.user_info : null) || 
                   (results[2].status === 'fulfilled' ? results[2].value.data.user_info : null) || 
                   {};
    if (Object.keys(dbUser).length > 0) {
      setUser(prevUser => ({
        ...prevUser, ...dbUser
      }));
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
        nama: user.name || '',
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

  const submitPermissionRequest = async (e) => {
    e.preventDefault();

    if (!permissionForm.reason.trim()) {
      addNotification('📝 Mohon isi alasan izin/sakit terlebih dahulu.', 'warning');
      return;
    }

    try {
      setPermissionSubmitting(true);
      const token = localStorage.getItem('token');
      const payload = {
        name: user?.name || user?.full_name || '',
        full_name: user?.name || user?.full_name || '',
        type: 'manual',
        status: permissionForm.type,
        approval_status: 'pending',
        is_pending: true,
        pending: true,
        reason: permissionForm.reason.trim(),
        notes: permissionForm.reason.trim(),
        keterangan: permissionForm.reason.trim(),
        attendance_time: getLocalTimestamp(new Date()),
        user_id: user?.nis || user?.user_id || '',
        nis: user?.nis || user?.user_id || '',
        role: 'siswa',
        ...(permissionForm.startDate ? { start_date: permissionForm.startDate } : {}),
        ...(permissionForm.endDate ? { end_date: permissionForm.endDate } : {})
      };

      await api.post('/attendance/izin', payload, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        timeout: 60000
      });

      addNotification(`✅ Pengajuan ${permissionForm.type === 'sakit' ? 'sakit' : 'izin'} berhasil dikirim ke admin.`, 'success');
      setPermissionForm({ type: 'izin', reason: '', startDate: '', endDate: '' });
      localStorage.setItem('attendance_updated', Date.now().toString());
      await fetchStudentData(false);
    } catch (err) {
      console.error('❌ Gagal mengirim pengajuan izin/sakit:', err);
      addNotification(`❌ ${err.response?.data?.message || 'Gagal mengirim pengajuan izin/sakit'}`, 'error');
    } finally {
      setPermissionSubmitting(false);
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

        {/* Main UI Column - UNTOUCHED */}
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
              </div>
            </div>
          </header>

          {isSynchronizingData && (
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
                      <span className="text-8xl">🧑‍🎓</span>
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
                        Halo, {user?.name}! 👋
                      </h2>
                      <p className="text-blue-100 text-[10px] sm:text-sm mt-0.5 sm:mt-1 font-medium">
                        Tetap semangat belajar ya! Jangan lupa untuk selalu disiplin dalam presensi.
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
                <div className="animate-fade-in">
                  <div className="bg-white rounded-xl border-2 border-blue-200 p-6 mb-6 shadow-lg">
                    <h2 className="text-xl font-bold text-blue-800 mb-1">🪪 Kode QR Presensi Digital</h2>
                    <p className="text-blue-600 text-sm">Gunakan kode di bawah ini untuk melakukan scan pada perangkat scanner sekolah.</p>
                  </div>

                  <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-xl overflow-hidden relative group">
                      <div className="p-8 lg:p-12 grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12 items-center">
                        {/* Area QR Code */}
                        <div className="lg:col-span-2 flex flex-col items-center">
                          <div className="p-6 bg-white rounded-[2rem] shadow-sm border-2 border-slate-50 transition-all duration-500 group-hover:border-blue-100 group-hover:scale-105">
                          {qrLoading ? (
                              <div className="w-48 h-48 flex items-center justify-center">
                              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          ) : (
                              <img src={myQRCode} alt="QR Saya" className="w-48 h-48" />
                          )}
                        </div>
                          <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] lg:hidden">Scan untuk Presensi</p>
                        </div>

                        {/* Data Info (Sisi Kanan di Laptop) */}
                        <div className="lg:col-span-3 flex flex-col">
                          <div className="mb-8 hidden lg:block">
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Kartu Presensi Digital</h3>
                            <p className="text-slate-500 text-sm mt-1 font-medium">Tunjukkan kode QR ini ke alat scanner untuk mencatat kehadiran.</p>
                          </div>

                          <div className="w-full space-y-4 mb-10">
                            <div className="flex justify-between items-center py-3 border-b border-slate-100 group/item">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Lengkap</span>
                              <span className="text-base font-bold text-slate-800 group-hover/item:text-blue-600 transition-colors">{user.name}</span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-slate-100 group/item">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nomor Induk (NIS)</span>
                              <span className="text-base font-bold text-blue-600 group-hover/item:scale-105 transition-transform">{user.nis || user.user_id}</span>
                            </div>
                            <div className="flex justify-between items-center py-3">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peran / Role</span>
                              <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-tighter border border-blue-100">Siswa Aktif</span>
                            </div>
                          </div>

                        <button 
                          onClick={downloadQRCode}
                          className="w-full py-4 bg-slate-900 hover:bg-blue-600 text-white font-black rounded-2xl transition-all duration-300 shadow-lg hover:shadow-blue-500/30 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                        >
                          <span>📥</span> Download Kartu QR
                        </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 bg-white rounded-2xl border-2 border-blue-100 shadow-lg p-6">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
                        <div>
                          <h3 className="text-lg font-bold text-blue-900">📋 Ajukan Izin / Sakit</h3>
                          <p className="text-sm text-slate-500">Pengajuan kamu akan dikirim ke admin untuk disetujui terlebih dahulu.</p>
                        </div>
                        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
                          <span>⏳</span> Menunggu persetujuan admin
                        </div>
                      </div>

                      <form onSubmit={submitPermissionRequest} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">Jenis Pengajuan</label>
                          <select
                            value={permissionForm.type}
                            onChange={(e) => setPermissionForm(prev => ({ ...prev, type: e.target.value }))}
                            className="w-full border-2 border-blue-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="izin">Izin</option>
                            <option value="sakit">Sakit</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">Tanggal Mulai</label>
                          <input
                            type="date"
                            value={permissionForm.startDate}
                            onChange={(e) => setPermissionForm(prev => ({ ...prev, startDate: e.target.value }))}
                            className="w-full border-2 border-blue-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">Tanggal Selesai</label>
                          <input
                            type="date"
                            value={permissionForm.endDate}
                            onChange={(e) => setPermissionForm(prev => ({ ...prev, endDate: e.target.value }))}
                            className="w-full border-2 border-blue-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-slate-700 mb-2">Alasan / Keterangan</label>
                          <textarea
                            required
                            rows={4}
                            value={permissionForm.reason}
                            onChange={(e) => setPermissionForm(prev => ({ ...prev, reason: e.target.value }))}
                            placeholder="Contoh: sakit kepala, mengikuti acara keluarga, atau alasan lainnya..."
                            className="w-full border-2 border-blue-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <p className="text-xs text-slate-500">Status pengajuan akan muncul kembali di riwayat setelah admin meninjau.</p>
                          <button
                            type="submit"
                            disabled={permissionSubmitting}
                            className="px-5 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm disabled:opacity-60"
                          >
                            {permissionSubmitting ? 'Mengirim...' : 'Kirim Pengajuan'}
                          </button>
                        </div>
                      </form>
                    </div>

                    <div className="mt-8 bg-amber-50 border-2 border-amber-100 rounded-2xl p-5 flex items-start gap-4">
                      <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-xl flex-shrink-0">💡</div>
                      <div>
                        <p className="text-xs font-bold text-amber-900 uppercase tracking-wide mb-1">Tips Penting</p>
                        <p className="text-xs text-amber-800 leading-relaxed font-medium">
                          Simpan QR Code ini ke galeri HP Anda agar tetap bisa melakukan presensi meskipun tidak ada koneksi internet di sekolah.
                        </p>
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

              {/* TAB: Profil Saya */}
              {activeTab === 'profil' && (
                <div>
                  <div className="bg-white rounded-xl border-2 border-blue-200 p-6 mb-6 shadow-lg">
                    <h2 className="text-xl font-bold text-blue-800 mb-1">👤 Profil Saya</h2>
                    <p className="text-blue-600 text-sm">Informasi lengkap tentang akun Anda</p>
                  </div>
                  <div className="bg-white rounded-xl border-2 border-blue-200 p-8 shadow-lg">
                    <div className="flex flex-col items-center mb-8">
                      <div className="w-32 h-32 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden border-4 border-blue-200 shadow-md mb-4">
                        {user.photo ? (
                          <img src={resolvePhotoUrl(user.photo)} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-5xl text-blue-400 font-bold">{user.name?.charAt(0) || 'S'}</span>
                        )}
                      </div>
                      <h3 className="text-2xl font-bold text-blue-800">{user.name}</h3>
                      <p className="text-blue-600 text-sm font-medium">{resolveClassName(user, classInfo)}</p>
                    </div>

                    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 text-left mb-6">
                      <h4 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
                        <span>ℹ️</span> Detail Akun
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm text-blue-800">
                        <div className="flex justify-between py-2 border-b-2 border-blue-200">
                          <span className="text-blue-600">Nama Lengkap:</span>
                          <span className="font-medium">{user.name || '-'}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b-2 border-blue-200">
                          <span className="text-blue-600">Email:</span>
                          <span className="font-medium">{user.email || '-'}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b-2 border-blue-200">
                          <span className="text-blue-600">NIS:</span>
                          <span className="font-medium">{user.nis || user.user_id || '-'}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b-2 border-blue-200">
                          <span className="text-blue-600">Kelas:</span>
                          <span className="font-medium">{resolveClassName(user, classInfo)}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b-2 border-blue-200">
                          <span className="text-blue-600">Jenis Kelamin:</span>
                          <span className="font-medium">{user.gender || '-'}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b-2 border-blue-200">
                          <span className="text-blue-600">No. Telepon Siswa:</span>
                          <span className="font-medium">{user.phone || '-'}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b-2 border-blue-200">
                          <span className="text-blue-600">Nama Orang Tua:</span>
                          <span className="font-medium">{user.parent_name || '-'}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b-2 border-blue-200">
                          <span className="text-blue-600">No. Telepon Orang Tua:</span>
                          <span className="font-medium">{user.parent_phone || '-'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 text-left">
                      <h4 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
                        <span>💡</span> Catatan
                      </h4>
                      <p className="text-sm text-blue-800">
                        Informasi profil ini diambil dari data yang terdaftar di sistem. Jika ada kesalahan atau perubahan data,
                        silakan hubungi administrator sekolah untuk melakukan pembaruan.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: Riwayat */}
              {activeTab === 'riwayat' && (
                <div>
                  <div className="bg-white rounded-xl border-2 border-blue-200 p-6 mb-6 shadow-lg">
                    <h2 className="text-xl font-bold text-blue-800 mb-1">Riwayat Absensi</h2>
                    <p className="text-blue-600 text-sm">Catatan kehadiranmu sepanjang semester</p>
                  </div>
                  <div className="bg-white rounded-xl border-2 border-blue-200 overflow-hidden shadow-lg">
                    {loading ? (
                      <div className="p-6 text-center text-blue-600">Memuat riwayat...</div>
                    ) : attendanceHistory.length === 0 ? (
                      <div className="p-6 text-center text-blue-600">
                        <p className="text-3xl mb-2">📭</p>
                        <p>Belum ada data absensi</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-blue-50 border-b-2 border-blue-200">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-blue-700 uppercase">Tanggal</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-blue-700 uppercase">Kelas</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-blue-700 uppercase">Status</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-blue-700 uppercase">Catatan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y-2 divide-blue-50">
                            {attendanceHistory.map((item) => (
                              <tr key={item.id} className="hover:bg-blue-50">
                                <td className="px-6 py-4 text-sm text-blue-800">{formatDate(item.date)}</td>
                                <td className="px-6 py-4 text-sm text-blue-600">{item.class_name || resolveClassName(user, classInfo)}</td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full border-2 ${statusBadgeClass(item.status)}`}>
                                    {statusLabel(item.status)}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-blue-600">{item.note || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
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