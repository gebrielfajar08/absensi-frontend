import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

// Helper function to resolve photo URL
const resolvePhotoUrl = (photo) => {
  if (!photo) return null;
  if (typeof photo !== 'string') return null;
  const trimmed = photo.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http') || trimmed.startsWith('data:')) return trimmed;
  const base = api.defaults.baseURL?.replace(/\/api\/?$/, '') || '';
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
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
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

const DashboardSiswa = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ringkasan');
  const [isExiting, setIsExiting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const navigate = useNavigate();

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
    disableAttendanceOnHolidays: true
  });

  // State untuk QR Code
  const [myQRCode, setMyQRCode] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);

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
      localStorage.clear();
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
            disableAttendanceOnHolidays: settings.disableAttendanceOnHolidays ?? settings.disable_attendance_on_holidays ?? true
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
            disableAttendanceOnHolidays: settings.disableAttendanceOnHolidays ?? settings.disable_attendance_on_holidays ?? true
          });
        } catch (err) {
          console.error("Error parsing settings", err);
        }
      }
    };

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

  // Update waktu real-time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  // Cleanup QR scanner saat unmount
  useEffect(() => {
    return () => {
      if (qrScanner) {
        stopQRScanner();
      }
    };
  }, [qrScanner]);

  // Ref untuk instance Html5Qrcode agar tidak terjadi tabrakan (timeout)
  const html5QrcodeScannerRef = useRef(null);

  // Watch untuk modal dan start scanner saat modal terbuka
  useEffect(() => {
    let isMounted = true;
    if (showAbsenModal && activeAbsenTab === 'scan') {
      const timer = setTimeout(() => {
        if (isMounted) startQRScanner();
      }, 500);
      return () => {
        isMounted = false;
        clearTimeout(timer);
        stopQRScanner();
      };
    } else {
      stopQRScanner();
    }
  }, [showAbsenModal, activeAbsenTab]);

  const fetchStudentData = async (silent = true) => {
    if (!silent) setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` }, timeout: 120000 };

      const results = await Promise.allSettled([
        api.get('/siswa/stats', config).catch(e => { console.warn("Stats API fail", e); throw e; }),
        api.get('/siswa/attendance', config).catch(e => { console.warn("History API fail", e); throw e; }),
        api.get('/siswa/class', config).catch(e => { console.warn("Class API fail", e); throw e; })
      ]);

      const eventRes = await api.get('/public/events', config).catch(() => ({ data: [] }));
      setEvents(Array.isArray(eventRes.data) ? eventRes.data : []);

    const statsData = results[0].status === 'fulfilled' ? results[0].value.data : {};
    setStats({
      totalAttendance: statsData.total_pertemuan || 0,
      presentDays: statsData.hadir || 0,
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
      const res = await api.get('/siswa/schedules', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSchedules(res.data || []);
    } catch (err) {
      console.error('Gagal memuat jadwal:', err);
      setSchedules([]);
    } finally {
      setScheduleLoading(false);
    }
  };

  // Generate QR Code lokal (fallback jika API error)
  const generateLocalQRCode = () => {
    try {
      const qrData = {
        type: 'student_qr', // Diperlukan agar scanner Landing/Guru mengenali data ini
        id: user.id,
        name: user.name || '',
        user_id: user.nis || user.user_id || '', // NIS Siswa
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
      alert('❌ QR Code belum tersedia');
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
      
      alert('✅ QR Code berhasil diunduh! Cek folder Downloads Anda.');
      console.log('✅ QR Code berhasil diunduh:', fileName);
    } catch (err) {
      console.error('❌ Gagal download QR Code:', err);
      alert('❌ Gagal mengunduh QR Code. Coba lagi.');
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
    if (!attendanceSettings.disableAttendanceOnHolidays) return false;
    return currentTime.getDay() === 0; // 0 is Sunday
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-blue-600 font-medium">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-blue-100 transition-opacity duration-500 flex flex-col overflow-hidden ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
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
                  {attendanceSettings.schoolLogo ? (
                    <img
                      src={resolvePhotoUrl(attendanceSettings.schoolLogo)}
                      alt="Logo Sekolah"
                      className="w-8 h-8 object-contain"
                      onError={(e) => { 
                        e.target.onerror = null; 
                        e.target.src = 'https://via.placeholder.com/40/3b82f6/ffffff?text=S'; 
                      }}
                    />
                  ) : (
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  )}
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
          {sessionInfo?.attendanceSessionOpen === false && (
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

          {/* Page Content Area - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-8">
            <div className="max-w-7xl mx-auto w-full">
            <div className="animate-fade-in">
              {/* TAB: Ringkasan */}
              {activeTab === 'ringkasan' && (
                <div className="space-y-6">
                  {/* ✨ BANNER SELAMAT DATANG (Paling Atas) */}
                  <div className="bg-blue-50 border-2 border-blue-100 rounded-3xl p-6 mb-2 shadow-sm flex flex-col sm:flex-row items-center gap-5 relative overflow-hidden transition-all hover:border-blue-200">
                    {/* Ornamen Dekoratif */}
                    <div className="absolute right-0 top-0 w-32 h-full bg-blue-100/50 -skew-x-12 translate-x-16 pointer-events-none"></div>
                    <div className="absolute right-10 top-1/2 -translate-y-1/2 opacity-10 pointer-events-none hidden md:block">
                      <span className="text-8xl">🧑‍🎓</span>
                    </div>

                    <div className="relative z-10">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden border-4 border-white shadow-md bg-white flex-shrink-0">
                        <img
                          src={resolvePhotoUrl(user?.photo) || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Siswa')}&background=3b82f6&color=ffffff`}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    
                    <div className="text-center sm:text-left relative z-10">
                      <h2 className="text-xl lg:text-2xl font-black text-blue-900 leading-tight">
                        Halo, {user?.name}! 👋
                      </h2>
                      <p className="text-blue-600/80 text-sm mt-1 font-medium">
                        Tetap semangat belajar ya! Jangan lupa untuk selalu disiplin dalam presensi.
                      </p>
                    </div>
                  </div>

                  {/* ✨ TANGGAL KOTAK DINAMIS (LANDING STYLE) */}
                  {(() => {
                    const sectionBg = getSectionBackground(currentTime);
                    return (
                      <div
                        className="relative overflow-hidden rounded-2xl border-2 border-blue-100 p-6 text-white shadow-lg mb-6"
                        style={{
                          backgroundImage: `linear-gradient(rgba(15,23,42,0.75), rgba(15,23,42,0.65)), url(${sectionBg.image})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }}
                      >
                        <div className="relative">
                          <p className="text-xs uppercase tracking-[0.24em] text-blue-200/90 mb-3 font-bold">
                            {sectionBg.isHoliday ? `Hari Besar: ${sectionBg.label}` : sectionBg.label}
                          </p>
                          <h3 className="text-2xl md:text-3xl font-black mb-2 tracking-tight">
                            {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                          </h3>
                          <p className="text-sm text-slate-200/80 mb-6">
                            Sistem pencatatan waktu otomatis zona waktu Jakarta.
                          </p>
                          <div className="inline-flex items-center gap-3 rounded-full bg-white/10 backdrop-blur-md px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-lg border border-white/20">
                            <span>{currentTime.getFullYear()}</span>
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400" />
                            <span>{currentTime.getDate()} {new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(currentTime)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ✨ TAMBAHAN: Kartu Event Countdown */}
                  {events.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                      {events.map((event) => {
                        const today = new Date(); today.setHours(0,0,0,0);
                        const target = new Date(event.date);
                        const days = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
                        if (days < 0) return null;
                        return (
                          <div key={event.id} className="relative bg-white rounded-2xl border-2 border-blue-100 overflow-hidden shadow-md group hover:shadow-xl transition-all">
                            <img src={resolvePhotoUrl(event.image)} className="w-full h-24 object-cover opacity-80 group-hover:scale-105 transition-transform" />
                            <div className="p-4 bg-white">
                              <div className="flex justify-between items-center">
                                <h4 className="font-bold text-blue-900 text-sm truncate">{event.title}</h4>
                                <span className={`${days === 0 ? 'bg-red-600' : 'bg-blue-600'} text-white text-[9px] font-black px-2 py-0.5 rounded-full`}>
                                  {days === 0 ? '🎉 HARI INI' : `⏳ H-${days} HARI LAGI`}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-wider">
                                {new Date(event.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ✨ SEKSI MEDIA (DIPINDAHKAN KE BAWAH SALAM) */}
                    <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-5 shadow-lg mb-6">
                    <h3 className="font-semibold text-blue-800 mb-4 flex items-center gap-2">
                      <span>🖼️</span> Media & Kegiatan Sekolah
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Baris Foto: Sliding Left Animation */}
                      <div className="overflow-hidden relative w-full py-1">
                        <div className="flex gap-4 animate-slide-left w-max">
                          {[1, 2, 3, 1, 2, 3].map((i, idx) => (
                            <div key={`siswa-photo-slide-${idx}`} className="w-48 sm:w-72 flex-shrink-0 rounded-lg overflow-hidden border border-blue-100 bg-slate-50 shadow-sm">
                              {attendanceSettings[`dashboardPhoto${i}`] ? (
                                <img src={resolvePhotoUrl(attendanceSettings[`dashboardPhoto${i}`])} alt={`Sekolah ${i}`} className="w-full h-32 sm:h-48 object-cover hover:scale-110 transition-transform duration-700" />
                              ) : (
                                <div className="h-24 sm:h-40 flex flex-col items-center justify-center text-slate-400">
                                  <span className="text-2xl">📸</span>
                                  <p className="text-[10px]">Foto {i}</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Baris Video: Di sebelah kanan foto pada desktop */}
                      <div className="rounded-lg overflow-hidden border border-blue-100 bg-black shadow-md">
                        {attendanceSettings.dashboardVideo ? (
                          <video src={resolvePhotoUrl(attendanceSettings.dashboardVideo)} controls className="w-full h-full min-h-[160px] sm:min-h-[192px] object-contain" />
                        ) : (
                          <div className="h-32 bg-slate-50 flex flex-col items-center justify-center text-slate-400">
                            <span className="text-2xl">🎥</span><p className="text-[10px]">Belum ada video terbaru</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

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
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                      {[
                        { label: 'Total Pertemuan', value: stats.totalAttendance, color: 'blue', icon: '📅' },
                        { label: 'Hadir', value: stats.presentDays, color: 'green', icon: '✓' },
                        { label: 'Terlambat', value: stats.lateDays, color: 'amber', icon: '⚠' },
                        { label: 'Izin', value: stats.izinDays, color: 'blue', icon: '📋' },
                        { label: 'Sakit', value: stats.sakitDays, color: 'blue', icon: '🏥' },
                        { label: 'Absen', value: stats.absentDays, color: 'red', icon: '✗' },
                      ].map((stat, idx) => (
                      <div key={idx} className="bg-white rounded-2xl p-5 border-2 border-blue-100 shadow-md hover:shadow-lg transition-all group">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-2xl group-hover:scale-110 transition-transform">{stat.icon}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                            stat.color === 'blue' ? 'bg-blue-50 text-blue-600 border-blue-200' : 
                            stat.color === 'green' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 
                            stat.color === 'amber' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' : 
                            'bg-red-50 text-red-600 border-red-200'
                          } border`}>
                            Semester Ini
                          </span>
                        </div>
                        <p className="text-3xl font-bold text-blue-800">{stat.value}</p>
                        <p className="text-slate-500 text-sm mt-1">{stat.label}</p>
                      </div>
                      ))}
                    </div>
                  )}

                  <div className="bg-white rounded-xl border-2 border-blue-200 p-6 mb-6 shadow-lg">
                    <h3 className="font-semibold text-blue-800 mb-4">Progress Kehadiran</h3>
                    <div className="flex flex-col sm:flex-row items-center gap-8">
                      <div className="relative w-32 h-32 group">
                        {/* ✨ Lingkaran Progres dengan Warna Dinamis */}
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="15.9155" fill="none" className="text-slate-100" stroke="currentColor" strokeWidth="3.5" />
                          <circle
                            cx="18"
                            cy="18"
                            r="15.9155"
                            fill="none"
                            className={`${stats.percentage >= 80 ? 'text-green-500' : stats.percentage >= 60 ? 'text-amber-500' : 'text-red-500'} transition-all duration-1000 ease-out`}
                            stroke="currentColor"
                            strokeWidth="3.5"
                            strokeDasharray={`${stats.percentage}, 100`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className={`text-2xl font-black ${stats.percentage >= 80 ? 'text-green-600' : stats.percentage >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                            {Math.round(stats.percentage)}%
                          </span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Hadir</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-blue-600 mb-2">
                          Kamu hadir <span className="font-bold text-blue-600">{stats.presentDays}</span> dari <span className="font-bold">{stats.totalAttendance}</span> pertemuan
                        </p>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="flex items-center gap-2"><span className="w-3 h-3 bg-green-500 rounded-full"></span> Hadir</span>
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
                            <span className="flex items-center gap-2"><span className="w-3 h-3 bg-red-500 rounded-full"></span> Absen</span>
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
                </div>
              )}

              {/* TAB: Absensi */}
              {activeTab === 'absensi' && (
                <div className="animate-fade-in">
                  <div className="bg-white rounded-xl border-2 border-blue-200 p-6 mb-6 shadow-lg">
                    <h2 className="text-xl font-bold text-blue-800 mb-1">🪪 Kode QR Presensi Digital</h2>
                    <p className="text-blue-600 text-sm">Gunakan kode di bawah ini untuk melakukan scan pada perangkat scanner sekolah.</p>
                  </div>

                  <div className="max-w-md mx-auto">
                    <div className="bg-white rounded-[2.5rem] border-2 border-blue-200 shadow-2xl overflow-hidden relative group">
                      {/* Header Kartu */}
                      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white text-center relative">
                        <div className="absolute top-0 right-0 p-4 opacity-20">
                          <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                        </div>
                        <div className="w-16 h-16 bg-white rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
                          <img 
                            src={attendanceSettings.schoolLogo ? resolvePhotoUrl(attendanceSettings.schoolLogo) : "/logo sekolah.jpeg"} 
                            className="w-12 h-12 object-contain" 
                            alt="School"
                          />
                        </div>
                        <h3 className="font-black text-xl tracking-tight leading-tight uppercase">{attendanceSettings.schoolName}</h3>
                        <p className="text-blue-100 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">Kartu Presensi Siswa</p>
                      </div>

                      {/* Body Kartu (QR Area) */}
                      <div className="p-10 flex flex-col items-center bg-slate-50/50">
                        <div className="relative p-5 bg-white rounded-[2rem] shadow-xl border-2 border-blue-50 mb-8 transform transition-transform group-hover:scale-105 duration-500">
                          {qrLoading ? (
                            <div className="w-48 h-48 flex items-center justify-center">
                              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          ) : (
                            <img src={myQRCode} alt="QR Saya" className="w-48 h-48" />
                          )}
                        </div>

                        <div className="text-center space-y-1 mb-8">
                          <p className="text-2xl font-black text-slate-800 tracking-tight">{user.name}</p>
                          <div className="inline-block px-4 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-black uppercase tracking-widest">
                            NIS: {user.nis || user.user_id}
                          </div>
                        </div>

                        <button 
                          onClick={downloadQRCode}
                          className="w-full py-4 bg-slate-900 hover:bg-blue-600 text-white font-black rounded-2xl transition-all duration-300 shadow-lg hover:shadow-blue-500/30 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                        >
                          <span>⬇️</span> Simpan Ke Galeri
                        </button>
                      </div>

                      {/* Footer Aksen */}
                      <div className="h-2 bg-gradient-to-r from-blue-400 via-indigo-500 to-blue-600"></div>
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