import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

// ➕ TAMBAHAN: Fungsi cek koneksi ke backend
const resolvePhotoUrl = (photo) => {
  if (!photo) return null;
  if (typeof photo !== 'string') return null;
  const trimmed = photo.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http') || trimmed.startsWith('data:')) return trimmed;
  const base = api.defaults.baseURL?.replace(/\/api\/?$/, '') || '';
  return `${base}/${trimmed.replace(/^\//, '')}`;
};

const checkBackendConnection = async (baseURL) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${baseURL}/health`, {
      signal: controller.signal,
      mode: 'cors'
    });
    clearTimeout(timeout);
    return response.ok || response.status === 401;
  } catch {
    return false;
  }
};

// ➕ TAMBAHAN: Fungsi retry dengan exponential backoff
const fetchWithRetry = async (apiCall, maxRetries = 3, delay = 1000) => {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) break;
      if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

const DashboardGuru = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ringkasan');
  const [isExiting, setIsExiting] = useState(false);
  const navigate = useNavigate();
  
  // ✨ TAMBAHAN: State untuk hamburger menu
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // State untuk data dashboard
  const [stats, setStats] = useState({ totalClasses: 0, totalStudents: 0, todayAttendance: 0 });
  const [classes, setClasses] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [lastSync, setLastSync] = useState(null);

  // ➕ TAMBAHAN: State untuk status koneksi
  const [connectionStatus, setConnectionStatus] = useState('checking');

  const [attendanceSettings, setAttendanceSettings] = useState({
    schoolName: 'AbsensiPro',
    schoolLogo: null,
    dashboardPhoto1: null,
    dashboardPhoto2: null,
    dashboardPhoto3: null,
    dashboardVideo: null
  });
  const [currentTime, setCurrentTime] = useState(new Date());

  // ✨ Theme Sync

  // ➕ TAMBAHAN: State untuk fitur baru
  const [searchQuery, setSearchQuery] = useState('');
  const [attendanceMode, setAttendanceMode] = useState('quick');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState('pdf');
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [pendingAttendance, setPendingAttendance] = useState(0);

  // ← Cek auth & role
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (!token || !userStr) {
      navigate('/');
      return;
    }
    try {
      const userData = JSON.parse(userStr);
      if (userData.role !== 'guru') {
        navigate(`/dashboard/${userData.role}`);
        return;
      }
      setUser(userData);
    } catch {
      localStorage.clear();
      navigate('/');
    }
    setLoading(false);
  }, [navigate]);

  // ➕ TAMBAHAN: Cek koneksi backend saat komponen mount
  useEffect(() => {
    const verifyConnection = async () => {
      const baseURL = api.defaults.baseURL || 'http://127.0.0.1:8000/api';
      const apiRoot = baseURL.replace('/api', '');
      const isConnected = await checkBackendConnection(apiRoot);
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');
      if (!isConnected) {
        console.warn('⚠️ Backend tidak terdeteksi. Pastikan server Laravel berjalan di http://127.0.0.1:8000');
      }
    };
    verifyConnection();
  }, []);

  // ➕ TAMBAHAN: Update waktu real-time & Load Settings
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    const loadSettings = () => {
      const savedSettings = localStorage.getItem('school_settings');
      if (savedSettings) {
        try {
          const settings = JSON.parse(savedSettings);
          setAttendanceSettings({
            schoolName: settings.schoolName || settings.nama_sekolah || 'AbsensiPro',
            schoolLogo: settings.schoolLogo || settings.logo || null,
            dashboardPhoto1: settings.dashboard_photo_1 || settings.dashboardPhoto1 || null,
            dashboardPhoto2: settings.dashboard_photo_2 || settings.dashboardPhoto2 || null,
            dashboardPhoto3: settings.dashboard_photo_3 || settings.dashboardPhoto3 || null,
            dashboardVideo: settings.dashboardVideo || settings.dashboard_video || null
          });
        } catch (err) {
          console.error("Error parsing settings", err);
        }
      }
    };

    loadSettings();
    window.addEventListener('storage', loadSettings);
    return () => {
      clearInterval(timer);
      window.removeEventListener('storage', loadSettings);
    };
  }, []);

  // ← Fetch data dari backend
  useEffect(() => {
    if (user) fetchDashboardData();
    const syncInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchDashboardData(true);
      }
    }, 30000);
    return () => clearInterval(syncInterval);
  }, [user]);

  // ← Listen untuk broadcast dari tab lain
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'attendance_updated') {
        fetchDashboardData(true);
        addNotification('📊 Data absensi diperbarui', 'info');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // ➕ TAMBAHAN: Fungsi notifikasi
  const addNotification = (message, type = 'info', icon = '') => {
    const id = Date.now();
    setNotifications(prev => [{ id, icon, message, type, time: new Date() }, ...prev.slice(0, 4)]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  // ➕ TAMBAHAN: Helper notifikasi absensi yang lebih kaya
  const getAttendanceMessage = (status, isAlready = false) => {
    if (isAlready) {
      return {
        icon: '✅',
        text: 'Sudah tercatat sebelumnya, data absensi tetap aman!',
        type: 'info'
      };
    }
    if (status === 'hadir') {
      return {
        icon: '🎉',
        text: 'Absen berhasil! Semangat belajar dan jaga produktivitasmu.',
        type: 'success'
      };
    }
    if (status === 'terlambat') {
      return {
        icon: '⏰',
        text: 'Terlambat tercatat. Yuk, mulai hari ini dari awal yang lebih baik.',
        type: 'warning'
      };
    }
    if (status === 'absen') {
      return {
        icon: '🛑',
        text: 'Absen tercatat. Pastikan ketidakhadiran dicatat dan ketua kelas diinformasikan.',
        type: 'error'
      };
    }
    if (status === 'izin') {
      return { icon: '📋', text: 'Status izin tersimpan.', type: 'info' };
    }
    if (status === 'sakit') {
      return { icon: '🏥', text: 'Status sakit tersimpan.', type: 'info' };
    }
    return {
      icon: '✅',
      text: 'Absensi diproses. Terima kasih sudah memperbarui kehadiran kamu.',
      type: 'info'
    };
  };

  const fetchDashboardData = async (silent = false) => {
    if (!silent) setDataLoading(true);
    if (connectionStatus === 'disconnected' && !silent) {
      console.warn('⚠️ Koneksi ke backend terputus.');
      setDataLoading(false);
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const [statsRes, classesRes, activityRes] = await Promise.all([
        fetchWithRetry(() => api.get('/guru/stats', config)),
        fetchWithRetry(() => api.get('/guru/classes', config)),
        fetchWithRetry(() => api.get('/guru/activity', config))
      ]);
      setStats(statsRes.data);
      setClasses(classesRes.data);
      setRecentActivity(activityRes.data);
      setLastSync(new Date());
      if (connectionStatus !== 'connected') {
        setConnectionStatus('connected');
      }
      localStorage.setItem('attendance_updated', Date.now().toString());
      localStorage.removeItem('attendance_updated');
      
      // ➕ TAMBAHAN: Hitung pending attendance
      const today = new Date().toISOString().split('T')[0];
      const pending = classesRes.data.filter(c => !c.attendance_submitted || c.attendance_date !== today).length;
      setPendingAttendance(pending);
      if (pending > 0 && !silent) {
        addNotification(`⚠️ Ada ${pending} kelas belum diisi absensinya`, 'warning');
      }
    } catch (err) {
      console.error('Gagal mengambil data:', err);
      if (err.code === 'ECONNREFUSED' || err.message?.includes('Network Error')) {
        setConnectionStatus('disconnected');
        if (!silent) addNotification('🔌 Koneksi terputus. Periksa server backend.', 'error');
      } else if (err.response?.status === 401) {
        localStorage.clear();
        navigate('/');
      } else if (!silent) {
        addNotification(`⚠️ ${err.response?.data?.message || 'Gagal memuat data'}`, 'error');
      }
    } finally {
      if (!silent) setDataLoading(false);
    }
  };

  const fetchStudents = async (classroomId = null) => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const url = classroomId ? `/guru/students?classroom_id=${classroomId}` : '/guru/students';
      const res = await fetchWithRetry(() => api.get(url, config));
      setStudents(res.data);
      setSelectedClass(classroomId || '');
    } catch (err) {
      setStudents([]);
      console.error('Gagal memuat siswa:', err);
      if (err.code !== 'ECONNREFUSED') {
        addNotification('⚠️ Gagal memuat data siswa', 'error');
      }
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

  const sendParentWhatsApp = async (student, status) => {
    if (!student || !student.parent_phone) return;

    const token = localStorage.getItem('token');
    const message = `Halo orang tua ${student.name || 'siswa'},\n\nAnanda tercatat ${status === 'terlambat' ? 'TERLAMBAT' : status === 'absen' ? 'ABSEN' : 'hadir'} pada ${selectedDate}.\nHarap informasikan kepada siswa dan pastikan kedatangan tepat waktu.\n\nTerima kasih.`;

    try {
      await api.post('/whatsapp/send-bulk', {
        class_id: selectedClass || student.class_id || '',
        message_type: 'attendance',
        custom_message: message
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      addNotification(`📩 WA notifikasi ${status} ke orang tua ${student.name} berhasil`, 'success');
    } catch (err) {
      console.error('WA otomatis gagal:', err);
      addNotification('⚠️ WA otomatis ke orang tua gagal dikirim. Cek konfigurasi WA server.', 'warning');
    }
  };

  const handleAttendanceSubmit = async (studentId, status) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetchWithRetry(() => api.post('/guru/attendance', {
        student_id: studentId,
        status: status,
        date: selectedDate
      }, { headers: { Authorization: `Bearer ${token}` } }));
      
      const student = students.find((s) => s.id === studentId || s.student_id === studentId);
      const wasCreated = res?.data?.was_recently_created;

      // notifikasi dengan teks dan icon sesuai status
      const messageInfo = getAttendanceMessage(status, wasCreated === false);
      addNotification(messageInfo.text, messageInfo.type, messageInfo.icon);

      if (status === 'terlambat' && student) {
        await sendParentWhatsApp(student, status);
      }

      fetchDashboardData();
      localStorage.setItem('attendance_updated', Date.now().toString());
      localStorage.removeItem('attendance_updated');
    } catch (err) {
      console.error(err);
      const errorMsg = err.response?.data?.message || 'Gagal menyimpan absensi';
      addNotification(`❌ ${errorMsg}`, 'error');
    }
  };

  // ➕ TAMBAHAN: Bulk attendance submit
  const handleBulkAttendance = async (attendances) => {
    try {
      const token = localStorage.getItem('token');
      await api.post('/guru/attendance/bulk', {
        attendances: attendances,
        date: selectedDate
      }, { headers: { Authorization: `Bearer ${token}` } });
      addNotification('✅ Semua absensi berhasil disimpan', 'success');
      fetchDashboardData();
      localStorage.setItem('attendance_updated', Date.now().toString());
      localStorage.removeItem('attendance_updated');
    } catch (err) {
      addNotification('❌ Gagal menyimpan absensi', 'error');
    }
  };

  const handleExportReport = async (type) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetchWithRetry(() => api.get(`/guru/reports/${type}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      }));
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `laporan-${type}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addNotification('✅ Laporan berhasil diunduh', 'success');
    } catch (err) {
      console.error(err);
      addNotification('❌ Gagal export laporan', 'error');
    }
  };

  const handleManualRefresh = async () => {
    setConnectionStatus('checking');
    await fetchDashboardData(false);
  };

  // ➕ TAMBAHAN: Filter students based on search
  const filteredStudents = students.filter(student =>
    student.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.nis?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ➕ TAMBAHAN: Get today's classes
  const todayClasses = classes.filter(cls => {
    const today = new Date().toISOString().split('T')[0];
    return cls.schedule?.some(s => s.day === new Date().toLocaleDateString('id-ID', { weekday: 'long' }).toLowerCase());
  });

  const menuItems = [
    { id: 'ringkasan', label: 'Ringkasan', icon: '🏠' },
    { id: 'absensi', label: 'Input Absensi', icon: '📝' },
    { id: 'siswa', label: 'Data Siswa', icon: '👥' },
    { id: 'profil', label: 'Profil Saya', icon: '👤' },
    { id: 'jadwal', label: 'Jadwal Mengajar', icon: '📅' },
    { id: 'laporan', label: 'Laporan', icon: '📈' },
  ];

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-blue-600 font-medium">Memuat dashboard...</p>
          {connectionStatus === 'disconnected' && (
            <p className="text-xs text-amber-600 mt-2">⚠️ Cek koneksi backend</p>
          )}
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

        {/* Sidebar */}
        <aside className={`fixed lg:static inset-y-0 left-0 z-50 bg-white border-r-2 border-blue-200 flex flex-col shadow-lg transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0 w-72' : sidebarCollapsed ? '-translate-x-full lg:translate-x-0 w-20 lg:w-20' : '-translate-x-full lg:translate-x-0 lg:w-72'
        }`}>
          <div className="p-6 border-b-2 border-blue-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg overflow-hidden shadow-md border-2 border-blue-200">
                  <img
                    src={attendanceSettings.schoolLogo ? resolvePhotoUrl(attendanceSettings.schoolLogo) : "/logo sekolah.jpeg"}
                    alt="Logo Sekolah"
                    className="w-full h-full object-contain bg-white"
                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/40/2563eb/ffffff?text=S'; }}
                  />
                </div>
                {!sidebarCollapsed && (
                  <span className="text-lg font-bold text-blue-800 truncate max-w-[150px]">
                    {attendanceSettings.schoolName || 'AbsensiPro'}
                  </span>
                )}
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-2 text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                  if (item.id === 'siswa' && students.length === 0) fetchStudents();
                }}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2' : 'gap-3 px-4 py-3'} rounded-xl text-left transition-all duration-200 group border-2 ${
                  activeTab === item.id
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium border-blue-300 shadow-md'
                    : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700 border-transparent hover:border-blue-200'
                }`}
                title={sidebarCollapsed ? item.label : ""}
              >
                <span className="text-lg transition-transform group-hover:scale-110">{item.icon}</span>
                {!sidebarCollapsed && <span className="text-sm font-medium">{item.label}</span>}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t-2 border-blue-100">
            {!sidebarCollapsed && (
              <div className="mb-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border-2 border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-white rounded-full flex items-center justify-center shadow-sm flex-shrink-0 border-2 border-blue-300 overflow-hidden">
                    <img
                      src={resolvePhotoUrl(user.photo) || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email || 'Guru')}&background=2563eb&color=ffffff`}
                      alt="User Avatar"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email || 'Guru')}&background=2563eb&color=ffffff`; }}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-blue-800 font-semibold text-sm truncate max-w-[140px]" title={user.name}>{user.name || 'Guru'}</p>
                    <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200">
                      🎓 Guru
                    </span>
                  </div>
                </div>
              </div>
            )}
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all text-sm font-medium border-2 border-transparent hover:border-red-200"
              title="Keluar"
            >
              <span className="flex-shrink-0">🚪</span>
              {!sidebarCollapsed && <span>Keluar</span>}
            </button>
          </div>
        </aside>

        {/* Main Column */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-white border-b-2 border-blue-100 sticky top-0 z-40 shadow-sm h-[70px] flex items-center w-full transition-all duration-300 flex-shrink-0">
            <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                {/* ✨ TOMBOL HAMBURGER UNTUK MEMBUKA SIDEBAR */}
                <button
                  onClick={() => window.innerWidth >= 1024 ? setSidebarCollapsed(prev => !prev) : setSidebarOpen(true)}
                  className="p-2 text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all"
                  title="Toggle Sidebar"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>

                {/* ✨ Judul dinamis mengikuti fitur yang diklik (SAMADENGAN DASHBOARD SISWA) */}
                <h1 className="text-lg md:text-xl font-bold text-blue-900 tracking-tight ml-2">
                  {menuItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
                </h1>
              </div>

              <div className="flex items-center gap-2 md:gap-6">
                <div className="hidden md:flex flex-col items-end border-l-2 border-blue-50 pl-6">
                  <p className="text-[11px] font-bold text-blue-400 uppercase tracking-widest leading-none mb-1">
                    {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  <p className="text-lg font-black text-blue-900 font-mono leading-none">
                    {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <span className="text-xl">🔔</span>
                    {pendingAttendance > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">{pendingAttendance}</span>}
                  </button>
                </div>
              </div>
            </div>
          </header>

      {/* ➕ TAMBAHAN: Banner notifikasi jika offline */}
      {connectionStatus === 'disconnected' && (
        <div className="bg-gradient-to-r from-amber-50 to-amber-100 border-b-2 border-amber-200 px-4 py-3 text-center">
          <p className="text-sm text-amber-800">
            ⚠️ Koneksi ke server terputus.
            <button
              onClick={handleManualRefresh}
              className="ml-2 font-medium text-amber-900 hover:underline"
            >
              Coba hubungkan ulang
            </button>
            <span className="ml-2 text-amber-600">• Pastikan backend berjalan di http://127.0.0.1:8000</span>
          </p>
        </div>
      )}

          {/* Page Content Area - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-8">
            <div className="max-w-7xl mx-auto w-full animate-fade-in">
              {/* NOTIFICATION TOASTS */}
              <div className="fixed top-4 right-4 z-50 space-y-2">
                {notifications.map(notif => (
                  <div key={notif.id} className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-fade-in flex items-center gap-2 ${notif.type === 'success' ? 'bg-green-500 text-white' : notif.type === 'error' ? 'bg-red-500 text-white' : notif.type === 'warning' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'}`}>
                    {notif.icon && <span className="text-lg">{notif.icon}</span>}
                    <span>{notif.message}</span>
                  </div>
                ))}
              </div>

              {/* TAB: Ringkasan */}
              {activeTab === 'ringkasan' && (
                <div>
                  <div className="bg-white rounded-2xl border-2 border-blue-200 p-6 mb-6 shadow-lg">
                    <h2 className="text-xl font-bold text-blue-800 mb-1">Halo, {user.name}! 👋</h2>
                    <p className="text-blue-600 text-sm">Ringkasan aktivitas mengajar hari ini</p>
                  </div>

                  {/* ✨ SEKSI MEDIA (SAMA SEPERTI DASHBOARD SISWA) */}
                  <div className="bg-white rounded-xl border-2 border-blue-200 p-5 shadow-lg mb-6">
                    <h3 className="font-semibold text-blue-800 mb-4 flex items-center gap-2">
                      <span>🖼️</span> Media & Kegiatan Sekolah
                    </h3>
                    <div className="flex flex-col gap-4">
                      {/* Baris Foto: Sliding Left Animation */}
                      <div className="overflow-hidden relative w-full py-1">
                        <div className="flex gap-4 animate-slide-left w-max">
                          {[1, 2, 3, 1, 2, 3].map((i, idx) => (
                            <div key={`guru-photo-slide-${idx}`} className="w-48 sm:w-72 flex-shrink-0 rounded-lg overflow-hidden border border-blue-100 bg-slate-50 shadow-sm">
                              {attendanceSettings[`dashboardPhoto${i}`] ? (
                                <img src={resolvePhotoUrl(attendanceSettings[`dashboardPhoto${i}`])} alt={`Sekolah ${i}`} className="w-full h-24 sm:h-40 object-cover hover:scale-110 transition-transform duration-700" />
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
                      {/* Baris Video: Di bawah foto */}
                      <div className="rounded-lg overflow-hidden border border-blue-100 bg-black shadow-md">
                        {attendanceSettings.dashboardVideo ? (
                          <video src={resolvePhotoUrl(attendanceSettings.dashboardVideo)} controls className="w-full h-40 sm:h-64 object-contain" />
                        ) : (
                          <div className="h-32 bg-slate-50 flex flex-col items-center justify-center text-slate-400">
                            <span className="text-2xl">🎥</span><p className="text-[10px]">Belum ada video terbaru</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Kartu Statistik */}
                  {dataLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      {[1,2,3].map((i) => (
                        <div key={i} className="bg-white rounded-2xl p-5 border-2 border-blue-200 animate-pulse">
                          <div className="h-4 bg-blue-200 rounded w-24 mb-3"></div>
                          <div className="h-8 bg-blue-200 rounded w-16"></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      {[
                        { label: 'Total Kelas', value: stats.totalClasses, icon: '🏫', color: 'blue' },
                        { label: 'Total Siswa', value: stats.totalStudents, icon: '👥', color: 'blue' },
                        { label: 'Kehadiran Hari Ini', value: `${stats.todayAttendance}%`, icon: '✅', color: 'green' },
                      ].map((stat, idx) => (
                        <div key={idx} className="bg-white rounded-2xl p-5 border-2 border-blue-200 hover:shadow-lg transition-all shadow-md">
                          <p className="text-sm text-blue-600 mb-3">{stat.label}</p>
                          <div className="flex items-center justify-between">
                            <p className={`text-3xl font-bold text-${stat.color}-600`}>{stat.value}</p>
                            <div className={`w-12 h-12 bg-${stat.color}-50 rounded-xl flex items-center justify-center text-xl border-2 border-${stat.color}-200`}>
                              {stat.icon}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Daftar Kelas */}
                  <div className="bg-white rounded-2xl border-2 border-blue-200 mb-6 shadow-lg">
                    <div className="px-6 py-4 border-b-2 border-blue-100 flex justify-between items-center">
                      <h3 className="font-semibold text-blue-800">Kelas Anda</h3>
                      <button
                        onClick={handleManualRefresh}
                        disabled={dataLoading || connectionStatus === 'disconnected'}
                        className={`text-xs ${dataLoading || connectionStatus === 'disconnected' ? 'text-blue-300 cursor-not-allowed' : 'text-blue-600 hover:underline'}`}
                      >
                        {dataLoading ? '⏳ Memuat...' : '🔄 Refresh'}
                      </button>
                    </div>
                    <div className="divide-y-2 divide-blue-50">
                      {dataLoading ? (
                        <div className="p-6 text-center text-blue-600">Memuat data kelas...</div>
                      ) : classes.length === 0 ? (
                        <div className="p-6 text-center text-blue-600">
                          <p className="text-3xl mb-2">📭</p>
                          <p>Belum ada kelas yang ditugaskan</p>
                        </div>
                      ) : (
                        classes.map((cls) => (
                          <div key={cls.id} className="p-4 flex items-center justify-between hover:bg-blue-50 transition-colors">
                            <div>
                              <p className="font-medium text-blue-800">{cls.name}</p>
                              <p className="text-sm text-blue-600">{cls.total_students} siswa</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-xs text-blue-600">Kehadiran</p>
                                <p className="text-lg font-bold text-blue-600">{cls.attendance_percentage}%</p>
                              </div>
                              <button
                                onClick={() => {
                                  setSelectedClass(cls.id);
                                  fetchStudents(cls.id);
                                  setActiveTab('absensi');
                                  addNotification(`📝 Input absensi untuk ${cls.name}`, 'info');
                                }}
                                className="px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl transition-all shadow-md"
                              >
                                Input Absensi
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  {/* Aktivitas Terbaru */}
                  <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-lg">
                    <div className="px-6 py-4 border-b-2 border-blue-100">
                      <h3 className="font-semibold text-blue-800">Aktivitas Terbaru</h3>
                    </div>
                    <div className="divide-y-2 divide-blue-50 max-h-96 overflow-y-auto">
                      {dataLoading ? (
                        <div className="p-6 text-center text-blue-600">Memuat aktivitas...</div>
                      ) : recentActivity.length === 0 ? (
                        <div className="p-6 text-center text-blue-600">
                          <p className="text-3xl mb-2">📭</p>
                          <p>Belum ada aktivitas hari ini</p>
                        </div>
                      ) : (
                        recentActivity.map((act) => (
                          <div key={act.id} className="p-4 flex items-center justify-between hover:bg-blue-50 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border-2 ${
                                act.status === 'hadir'
                                  ? 'bg-green-50 border-green-200 text-green-600'
                                  : act.status === 'terlambat'
                                  ? 'bg-amber-50 border-amber-200 text-amber-600'
                                  : 'bg-red-50 border-red-200 text-red-600'
                              }`}>
                                {act.student_name?.charAt(0) || 'S'}
                              </div>
                              <div>
                                <p className="font-medium text-blue-800">{act.student_name}</p>
                                <p className="text-sm text-blue-600">{act.action}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-blue-600">
                                {new Date(act.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                              <span className={`text-sm font-bold ${
                                act.status === 'hadir' ? 'text-green-600' :
                                act.status === 'terlambat' ? 'text-amber-600' : 'text-red-600'
                              }`}>
                                {act.status === 'hadir' ? '✓ Hadir' :
                                act.status === 'terlambat' ? '⚠ Terlambat' : '✗ Absen'}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: Input Absensi */}
              {activeTab === 'absensi' && (
                <div>
                  <div className="bg-white rounded-2xl border-2 border-blue-200 p-6 mb-6 shadow-lg">
                    <h2 className="text-xl font-bold text-blue-800 mb-1">Input Absensi</h2>
                    <p className="text-blue-600 text-sm">Pilih kelas dan catat kehadiran siswa</p>
                  </div>
                  <div className="bg-white rounded-2xl border-2 border-blue-200 p-6 shadow-lg">
                    {/* ➕ TAMBAHAN: Date Selector */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-blue-700 mb-2">Tanggal Absensi</label>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full md:w-64 px-4 py-3 border-2 border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                      />
                    </div>
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-blue-700 mb-2">Pilih Kelas</label>
                      <select
                        className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white disabled:bg-blue-50 disabled:cursor-not-allowed"
                        onChange={(e) => fetchStudents(e.target.value)}
                        value={selectedClass}
                        disabled={connectionStatus === 'disconnected' || dataLoading}
                      >
                        <option value="">-- Pilih Kelas --</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name} ({cls.total_students} siswa)
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* ➕ TAMBAHAN: Attendance Mode Toggle */}
                    <div className="mb-6 flex gap-2">
                      <button
                        onClick={() => setAttendanceMode('quick')}
                        className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all border-2 ${
                          attendanceMode === 'quick'
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-500 shadow-md'
                            : 'bg-blue-50 text-blue-600 border-blue-200 hover:border-blue-300'
                        }`}
                      >
                        ⚡ Cepat (Per Siswa)
                      </button>
                      <button
                        onClick={() => setAttendanceMode('bulk')}
                        className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all border-2 ${
                          attendanceMode === 'bulk'
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-500 shadow-md'
                            : 'bg-blue-50 text-blue-600 border-blue-200 hover:border-blue-300'
                        }`}
                      >
                        📋 Bulk (Semua Sekali)
                      </button>
                    </div>
                    {students.length === 0 ? (
                      <div className="text-center py-12 text-blue-600">
                        <p className="text-3xl mb-2">📋</p>
                        <p>Pilih kelas untuk melihat daftar siswa</p>
                        {connectionStatus === 'disconnected' && (
                          <p className="text-xs text-amber-600 mt-2">💡 Pastikan koneksi ke server aktif</p>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* ➕ TAMBAHAN: Search Bar */}
                        <div className="mb-4">
                          <input
                            type="text"
                            placeholder="🔍 Cari siswa..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                          />
                        </div>
                        <div className="mb-4 flex flex-wrap gap-2 justify-between items-center text-sm text-blue-600">
                          <span>{filteredStudents.length} siswa ditemukan</span>
                          <div className="flex flex-wrap gap-2">
                            {attendanceMode === 'bulk' && selectedClass && filteredStudents.length > 0 && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const attendances = filteredStudents.filter((s) => s.has_login !== false).map((s) => ({ student_id: s.id, status: 'hadir' }));
                                  if (!attendances.length) {
                                    addNotification('⚠️ Tidak ada siswa dengan akun untuk ditandai hadir', 'warning');
                                    return;
                                  }
                                  await handleBulkAttendance(attendances);
                                }}
                                disabled={connectionStatus === 'disconnected'}
                                className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium disabled:opacity-50"
                              >
                                Tandai semua hadir
                              </button>
                            )}
                            <button
                              onClick={() => fetchStudents(selectedClass)}
                              disabled={connectionStatus === 'disconnected'}
                              className={`${connectionStatus === 'disconnected' ? 'text-blue-300 cursor-not-allowed' : 'text-blue-600 hover:underline'}`}
                            >
                              🔄 Refresh Data
                            </button>
                          </div>
                        </div>
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                          {filteredStudents.map((student) => (
                            <div key={student.id} className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border-2 border-blue-200 hover:border-blue-400 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md">
                                  {student.name?.charAt(0) || 'S'}
                                </div>
                                <div>
                                  <span className="font-medium text-blue-800 block">{student.name}</span>
                                  <span className="text-xs text-blue-600">{student.nis || '-'}</span>
                                  {student.has_login === false && (
                                    <span className="text-xs text-amber-600 block mt-0.5">⚠ Belum ada akun siswa (NIS sama)</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1 justify-end max-w-[220px]">
                                {[
                                  { status: 'hadir', label: 'H', title: 'Hadir', className: 'bg-green-500 hover:bg-green-600 text-white border-green-600' },
                                  { status: 'terlambat', label: 'T', title: 'Terlambat', className: 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600' },
                                  { status: 'izin', label: 'I', title: 'Izin', className: 'bg-sky-500 hover:bg-sky-600 text-white border-sky-600' },
                                  { status: 'sakit', label: 'S', title: 'Sakit', className: 'bg-violet-500 hover:bg-violet-600 text-white border-violet-600' },
                                  { status: 'absen', label: 'A', title: 'Absen', className: 'bg-red-500 hover:bg-red-600 text-white border-red-600' },
                                ].map(({ status, label, title, className }) => (
                                  <button
                                    key={status}
                                    type="button"
                                    title={title}
                                    onClick={() => handleAttendanceSubmit(student.id, status)}
                                    disabled={connectionStatus === 'disconnected' || student.has_login === false}
                                    className={`px-2.5 py-2 text-xs font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed border-2 ${className}`}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: Data Siswa */}
              {activeTab === 'siswa' && (
                <div>
                  <div className="bg-white rounded-2xl border-2 border-blue-200 p-6 mb-6 shadow-lg">
                    <h2 className="text-xl font-bold text-blue-800 mb-1">Data Siswa</h2>
                    <p className="text-blue-600 text-sm">Kelola data siswa di kelas Anda</p>
                  </div>
                  {dataLoading ? (
                    <div className="bg-white rounded-2xl border-2 border-blue-200 p-6 text-center shadow-lg">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                      <p className="text-blue-600">Memuat data siswa...</p>
                    </div>
                  ) : students.length === 0 ? (
                    <div className="bg-white rounded-2xl border-2 border-blue-200 p-6 text-center shadow-lg">
                      <p className="text-3xl mb-2">📭</p>
                      <p className="text-blue-600">Pilih kelas untuk melihat data siswa</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border-2 border-blue-200 overflow-hidden shadow-lg">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-blue-50 border-b-2 border-blue-200">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-blue-600 uppercase">Nama</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-blue-600 uppercase">NIS</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-blue-600 uppercase">Kelas</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-blue-600 uppercase">Kehadiran</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-blue-600 uppercase">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y-2 divide-blue-100">
                            {students.map((student) => (
                              <tr key={student.id} className="hover:bg-blue-50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center text-blue-700 font-bold text-xs border-2 border-blue-200">
                                      {student.name?.charAt(0) || 'S'}
                                    </div>
                                    <span className="font-medium text-blue-800">{student.name}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-blue-600">{student.nis || '-'}</td>
                                <td className="px-6 py-4 text-sm text-blue-600">{student.class_name || '-'}</td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full border-2 ${
                                    (student.attendance_percentage || 0) >= 80
                                      ? 'bg-green-100 text-green-700 border-green-200'
                                      : (student.attendance_percentage || 0) >= 60
                                      ? 'bg-amber-100 text-amber-700 border-amber-200'
                                      : 'bg-red-100 text-red-700 border-red-200'
                                  }`}>
                                    {student.attendance_percentage || 0}%
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <button className="text-blue-600 font-medium hover:text-blue-800 hover:underline text-sm">
                                    Detail
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
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
                          <span className="text-5xl text-blue-400 font-bold">{user.name?.charAt(0) || 'G'}</span>
                        )}
                      </div>
                      <h3 className="text-2xl font-bold text-blue-900">{user.name}</h3>
                      <p className="text-blue-600 text-sm">Tenaga Pendidik / Guru</p>
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
                          <span className="text-blue-600">NIP / ID Guru:</span>
                          <span className="font-medium">{user.nip || user.user_id || '-'}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b-2 border-blue-200">
                          <span className="text-blue-600">Jenis Kelamin:</span>
                          <span className="font-medium">{user.gender || '-'}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b-2 border-blue-200">
                          <span className="text-blue-600">No. Telepon:</span>
                          <span className="font-medium">{user.phone || '-'}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b-2 border-blue-200">
                          <span className="text-blue-600">Wali Kelas:</span>
                          <span className="font-medium">{user.class_name || user.kelas || '-'}</span>
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

              {/* TAB: Jadwal Mengajar */}
              {activeTab === 'jadwal' && (
                <div>
                  <div className="bg-white rounded-2xl border-2 border-blue-200 p-6 mb-6 shadow-lg">
                    <h2 className="text-xl font-bold text-blue-800 mb-1">📅 Jadwal Mengajar</h2>
                    <p className="text-blue-600 text-sm">Jadwal kelas Anda minggu ini</p>
                  </div>
                  <div className="bg-white rounded-2xl border-2 border-blue-200 p-12 text-center shadow-lg">
                    <p className="text-5xl mb-4">📅</p>
                    <p className="text-blue-700 font-medium">Fitur jadwal mengajar</p>
                    <p className="text-blue-500 text-sm mt-2">Segera hadir - Sinkronisasi dengan kalender sekolah</p>
                  </div>
                </div>
              )}

              {/* TAB: Laporan */}
              {activeTab === 'laporan' && (
                <div>
                  <div className="bg-white rounded-2xl border-2 border-blue-200 p-6 mb-6 shadow-lg">
                    <h2 className="text-xl font-bold text-blue-800 mb-1">Laporan</h2>
                    <p className="text-blue-600 text-sm">Export data absensi untuk keperluan administrasi</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { type: 'harian', icon: '📄', judul: 'Laporan Harian', desk: 'Export ke PDF' },
                      { type: 'bulanan', icon: '📊', judul: 'Laporan Bulanan', desk: 'Export ke Excel' },
                      { type: 'kelas', icon: '📋', judul: 'Rekap Per Kelas', desk: 'Export ke CSV' },
                      { type: 'cetak', icon: '🖨️', judul: 'Cetak Laporan', desk: 'Print langsung' },
                    ].map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleExportReport(item.type)}
                        disabled={connectionStatus === 'disconnected'}
                        className={`flex items-center gap-4 p-5 bg-white rounded-2xl border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 hover:shadow-lg transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white ${connectionStatus === 'disconnected' ? '' : ''}`}
                      >
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-xl text-blue-600 group-hover:scale-110 transition-transform border-2 border-blue-200">
                          {item.icon}
                        </div>
                        <div>
                          <p className="font-medium text-blue-800">{item.judul}</p>
                          <p className="text-sm text-blue-600">{item.desk}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
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

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideLeft {
          0% { transform: translateX(0); }
          100% { transform: translateX(calc(-50% - 8px)); }
        }
        .animate-slide-left {
          animation: slideLeft 25s linear infinite;
        }
        .animate-slide-left:hover {
          animation-play-state: paused;
        }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
      `}</style>
    </div>
  );
};

export default DashboardGuru;