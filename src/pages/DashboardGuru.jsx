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

const checkBackendConnection = async () => {
  try {
    const response = await api.get('/health');
    return response.data?.status === 'ok' || response.status === 200;
  } catch (error) {
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
  const [events, setEvents] = useState([]);
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

  // ✨ HELPER: Mendapatkan nama kelas secara akurat dari ID
  const getClassName = (classId) => {
    const found = classes.find(c => c.id?.toString() === classId?.toString());
    if (found) return found.name;
    // Fallback ke data user jika guru adalah wali kelas
    return user?.class_name || user?.kelas || '-';
  };

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
  const [schedules, setSchedules] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [scheduleFormData, setScheduleFormData] = useState({
    day: 'Senin',
    subject_name: '',
    start_time: '07:00',
    end_time: '08:00'
  });

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
    
    const fetchSettings = async () => {
      try {
        const res = await api.get('/public/settings');
        if (res.data) {
          const settings = res.data;
          const mappedSettings = {
            schoolName: settings.schoolName || settings.nama_sekolah || 'AbsensiPro',
            schoolLogo: settings.schoolLogo || settings.logo || settings.logo_url || null,
            dashboardPhoto1: settings.dashboard_photo_1 || settings.dashboardPhoto1 || settings.photo1_url || null,
            dashboardPhoto2: settings.dashboard_photo_2 || settings.dashboardPhoto2 || settings.photo2_url || null,
            dashboardPhoto3: settings.dashboard_photo_3 || settings.dashboardPhoto3 || settings.photo3_url || null,
            dashboardVideo: settings.dashboardVideo || settings.dashboard_video || settings.video_url || null,
            disableAttendanceOnHolidays: settings.disableAttendanceOnHolidays ?? settings.disable_attendance_on_holidays ?? true
          };
          setAttendanceSettings(mappedSettings);
          localStorage.setItem('school_settings', JSON.stringify(mappedSettings));
        }
      } catch (err) {
        console.warn("Gagal fetch settings, pakai local storage", err);
        loadSettings();
      }
    };

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
            dashboardVideo: settings.dashboardVideo || settings.dashboard_video || null,
            disableAttendanceOnHolidays: settings.disableAttendanceOnHolidays ?? settings.disable_attendance_on_holidays ?? true
          });
        } catch (err) {
          console.error("Error parsing settings", err);
        }
      }
    };

    fetchSettings();
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

  // ➕ TAMBAHAN: Auto fetch jadwal saat tab aktif
  useEffect(() => {
    if (user && activeTab === 'jadwal') {
      if (selectedClass) {
        fetchSchedules(selectedClass);
      } else if (classes && classes.length > 0) {
        setSelectedClass(classes[0].id);
        fetchSchedules(classes[0].id);
      }
    }
  }, [activeTab, selectedClass, classes, user]);

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

  // ➕ Check if selected date is Sunday
  const checkIsHoliday = (dateString) => {
    if (!attendanceSettings.disableAttendanceOnHolidays) return false;
    const date = new Date(dateString || selectedDate);
    return date.getDay() === 0;
  };

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
      const [statsRes, classesRes, activityRes, eventsRes] = await Promise.all([
        fetchWithRetry(() => api.get('/guru/stats', config)),
        fetchWithRetry(() => api.get('/guru/classes', config)),
        fetchWithRetry(() => api.get('/guru/activity', config)),
        api.get('/public/events', config).catch(() => ({ data: [] }))
      ]);
      
      setEvents(Array.isArray(eventsRes.data) ? eventsRes.data : (eventsRes.data?.data || []));
      setStats(statsRes.data);
      setClasses(classesRes.data);
      setRecentActivity(activityRes.data);
      if (classesRes.data.length > 0 && !selectedClass) setSelectedClass(classesRes.data[0].id);
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

  // ➕ TAMBAHAN: Fungsi CRUD Jadwal
  const fetchSchedules = async (classId) => {
    if (!classId) return;
    setScheduleLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await api.get(`/guru/schedules?class_id=${classId}`, {
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

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClass) return;
    try {
      const token = localStorage.getItem('token');
      
      if (editId) {
        // Mode EDIT
        await api.put(`/guru/schedules/${editId}`, {
          ...scheduleFormData,
          class_id: selectedClass
        }, { headers: { Authorization: `Bearer ${token}` } });
        addNotification('✅ Jadwal berhasil diperbarui', 'success');
      } else {
        // Mode TAMBAH
        await api.post('/guru/schedules', {
          ...scheduleFormData,
          class_id: selectedClass
        }, { headers: { Authorization: `Bearer ${token}` } });
        addNotification('✅ Jadwal berhasil disimpan', 'success');
      }
      
      setShowScheduleForm(false);
      resetScheduleForm();
      fetchSchedules(selectedClass);
    } catch (err) {
      addNotification('❌ Gagal menyimpan jadwal', 'error');
    }
  };

  const resetScheduleForm = () => {
    setEditId(null);
    setScheduleFormData({ day: 'Senin', subject_name: '', start_time: '07:00', end_time: '08:00' });
  };

  const handleScheduleDelete = async (id) => {
    if (!confirm('Hapus jadwal ini?')) return;
    try {
      const token = localStorage.getItem('token');
      await api.delete(`/guru/schedules/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      addNotification('✅ Jadwal berhasil dihapus', 'success');
      fetchSchedules(selectedClass);
    } catch (err) {
      addNotification('❌ Gagal menghapus jadwal', 'error');
    }
  };

  const openEditScheduleModal = (item) => {
    setEditId(item.id);
    setScheduleFormData({
      day: item.day,
      subject_name: item.subject_name,
      start_time: item.start_time,
      end_time: item.end_time
    });
    setShowScheduleForm(true);
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
      if (checkIsHoliday()) {
        addNotification('❌ Tidak dapat mengisi absensi pada hari libur (Minggu)', 'error');
        return;
      }

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
      if (checkIsHoliday()) {
        addNotification('❌ Tidak dapat mengisi absensi pada hari libur (Minggu)', 'error');
        return;
      }

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
        <aside className={`fixed lg:static inset-y-0 left-0 z-50 bg-white border-r border-gray-200 flex flex-col shadow-sm transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0 w-72' : sidebarCollapsed ? '-translate-x-full lg:translate-x-0 w-20' : '-translate-x-full lg:translate-x-0 w-72'
        }`}>
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
                      {attendanceSettings.schoolName || 'AbsensiPro'}
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

          <nav className="flex-1 p-4 overflow-y-auto">
            {!sidebarCollapsed && <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">MENU</div>}
            <div className="space-y-1">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                    if (item.id === 'siswa' && students.length === 0) fetchStudents();
                  }}
                  className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-3 py-3' : 'gap-3 px-3 py-2.5'} rounded-lg text-left transition-all duration-200 ${
                    activeTab === item.id ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  title={sidebarCollapsed ? item.label : ""}
                >
                  <span className="text-xl flex-shrink-0">{item.icon}</span>
                  {!sidebarCollapsed && <span className="text-sm font-medium flex-1">{item.label}</span>}
                </button>
              ))}
            </div>
          </nav>

          <div className="p-4 border-t border-gray-100">
            {!sidebarCollapsed && (
              <div className="mb-3 bg-gray-50 rounded-xl p-3 border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm flex-shrink-0 border border-gray-200 overflow-hidden">
                    <img
                      src={resolvePhotoUrl(user.photo) || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email || 'Guru')}&background=2563eb&color=ffffff`}
                      alt="User Avatar"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email || 'Guru')}&background=2563eb&color=ffffff`; }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate" title={user.name}>{user.name || 'Guru'}</p>
                    <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                      🎓 Guru
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

        {/* Main Column */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm h-[70px] flex items-center w-full transition-all duration-300 flex-shrink-0">
            <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                {/* ✨ TOMBOL HAMBURGER UNTUK MEMBUKA SIDEBAR */}
                <button
                  onClick={() => window.innerWidth >= 1024 ? setSidebarCollapsed(prev => !prev) : setSidebarOpen(true)}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
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
                <div className="hidden md:flex flex-col items-end border-l border-gray-200 pl-6">
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
                <div className="space-y-6">
                  {/* ✨ BANNER SELAMAT DATANG (Paling Atas) */}
                  <div className="bg-blue-50 border-2 border-blue-100 rounded-3xl p-6 mb-2 shadow-sm flex flex-col sm:flex-row items-center gap-5 relative overflow-hidden transition-all hover:border-blue-200">
                    {/* Ornamen Dekoratif */}
                    <div className="absolute right-0 top-0 w-32 h-full bg-blue-100/50 -skew-x-12 translate-x-16 pointer-events-none"></div>
                    <div className="absolute right-10 top-1/2 -translate-y-1/2 opacity-10 pointer-events-none hidden md:block">
                      <span className="text-8xl">🎓</span>
                    </div>

                    <div className="relative z-10">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden border-4 border-white shadow-md bg-white flex-shrink-0">
                        <img
                          src={resolvePhotoUrl(user?.photo) || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Guru')}&background=2563eb&color=ffffff`}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    
                    <div className="text-center sm:text-left relative z-10">
                      <div className="flex flex-wrap items-center gap-2 mb-1 justify-center sm:justify-start">
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-black rounded-lg uppercase tracking-widest shadow-sm">
                          Wali Kelas {getClassName(user?.class_id)}
                        </span>
                      </div>
                      <h2 className="text-xl lg:text-2xl font-black text-blue-900 leading-tight">
                        Halo, Bapak/Ibu {user?.name}! 👋
                      </h2>
                      <p className="text-blue-600/80 text-sm mt-1 font-medium">
                        Siap untuk menginspirasi siswa Anda hari ini? Berikut ringkasan aktivitas mengajar Anda.
                      </p>
                    </div>
                  </div>

                  {/* ✨ TANGGAL KOTAK DINAMIS (LANDING STYLE) */}
                  {(() => {
                    const sectionBg = getSectionBackground(currentTime);
                    return (
                      <div
                        className="relative overflow-hidden rounded-2xl border-2 border-blue-100 p-6 text-white shadow-lg"
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
                  {/* ✨ TAMBAHAN: Kartu Event Countdown untuk Guru */}
                  {events.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                      {events.map((event) => {
                        const today = new Date(); today.setHours(0,0,0,0);
                        const target = new Date(event.date);
                        const days = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
                        if (days < 0) return null;
                        return (
                          <div key={event.id} className="bg-white rounded-2xl border-2 border-blue-100 overflow-hidden shadow-md flex items-center p-3 gap-4 group hover:border-blue-300 transition-all">
                            <img src={resolvePhotoUrl(event.image)} className="w-16 h-16 rounded-xl object-cover border border-amber-100" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-black text-blue-900 uppercase tracking-tighter truncate">{event.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`${days === 0 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'} text-[10px] font-bold px-2 py-0.5 rounded-md border`}>
                                  {days === 0 ? '🎉 HARI INI' : `⏳ H-${days} Hari Lagi`}
                                </span>
                              </div>
                            </div>
                            <div className="text-blue-300 group-hover:text-blue-500 transition-colors mr-2">
                              📅
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ✨ SEKSI MEDIA (SAMA SEPERTI DASHBOARD SISWA) */}
                  <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-5 shadow-lg mb-6">
                    <h3 className="font-semibold text-blue-800 mb-4 flex items-center gap-2">
                      <span>🖼️</span> Media & Kegiatan Sekolah
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Baris Foto: Sliding Left Animation */}
                      <div className="overflow-hidden relative w-full py-1">
                        <div className="flex gap-4 animate-slide-left w-max">
                          {[1, 2, 3, 1, 2, 3].map((i, idx) => (
                            <div key={`guru-photo-slide-${idx}`} className="w-48 sm:w-72 flex-shrink-0 rounded-lg overflow-hidden border border-blue-100 bg-slate-50 shadow-sm">
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
                              <p className="font-bold text-blue-900">{cls.name}</p>
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
                                <td className="px-6 py-4 text-sm font-bold text-blue-800">{getClassName(student.class_id)}</td>
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
                    <h2 className="text-xl font-bold text-blue-800 mb-1">📅 Manajemen Jadwal Pelajaran</h2>
                    <p className="text-blue-600 text-sm">Kelola mata pelajaran harian (Senin - Minggu) untuk kelas Anda</p>
                  </div>

                  <div className="bg-white rounded-2xl border-2 border-blue-200 p-6 shadow-lg mb-6">
                    <div className="flex flex-col md:flex-row gap-4 items-end justify-between mb-6">
                      <div className="w-full md:w-64">
                        <label className="block text-xs font-bold text-blue-800 mb-2 uppercase">Pilih Kelas</label>
                        <select
                          value={selectedClass}
                          onChange={(e) => setSelectedClass(e.target.value)}
                          className="w-full px-4 py-2.5 border-2 border-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500 bg-blue-50 text-sm font-medium"
                        >
                          {classes.length === 0 ? <option value="">Tidak ada kelas</option> : classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <button
                        onClick={() => {
                          resetScheduleForm();
                          setShowScheduleForm(true);
                        }}
                        disabled={!selectedClass}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-md disabled:bg-slate-300 disabled:cursor-not-allowed"
                      >
                        ➕ Tambah Mata Pelajaran
                      </button>
                    </div>

                    {scheduleLoading ? (
                      <div className="p-10 text-center text-blue-600">Memuat jadwal...</div>
                    ) : !selectedClass ? (
                      <div className="p-10 text-center text-slate-400 italic">Pilih kelas untuk mengelola jadwal</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map(day => {
                          const daySchedules = schedules.filter(s => s.day === day);
                          return (
                            <div key={day} className="border-2 border-blue-50 rounded-2xl overflow-hidden shadow-sm">
                              <div className="px-4 py-2 bg-blue-50 border-b-2 border-blue-100 font-bold text-blue-800 text-sm">{day}</div>
                              <div className="p-4 space-y-2">
                                {daySchedules.length === 0 ? (
                                  <p className="text-xs text-slate-400 italic">Belum ada jadwal</p>
                                ) : (
                                  daySchedules.map((s) => (
                                    <div key={s.id} className="p-3 bg-white border border-blue-100 rounded-xl flex justify-between items-center group hover:border-blue-300 transition-all">
                                      <div>
                                        <p className="font-bold text-blue-900 text-sm">{s.subject_name}</p>
                                        <p className="text-[10px] text-blue-500 font-medium">🕒 {s.start_time} - {s.end_time}</p>
                                      </div>
                                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                        <button
                                          onClick={() => openEditScheduleModal(s)}
                                          className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                          title="Edit"
                                        >
                                          ✏️
                                        </button>
                                        <button
                                          onClick={() => handleScheduleDelete(s.id)}
                                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                          title="Hapus"
                                        >
                                          🗑️
                                        </button>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {showScheduleForm && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-fade-in-up border-2 border-blue-100">
                        <h3 className="text-lg font-bold text-blue-900 mb-4">{editId ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}</h3>
                        <form onSubmit={handleScheduleSubmit} className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hari</label>
                            <select
                              value={scheduleFormData.day}
                              onChange={(e) => setScheduleFormData({...scheduleFormData, day: e.target.value})}
                              className="w-full px-4 py-2 border-2 border-blue-50 rounded-xl text-sm"
                            >
                              {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nama Mata Pelajaran</label>
                            <input
                              type="text" required
                              value={scheduleFormData.subject_name}
                              onChange={(e) => setScheduleFormData({...scheduleFormData, subject_name: e.target.value})}
                              className="w-full px-4 py-2 border-2 border-blue-50 rounded-xl text-sm"
                              placeholder="Misal: Matematika"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Jam Mulai</label>
                              <input type="time" required value={scheduleFormData.start_time} onChange={(e) => setScheduleFormData({...scheduleFormData, start_time: e.target.value})} className="w-full px-4 py-2 border-2 border-blue-50 rounded-xl text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Jam Selesai</label>
                              <input type="time" required value={scheduleFormData.end_time} onChange={(e) => setScheduleFormData({...scheduleFormData, end_time: e.target.value})} className="w-full px-4 py-2 border-2 border-blue-50 rounded-xl text-sm" />
                            </div>
                          </div>
                          <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => { setShowScheduleForm(false); resetScheduleForm(); }} className="flex-1 py-2.5 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-500">Batal</button>
                            <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg">Simpan</button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
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