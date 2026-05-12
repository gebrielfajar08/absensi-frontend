import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

// Helper functions
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
    console.warn('Invalid date value:', utcDate);
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
    console.error('Date formatting error:', err);
    return utcDate.toString();
  }
};

const formatTimeOnly = (utcDate) => {
  if (!utcDate) return '-';
  const date = new Date(utcDate);
  if (isNaN(date.getTime())) {
    console.warn('Invalid date:', utcDate);
    return '-';
  }
  const options = {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };
  return new Intl.DateTimeFormat('id-ID', options).format(date);
};

const formatDateOnly = (utcDate) => {
  if (!utcDate) return '-';
  const date = new Date(utcDate);
  if (isNaN(date.getTime())) {
    console.warn('Invalid date:', utcDate);
    return '-';
  }
  const options = {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  return new Intl.DateTimeFormat('id-ID', options).format(date);
};

const resolvePhotoUrl = (photo, fallbackBase = 'http://127.0.0.1:8000') => {
  if (!photo || typeof photo !== 'string') return null;
  const trimmed = photo.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http') || trimmed.startsWith('data:')) return trimmed;
  const base = api.defaults.baseURL?.replace(/\/api\/?$/, '') || fallbackBase;
  return `${base}/${trimmed.replace(/^\//, '')}`;
};

const staticClassOptions = [
  { id: 'kelas-1', name: 'Kelas 1' },
  { id: 'kelas-2', name: 'Kelas 2' },
  { id: 'kelas-3', name: 'Kelas 3' }
];

const userEndpointCandidates = {
  create: ['/admin/users'],
  index: ['/admin/users'],
  update: (id) => [`/admin/users/${id}`],
  delete: (id) => [`/admin/users/${id}`]
};

const apiTryEndpoints = async (method, endpoints, ...args) => {
  let lastError;
  for (const endpoint of endpoints) {
    try {
      return await api[method](endpoint, ...args);
    } catch (err) {
      lastError = err;
      const status = err?.response?.status;
      // ✨ JANGAN retri jika timeout atau server tidak merespon (Network Error)
      if (!status || [401, 403, 422].includes(status)) {
        break;
      }
    }
  }
  throw lastError;
};

const DashboardAdmin = () => {

  const handleSettingsChange = (e) => {
  const { name, value, type, checked } = e.target;

  setSettingsData(prev => ({
    ...prev,
    [name]: type === 'checkbox' ? checked : value
  }));
};

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isExiting, setIsExiting] = useState(false);
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  // State untuk data
  const [stats, setStats] = useState({
    totalUsers: 0, totalGuru: 0, totalSiswa: 0, totalKelas: 0, kehadiranHariIni: 0
  });
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [attendanceReports, setAttendanceReports] = useState([]);
  const [currentActivityPage, setCurrentActivityPage] = useState(1);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState('');
  const activityPageSize = 10;

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(attendanceReports.length / activityPageSize));
    if (currentActivityPage > totalPages) {
      setCurrentActivityPage(totalPages);
    }
  }, [attendanceReports, currentActivityPage, activityPageSize]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  // ✨ TAMBAHAN: State untuk fitur baru
  const [subjects, setSubjects] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  
  // State untuk Data Guru dan Data Siswa
  const [guruData, setGuruData] = useState([]);
  const [siswaData, setSiswaData] = useState([]);
  
  // ✨ TAMBAHAN: State untuk fitur WhatsApp
  const [waSearchQuery, setWaSearchQuery] = useState('');
  const [waMessageTemplate, setWaMessageTemplate] = useState('Halo, ini pesan dari admin sekolah. ');
  
  // State untuk modal/form
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', role: 'guru', user_id: '', class_id: '', phone: '', parent_phone: '', gender: '', parent_name: ''
  });
  const [selectedUser, setSelectedUser] = useState(null);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  
  const [mediaPhotoFiles, setMediaPhotoFiles] = useState({ 1: null, 2: null, 3: null });
  const [mediaPhotoPreviews, setMediaPhotoPreviews] = useState({ 1: null, 2: null, 3: null });
  const [mediaVideoFile, setMediaVideoFile] = useState(null);
  const [mediaVideoPreview, setMediaVideoPreview] = useState(null);

  // ✨ TAMBAHAN: State untuk Fitur Event
  const [events, setEvents] = useState([]);
  const [showEventModal, setShowAnnouncementModal_Event] = useState(false); // Menggunakan nama unik
  const [eventFormData, setEventFormData] = useState({ title: '', date: '', image: null });
  const [eventImagePreview, setEventImagePreview] = useState(null);
  const [isSavingEvent, setIsSavingEvent] = useState(false);

  const [showSuccessNotification, setShowSuccessNotification] = useState(false);

  // ✨ TAMBAHAN: State untuk Modal Profil Detail
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState(null);

  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  // ✨ TAMBAHAN: State untuk QR Code Modal
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeData, setQrCodeData] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  
  // ✨ TAMBAHAN: State untuk Pengaturan
  const [settingsData, setSettingsData] = useState({
    schoolName: '',
    schoolAddress: '',
    schoolPhone: '',
    schoolEmail: '',
    academicYear: '',
    schoolLogo: null,
    attendanceStartTime: '',
    attendanceOpenTime: '',
    attendanceCloseTime: '',
    attendanceEndTime: '',
    lateThreshold: '',
    enableNotifications: true,
    enableEmailReports: true,
    enableQRCode: true,
    themeColor: 'blue',
    attendanceSessionOpen: true,
    schoolEndTime: '',
    autoMarkAbsentEnabled: true,
    limitOneScanPerDay: true,
    disableAttendanceOnHolidays: true,
    dashboardPhoto1: null,
    dashboardPhoto2: null,
    dashboardPhoto3: null,
    dashboardVideo: null,
  });

  const [settingsSection, setSettingsSection] = useState('school');

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

  // Fetch Data Guru
const fetchDataGuru = async () => {
  try {
    const token = localStorage.getItem('token');
    const res = await api.get('/admin/users?role=guru', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const rawData = res.data?.data || res.data || [];
    setGuruData(Array.isArray(rawData) ? rawData.map(normalizeUser) : []);
  } catch (err) {
    console.error('Gagal mengambil data guru:', err);
    setGuruData([]);
  }
};

// Fetch Data Siswa
const fetchDataSiswa = async () => {
  try {
    const token = localStorage.getItem('token');
    const res = await api.get('/admin/users?role=siswa', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const rawData = res.data?.data || res.data || [];
    setSiswaData(Array.isArray(rawData) ? rawData.map(normalizeUser) : []);
  } catch (err) {
    console.error('Gagal mengambil data siswa:', err);
    setSiswaData([]);
  }
};

const fetchClasses = async () => {
  try {
    const token = localStorage.getItem('token');
    const config = { headers: { Authorization: `Bearer ${token}` } };
    const res = await apiTryEndpoints('get', ['/admin/classes', '/classes', '/class'], config);
    setClasses(res.data?.data || res.data || []);
  } catch (err) {
    console.error('Gagal mengambil data kelas:', err);
    setClasses([]);
  }
};

  // ✨ TAMBAHAN: Fetch functions untuk fitur baru (DIPINDAHKAN KE SCOPE UTAMA)
  const fetchSubjects = async () => {
    try {
      setFeatureDataLoading(true);
      const token = localStorage.getItem('token');
      const res = await api.get('/admin/subjects', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSubjects(Array.isArray(res.data) ? res.data : (res.data.data || []));
    } catch (err) {
      console.error('Gagal mengambil data mata pelajaran:', err);
      setSubjects([]);
    } finally {
      setFeatureDataLoading(false);
    }
  };

  const fetchSchedules = async () => {
    try {
      setFeatureDataLoading(true);
      const token = localStorage.getItem('token');
      const res = await api.get('/admin/schedules', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSchedules(Array.isArray(res.data) ? res.data : (res.data.data || []));
    } catch (err) {
      console.error('Gagal mengambil data jadwal:', err);
      setSchedules([]);
    } finally {
      setFeatureDataLoading(false);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      setFeatureDataLoading(true);
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await apiTryEndpoints('get', ['/admin/announcements', '/admin/pengumuman', '/pengumuman', '/announcements'], config);
      setAnnouncements(Array.isArray(res.data) ? res.data : (res.data.data || []));
    } catch (err) {
      console.warn('Gagal mengambil data pengumuman (fallback):', err?.response?.status || err.message);
      setAnnouncements([]);
    } finally {
      setFeatureDataLoading(false);
    }
  };

  const fetchAttendanceReports = async () => {
    try {
      setFeatureDataLoading(true);
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      let res;
      try {
        res = await api.get('/admin/attendances', config);
      } catch (err) {
        res = await api.get('/admin/activity', config);
      }
      const rawData = Array.isArray(res.data) ? res.data : (res.data.data || []);
      const normalized = rawData.map(act => normalizeAttendanceRecord(act));
      setAttendanceReports(normalized);
      setRecentActivity(normalized);
    } catch (err) {
      console.error('Gagal mengambil laporan absensi:', err);
      setAttendanceReports([]);
      setRecentActivity([]);
    } finally {
      setFeatureDataLoading(false);
    }
  };

  const [settingsSaved, setSettingsSaved] = useState(false);
  const [notifiedAttendanceKeys, setNotifiedAttendanceKeys] = useState([]);
  
  // ✨ TAMBAHAN: State untuk Modal Features Baru

  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [featureDataLoading, setFeatureDataLoading] = useState(false);
  const [selectedPromoteStudents, setSelectedPromoteStudents] = useState([]);
  const [isPromoting, setIsPromoting] = useState(false);

  const handleLogout = () => {
    setIsExiting(true);

    setTimeout(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/');
    }, 600);
  };


const fetchSettings = async () => {
  const token = localStorage.getItem('token');
  const config = {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 120000
  };

  try {
    const res = await api.get('/admin/settings', config);

    if (res?.data) {
      const backendSettings = {
        schoolName: res.data.schoolName ?? '',
        schoolAddress: res.data.schoolAddress ?? '',
        schoolPhone: res.data.schoolPhone ?? '',
        schoolEmail: res.data.schoolEmail ?? '',
        academicYear: res.data.academicYear ?? '',

        attendanceStartTime: res.data.attendanceStartTime ?? '07:00',
        attendanceEndTime: res.data.attendanceEndTime ?? '08:00',
        lateThreshold: res.data.lateThreshold ?? '08:00',
        schoolEndTime: res.data.schoolEndTime ?? '15:30',

        enableQRCode: res.data.enableQRCode ?? true,
        attendanceSessionOpen: res.data.attendanceSessionOpen ?? true,
        enableNotifications: res.data.enableNotifications ?? true,
        enableEmailReports: res.data.enableEmailReports ?? true,
        autoMarkAbsentEnabled: res.data.autoMarkAbsentEnabled ?? true,

        // 🔥 ini bukan input text → boleh null
        schoolLogo: res.data.logo_url ?? null,
        dashboardPhoto1: res.data.photo1_url ?? null,
        dashboardPhoto2: res.data.photo2_url ?? null,
        dashboardPhoto3: res.data.photo3_url ?? null,
        dashboardVideo: res.data.video_url ?? null,
      };

      console.log('✅ Settings loaded from database:', backendSettings);
      setSettingsData(backendSettings);

      // ✅ Preview fix (WAJIB pakai URL dari backend)
      if (backendSettings.schoolLogo) {
        setLogoPreview(backendSettings.schoolLogo);
      }

      setMediaPhotoPreviews({
        1: backendSettings.dashboardPhoto1,
        2: backendSettings.dashboardPhoto2,
        3: backendSettings.dashboardPhoto3,
      });

      if (backendSettings.dashboardVideo) {
        setMediaVideoPreview(backendSettings.dashboardVideo);
      }

      localStorage.setItem('school_settings', JSON.stringify(backendSettings));
    }

  } catch (err) {
    console.error('❌ Error fetching settings:', err?.response?.data || err.message);
    console.log('⚠️ Trying with default values...');
    
    // ✅ FALLBACK: Use default values jika ada error
    const defaultSettings = {
      schoolName: 'SMK Negeri 1',
      schoolAddress: 'Jl. Pendidikan No. 123',
      schoolPhone: '021-1234567',
      schoolEmail: 'info@smkn1.sch.id',
      academicYear: '2025/2026',
      attendanceStartTime: '07:00',
      attendanceEndTime: '08:00',
      lateThreshold: '08:00',
      schoolEndTime: '15:30',
      enableQRCode: true,
      attendanceSessionOpen: true,
      enableNotifications: true,
      enableEmailReports: true,
      autoMarkAbsentEnabled: true,
      schoolLogo: null,
      dashboardPhoto1: null,
      dashboardPhoto2: null,
      dashboardPhoto3: null,
      dashboardVideo: null,
    };
    setSettingsData(defaultSettings);
  }
};

  // Cek auth & role
  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (!token || !userStr) { navigate('/'); return; }
    try {
      const userData = JSON.parse(userStr);
      if (userData.role !== 'admin') {
        alert('⛔ Akses ditolak! Hanya admin yang bisa mengakses halaman ini.');
        navigate(`/dashboard/${userData.role}`);
        return;
      }
      setUser(userData);
    } catch { localStorage.clear(); navigate('/'); }
    setLoading(false);
  }, [navigate]);

  // Fetch data dari backend
  useEffect(() => { if (user) fetchAllData(); }, [user]);

  // ✨ Refresh data saat tab overview dibuka untuk memastikan statistik akurat
  useEffect(() => {
    if (activeTab === 'overview' && !dataLoading) {
      fetchAllData();
    }
  }, [activeTab]);

  // Fetch Data Guru dan Siswa saat tab aktif
  useEffect(() => {
    if (activeTab === 'dataGuru') fetchDataGuru();
    if (activeTab === 'dataSiswa') fetchDataSiswa();
    if (activeTab === 'pesanWA') fetchDataSiswa();
    if (activeTab === 'promotion') {
      fetchDataSiswa();
      fetchClasses(); // Memastikan data kelas tersedia untuk promosi
      fetchClasses();
    }
    if (activeTab === 'classes') {
      fetchClasses();
      fetchDataSiswa();
      fetchSchedules(); // ✨ Pastikan jadwal diambil untuk relasi mapel di kelas
    }
    if (activeTab === 'subjects') fetchSubjects();
    if (activeTab === 'schedules') fetchSchedules();
  }, [activeTab]);

  // Sync data when attendance updates occur in other tabs
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'attendance_updated') {
        console.debug('🌀 attendance_updated event received, reloading dashboard data');
        fetchAllData();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [user]);

  // Poll in background every 30 detik saat tab aktif
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && user) {
        fetchAllData();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const extractRecordsFromResponse = (res) => {
    if (!res || !res.data) return [];
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.data.data)) return res.data.data;
    if (Array.isArray(res.data.results)) return res.data.results;
    return [];
  };

  const normalizeRecordsResponse = (res) => {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (res.data) {
      if (Array.isArray(res.data)) return res.data;
      if (Array.isArray(res.data.data)) return res.data.data;
      if (Array.isArray(res.data.results)) return res.data.results;
      if (typeof res.data === 'object' && res.data !== null) return Object.values(res.data);
    }
    if (typeof res === 'object' && res !== null) return Object.values(res);
    return [];
  };

  const fetchAllData = async () => {
    setDataLoading(true);
    try {
      setError('');
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` }, timeout: 120000 };
      
      // Ambil semua data secara paralel
      const [statsRes, usersRes, classesRes, attendanceRes] = await Promise.allSettled([
        apiTryEndpoints('get', ['/admin/stats', '/stats'], config),
        apiTryEndpoints('get', userEndpointCandidates.index, config),
        apiTryEndpoints('get', ['/admin/classes', '/classes', '/class'], config),
        api.get('/admin/attendances', config).catch(() => api.get('/admin/activity', config))
      ]);
      
      // Process Stats - hitung dari data users jika stats endpoint tidak tersedia
      let calculatedStats = {
        totalUsers: 0,
        totalGuru: 0,
        totalSiswa: 0,
        totalKelas: 0,
        kehadiranHariIni: 0
      };
      
      if (statsRes.status === 'fulfilled' && statsRes.value?.data) {
        const statsData = statsRes.value.data;
        // Handle berbagai format response stats
        calculatedStats = {
          totalUsers: statsData.total_users ?? statsData.totalUsers ?? statsData.total ?? 0,
          totalGuru: statsData.total_guru ?? statsData.totalGuru ?? statsData.guru ?? 0,
          totalSiswa: statsData.total_siswa ?? statsData.totalSiswa ?? statsData.siswa ?? 0,
          totalKelas: statsData.total_kelas ?? statsData.totalKelas ?? statsData.kelas ?? 0,
          kehadiranHariIni: statsData.kehadiran_hari_ini ?? statsData.kehadiranHariIni ?? statsData.hari_ini ?? statsData.today ?? 0
        };
      }
      
      // Jika stats endpoint tidak memberikan data, hitung dari users
      if (calculatedStats.totalUsers === 0 && usersRes.status === 'fulfilled' && usersRes.value?.data) {
        const uData = usersRes.value?.data;
        const rawUsers = Array.isArray(uData) ? uData : (uData?.data || []);
        const gurus = rawUsers.filter(u => (u.role || '').toString().toLowerCase() === 'guru');
        const siswas = rawUsers.filter(u => (u.role || '').toString().toLowerCase() === 'siswa');
        calculatedStats.totalUsers = rawUsers.length;
        calculatedStats.totalGuru = gurus.length;
        calculatedStats.totalSiswa = siswas.length;
      }
      
      setStats(calculatedStats);
      
      // Process Users
      if (usersRes.status === 'fulfilled' && usersRes.value) {
        const uData = usersRes.value?.data;
        const rawUsers = Array.isArray(uData) ? uData : (uData?.data || []);
        setUsers(rawUsers.map(normalizeUser));
      }

      // Process Classes
      if (classesRes.status === 'fulfilled' && classesRes.value) {
        const classData = normalizeRecordsResponse(classesRes.value);
        setClasses(classData.length > 0 ? classData : staticClassOptions);
        // Update stats dengan jumlah kelas jika belum ada dari stats endpoint
        if (calculatedStats.totalKelas === 0) {
          const finalClassCount = classData.length > 0 ? classData.length : staticClassOptions.length;
          setStats(prev => ({ ...prev, totalKelas: finalClassCount }));
        }
      } else {
        // Jika endpoint classes gagal, gunakan static options sebagai fallback
        setClasses(staticClassOptions);
        if (calculatedStats.totalKelas === 0) {
          setStats(prev => ({ ...prev, totalKelas: staticClassOptions.length }));
        }
      }

      // Process Attendance Reports
      if (attendanceRes.status === 'fulfilled' && attendanceRes.value) {
        const rawActivity = extractRecordsFromResponse(attendanceRes.value);
        const normalizedActivity = rawActivity.map(act => normalizeAttendanceRecord(act));
        setRecentActivity(normalizedActivity);
        setAttendanceReports(normalizedActivity);
        
        // Update kehadiran hari ini dari attendance jika belum ada
        const today = getJakartaDateKey(new Date());
        const todayAttendance = normalizedActivity.filter(item => {
          const itemKey = normalizeDateKey(item.date || item.created_at || item.attendance_time);
          return itemKey === today;
        });
        
        if (calculatedStats.kehadiranHariIni === 0 && todayAttendance.length > 0) {
          setStats(prev => ({ ...prev, kehadiranHariIni: todayAttendance.length }));
        }
        
        console.debug('🟢 DashboardAdmin data loaded:', {
          users: calculatedStats.totalUsers,
          guru: calculatedStats.totalGuru,
          siswa: calculatedStats.totalSiswa,
          kelas: calculatedStats.totalKelas,
          attendance: normalizedActivity.length
        });
      }
    } catch (err) {
      console.error('Gagal mengambil data', err);
      setError('Gagal memuat data dari server.');
      setStats({ totalUsers: 0, totalGuru: 0, totalSiswa: 0, totalKelas: 0, kehadiranHariIni: 0 });
      setUsers([]);
      setClasses([]);
      setRecentActivity([]);
      setAttendanceReports([]);
    } finally {
      setDataLoading(false);
    }
  };

  // ✨ TAMBAHAN: Fetch & CRUD Event
  const fetchEvents = async () => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      // ✨ Mencoba beberapa kemungkinan endpoint jika salah satu 404
      const res = await apiTryEndpoints('get', ['/admin/events', '/events', '/public/events'], config);
      setEvents(Array.isArray(res.data) ? res.data : (res.data.data || []));
    } catch (err) {
      console.error('Gagal mengambil data event:', err);
      // Fallback data dummy jika API belum siap
      setEvents([]);
    }
  };

  useEffect(() => {
    if (user) fetchEvents();
  }, [user]);

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    setIsSavingEvent(true);
    try {
      const token = localStorage.getItem('token');
      const data = new FormData();
      data.append('title', eventFormData.title);
      data.append('date', eventFormData.date);
      if (eventFormData.image) data.append('image', eventFormData.image);

      // ✨ Gunakan apiTryEndpoints untuk menyimpan agar lebih fleksibel
      await apiTryEndpoints('post', ['/admin/events', '/events'], data, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      
      alert('✅ Event berhasil disimpan!');
      setShowAnnouncementModal_Event(false);
      setEventFormData({ title: '', date: '', image: null });
      setEventImagePreview(null);
      fetchEvents();
    } catch (err) {
      alert('❌ Gagal menyimpan event');
    } finally {
      setIsSavingEvent(false);
    }
  };

  const handleDeleteEvent = async (id) => {
    if (!confirm('Yakin ingin menghapus event ini?')) return;
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      // ✨ Coba hapus ke beberapa kemungkinan endpoint
      await apiTryEndpoints('delete', [`/admin/events/${id}`, `/events/${id}`], config);
      fetchEvents();
    } catch (err) {
      alert('❌ Gagal menghapus event');
    }
  };

  // Helper hitung mundur
  const getDaysRemaining = (dateString) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateString);
    target.setHours(0, 0, 0, 0);
    const diffTime = target - today;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Handle photo upload
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // helper fields class id/name dari list class
  const resolveClassFields = (given) => {
    const classId = given.class_id || given.kelas_id || given.kelas || '';
    const classNameById = classes.find(c => c.id?.toString() === classId?.toString());
    const staticClassById = staticClassOptions.find(c => c.id === classId);
    const resolvedName = classNameById?.name || staticClassById?.name || given.class_name || given.kelas || '';
    const resolvedId = classNameById?.id || (staticClassById ? staticClassById.id : classId);
    return {
      class_id: resolvedId,
      kelas_id: resolvedId,
      class_name: resolvedName,
      kelas: resolvedName
    };
  };

  const buildUserPayload = () => {
    const classFields = resolveClassFields(formData);
    const payload = {
      name: formData.name,
      email: formData.email,
      role: formData.role,
      phone: formData.phone || '',
      class_name: classFields.kelas || classFields.class_name || '',
      gender: formData.gender || '',
      parent_name: formData.parent_name || ''
    };
    if (formData.password) {
      payload.password = formData.password;
    }
    if (formData.role === 'siswa') {
      payload.nis = formData.user_id;
      payload.class_name = classFields.kelas || classFields.class_name || payload.class_name;
      if (formData.parent_phone) payload.parent_phone = formData.parent_phone;
        if (classFields.class_id) payload.class_id = classFields.class_id; // Tambahkan class_id secara eksplisit untuk siswa
    }
    if (formData.role === 'guru' || formData.role === 'admin') {
      payload.nis = formData.user_id;
    }
    if (formData.password) {
      payload.password_confirmation = formData.password;
    }
    return payload;
  };

  // CRUD Operations
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.user_id || !formData.password) {
      return alert('❌ Nama, email, NIS/NIP, dan password wajib diisi.');
    }
    if (formData.role === 'siswa' && (!formData.class_id || !formData.parent_phone)) {
      return alert('❌ Untuk siswa, pilih kelas dan isi nomor telepon orang tua.');
    }
    const emailExists = users.some((u) => (u.email || '').toLowerCase() === formData.email.toLowerCase());
    if (emailExists) {
      return alert('❌ Email sudah terdaftar. Silakan gunakan email lain.');
    }
    const nisValue = formData.user_id?.toString().trim();
    if (nisValue) {
      const nisExists = users.some((u) => {
        const existingNis = (u.nis || u.user_id || u.nisn || '').toString().trim();
        return existingNis && existingNis === nisValue;
      });
      if (nisExists) {
        return alert('❌ NIS/NIP sudah terdaftar. Silakan gunakan NIS/NIP lain.');
      }
    }
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const payload = buildUserPayload();
      console.debug('📤 Create payload:', payload);
      let responseData;
      if (profilePhoto) {
        const formDataUpload = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== undefined && v !== null) formDataUpload.append(k, v);
        });
        formDataUpload.append('photo', profilePhoto);
        responseData = await apiTryEndpoints('post', userEndpointCandidates.create, formDataUpload, {
          ...config,
          headers: { ...config.headers, 'Content-Type': 'multipart/form-data' }
        });
      } else {
        responseData = await apiTryEndpoints('post', userEndpointCandidates.create, payload, config);
      }
      console.debug('📥 Create response:', responseData?.data);
      setShowModal(false);
      resetForm();
      await fetchAllData();
      await fetchDataGuru();
      await fetchDataSiswa();
      if (formData.role === 'siswa') {
        const checkRes = await apiTryEndpoints('get', userEndpointCandidates.index, config);
        const found = (Array.isArray(checkRes.data) ? checkRes.data : (checkRes.data.data || [])).some(u => (u.user_id || u.nis || u.nisn)?.toString() === formData.user_id?.toString());
        if (!found) {
          alert('⚠️ Pengguna baru tidak ditemukan saat reload. Cek backend DB dan endpoint /admin/users.');
          return;
        }
      }
      alert('✅ User berhasil ditambahkan');
    } catch (err) {
      console.error('Create user failed:', err.response?.data || err.message);
      const apiMessage = err.response?.data?.message || err.message || 'Cek log';
      let details = '';
      if (err.response?.data?.errors) {
        details = Object.entries(err.response.data.errors)
          .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
          .join('\n');
      }
      alert(`❌ Gagal menambah user: ${apiMessage}${details ? '\n' + details : ''}`);
    }
  };

  // ✨ HANDLER: Manajemen Naik Kelas
  const togglePromoteSelection = (id) => {
    setSelectedPromoteStudents(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllInClass = (students) => {
    const ids = students.map(s => s.id);
    const allSelected = ids.every(id => selectedPromoteStudents.includes(id));
    if (allSelected) {
      setSelectedPromoteStudents(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setSelectedPromoteStudents(prev => [...new Set([...prev, ...ids])]);
    }
  };

  const handlePromoteStudents = async (studentIds) => {
    if (!studentIds || studentIds.length === 0) {
      alert('⚠️ Silakan pilih minimal satu siswa untuk dinaikkan kelasnya.');
      return;
    }
    if (!confirm(`🚀 Yakin ingin menaikkan ${studentIds.length} siswa ke tingkat berikutnya?`)) return;

    setIsPromoting(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      // Endpoint backend: POST /admin/students/promote
      await api.post('/admin/students/promote', { student_ids: studentIds }, config);
      alert('✅ Berhasil menaikkan kelas siswa!');
      setSelectedPromoteStudents([]);
      await fetchDataSiswa();
      await fetchAllData();
    } catch (err) {
      console.error('Gagal menaikkan kelas:', err);
      alert('❌ Gagal menaikkan kelas: ' + (err.response?.data?.message || 'Terjadi kesalahan sistem'));
    } finally {
      setIsPromoting(false);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.user_id) {
      return alert('❌ Nama, email, dan NIS/NIP wajib diisi.');
    }
    if (formData.role === 'siswa' && (!formData.class_id || !formData.parent_phone)) {
      return alert('❌ Untuk siswa, pilih kelas dan isi nomor telepon orang tua.');
    }
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const payload = buildUserPayload();
      console.debug('📤 Update payload:', payload);
      let responseData;
      if (profilePhoto) {
        const formDataUpload = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== undefined && v !== null) formDataUpload.append(k, v);
        });
        formDataUpload.append('photo', profilePhoto);
        formDataUpload.append('_method', 'PUT');
        responseData = await apiTryEndpoints('post', userEndpointCandidates.update(selectedUser.id), formDataUpload, {
          ...config,
          headers: { ...config.headers, 'Content-Type': 'multipart/form-data' }
        });
      } else {
        if (!payload.password) delete payload.password;
        responseData = await apiTryEndpoints('put', userEndpointCandidates.update(selectedUser.id), payload, config);
      }
      console.debug('📥 Update response:', responseData?.data);
      setShowModal(false);
      resetForm();
      await fetchAllData();
      await fetchDataGuru();
      await fetchDataSiswa();
      const checkRes = await apiTryEndpoints('get', userEndpointCandidates.index, config);
      const found = (Array.isArray(checkRes.data) ? checkRes.data : (checkRes.data.data || [])).some(u => (u.user_id || u.nis || u.nisn)?.toString() === formData.user_id?.toString());
      if (!found) {
        alert('⚠️ Update disimpan namun tidak ditemukan lagi saat reload. Cek backend untuk informasi DB.');
        return;
      }
      alert('✅ User berhasil diupdate');
    } catch (err) {
      console.error('Update user failed:', err.response?.data || err.message);
      const apiMessage = err.response?.data?.message || err.message || 'Cek log';
      let details = '';
      if (err.response?.data?.errors) {
        details = Object.entries(err.response.data.errors)
          .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
          .join('\n');
      }
      alert(`❌ Gagal mengupdate user: ${apiMessage}${details ? '\n' + details : ''}`);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('⚠️ Yakin ingin menghapus user ini?')) return;
    try {
      const token = localStorage.getItem('token');
      await apiTryEndpoints('delete', userEndpointCandidates.delete(userId), { headers: { Authorization: `Bearer ${token}` } });
      alert('✅ User berhasil dihapus');
      fetchAllData();
      if (activeTab === 'dataGuru') fetchDataGuru();
      if (activeTab === 'dataSiswa') fetchDataSiswa();
    } catch (err) {
      alert('❌ Gagal menghapus user');
    }
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    const classId = user.class_id || user.kelas_id || user.kelas || user.class?.id || '';
    const userIdValue = user.user_id || user.nis || user.nisn || '';
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      user_id: userIdValue,
      class_id: classId,
      phone: user.phone || '',
      parent_phone: user.parent_phone || '',
      gender: user.gender || '',
      parent_name: user.parent_name || ''
    });
    setPhotoPreview(resolvePhotoUrl(user.photo) || null);
    setProfilePhoto(null);
    setModalMode('edit');
    setShowModal(true);
  };

  const openCreateModal = (initialData = {}) => {
    resetForm();
    setFormData((prev) => ({ ...prev, ...initialData }));
    setModalMode('create');
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'guru',
      user_id: '',
      class_id: '',
      phone: '',
      parent_phone: '',
      gender: '',
      parent_name: ''
    });
    setSelectedUser(null);
    setProfilePhoto(null);
    setPhotoPreview(null);
  };

  // ✨ UBAH: Fungsi Show QR Code
  const handleShowQR = (userData, role) => {
    const qrData = {
      type: role === 'guru' ? 'teacher_qr' : 'student_qr',
      id: userData.id,
      name: userData.name,
      user_id: userData.user_id,
      role: role,
      generated_at: new Date().toISOString()
    };
    const qrString = JSON.stringify(qrData);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrString)}`;
    setQrCodeData(qrData);
    setQrCodeUrl(qrUrl);
    setShowQRModal(true);
  };

  // ✨ UBAH: Fungsi Download QR Code
  const handleDownloadQR = () => {
    if (!qrCodeUrl || !qrCodeData) return;
    fetch(qrCodeUrl)
      .then(response => response.blob())
      .then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `QR_${qrCodeData.role === 'guru' ? 'guru' : 'siswa'}_${qrCodeData.user_id || qrCodeData.id}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        alert('✅ QR Code berhasil diunduh!');
      })
      .catch(err => {
        console.error('Gagal download QR:', err);
        alert('❌ Gagal mengunduh QR Code');
      });
  };

const handleSaveSettings = async (section, e) => {
  if (typeof section !== 'string') {
    e = section;
    section = 'school';
  }
  if (e?.preventDefault) e.preventDefault();

  const token = localStorage.getItem('token');
  if (!token) {
    alert('Sesi habis, silakan login ulang sebelum menyimpan pengaturan.');
    return;
  }

  try {
    setIsPromoting(true);

    const config = {
      headers: { Authorization: `Bearer ${token}` }
    };

    const data = new FormData();
    const appendField = (key, value) => {
      if (value === undefined || value === null) return;
      data.append(key, value);
    };

    // FORMAT JAM FIX
    const formatTime = (time) => {
      if (!time) return null;
      return time.toString().substring(0, 5);
    };

    appendField('schoolName', settingsData.schoolName);
    appendField('schoolAddress', settingsData.schoolAddress);
    appendField('schoolPhone', settingsData.schoolPhone);
    appendField('schoolEmail', settingsData.schoolEmail);
    appendField('academicYear', settingsData.academicYear);

    appendField('attendanceStartTime', formatTime(settingsData.attendanceStartTime));
    appendField('attendanceEndTime', formatTime(settingsData.attendanceEndTime));
    appendField('lateThreshold', formatTime(settingsData.lateThreshold));
    appendField('schoolEndTime', formatTime(settingsData.schoolEndTime));

    data.append('enable_notifications', settingsData.enableNotifications ? '1' : '0');
    data.append('enable_email_reports', settingsData.enableEmailReports ? '1' : '0');
    data.append('enable_qr_code', settingsData.enableQRCode ? '1' : '0');
    data.append('attendance_session_open', settingsData.attendanceSessionOpen ? '1' : '0');
    data.append('auto_mark_absent_enabled', settingsData.autoMarkAbsentEnabled ? '1' : '0');

    if (section === 'school') {
      if (logoFile instanceof File) {
        data.append('logo', logoFile);
      }
      if (mediaPhotoFiles[1] instanceof File) {
        data.append('photo1', mediaPhotoFiles[1]);
      }
      if (mediaPhotoFiles[2] instanceof File) {
        data.append('photo2', mediaPhotoFiles[2]);
      }
      if (mediaPhotoFiles[3] instanceof File) {
        data.append('photo3', mediaPhotoFiles[3]);
      }
      if (mediaVideoFile instanceof File) {
        data.append('video_profile', mediaVideoFile);
      }
    }

    console.log("KIRIM DATA:");
    for (let pair of data.entries()) {
      console.log(pair[0], pair[1]);
    }

    const response = await api.post('/admin/settings', data, {
      ...config,
      timeout: 120000
    });

    if (response.status === 200 || response.status === 201) {
      await fetchSettings();

      setSettingsSaved(true);
      setShowSuccessNotification(true);

      setLogoFile(null);
      setMediaPhotoFiles({ 1: null, 2: null, 3: null });
      setMediaVideoFile(null);

      setTimeout(() => {
        setShowSuccessNotification(false);
        setSettingsSaved(false);
      }, 3000);
    }

  }catch (err) {
  console.log("🔥 INI ERROR ASLI DARI BACKEND:");
  console.log(err.response?.data);

  console.error('Error saving settings:', err);

  const apiErr = err.response?.data;
    let detailMsg = apiErr?.message || "Gagal menyimpan pengaturan";

    if (apiErr?.errors) {
      detailMsg += "\n" + Object.entries(apiErr.errors)
        .map(([key, val]) => `• ${key}: ${val}`)
        .join("\n");
    }

    alert(`❌ Kesalahan Validasi:\n${detailMsg}`);
  } finally {
    setIsPromoting(false);
  }
};

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // ✨ TAMBAHAN: Handle Export Data
  const handleExportData = async (type) => {
    try {
      const token = localStorage.getItem('token');
      const response = await api.get(`/admin/export/${type}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      alert('✅ Data berhasil diekspor!');
    } catch (err) {
      alert('❌ Gagal mengekspor data');
    }
  };

  // ✨ TAMBAHAN: Handle Send WhatsApp Message
  const handleSendWhatsApp = (parentPhone, studentName) => {
    if (!parentPhone) {
      alert('❌ Nomor telepon orang tua tidak tersedia');
      return;
    }
    // Format nomor: hapus 0 di depan, tambah 62
    let formattedPhone = parentPhone.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.slice(1);
    }
    if (!formattedPhone.startsWith('62')) {
      formattedPhone = '62' + formattedPhone;
    }
    const message = encodeURIComponent(`${waMessageTemplate}Nama siswa: ${studentName}`);
    const waUrl = `https://wa.me/${formattedPhone}?text=${message}`;
    window.open(waUrl, '_blank');
  };

  // ✨ Menu items dengan tambahan Pesan WA
  const menuItems = [
    { id: 'overview', label: 'Ringkasan', icon: '📊' },
    { id: 'users', label: 'Kelola User', icon: '👥' },
    { id: 'dataGuru', label: 'Data Guru', icon: '🎓' },
    { id: 'dataSiswa', label: 'Data Siswa', icon: '🧑‍🎓' },
    { id: 'pesanWA', label: 'Pesan WA', icon: '💬' },
    { id: 'promotion', label: 'Naik Kelas', icon: '🚀' },
    { id: 'classes', label: 'Data Kelas', icon: '🏫' },
    { id: 'alumni', label: 'Alumni', icon: '🧑‍🎓' }, // ✨ TAMBAHAN: Menu Alumni
    { id: 'settings', label: 'Pengaturan', icon: '⚙️' },
  ];

  // ✨ FIX: Normalisasi user agar NIS/NIP dan Kelas selalu tersedia
  const normalizeUser = (user) => {
    if (!user) return user;
    const normalizedUserId = user.user_id ?? user.nis ?? user.nisn ?? '';
    const normalizedClassId = user.class_id ?? user.kelas_id ?? (user.class?.id ?? '') ?? '';
    const normalizedClassName = user.class_name ?? user.class?.name ?? user.kelas ?? '';
    return {
      ...user,
      user_id: normalizedUserId,
      class_id: normalizedClassId,
      class_name: normalizedClassName,
      kelas: normalizedClassName,
      photo: resolvePhotoUrl(user.photo) || null
    };
  };

  // ✨ FIX: Fungsi untuk mendapatkan nama kelas dari class_id
  const getClassName = (classId, classNameFallback = '') => {
    const candidate = classNameFallback || classId;
    if (!candidate && candidate !== 0) return '-';
    if (typeof candidate === 'object') return candidate?.name || '-';
    const classData = classes.find(c => c.id == candidate || c.id?.toString() === candidate?.toString());
    if (classData) return classData.name;
    const strCandidate = candidate.toString().trim();
    return strCandidate ? strCandidate : '-';
  };

  // ✨ TAMBAHAN: Ambil nomor kelas utama (1/2/3) dari data siswa
  const getClassGroup = (siswa) => {
    if (!siswa) return 'Lainnya';
    const raw = siswa.class_name || siswa.class || siswa.kelas || siswa.class_id || siswa.kelas_id || siswa.class?.name;
    if (!raw) return 'Lainnya';
    const normalized = raw.toString().toLowerCase().trim();
    const cleaned = normalized.replace(/kelas\s*/g, '').replace(/[\s]/g, '');
    if (/^[123]$/i.test(cleaned)) return cleaned;
    const m = cleaned.match(/[123]/);
    return m ? m[0] : 'Lainnya';
  };

  // ✨ FIX: Normalize per-record attendance data
  const normalizeAttendanceRecord = (act) => {
    const rawStatus = (act.status || '').toString().toLowerCase();
    const rawAction = (act.action || act.description || '').toString().toLowerCase();
    const isExplicitLate = act.is_late === true || ['terlambat', 'late', 'tardy'].includes(rawStatus) || rawAction.includes('terlambat') || rawAction.includes('late');
    const isExplicitOnTime = ['hadir', 'tepat_waktu', 'on_time', 'present'].includes(rawStatus) || rawAction.includes('hadir') || rawAction.includes('tepat waktu') || rawAction.includes('tepat_waktu');
    const statusValue = isExplicitLate ? 'terlambat' : isExplicitOnTime ? 'hadir' : (act.is_late ? 'terlambat' : (act.status || 'absen'));
    const dateValue = act.date || act.tanggal || act.created_at || act.attendance_time || act.time || act.scan_time || '';
    const scanTimeValue = act.scan_time || act.time || act.attendance_time || act.created_at || act.date || '';
    const notesValue = act.notes || act.keterangan || act.description || act.action || '';
    const userNameFallback = act.user_name || act.nama || act.name || '-';
    const userNameFromUserObj = act.user && typeof act.user === 'object'
      ? (act.user.name || act.user.full_name || act.user.nama || act.user.email || act.user.user_id || '-')
      : act.user;

    // Coba tebak role jika tidak ada
    let roleValue = act.role || (act.user && act.user.role);
    if (!roleValue) {
      if (act.user_id?.length > 8 || act.nip) roleValue = 'guru';
      else if (act.nis || act.user_id) roleValue = 'siswa';
    }

    const userNameValue = (userNameFallback !== '-' ? userNameFallback : userNameFromUserObj) || '-';
    return {
      ...act,
      status: statusValue,
      user_name: userNameValue,
      date: dateValue,
      scan_time: scanTimeValue,
      notes: notesValue,
      role: roleValue || '',
      action: act.action || act.description || 'Absensi'
    };
  };

  // ✨ TAMBAHAN: Filter data berdasarkan search
  const filterData = (data, query = '') => {
    if (!query) return data;
    const q = query.toLowerCase();
    return data.filter(item =>
      item.name?.toLowerCase().includes(q) ||
      item.email?.toLowerCase().includes(q) ||
      item.user_id?.toLowerCase().includes(q)
    );
  };

  // ✨ TAMBAHAN: Filter siswa untuk WhatsApp berdasarkan search
  const filterSiswaForWA = (siswaList, query = '') => {
    if (!query) return siswaList;
    const q = query.toLowerCase();
    return siswaList.filter(item =>
      item.name?.toLowerCase().includes(q) ||
      item.parent_phone?.toLowerCase().includes(q) ||
      item.class_name?.toLowerCase().includes(q)
    );
  };

  // ✨ TAMBAHAN: CRUD Handlers untuk Features Baru
  const handleDeleteSubject = async (id) => {
    if (!confirm('⚠️ Yakin ingin menghapus mata pelajaran ini?')) return;
    try {
      const token = localStorage.getItem('token');
      await api.delete(`/admin/subjects/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      alert('✅ Mata pelajaran berhasil dihapus');
      fetchSubjects();
    } catch (err) {
      alert('❌ Gagal menghapus mata pelajaran');
    }
  };

  const handleDeleteSchedule = async (id) => {
    if (!confirm('⚠️ Yakin ingin menghapus jadwal ini?')) return;
    try {
      const token = localStorage.getItem('token');
      await api.delete(`/admin/schedules/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      alert('✅ Jadwal berhasil dihapus');
      fetchSchedules();
    } catch (err) {
      alert('❌ Gagal menghapus jadwal');
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!confirm('⚠️ Yakin ingin menghapus pengumuman ini?')) return;
    try {
      const token = localStorage.getItem('token');
      await api.delete(`/admin/announcements/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      alert('✅ Pengumuman berhasil dihapus');
      fetchAnnouncements();
    } catch (err) {
      alert('❌ Gagal menghapus pengumuman');
    }
  };

  // ✨ TAMBAHAN: Helper untuk memisahkan aktivitas terlambat dan tepat waktu
  const isLateStatus = (status, act) => {
    const s = (status || '').toString().toLowerCase();
    const rawAction = (act?.action || act?.description || '').toString().toLowerCase();
    return act?.is_late === true ||
      ['terlambat', 'late', 'tardy'].includes(s) ||
      rawAction.includes('terlambat') ||
      rawAction.includes('late');
  };

  const isOnTimeStatus = (status, act) => {
    const s = (status || '').toString().toLowerCase();
    const rawAction = (act?.action || act?.description || '').toString().toLowerCase();
    return ['hadir', 'tepat_waktu', 'on_time', 'present'].includes(s) ||
      rawAction.includes('hadir') ||
      rawAction.includes('tepat waktu') ||
      rawAction.includes('tepat_waktu');
  };

  const getJakartaDateKey = (date) => {
    if (!date) return '';
    try {
      const dt = date instanceof Date ? date : new Date(date);
      if (isNaN(dt.getTime())) return '';
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(dt);
    } catch (err) {
      console.warn('Gagal membuat Jakarta date key:', err, date);
      return '';
    }
  };

  const normalizeDateKey = (rawDate) => {
    if (!rawDate) return '';

    if (rawDate instanceof Date) {
      return getJakartaDateKey(rawDate);
    }

    const str = String(rawDate).trim();
    if (!str) return '';

    // Handle timestamp values
    if (/^\d{10}$/.test(str)) {
      return getJakartaDateKey(new Date(Number(str) * 1000));
    }
    if (/^\d{13}$/.test(str)) {
      return getJakartaDateKey(new Date(Number(str)));
    }

    // Handle format ISO-like or datetime with space separator
    const isoTimestamp = str.replace(' ', 'T');
    const parsedIso = new Date(isoTimestamp);
    if (!isNaN(parsedIso.getTime())) {
      return getJakartaDateKey(parsedIso);
    }

    // Handle format DD-MM-YYYY atau DD/MM/YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})(?:[ T](\d{2}:\d{2}:\d{2}))?/);
    if (dmyMatch) {
      const [, day, month, year, timePart] = dmyMatch;
      const [hour = '00', minute = '00', second = '00'] = (timePart || '00:00:00').split(':');
      const dateObj = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
      return getJakartaDateKey(dateObj);
    }

    const parts = str.split(' ');
    return parts[0] || '';
  };

  const getTodayAttendance = () => {
    const todayKey = getJakartaDateKey(new Date());
    return attendanceReports.filter(item => {
      const key = normalizeDateKey(item.date || item.created_at || item.attendance_time || item.time || item.scan_time);
      return key === todayKey;
    });
  };

  const getLateActivities = () => {
    const todayActs = getTodayAttendance();
    return todayActs.filter(act => isLateStatus(act.status, act));
  };

  const getOnTimeActivities = () => {
    const todayActs = getTodayAttendance();
    return todayActs.filter(act => !isLateStatus(act.status, act) && isOnTimeStatus(act.status, act));
  };

  const getAttendanceStats = () => {
    const today = getTodayAttendance();
    const total = today.length;
    
    // Hitung hadir - termasuk semua status kehadiran (hadir, tepat_waktu, present, on_time)
    const hadir = today.filter(item => {
      const status = (item.status || '').toString().toLowerCase();
      return ['hadir', 'tepat_waktu', 'present', 'on_time'].includes(status);
    }).length;
    
    // Hitung terlambat - termasuk is_late = true atau status terlambat/late/tardy
    const terlambat = today.filter(item => {
      const status = (item.status || '').toString().toLowerCase();
      return item.is_late === true || 
             ['terlambat', 'late', 'tardy'].includes(status);
    }).length;
    
    // Hitung izin
    const izin = today.filter(item => {
      const status = (item.status || '').toString().toLowerCase();
      return ['izin', 'permisi'].includes(status);
    }).length;

    // Hitung sakit
    const sakit = today.filter(item => {
      const status = (item.status || '').toString().toLowerCase();
      return ['sakit', 'sick'].includes(status);
    }).length;

    // Hitung absen - status yang menunjukkan tidak hadir
    const absen = today.filter(item => {
      const status = (item.status || '').toString().toLowerCase();
      return ['absen', 'absent', 'tidak hadir', 'missing', 'alpha'].includes(status);
    }).length;
    
    // Hitung persentase kehadiran (hadir + terlambat dianggap hadir)
    const totalHadir = hadir + terlambat;
    const hadirPercent = total > 0 ? Math.round((totalHadir / total) * 100) : 0;
    
    return { total, hadir, terlambat, izin, sakit, absen, hadirPercent };
  };

  const getAttendanceChartData = () => {
    const today = new Date();
    // Cari hari Minggu terdekat
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay());
    
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    
    return dayNames.map((name, i) => {
      const targetDate = new Date(sunday);
      targetDate.setDate(sunday.getDate() + i);
      
      const dateKey = getJakartaDateKey(targetDate);
      
      // Hitung siswa yang hadir hari itu (termasuk terlambat)
      const studentsPresentCount = attendanceReports.filter((item) => {
        // Filter hanya siswa
        if (item.role && item.role !== 'siswa') return false;
        
        // Filter tanggal
        const itemKey = normalizeDateKey(item.date || item.created_at || item.attendance_time);
        if (itemKey !== dateKey) return false;
        
        // Hitung jika hadir atau terlambat
        const status = (item.status || '').toString().toLowerCase();
        return ['hadir', 'tepat_waktu', 'present', 'on_time', 'terlambat', 'late', 'tardy'].includes(status) || item.is_late === true;
      }).length;
      
      return { label: name, count: studentsPresentCount, date: dateKey };
    });
  };

  const getMonthlyAttendanceTrend = () => {
    const now = new Date();
    const monthsRef = [];
    
    // Generate 12 bulan terakhir
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('id-ID', { month: 'short', year: '2-digit' });
      monthsRef.push({ year: d.getFullYear(), month: d.getMonth(), label });
    }
    
    const trend = monthsRef.map((m) => {
      // Hitung attendance per bulan dari attendanceReports
      const count = attendanceReports.reduce((acc, item) => {
        const rawDate = item.attendance_time || item.created_at || item.time || item.date;
        if (!rawDate) return acc;
        
        let d = new Date(rawDate);
        if (isNaN(d.getTime())) {
          // Coba parse dengan normalizeDateKey
          const normalized = normalizeDateKey(rawDate);
          if (!normalized) return acc;
          const parts = normalized.split('-').map(Number);
          if (parts.length < 3) return acc;
          // parts[0] = year, parts[1] = month (0-based), parts[2] = day
          if (parts[0] === m.year && (parts[1] - 1) === m.month) return acc + 1;
          return acc;
        }
        
        // Jika tanggal valid, cek bulan dan tahun
        if (d.getFullYear() === m.year && d.getMonth() === m.month) return acc + 1;
        return acc;
      }, 0);
      
      return { ...m, count };
    });
    
    return trend;
  };

  const { total, hadir, terlambat, izin, sakit, absen, hadirPercent } = getAttendanceStats();

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-blue-500 border-t-transparent mx-auto mb-5 shadow-lg"></div>
          <p className="text-blue-600 font-medium">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-blue-100 transition-all duration-500 ${isExiting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
      <div className="flex h-screen overflow-hidden">
        {/* ✨ Overlay untuk mobile agar navbar tidak menutupi konten */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* SIDEBAR - Kembali ke drawer untuk mobile */}
        <aside className={`fixed lg:sticky top-0 h-screen z-50 bg-white border-r border-slate-100 flex flex-col transition-all duration-500 ease-in-out ${sidebarOpen ? 'translate-x-0 w-64' : sidebarCollapsed ? '-translate-x-full lg:translate-x-0 w-20' : '-translate-x-full lg:translate-x-0 lg:w-64'} py-8 px-4`}>
          {/* Logo */}
          <div className="mb-10 px-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                <img
                  src={settingsData.schoolLogo ? resolvePhotoUrl(settingsData.schoolLogo) : "/logo sekolah.jpeg"}
                  alt="Logo Sekolah"
                  className="w-8 h-8 object-contain"
                  onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/40x40/2563eb/ffffff?text=S'; }}
                />
              </div>
              {!sidebarCollapsed && <span className="text-lg font-black text-slate-800 tracking-tight truncate">{settingsData.schoolName || 'ADMIN'}</span>}
            </div>
            {sidebarOpen && (
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 text-slate-400 hover:text-slate-900">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 space-y-1.5 overflow-y-auto custom-scrollbar px-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-3' : 'gap-4 px-4 py-3'} rounded-full transition-all duration-300 group ${activeTab === item.id
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
              >
                <span className={`text-xl transition-all duration-300 ${activeTab === item.id ? 'scale-110' : 'opacity-70 group-hover:opacity-100'}`}>{item.icon}</span>
                {!sidebarCollapsed && <span className="text-[15px] font-bold tracking-tight">{item.label}</span>}
              </button>
            ))}
          </nav>
          
          {/* Profile & Logout Section at Bottom */}
          <div className="mt-auto pt-6 space-y-3 px-1">
            {!sidebarCollapsed ? (
              <div className="p-3 bg-slate-50 rounded-[2rem] flex items-center gap-3 ring-1 ring-slate-100">
                <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-white shadow-sm flex-shrink-0">
                  <img
                    src={resolvePhotoUrl(user.photo) || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email || 'Admin')}&background=2563eb&color=ffffff`}
                    alt="User"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{user.name || 'Admin'}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">Admin</p>
                </div>
              </div>
            ) : (
              <div className="w-12 h-12 mx-auto rounded-full overflow-hidden ring-1 ring-slate-100 shadow-sm">
                <img
                  src={resolvePhotoUrl(user.photo) || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email || 'Admin')}&background=2563eb&color=ffffff`}
                  alt="User"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-3' : 'gap-4 px-4 py-3'} rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all duration-300 font-bold group`}
            >
              <span className="text-xl group-hover:scale-110 transition-transform">🚪</span>
              {!sidebarCollapsed && <span className="text-[15px] tracking-tight">Keluar</span>}
            </button>
          </div>
        </aside>

        {/* ✅ MAIN CONTENT */}
        <main className="relative flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm h-[70px] flex items-center w-full transition-all duration-300 flex-shrink-0">
            <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (window.innerWidth >= 1024) {
                      setSidebarCollapsed(prev => !prev);
                    } else {
                      setSidebarOpen(true);
                    }
                  }}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                  title="Toggle Sidebar"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>

                <h1 className="text-lg md:text-xl font-bold text-blue-900 tracking-tight ml-2">
                  {menuItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
                </h1>
              </div>

              <div className="flex items-center gap-2 md:gap-6">
                {(activeTab === 'users' || activeTab === 'dataGuru' || activeTab === 'dataSiswa' || activeTab === 'pesanWA') && (
                  <input
                    type="text"
                    placeholder="Cari..."
                    value={activeTab === 'pesanWA' ? waSearchQuery : searchQuery}
                    onChange={(e) => activeTab === 'pesanWA' ? setWaSearchQuery(e.target.value) : setSearchQuery(e.target.value)}
                    className="hidden lg:block px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                )}

                <div className="hidden md:flex flex-col items-end border-l border-gray-200 pl-6">
                  <p className="text-[11px] font-bold text-blue-400 uppercase tracking-widest leading-none mb-1">
                    {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  <p className="text-lg font-black text-blue-900 font-mono leading-none">
                    {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </p>
                </div>

                <button
                  onClick={() => setShowNotifications(prev => !prev)}
                  className="relative p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <span className="text-xl">🔔</span>
                  {notifications.length > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold">
                      {notifications.length}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </header>

          {showNotifications && (
            <div className="absolute right-4 top-[74px] w-[min(320px,calc(100%-2rem))] rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-800">Notifikasi</div>
              <div className="p-4 text-sm text-slate-600">
                {notifications.length > 0 ? (
                  notifications.map((notif, index) => (
                    <div key={index} className="mb-3 last:mb-0">
                      <p className="font-semibold text-slate-800">{notif.title || 'Pemberitahuan'}</p>
                      <p className="text-slate-500">{notif.message || notif}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500">Belum ada notifikasi untuk saat ini.</p>
                )}
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-8">
            <div className="max-w-7xl mx-auto w-full">
              {/* Modal Edit/Create User */}
              {showModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border-2 border-blue-200 animate-fade-in-up max-h-[90vh] overflow-y-auto">
                    <h3 className="text-lg font-bold text-blue-800 mb-5 flex items-center gap-2">
                      {modalMode === 'create' ? '➕' : '✏️'} {modalMode === 'create' ? 'Tambah User' : 'Edit User'}
                    </h3>
                    <form onSubmit={modalMode === 'create' ? handleCreateUser : handleUpdateUser} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Foto Profil</label>
                        <div className="flex items-center gap-4">
                          <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden border-2 border-blue-200">
                            {photoPreview ? (
                              <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-3xl text-blue-400">{formData.name?.charAt(0) || '?'}</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoChange}
                              className="w-full text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 transition-all"
                            />
                            <p className="text-xs text-slate-500 mt-1">PNG, JPG maksimal 2MB</p>
                          </div>
                        </div>
                      </div>
                      {[
                        { label: 'Nama Lengkap', name: 'name', type: 'text' },
                        { label: 'Email', name: 'email', type: 'email' },
                        ...(modalMode === 'create' ? [{ label: 'Password', name: 'password', type: 'password' }] : [{ label: 'Password (kosongkan jika tidak diubah)', name: 'password', type: 'password' }]),
                        { label: 'NIS/NIP', name: 'user_id', type: 'text' },
                        { label: 'No. Telepon', name: 'phone', type: 'tel' },
                      ].map((field) => (
                        <div key={field.name}>
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">{field.label}</label>
                          <input
                            type={field.type}
                            value={formData[field.name]}
                            onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                            className="w-full px-4 py-2.5 border-2 border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            required={field.name !== 'phone' && field.name !== 'parent_phone' && !(modalMode === 'edit' && field.name === 'password')}
                          />
                        </div>
                      ))}
                      {formData.role === 'siswa' && (
                        <>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Jenis Kelamin</label>
                            <select
                              value={formData.gender}
                              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                              className="w-full px-4 py-2.5 border-2 border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                              required
                            >
                              <option value="">Pilih Jenis Kelamin</option>
                              <option value="Laki-laki">Laki-laki</option>
                              <option value="Perempuan">Perempuan</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Nama Orang Tua</label>
                            <input
                              type="text"
                              value={formData.parent_name}
                              onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                              className="w-full px-4 py-2.5 border-2 border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                              placeholder="Masukkan nama orang tua"
                              required
                            />
                          </div>
                        </>
                      )}
                      {formData.role === 'siswa' && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">No. Telepon Orang Tua</label>
                          <input
                            type="tel"
                            value={formData.parent_phone}
                            onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                            className="w-full px-4 py-2.5 border-2 border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            placeholder="08123456789"
                            required
                          />
                        </div>
                      )}
                      {formData.role === 'siswa' && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Kelas</label>
                          <select
                            value={formData.class_id}
                            onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                            className="w-full px-4 py-2.5 border-2 border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                          >
                            <option value="">Pilih Kelas</option>
                            {(classes.length ? classes : staticClassOptions).map((cls) => (
                              <option key={cls.id} value={cls.id}>{cls.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Role</label>
                        <select
                          value={formData.role}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                          className="w-full px-4 py-2.5 border-2 border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                        >
                          <option value="guru">🎓 Guru</option>
                          <option value="siswa">🧑‍🎓 Siswa</option>
                          <option value="admin">👮 Admin</option>
                        </select>
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border-2 border-blue-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-blue-50 transition-all">Batal</button>
                        <button type="submit" className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg border-2 border-blue-300">Simpan</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* ✨ TAMBAHAN: Modal QR Code */}
              {showQRModal && qrCodeData && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border-2 border-blue-200 animate-fade-in-up">
                    <h3 className="text-lg font-bold text-blue-800 mb-4 text-center">
                      📱 QR Code {qrCodeData.role === 'guru' ? 'Guru' : 'Siswa'}
                    </h3>
                    <div className="flex justify-center mb-6">
                      <div className="bg-white p-4 rounded-xl border-2 border-blue-200">
                        <img
                          src={qrCodeUrl}
                          alt="QR Code"
                          className="w-64 h-64 object-contain"
                        />
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-4 mb-6 border-2 border-blue-200">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-blue-600">Nama:</span>
                          <span className="font-semibold text-blue-800">{qrCodeData.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-600">NIS/NIP:</span>
                          <span className="font-semibold text-blue-800">{qrCodeData.user_id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-600">Role:</span>
                          <span className="font-semibold text-blue-800 capitalize">{qrCodeData.role}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setShowQRModal(false)}
                        className="flex-1 px-4 py-2.5 border-2 border-blue-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-blue-50 transition-all"
                      >
                        Tutup
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowQRModal(false);
                          handleDownloadQR();
                        }}
                        className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg border-2 border-blue-300"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Logout Confirmation Modal */}
              {showLogoutConfirm && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border-2 border-blue-200 animate-fade-in-up">
                    <h3 className="text-lg font-bold text-blue-800 mb-3">Yakin ingin keluar?</h3>
                    <p className="text-slate-600 text-sm mb-6">Anda akan keluar dari sesi saat ini dan kembali ke halaman login.</p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setShowLogoutConfirm(false)}
                        className="flex-1 px-4 py-2.5 border-2 border-blue-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-blue-50 transition-all"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowLogoutConfirm(false);
                          handleLogout();
                        }}
                        className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl text-sm font-medium hover:from-red-600 hover:to-red-700 transition-all shadow-md hover:shadow-lg border-2 border-red-300"
                      >
                        Keluar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3 text-red-700">
                  <span className="text-lg">⚠️</span>
                  <span className="text-sm font-medium">{error}</span>
                </div>
              )}

              {/* Banner Selamat Datang hanya di tab Ringkasan */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Banner Selamat Datang - Sekarang di posisi teratas */}
                  <div className="bg-white border-2 border-blue-100 rounded-2xl p-5 mx-4 lg:mx-8 shadow-sm flex flex-col sm:flex-row items-center gap-4 relative overflow-hidden transition-all hover:border-blue-200">
                    {/* Efek dekorasi subtle di background agar tidak membosankan */}
                    <div className="absolute right-0 top-0 w-32 h-full bg-blue-50/50 -skew-x-12 translate-x-16 pointer-events-none"></div>
                    
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white text-2xl shadow-md flex-shrink-0 relative z-10">
                      👋
                    </div>
                    
                    <div className="text-center sm:text-left relative z-10">
                      <h2 className="text-lg lg:text-xl font-bold text-slate-800 leading-tight">
                        Selamat datang, {user?.name || 'Administrator'}!
                      </h2>
                      <p className="text-slate-500 text-xs lg:text-sm mt-0.5">
                        Sistem siap digunakan. Anda memiliki kontrol penuh untuk memantau aktivitas sekolah hari ini.
                      </p>
                    </div>
                  </div>

                  {/* ✨ BARU: Layout Grid Kalender (Kiri) & Event (Kanan) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mx-4 lg:mx-8 mt-2">
                    {/* 📅 SISI KIRI: TANGGAL DINAMIS */}
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
                            <p className="text-[10px] uppercase tracking-[0.24em] text-blue-200/90 mb-2 font-black">
                              {sectionBg.isHoliday ? `HARI BESAR: ${sectionBg.label}` : sectionBg.label}
                            </p>
                            <h3 className="text-xl md:text-2xl font-black mb-1 tracking-tight">
                              {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </h3>
                            <div className="inline-flex items-center gap-3 rounded-full bg-white/10 backdrop-blur-md px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white border border-white/20 mt-4">
                              <span>{currentTime.getFullYear()}</span>
                              <span className="inline-block h-1 w-1 rounded-full bg-blue-400" />
                              <span>{currentTime.getDate()} {new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(currentTime)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 🗓️ SISI KANAN: EVENT MENDATANG */}
                  <div className="bg-white rounded-3xl border-2 border-blue-100 p-5 shadow-lg flex flex-col h-full min-h-[180px] mb-6">
                      <h3 className="font-black text-blue-900 mb-4 flex items-center justify-between text-xs uppercase tracking-wider">
                        <span className="flex items-center gap-2">📅 Agenda & Event</span>
                        <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">{events.length} Hari Besar</span>
                      </h3>
                    <div className="space-y-4 overflow-y-auto max-h-[300px] custom-scrollbar pr-2 flex-1">
                        {events.length > 0 ? (
                          events.map((event) => {
                            const days = getDaysRemaining(event.date);
                            if (days < 0) return null;
                            return (
                            <div key={event.id} className="relative bg-white rounded-2xl border-2 border-blue-100 overflow-hidden shadow-sm group hover:shadow-md transition-all">
                              <img
                                src={resolvePhotoUrl(event.image)}
                                alt={event.title}
                                className="w-full h-28 object-cover"
                                onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/400x200/cccccc/ffffff?text=IMAGE'; }}
                              />
                              <div className="p-4 bg-white">
                                <div className="flex justify-between items-center gap-2">
                                  <h4 className="font-bold text-blue-900 text-xs truncate uppercase tracking-tight">{event.title}</h4>
                                  <span className={`${days === 0 ? 'bg-red-600' : 'bg-blue-600'} text-white text-[8px] font-black px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm`}>
                                    {days === 0 ? '🎉 HARI INI' : `⏳ H-${days}`}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">
                                  {new Date(event.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}
                                </p>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-slate-400 py-4">
                            <span className="text-2xl mb-1 opacity-20">📅</span>
                            <p className="text-[10px] font-bold uppercase">Belum ada agenda</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
              </div>
              )}

              {/* Seksi Media & Kegiatan (Samakan dengan Dashboard Siswa) */}
              {activeTab === 'overview' && (
                <div className="bg-white rounded-2xl border-2 border-blue-100 p-6 shadow-md mb-10 mx-4 lg:mx-8 mt-4">
                  <h3 className="font-bold text-blue-800 mb-4 flex items-center gap-2">
                    <span>🖼️</span> Media & Kegiatan Sekolah
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Baris Foto: Sliding Left Animation */}
                    <div className="overflow-hidden relative w-full py-1">
                      <div className="flex gap-4 animate-slide-left w-max">
                        {[1, 2, 3, 1, 2, 3].map((i, idx) => (
                          <div key={`overview-photo-slide-${idx}`} className="w-48 sm:w-72 flex-shrink-0 rounded-xl overflow-hidden border border-blue-50 bg-slate-50 shadow-sm">
                            {settingsData[`dashboardPhoto${i}`] ? (
                              <img src={resolvePhotoUrl(settingsData[`dashboardPhoto${i}`])} alt={`Sekolah ${i}`} className="w-full h-32 sm:h-48 object-cover hover:scale-110 transition-transform duration-700" />
                            ) : (
                              <div className="h-32 sm:h-48 flex flex-col items-center justify-center text-slate-400">
                                <span className="text-2xl">📸</span>
                                <p className="text-[10px] mt-1 font-medium">Foto {i}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Baris Video */}
                    <div className="rounded-xl overflow-hidden border-2 border-blue-50 bg-black shadow-inner">
                      {settingsData.dashboardVideo ? (
                        <video src={resolvePhotoUrl(settingsData.dashboardVideo)} controls className="w-full h-full min-h-[180px] sm:min-h-[220px] object-contain" />
                      ) : (
                        <div className="h-full min-h-[180px] bg-slate-900 flex flex-col items-center justify-center text-slate-500">
                          <span className="text-2xl">🎥</span>
                          <p className="text-[10px] mt-1">Belum ada video terbaru</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: Overview */}
              {activeTab === 'overview' && (
                <div className="space-y-6 animate-fade-in">

                  {/* Statistik 6 Kotak */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                    {[
                      { label: 'Total', value: total, color: 'indigo', icon: '📅' },
                      { label: 'Hadir', value: hadir, color: 'emerald', icon: '✓' },
                      { label: 'Terlambat', value: terlambat, color: 'amber', icon: '⚠' },
                      { label: 'Izin', value: izin, color: 'sky', icon: '📋' },
                      { label: 'Sakit', value: sakit, color: 'violet', icon: '🏥' },
                      { label: 'Absen', value: absen, color: 'rose', icon: '✗' },
                    ].map((stat, idx) => (
                      <div key={idx} className={`rounded-2xl p-4 md:p-5 border-2 shadow-sm md:shadow-md hover:shadow-lg transition-all group ${
                        stat.color === 'indigo' ? 'bg-indigo-50/50 border-indigo-100' :
                        stat.color === 'emerald' ? 'bg-emerald-50/50 border-emerald-100' :
                        stat.color === 'amber' ? 'bg-amber-50/50 border-amber-100' :
                        stat.color === 'sky' ? 'bg-sky-50/50 border-sky-100' :
                        stat.color === 'violet' ? 'bg-violet-50/50 border-violet-100' :
                        'bg-rose-50/50 border-rose-100'
                      }`}>
                        <div className="flex items-center justify-between mb-1 md:mb-3">
                          <span className="text-xs md:text-2xl group-hover:scale-110 transition-transform">{stat.icon}</span>
                          <span className={`hidden md:block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                            stat.color === 'indigo' ? 'bg-white text-indigo-600 border-indigo-200' : 
                            stat.color === 'emerald' ? 'bg-white text-emerald-600 border-emerald-200' : 
                            stat.color === 'amber' ? 'bg-white text-amber-600 border-amber-200' : 
                            stat.color === 'sky' ? 'bg-white text-sky-600 border-sky-200' : 
                            stat.color === 'violet' ? 'bg-white text-violet-600 border-violet-200' : 
                            'bg-white text-rose-600 border-rose-200'
                          } border`}>
                            Hari Ini
                          </span>
                        </div>
                        <p className={`text-xs md:text-3xl font-black ${
                          stat.color === 'indigo' ? 'text-indigo-800' :
                          stat.color === 'emerald' ? 'text-emerald-800' :
                          stat.color === 'amber' ? 'text-amber-800' :
                          stat.color === 'sky' ? 'text-sky-800' :
                          stat.color === 'violet' ? 'text-violet-800' :
                          'text-rose-800'
                        }`}>{stat.value}</p>
                        <p className="text-slate-500 text-[8px] md:text-sm mt-0.5 md:mt-1 truncate font-bold leading-tight">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Progress Kehadiran (Gaya Dashboard Siswa) */}
                  <div className="bg-white rounded-xl border-2 border-blue-200 p-6 mb-6 shadow-lg">
                    <h3 className="font-semibold text-blue-800 mb-4">Progress Kehadiran Hari Ini</h3>
                    <div className="flex flex-col sm:flex-row items-center gap-8">
                      <div className="relative w-32 h-32 group">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="15.9155" fill="none" className="text-slate-100" stroke="currentColor" strokeWidth="3.5" />
                          <circle
                            cx="18"
                            cy="18"
                            r="15.9155"
                            fill="none"
                            className={`${hadirPercent >= 80 ? 'text-emerald-500' : hadirPercent >= 60 ? 'text-amber-500' : 'text-rose-500'} transition-all duration-1000 ease-out`}
                            stroke="currentColor"
                            strokeWidth="3.5"
                            strokeDasharray={`${hadirPercent}, 100`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className={`text-2xl font-black ${hadirPercent >= 80 ? 'text-emerald-600' : hadirPercent >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {hadirPercent}%
                          </span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Hadir</span>
                        </div>
                      </div>
                      <div className="flex-1 w-full">
                        <p className="text-sm text-blue-600 mb-2">
                          Kehadiran mencapai <span className="font-bold text-blue-600">{hadirPercent}%</span> dari total <span className="font-bold">{total}</span> rekaman hari ini
                        </p>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="flex items-center gap-2"><span className="w-3 h-3 bg-emerald-500 rounded-full"></span> Hadir</span>
                            <span className="font-medium">{hadir}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="flex items-center gap-2"><span className="w-3 h-3 bg-amber-500 rounded-full"></span> Terlambat</span>
                            <span className="font-medium">{terlambat}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="flex items-center gap-2"><span className="w-3 h-3 bg-sky-500 rounded-full"></span> Izin / Sakit</span>
                            <span className="font-medium">{izin + sakit}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="flex items-center gap-2"><span className="w-3 h-3 bg-rose-500 rounded-full"></span> Absen / Alpha</span>
                            <span className="font-medium">{absen}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-2xl border-2 border-blue-100 shadow-md overflow-hidden mt-4">
                    <div className="px-5 py-4 border-b border-blue-100 flex items-center justify-between">
                      <h3 className="font-bold text-blue-800">Aktivitas Absensi Terbaru</h3>
                      <span className="text-xs text-slate-500">Data tersambung langsung ke database</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-blue-50 border-b border-blue-100">
                          <tr>
                            <th className="px-4 py-3 text-left">Waktu</th>
                            <th className="px-4 py-3 text-left">Siswa</th>
                            <th className="px-4 py-3 text-left">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-blue-50">
                          {(() => {
                            const latestReports = [...attendanceReports].reverse();
                            const pageStart = (currentActivityPage - 1) * activityPageSize;
                            const pageEnd = pageStart + activityPageSize;
                            const paginatedReports = latestReports.slice(pageStart, pageEnd);

                            return paginatedReports.length > 0 ? paginatedReports.map((item, idx) => {
                              const dateStr = formatToIndonesiaTime(item.attendance_time || item.created_at || item.time || item.date);
                              const className = getClassName(item.class_id || item.kelas_id || item.kelas || item.class?.id || item.class?.name);
                              const status = (item.status || '').toString().toLowerCase();
                              const statusLabel = status === 'terlambat' || status === 'late' ? '⏰ Terlambat' : status === 'hadir' || status === 'tepat_waktu' ? '✅ Hadir' : '✗ Absen';
                              const userDisplay = item.user_name ||
                                (item.user && typeof item.user === 'object' ? (item.user.name || item.user.full_name || item.user.nama || item.user.user_id || '-') : item.user) ||
                                item.name || '-';
                              return (
                                <tr key={`${item.id || idx}-${item.user_id || item.user?.user_id || idx}-${item.attendance_time || idx}`}>
                                  <td className="px-4 py-3 text-slate-600">{dateStr}</td>
                                  <td className="px-4 py-3 text-blue-800 font-medium">{userDisplay}</td>
                                  <td className="px-4 py-3 text-sm font-semibold text-slate-700">{statusLabel}</td>
                                </tr>
                              );
                            }) : (
                              <tr>
                                <td colSpan="4" className="px-4 py-8 text-center text-slate-400">Belum ada data absensi</td>
                              </tr>
                            );
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="px-5 py-4 border-t border-blue-100 bg-blue-50 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">Halaman {currentActivityPage} dari {Math.max(1, Math.ceil(attendanceReports.length / activityPageSize))} · Total {attendanceReports.length} aktivitas</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={currentActivityPage <= 1}
                        onClick={() => setCurrentActivityPage((prev) => Math.max(prev - 1, 1))}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold transition ${currentActivityPage <= 1 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
                      >
                        Sebelumnya
                      </button>
                      <button
                        type="button"
                        disabled={currentActivityPage >= Math.max(1, Math.ceil(attendanceReports.length / activityPageSize))}
                        onClick={() => setCurrentActivityPage((prev) => Math.min(prev + 1, Math.max(1, Math.ceil(attendanceReports.length / activityPageSize))))}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold transition ${currentActivityPage >= Math.max(1, Math.ceil(attendanceReports.length / activityPageSize)) ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
                      >
                        Selanjutnya
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
                    <div className="bg-white rounded-2xl border-2 border-blue-100 shadow-md p-4">
                      <h4 className="font-semibold text-blue-800 mb-2">Data Siswa Aktif</h4>
                      <p className="text-slate-500 text-xs">{stats.totalSiswa} siswa terdaftar</p>
                    </div>
                    <div className="bg-white rounded-2xl border-2 border-blue-100 shadow-md p-4">
                      <h4 className="font-semibold text-blue-800 mb-2">Data Guru Aktif</h4>
                      <p className="text-slate-500 text-xs">{stats.totalGuru} guru terdaftar</p>
                    </div>
                    <div className="bg-white rounded-2xl border-2 border-blue-100 shadow-md p-4">
                      <h4 className="font-semibold text-blue-800 mb-2">Data Kelas Aktif</h4>
                      <p className="text-slate-500 text-xs">{stats.totalKelas} kelas tersedia</p>
                    </div>
                  </div>
                      </div>
              )}

              {/* TAB: Users */}
              {activeTab === 'users' && (
                <div className="animate-fade-in">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-lg font-bold text-blue-800">Daftar Pengguna</h2>
                      <p className="text-slate-500 text-sm">Kelola semua user sistem</p>
                    </div>
                    <button onClick={() => openCreateModal()} className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2 border-2 border-blue-300">
                      <span>➕</span> Tambah User
                    </button>
                  </div>
                  <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-blue-50 border-b-2 border-blue-200">
                          <tr>
                            {['Foto', 'Nama', 'Email', 'NIS/NIP', 'Role', 'Aksi'].map((h) => (
                              <th key={h} className="px-6 py-4 text-left text-xs font-semibold text-blue-700 uppercase tracking-wide">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-blue-50">
                          {filterData(users, searchQuery).map((u) => (
                            <tr key={u.id} className="hover:bg-blue-50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden border-2 border-blue-200">
                                  {u.photo ? (
                                    <img src={u.photo} alt={u.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-blue-400 font-bold">{u.name?.charAt(0) || '?'}</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="font-medium text-blue-800 text-sm">{u.name}</span>
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-600">{u.email}</td>
                              <td className="px-6 py-4 text-sm text-slate-600 font-mono">{u.user_id || '-'}</td>
                              <td className="px-6 py-4">
                                <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border-2 ${u.role === 'guru' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                  u.role === 'siswa' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                    'bg-blue-100 text-blue-700 border-blue-200'
                                  }`}>
                                  {u.role}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex gap-2">
                                  <button onClick={() => openEditModal(u)} className="text-blue-600 hover:text-blue-800 font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-all border border-blue-200">Edit</button>
                                  <button onClick={() => handleDeleteUser(u.id)} className="text-red-600 hover:text-red-800 font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all border border-red-200">Hapus</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: Data Guru */}
              {activeTab === 'dataGuru' && (
                <div className="animate-fade-in">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-lg font-bold text-blue-800">🎓 Data Guru</h2>
                      <p className="text-slate-500 text-sm">Daftar semua guru dan informasi</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => openCreateModal({ role: 'guru' })} className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2 border-2 border-blue-300">
                        <span>➕</span> Tambah Guru
                      </button>
                      <input
                        type="text"
                        placeholder="Cari..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="hidden sm:block px-4 py-2 border-2 border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-blue-50 border-b-2 border-blue-200">
                          <tr>
                            {['Nama', 'Email', 'NIP', 'Kode QR', 'Profil', 'Aksi'].map((h) => (
                              <th key={h} className="px-6 py-4 text-left text-xs font-semibold text-blue-700 uppercase tracking-wide">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-blue-50">
                          {guruData.length === 0 ? (
                            <tr>
                              <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                                <p className="text-4xl mb-3">📭</p>
                                <p className="font-medium">Belum ada data guru</p>
                              </td>
                            </tr>
                          ) : (
                            filterData(guruData, searchQuery).map((guru, index) => (
                              <tr key={guru.id} className="hover:bg-blue-50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shadow-sm overflow-hidden border-2 border-blue-200">
                                      {guru.photo ? (
                                        <img src={guru.photo} alt={guru.name} className="w-full h-full object-cover" />
                                      ) : (
                                        guru.name?.charAt(0) || 'G'
                                      )}
                                    </div>
                                    <span className="font-medium text-blue-800 text-sm">{guru.name}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600">{guru.email}</td>
                                <td className="px-6 py-4 text-sm text-slate-600 font-mono">{guru.user_id || '-'}</td>
                                <td className="px-6 py-4">
                                  <button
                                    onClick={() => handleShowQR(guru, 'guru')}
                                    className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all border border-blue-200"
                                    title="Lihat QR Code"
                                  >
                                    📱 QR
                                  </button>
                                </td>
                                <td className="px-6 py-4">
                                  <button
                                    onClick={() => {
                                      setSelectedProfileUser(guru);
                                      setShowProfileModal(true);
                                    }}
                                    className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all border border-indigo-200"
                                  >
                                    👤 Profil
                                  </button>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex gap-2">
                                    <button onClick={() => openEditModal(guru)} className="text-blue-600 hover:text-blue-800 font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-all border border-blue-200">Edit</button>
                                    <button onClick={() => handleDeleteUser(guru.id)} className="text-red-600 hover:text-red-800 font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all border border-red-200">Hapus</button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: Data Siswa */}
              {activeTab === 'dataSiswa' && (
                <div className="animate-fade-in">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-lg font-bold text-blue-800">🧑‍🎓 Data Siswa</h2>
                      <p className="text-slate-500 text-sm">Daftar semua siswa dan informasi</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => openCreateModal({ role: 'siswa' })} className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-sm font-medium hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2 border-2 border-emerald-300">
                        <span>➕</span> Tambah Siswa
                      </button>
                      <input
                        type="text"
                        placeholder="Cari..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="hidden sm:block px-4 py-2 border-2 border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-6">
                    {['1', '2', '3'].map((kelasNomor) => {
                      const siswaInClass = filterData(siswaData, searchQuery)
                        .filter((siswa) => getClassGroup(siswa) === kelasNomor);
                      return (
                        <div key={kelasNomor} className="bg-white rounded-2xl border-2 border-blue-200 shadow-md overflow-hidden">
                          <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
                            <h3 className="font-semibold text-blue-800">Kelas {kelasNomor}</h3>
                            <p className="text-xs text-slate-500">Total siswa: {siswaInClass.length}</p>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-blue-50 border-b-2 border-blue-200">
                                <tr>
                              {['Nama', 'Email', 'NIP', 'Kode QR', 'Profil', 'Aksi'].map((h) => (
                                    <th key={h} className="px-6 py-4 text-left text-xs font-semibold text-blue-700 uppercase tracking-wide">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-blue-50">
                                {siswaInClass.length === 0 ? (
                                  <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                      <p className="text-sm">Belum ada siswa di kelas {kelasNomor}</p>
                                    </td>
                                  </tr>
                                ) : (
                                  siswaInClass.map((siswa, index) => (
                                    <tr key={`kelas-${kelasNomor}-${siswa.id}`} className="hover:bg-blue-50 transition-colors">
                                      <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center overflow-hidden border-2 border-blue-200">
                                            {siswa.photo ? (
                                              <img src={siswa.photo} alt={siswa.name} className="w-full h-full object-cover" />
                                            ) : (
                                              <span className="text-sm font-bold">{siswa.name?.charAt(0) || 'S'}</span>
                                            )}
                                          </div>
                                          <span className="font-medium text-blue-800 text-sm">{siswa.name}</span>
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 text-sm text-slate-600">{siswa.email || '-'}</td>
                                      <td className="px-6 py-4 text-sm text-slate-600 font-mono">{siswa.user_id || siswa.nis || siswa.nisn || '-'}</td>
                                      <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => handleShowQR(siswa, 'siswa')}
                                        className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all border border-blue-200"
                                        title="Lihat QR Code"
                                          >
                                        📱 QR
                                          </button>
                                        </div>
                                      </td>
                                  <td className="px-6 py-4">
                                    <button
                                      onClick={() => {
                                        setSelectedProfileUser(siswa);
                                        setShowProfileModal(true);
                                      }}
                                      className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all border border-indigo-200"
                                    >
                                      👤 Profil
                                    </button>
                                  </td>
                                      <td className="px-6 py-4">
                                        <div className="flex gap-2">
                                          <button onClick={() => openEditModal(siswa)} className="text-emerald-600 hover:text-emerald-800 font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-all border border-emerald-200">Edit</button>
                                          <button onClick={() => handleDeleteUser(siswa.id)} className="text-red-600 hover:text-red-800 font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all border border-red-200">Hapus</button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}

                    {/* ✨ TAMBAHAN: Daftar Alumni (Setelah Lulus) */}
                    <div className="bg-white rounded-2xl border-2 border-slate-300 shadow-md overflow-hidden">
                      <div className="px-6 py-4 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-slate-700 text-lg">🎓 Daftar Alumni (Lulus)</h3>
                          <p className="text-xs text-slate-500">Siswa yang sudah lulus dan tidak memiliki kelas aktif</p>
                        </div>
                        <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
                          Total Alumni: {siswaData.filter(s => !['1', '2', '3'].includes(getClassGroup(s))).length}
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="px-6 py-3 text-left w-10 text-xs font-bold text-slate-400">#</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Siswa</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">NIS / ID</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status Terakhir</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(() => {
                              const alumni = siswaData.filter(s => !['1', '2', '3'].includes(getClassGroup(s)));
                              return alumni.length === 0 ? (
                                <tr>
                                  <td colSpan="4" className="px-6 py-8 text-center text-slate-400 text-sm italic">
                                    Belum ada data alumni tersimpan.
                                  </td>
                                </tr>
                              ) : (
                                alumni.map((siswa, idx) => (
                                  <tr key={`alumni-${siswa.id}`} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-xs text-slate-400">{idx + 1}</td>
                                    <td className="px-6 py-4">
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold border border-slate-300 overflow-hidden">
                                          {siswa.photo ? <img src={siswa.photo} className="w-full h-full object-cover" /> : siswa.name?.charAt(0)}
                                        </div>
                                        <span className="font-medium text-slate-800 text-sm">{siswa.name}</span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500 font-mono">{siswa.user_id}</td>
                                    <td className="px-6 py-4">
                                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                                        ALUMNI / LULUS
                                      </span>
                                    </td>
                                  </tr>
                                ))
                              );
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ✨ TAB: Naik Kelas (Promotion) */}
              {activeTab === 'promotion' && (
                <div className="animate-fade-in">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-blue-800">🚀 Manajemen Naik Kelas</h2>
                      <p className="text-slate-500 text-sm">Naikkan kelas siswa secara massal atau manual</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePromoteStudents(siswaData.map(s => s.id))}
                        disabled={siswaData.length === 0 || isPromoting}
                        className="px-6 py-2.5 bg-indigo-100 text-indigo-700 rounded-xl text-sm font-bold border-2 border-indigo-200 hover:bg-indigo-200 transition-all shadow-sm"
                      >
                        Otomatis Naikkan Semua
                      </button>
                      <button
                        onClick={() => handlePromoteStudents(selectedPromoteStudents)}
                        disabled={selectedPromoteStudents.length === 0 || isPromoting}
                        className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 border-2 border-blue-400"
                      >
                        {isPromoting ? '⏳ Memproses...' : `🚀 Naikkan Pilihan (${selectedPromoteStudents.length})`}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-8">
                    {['1', '2', '3'].map((kelasNomor) => {
                      const studentsInClass = siswaData.filter(s => getClassGroup(s) === kelasNomor);
                      const currentClassData = classes.find(c => c.name?.includes(kelasNomor) || c.id?.toString() === kelasNomor);
                      const walikelas = currentClassData?.teacher_name || '-';
                      
                      return (
                        <div key={`promote-class-${kelasNomor}`} className="bg-white rounded-2xl border-2 border-blue-200 shadow-md overflow-hidden">
                          <div className="px-6 py-4 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 border-b border-blue-200 flex flex-col md:flex-row md:items-center justify-between gap-2">
                            <div>
                              <h3 className="font-bold text-blue-900 text-lg">Kelas {kelasNomor}</h3>
                              <p className="text-xs text-indigo-600 font-bold bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 inline-block mt-1">
                                👨‍🏫 Wali Kelas: {walikelas}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <button 
                                onClick={() => handleSelectAllInClass(studentsInClass)}
                                className="text-xs font-bold text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-all"
                              >
                                {studentsInClass.every(s => selectedPromoteStudents.includes(s.id)) ? 'Lepas Semua' : 'Pilih Semua'}
                              </button>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-slate-50/50 border-b border-slate-200">
                                <tr>
                                  <th className="px-6 py-3 text-left w-10">
                                    <span className="text-xs font-bold text-slate-400">#</span>
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-semibold text-blue-700 uppercase">Siswa</th>
                                  <th className="px-6 py-3 text-left text-xs font-semibold text-blue-700 uppercase">NIS / ID</th>
                                  <th className="px-6 py-3 text-center text-xs font-semibold text-blue-700 uppercase">Status Pilih</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {studentsInClass.length === 0 ? (
                                  <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-slate-400 text-sm italic">
                                      Belum ada data siswa di kelas ini.
                                    </td>
                                  </tr>
                                ) : (
                                  studentsInClass.map((siswa, idx) => (
                                    <tr 
                                      key={siswa.id} 
                                      className={`hover:bg-blue-50/50 transition-colors cursor-pointer ${selectedPromoteStudents.includes(siswa.id) ? 'bg-blue-50/80' : ''}`}
                                      onClick={() => togglePromoteSelection(siswa.id)}
                                    >
                                      <td className="px-6 py-4 text-xs text-slate-400">{idx + 1}</td>
                                      <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold border border-blue-200 overflow-hidden">
                                            {siswa.photo ? <img src={siswa.photo} className="w-full h-full object-cover" /> : siswa.name?.charAt(0)}
                                          </div>
                                          <span className="font-medium text-slate-800 text-sm">{siswa.name}</span>
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 text-sm text-slate-500 font-mono">{siswa.user_id}</td>
                                      <td className="px-6 py-4 text-center">
                                        <input 
                                          type="checkbox"
                                          checked={selectedPromoteStudents.includes(siswa.id)}
                                          onChange={() => togglePromoteSelection(siswa.id)}
                                          className="w-5 h-5 text-blue-600 border-2 border-blue-200 rounded focus:ring-blue-500 cursor-pointer"
                                        />
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ✨ TAMBAHAN: TAB: Pesan WhatsApp */}
              {activeTab === 'pesanWA' && (
                <div className="animate-fade-in">
                  <div className="mb-6">
                    <h2 className="text-lg font-bold text-blue-800">💬 Pesan WhatsApp ke Orang Tua</h2>
                    <p className="text-slate-500 text-sm">Kirim pesan langsung ke nomor telepon orang tua siswa</p>
                  </div>
                  
                  {/* Template Pesan */}
                  <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-md p-5 mb-6">
                    <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Template Pesan</label>
                    <textarea
                      value={waMessageTemplate}
                      onChange={(e) => setWaMessageTemplate(e.target.value)}
                      rows="2"
                      className="w-full px-4 py-2.5 border-2 border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                      placeholder="Tulis pesan template..."
                    />
                    <p className="text-xs text-slate-500 mt-2">💡 Nama siswa akan ditambahkan otomatis di akhir pesan</p>
                  </div>
                  
                  {/* Tabel per Kelas */}
                  <div className="space-y-6">
                    {['1', '2', '3'].map((kelasNomor) => {
                      const siswaInClass = filterSiswaForWA(siswaData.filter(s => getClassGroup(s) === kelasNomor), waSearchQuery);
                      return (
                        <div key={`wa-kelas-${kelasNomor}`} className="bg-white rounded-2xl border-2 border-blue-200 shadow-md overflow-hidden">
                          <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-200">
                            <h3 className="font-semibold text-green-800 flex items-center gap-2">
                              <span>📱</span> Kelas {kelasNomor} - Kontak Orang Tua
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">Total: {siswaInClass.length} siswa</p>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-green-50 border-b-2 border-green-200">
                                <tr>
                                  {['No', 'Nama Siswa', 'Nomor Orang Tua', 'Aksi'].map((h) => (
                                    <th key={h} className="px-6 py-4 text-left text-xs font-semibold text-green-700 uppercase tracking-wide">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-green-50">
                                {siswaInClass.length === 0 ? (
                                  <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                                      <p className="text-4xl mb-3">📭</p>
                                      <p className="font-medium">Belum ada data siswa</p>
                                    </td>
                                  </tr>
                                ) : (
                                  siswaInClass.map((siswa, index) => (
                                    <tr key={`wa-${kelasNomor}-${siswa.id}`} className="hover:bg-green-50 transition-colors">
                                      <td className="px-6 py-4 text-sm text-slate-600">{index + 1}</td>
                                      <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                          <div className="w-9 h-9 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold shadow-sm overflow-hidden border-2 border-green-200">
                                            {siswa.photo ? (
                                              <img src={siswa.photo} alt={siswa.name} className="w-full h-full object-cover" />
                                            ) : (
                                              <span>{siswa.name?.charAt(0) || 'S'}</span>
                                            )}
                                          </div>
                                          <span className="font-medium text-green-800 text-sm">{siswa.name}</span>
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 text-sm text-slate-600 font-mono">
                                        {siswa.parent_phone || siswa.phone || '-'}
                                      </td>
                                      <td className="px-6 py-4">
                                        <div className="flex gap-2">
                                          <button
                                            onClick={() => openEditModal(siswa)}
                                            className="text-blue-600 hover:text-blue-800 font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-all border border-blue-200"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            onClick={() => handleSendWhatsApp(siswa.parent_phone || siswa.phone, siswa.name)}
                                            disabled={!siswa.parent_phone && !siswa.phone}
                                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border-2 ${
                                              siswa.parent_phone || siswa.phone
                                                ? 'bg-green-500 hover:bg-green-600 text-white border-green-300'
                                                : 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed'
                                            }`}
                                            title={!siswa.parent_phone && !siswa.phone ? 'Nomor telepon tidak tersedia' : 'Kirim via WhatsApp'}
                                          >
                                            <span>💬</span>
                                            <span>Kirim</span>
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Info */}
                  <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                    <h4 className="font-semibold text-blue-900 mb-2 text-sm flex items-center gap-1">
                      <span>ℹ️</span> Cara Penggunaan
                    </h4>
                    <ul className="space-y-1.5 text-sm text-blue-800">
                      <li>• Klik tombol "Kirim" untuk membuka WhatsApp Web/App</li>
                      <li>• Pesan template akan otomatis terisi dengan nama siswa</li>
                      <li>• Pastikan WhatsApp sudah terinstall atau login di browser</li>
                      <li>• Nomor telepon harus format Indonesia (08xx atau +62xx)</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* TAB: Classes */}
              {activeTab === 'classes' && (
                <div className="animate-fade-in">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-2xl font-black text-blue-900 tracking-tight">🏫 Data Manajemen Kelas</h2>
                      <p className="text-slate-500 text-sm mt-1">Struktur organisasi kelas dan daftar siswa aktif</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-xl text-sm font-bold border-2 border-blue-200 shadow-sm">
                        Total: {classes.length} Kelas
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {classes.length === 0 ? (
                      <div className="col-span-full bg-white rounded-3xl border-2 border-dashed border-blue-200 p-16 text-center shadow-inner">
                        <p className="text-5xl mb-4">🏫</p>
                        <p className="text-blue-900 font-bold text-lg">Belum ada data kelas di sistem</p>
                        <p className="text-slate-500 text-sm mt-1">Pastikan data kelas sudah tersinkronisasi dari database.</p>
                      </div>
                    ) : (
                      classes.map((cls) => {
                        // ✨ Hubungkan dengan database: Ambil siswa yang memiliki class_id yang sama
                        const studentsInClass = siswaData.filter(s => 
                          s.class_id?.toString() === cls.id?.toString() || 
                          s.class_name === cls.name ||
                          getClassGroup(s) === cls.name?.replace(/[^0-9]/g, '')
                        );
                        
                        // ✨ Hubungkan Mata Pelajaran: Ambil jadwal yang nyambung ke kelas ini
                        const classSubjects = schedules.filter(s => 
                          s.class_id?.toString() === cls.id?.toString() || 
                          s.class_name === cls.name
                        );
                        
                        return (
                          <div key={cls.id} className="group bg-white rounded-3xl border-2 border-blue-200 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden flex flex-col">
                            {/* Header Card: Design ala Landing Page (Gradient & Icon) */}
                            <div className="p-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white relative overflow-hidden">
                              <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500"></div>
                              <div className="relative z-10">
                                <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-inner border border-white/30 group-hover:scale-110 transition-transform duration-300">
                                  🏫
                                </div>
                                <h3 className="text-2xl font-black mb-1">{cls.name}</h3>
                                <div className="flex items-center gap-2 text-blue-100 text-sm font-medium">
                                  <span>👨‍🏫 Wali:</span>
                                  <span className="text-white bg-blue-500/50 px-2 py-0.5 rounded-lg border border-white/20">{cls.teacher_name || 'Belum Ditentukan'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Body: Daftar Siswa Terkoneksi Database */}
                            <div className="p-5 flex-1 flex flex-col">
                              <div className="flex items-center justify-between mb-4 pb-2 border-b border-blue-50">
                                <span className="text-xs font-black text-blue-900 uppercase tracking-widest">Daftar Siswa</span>
                                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                                  {studentsInClass.length} Orang
                                </span>
                              </div>

                              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                {studentsInClass.length === 0 ? (
                                  <div className="py-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                    <p className="text-xs text-slate-400 italic">Tidak ada siswa terdaftar</p>
                                  </div>
                                ) : (
                                  studentsInClass.map((student, sIdx) => (
                                    <div key={student.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-blue-50 transition-colors border border-transparent hover:border-blue-100">
                                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-[10px] font-black text-blue-600 shadow-sm border border-blue-200">
                                        {sIdx + 1}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-700 truncate">{student.name}</p>
                                        <p className="text-[10px] font-mono text-slate-400">NIS: {student.user_id}</p>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>

                              {/* ✨ TAMBAHAN: Daftar Mata Pelajaran Terkoneksi */}
                              <div className="mt-4 pt-4 border-t border-blue-50">
                                <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest block mb-2">📚 Daftar Mata Pelajaran</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {classSubjects.length === 0 ? (
                                    <span className="text-[10px] text-slate-400 italic font-medium">Belum ada jadwal mapel</span>
                                  ) : (
                                    // Mengambil subject unik agar tidak duplikat jika ada jadwal di hari berbeda
                                    Array.from(new Set(classSubjects.map(s => s.subject_name))).slice(0, 4).map((sub, idx) => (
                                      <span key={idx} className="text-[9px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md border border-indigo-100 shadow-sm">
                                        {sub}
                                      </span>
                                    ))
                                  )}
                                  {classSubjects.length > 4 && <span className="text-[9px] text-slate-400 font-bold">+{classSubjects.length - 4} lagi</span>}
                                </div>
                              </div>

                              <button 
                                onClick={() => {
                                  setActiveTab('dataSiswa');
                                  setSearchQuery(cls.name);
                                }}
                                className="mt-6 w-full py-3 bg-blue-50 text-blue-700 text-xs font-black rounded-2xl hover:bg-blue-600 hover:text-white transition-all duration-300 border-2 border-blue-100 uppercase tracking-tighter"
                              >
                                Kelola Siswa Kelas Ini →
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* ✨ TAB: Subjects */}
              {activeTab === 'subjects' && (
                <div className="animate-fade-in">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-lg font-bold text-blue-800">📚 Mata Pelajaran</h2>
                      <p className="text-slate-500 text-sm">Kelola mata pelajaran dari database</p>
                    </div>
                    <button
                      onClick={() => setShowSubjectModal(true)}
                      className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2 border-2 border-blue-300"
                    >
                      <span>➕</span> Tambah Mapel
                    </button>
                  </div>
                  {featureDataLoading ? (
                    <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-md p-12 text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                      <p className="text-blue-600 font-medium">Memuat data...</p>
                    </div>
                  ) : subjects.length === 0 ? (
                    <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-md p-12 text-center">
                      <p className="text-5xl mb-4">📚</p>
                      <p className="text-blue-700 font-medium">Belum ada mata pelajaran</p>
                      <p className="text-slate-500 text-sm mt-2">Klik tombol "Tambah Mapel" untuk menambahkan</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-md overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-blue-50 border-b-2 border-blue-200">
                            <tr>
                              {['No', 'Kode', 'Nama Mapel', 'SKS', 'Semester', 'Aksi'].map((h) => (
                                <th key={h} className="px-6 py-4 text-left text-xs font-semibold text-blue-700 uppercase tracking-wide">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-blue-50">
                            {subjects.map((subject, index) => (
                              <tr key={subject.id} className="hover:bg-blue-50 transition-colors">
                                <td className="px-6 py-4 text-sm text-slate-600">{index + 1}</td>
                                <td className="px-6 py-4 text-sm text-slate-600 font-mono">{subject.code || '-'}</td>
                                <td className="px-6 py-4">
                                  <span className="font-medium text-blue-800 text-sm">{subject.name}</span>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600">{subject.credits || 0}</td>
                                <td className="px-6 py-4">
                                  <span className="text-xs font-semibold px-3 py-1.5 rounded-full border-2 bg-blue-100 text-blue-700 border-blue-200">
                                    {subject.semester || '-'}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        setSelectedItem(subject);
                                        setShowSubjectModal(true);
                                      }}
                                      className="text-blue-600 hover:text-blue-800 font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-all border border-blue-200"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSubject(subject.id)}
                                      className="text-red-600 hover:text-red-800 font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all border border-red-200"
                                    >
                                      Hapus
                                    </button>
                                  </div>
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

              {/* ✨ TAB: Schedules */}
              {activeTab === 'schedules' && (
                <div className="animate-fade-in">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-lg font-bold text-blue-800">📅 Jadwal Pelajaran</h2>
                      <p className="text-slate-500 text-sm">Kelola jadwal mengajar dari database</p>
                    </div>
                    <button
                      onClick={() => setShowScheduleModal(true)}
                      className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2 border-2 border-blue-300"
                    >
                      <span>➕</span> Tambah Jadwal
                    </button>
                  </div>
                  {featureDataLoading ? (
                    <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-md p-12 text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                      <p className="text-blue-600 font-medium">Memuat data...</p>
                    </div>
                  ) : schedules.length === 0 ? (
                    <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-md p-12 text-center">
                      <p className="text-5xl mb-4">📅</p>
                      <p className="text-blue-700 font-medium">Belum ada jadwal</p>
                      <p className="text-slate-500 text-sm mt-2">Klik tombol "Tambah Jadwal" untuk menambahkan</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-md overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-blue-50 border-b-2 border-blue-200">
                            <tr>
                              {['No', 'Hari', 'Jam', 'Mapel', 'Kelas', 'Guru', 'Aksi'].map((h) => (
                                <th key={h} className="px-6 py-4 text-left text-xs font-semibold text-blue-700 uppercase tracking-wide">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-blue-50">
                            {schedules.map((schedule, index) => (
                              <tr key={schedule.id} className="hover:bg-blue-50 transition-colors">
                                <td className="px-6 py-4 text-sm text-slate-600">{index + 1}</td>
                                <td className="px-6 py-4">
                                  <span className="text-xs font-semibold px-3 py-1.5 rounded-full border-2 bg-blue-100 text-blue-700 border-blue-200">
                                    {schedule.day || '-'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600">{schedule.start_time || '-'} - {schedule.end_time || '-'}</td>
                                <td className="px-6 py-4">
                                  <span className="font-medium text-blue-800 text-sm">{schedule.subject_name || '-'}</span>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600">{schedule.class_name || '-'}</td>
                                <td className="px-6 py-4 text-sm text-slate-600">{schedule.teacher_name || '-'}</td>
                                <td className="px-6 py-4">
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        setSelectedItem(schedule);
                                        setShowScheduleModal(true);
                                      }}
                                      className="text-blue-600 hover:text-blue-800 font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-all border border-blue-200"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSchedule(schedule.id)}
                                      className="text-red-600 hover:text-red-800 font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all border border-red-200"
                                    >
                                      Hapus
                                    </button>
                                  </div>
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

              {/* ✨ TAB: Announcements */}
              {activeTab === 'announcements' && (
                <div className="animate-fade-in">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-lg font-bold text-blue-800">📢 Pengumuman</h2>
                      <p className="text-slate-500 text-sm">Kelola pengumuman dari database</p>
                    </div>
                    <button
                      onClick={() => setShowAnnouncementModal(true)}
                      className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2 border-2 border-blue-300"
                    >
                      <span>➕</span> Tambah Pengumuman
                    </button>
                  </div>
                  {featureDataLoading ? (
                    <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-md p-12 text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                      <p className="text-blue-600 font-medium">Memuat data...</p>
                    </div>
                  ) : announcements.length === 0 ? (
                    <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-md p-12 text-center">
                      <p className="text-5xl mb-4">📢</p>
                      <p className="text-blue-700 font-medium">Belum ada pengumuman</p>
                      <p className="text-slate-500 text-sm mt-2">Klik tombol "Tambah Pengumuman" untuk menambahkan</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {announcements.map((announcement) => (
                        <div key={announcement.id} className="bg-white rounded-2xl border-2 border-blue-200 p-6 shadow-md hover:shadow-lg transition-all group">
                          <div className="flex items-start justify-between mb-4">
                            <h3 className="font-bold text-blue-800 text-lg">{announcement.title}</h3>
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border-2 ${announcement.priority === 'high' ? 'bg-red-100 text-red-700 border-red-200' :
                              announcement.priority === 'medium' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                'bg-blue-100 text-blue-700 border-blue-200'
                              }`}>
                              {announcement.priority === 'high' ? '🔴 Penting' :
                                announcement.priority === 'medium' ? '🟡 Sedang' : '🟢 Biasa'}
                            </span>
                          </div>
                          <p className="text-slate-600 text-sm mb-4 line-clamp-3">{announcement.content}</p>
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>📅 {formatDateOnly(announcement.created_at)}</span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setSelectedItem(announcement);
                                  setShowAnnouncementModal(true);
                                }}
                                className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-all"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteAnnouncement(announcement.id)}
                                className="text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50 transition-all"
                              >
                                Hapus
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ✨ TAB: Reports */}
              {activeTab === 'reports' && (
                <div className="animate-fade-in">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-lg font-bold text-blue-800">📈 Laporan Absensi</h2>
                      <p className="text-slate-500 text-sm">Laporan kehadiran dari database</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleExportData('attendance')}
                        className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-sm font-medium hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2 border-2 border-emerald-300"
                      >
                        <span>📥</span> Export Excel
                      </button>
                      <button
                        onClick={() => handleExportData('attendance_pdf')}
                        className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl text-sm font-medium hover:from-red-600 hover:to-red-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2 border-2 border-red-300"
                      >
                        <span>📄</span> Export PDF
                      </button>
                    </div>
                  </div>
                  {featureDataLoading ? (
                    <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-md p-12 text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                      <p className="text-blue-600 font-medium">Memuat data...</p>
                    </div>
                  ) : attendanceReports.length === 0 ? (
                    <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-md p-12 text-center">
                      <p className="text-5xl mb-4">📈</p>
                      <p className="text-blue-700 font-medium">Belum ada laporan</p>
                      <p className="text-slate-500 text-sm mt-2">Data akan muncul setelah ada absensi</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-md overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-blue-50 border-b-2 border-blue-200">
                            <tr>
                              {['No', 'Tanggal', 'Nama', 'Role', 'Status', 'Waktu', 'Keterangan'].map((h) => (
                                <th key={h} className="px-6 py-4 text-left text-xs font-semibold text-blue-700 uppercase tracking-wide">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-blue-50">
                            {attendanceReports.map((report, index) => (
                              <tr key={report.id || `${index}-${report.user_name}-${report.date}`} className="hover:bg-blue-50 transition-colors">
                                <td className="px-6 py-4 text-sm text-slate-600">{index + 1}</td>
                                <td className="px-6 py-4 text-sm text-slate-600">{formatDateOnly(report.date || report.created_at || report.attendance_time || report.time)}</td>
                                <td className="px-6 py-4">
                                  <span className="font-medium text-blue-800 text-sm">{report.user_name || report.name || report.user || '-'}</span>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border-2 ${report.role === 'guru' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                    }`}>
                                    {report.role || 'siswa'}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border-2 ${(report.status || '').toString().toLowerCase() === 'hadir' || (report.status || '').toString().toLowerCase() === 'tepat_waktu' ? 'bg-green-100 text-green-700 border-green-200' :
                                      (report.status || '').toString().toLowerCase() === 'terlambat' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                        'bg-red-100 text-red-700 border-red-200'
                                    }`}>
                                    {report.status || '-'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600">{formatTimeOnly(report.scan_time || report.attendance_time || report.time || report.created_at)}</td>
                                <td className="px-6 py-4 text-sm text-slate-600">{report.notes || report.keterangan || report.description || report.action || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: Activity */}
              {activeTab === 'activity' && (
                <div className="animate-fade-in space-y-6">
                  <div className="mb-6">
                    <h2 className="text-lg font-bold text-blue-800">Aktivitas Sistem</h2>
                    <p className="text-slate-500 text-sm">Riwayat aktivitas semua pengguna</p>
                  </div>
                  {/* Tabel Aktivitas Terlambat */}
                  <div className="bg-white rounded-2xl border-2 border-red-200 shadow-md overflow-hidden">
                    <div className="px-6 py-4 border-b-2 border-red-100 bg-red-50">
                      <h3 className="font-semibold text-red-800 flex items-center gap-2">
                        <span>⚠️</span> Aktivitas Terlambat
                      </h3>
                    </div>
                    <div className="divide-y divide-red-50">
                      {getLateActivities().length === 0 ? (
                        <div className="p-12 text-center text-slate-500">
                          <p className="text-5xl mb-4">✅</p>
                          <p className="font-medium">Tidak ada aktivitas terlambat</p>
                        </div>
                      ) : (
                        getLateActivities().map((act, i) => {
                          const indoTime = formatToIndonesiaTime(act.created_at || act.time);
                          const indoDate = indoTime.split(' ')[0];
                          const indoClock = indoTime.split(' ')[1];
                          return (
                            <div key={i} className="p-5 flex items-center justify-between hover:bg-red-50 transition-colors">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold shadow-sm border-2 bg-red-100 text-red-600 border-red-200">
                                  {act.user?.charAt(0) || '?'}
                                </div>
                                <div>
                                  <p className="font-semibold text-red-800">{act.user}</p>
                                  <p className="text-slate-500 text-sm">{act.action}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-red-800">{indoClock}</p>
                                <p className="text-xs text-slate-400">{indoDate}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                  {/* Tabel Aktivitas Tepat Waktu */}
                  <div className="bg-white rounded-2xl border-2 border-green-200 shadow-md overflow-hidden">
                    <div className="px-6 py-4 border-b-2 border-green-100 bg-green-50">
                      <h3 className="font-semibold text-green-800 flex items-center gap-2">
                        <span>✅</span> Aktivitas Tepat Waktu
                      </h3>
                    </div>
                    <div className="divide-y divide-green-50">
                      {getOnTimeActivities().length === 0 ? (
                        <div className="p-12 text-center text-slate-500">
                          <p className="text-5xl mb-4">⏰</p>
                          <p className="font-medium">Belum ada aktivitas</p>
                        </div>
                      ) : (
                        getOnTimeActivities().map((act, i) => {
                          const indoTime = formatToIndonesiaTime(act.created_at || act.time);
                          const indoDate = indoTime.split(' ')[0];
                          const indoClock = indoTime.split(' ')[1];
                          return (
                            <div key={i} className="p-5 flex items-center justify-between hover:bg-green-50 transition-colors">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold shadow-sm border-2 bg-green-100 text-green-600 border-green-200">
                                  {act.user?.charAt(0) || '?'}
                                </div>
                                <div>
                                  <p className="font-semibold text-green-800">{act.user}</p>
                                  <p className="text-slate-500 text-sm">{act.action}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-green-800">{indoClock}</p>
                                <p className="text-xs text-slate-400">{indoDate}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ✨ TAB: Pengaturan */}
              {activeTab === 'settings' && (
                <div className="animate-fade-in">
                  <div className="mb-6">
                    <h2 className="text-lg font-bold text-blue-800">⚙️ Pengaturan Sistem</h2>
                    <p className="text-slate-500 text-sm">Konfigurasi pengaturan sistem absensi</p>
                  </div>
                  {settingsSaved && (
                    <div className="mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-xl flex items-center gap-3 text-green-700 animate-fade-in">
                      <span className="text-lg">✅</span>
                      <span className="text-sm font-medium">Pengaturan berhasil disimpan!</span>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-3">
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {[
                          { id: 'school', title: 'Sekolah', icon: '🏫', description: 'Identitas' },
                          { id: 'attendance', title: 'Absensi', icon: '⏰', description: 'Jadwal' },
                          { id: 'notification', title: 'Sistem', icon: '🔔', description: 'Notifikasi' },
                          { id: 'events', title: 'Event', icon: '📅', description: 'Hari Besar' },
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setSettingsSection(tab.id)}
                            className={`min-w-[110px] flex-shrink-0 group rounded-3xl border p-2.5 transition-all text-left ${settingsSection === tab.id ? 'bg-blue-500 border-blue-500 text-white shadow-lg' : 'bg-white border-blue-100 text-slate-700 hover:border-blue-200 hover:bg-blue-50'}`}
                          >
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-base ${settingsSection === tab.id ? 'bg-white text-blue-600' : 'bg-blue-50 text-blue-600'}`}>
                              {tab.icon}
                            </div>
                            <div className="mt-2">
                              <p className="text-xs font-semibold">{tab.title}</p>
                              <p className="text-[10px] text-slate-500 mt-1">{tab.description}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                      <div className="xl:col-span-2 space-y-4">
                        {settingsSection === 'school' && (
                          <form onSubmit={(e) => handleSaveSettings('school', e)} className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4 space-y-4">
                            <h3 className="text-base font-bold text-blue-800">🏫 Informasi Sekolah</h3>
                            <div className="space-y-4">
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Logo Sekolah</label>
                                <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                                  <div className="w-16 h-16 rounded-lg bg-white flex items-center justify-center overflow-hidden border border-blue-200 shadow-sm">
                                    {logoPreview ? (
                                      <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                                    ) : (
                                      <span className="text-2xl">🏫</span>
                                    )}
                                  </div>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleLogoChange}
                                    className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 transition-all"
                                  />
                                </div>
                              </div>
                              <div className="space-y-4">
                                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">Galeri Foto (Maks 3)</label>
                                <div className="grid grid-cols-3 gap-2">
                                  {[1, 2, 3].map((i) => (
                                    <div key={`setting-photo-slot-${i}`} className="p-2 bg-blue-50 rounded-xl border border-blue-100">
                                      <div className="w-full aspect-square mb-2 rounded-lg bg-white overflow-hidden border">
                                        {mediaPhotoPreviews[i] ? (
                                          <img src={mediaPhotoPreviews[i]} className="w-full h-full object-cover" />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-lg">📸</div>
                                        )}
                                      </div>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                          const file = e.target.files[0];
                                          if (file) {
                                            setMediaPhotoFiles((prev) => ({ ...prev, [i]: file }));
                                            const reader = new FileReader();
                                            reader.onloadend = () => setMediaPhotoPreviews((prev) => ({ ...prev, [i]: reader.result }));
                                            reader.readAsDataURL(file);
                                          }
                                        }}
                                        className="w-full text-[10px]"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">Video Profil</label>
                                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                                  <div className="w-full h-28 mb-2 rounded-lg bg-white overflow-hidden border flex items-center justify-center">
                                    {mediaVideoPreview ? (
                                      <span className="text-green-600 font-bold text-xs">Video Terpilih ✅</span>
                                    ) : (
                                      <div className="text-2xl">🎥</div>
                                    )}
                                  </div>
                                  <input
                                    type="file"
                                    accept="video/*"
                                    onChange={(e) => {
                                      const file = e.target.files[0];
                                      if (file) {
                                        setMediaVideoFile(file);
                                        setMediaVideoPreview(URL.createObjectURL(file));
                                      }
                                    }}
                                    className="w-full text-xs"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Nama Sekolah</label>
                                <input
                                  type="text"
                                  name="schoolName"
                                  value={settingsData.schoolName || ''}
                                  onChange={handleSettingsChange}
                                  className="w-full px-3 py-2 border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Alamat Sekolah</label>
                                <textarea
                                  name="schoolAddress"
                                  value={settingsData.schoolAddress}
                                  onChange={handleSettingsChange}
                                  rows="2"
                                  className="w-full px-3 py-2 border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Telepon</label>
                                  <input
                                    type="text"
                                    name="schoolPhone"
                                    value={settingsData.schoolPhone}
                                    onChange={handleSettingsChange}
                                    className="w-full px-3 py-2 border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Email</label>
                                  <input
                                    type="email"
                                    name="schoolEmail"
                                    value={settingsData.schoolEmail}
                                    onChange={handleSettingsChange}
                                    className="w-full px-3 py-2 border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Tahun Ajaran</label>
                                <input
                                  type="text"
                                  name="academicYear"
                                  value={settingsData.academicYear}
                                  onChange={handleSettingsChange}
                                  className="w-full px-3 py-2 border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end">
                              <button
                                type="submit"
                                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all"
                              >
                                Simpan Sekolah
                              </button>
                            </div>
                          </form>
                        )}

                        {settingsSection === 'attendance' && (
                          <form onSubmit={(e) => handleSaveSettings('attendance', e)} className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4 space-y-4">
                            <h3 className="text-base font-bold text-blue-800">⏰ Pengaturan Absensi</h3>
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Jam Buka Absensi</label>
                                  <input
                                    type="time"
                                    name="attendanceStartTime"
                                    value={settingsData.attendanceStartTime}
                                    onChange={handleSettingsChange}
                                    className="w-full px-3 py-2 border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Jam Tutup Absensi</label>
                                  <input
                                    type="time"
                                    name="attendanceEndTime"
                                    value={settingsData.attendanceEndTime}
                                    onChange={handleSettingsChange}
                                    className="w-full px-3 py-2 border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Batas Keterlambatan</label>
                                <input
                                  type="time"
                                  name="lateThreshold"
                                  value={settingsData.lateThreshold}
                                  onChange={handleSettingsChange}
                                  className="w-full px-3 py-2 border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Jam Pulang Sekolah (auto absen alfha)</label>
                                <input
                                  type="time"
                                  name="schoolEndTime"
                                  value={settingsData.schoolEndTime}
                                  onChange={handleSettingsChange}
                                  className="w-full px-3 py-2 border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />
                                <p className="text-xs text-slate-500 mt-1">Setelah jam ini, scheduler bisa menandai siswa tanpa absen sebagai alpha/absen (jalankan `php artisan schedule:work` atau cron).</p>
                              </div>
                              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-200">
                                <div>
                                  <p className="text-sm font-medium text-amber-900">Buka sesi absensi</p>
                                  <p className="text-xs text-slate-600">Matikan untuk menutup absensi QR/manual siswa</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    name="attendanceSessionOpen"
                                    checked={settingsData.attendanceSessionOpen}
                                    onChange={handleSettingsChange}
                                    className="sr-only peer"
                                  />
                                  <div className="w-11 h-6 bg-amber-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                                </label>
                              </div>
                              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <div>
                                  <p className="text-sm font-medium text-slate-800">Auto alpha/absen jam pulang</p>
                                  <p className="text-xs text-slate-500">Siswa tanpa rekaman di hari itu ditandai absen otomatis</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    name="autoMarkAbsentEnabled"
                                    checked={settingsData.autoMarkAbsentEnabled}
                                    onChange={handleSettingsChange}
                                    className="sr-only peer"
                                  />
                                  <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-700"></div>
                                </label>
                              </div>
                              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100">
                                <div>
                                  <p className="text-sm font-medium text-blue-800">QR Code Absensi</p>
                                  <p className="text-xs text-slate-500">Aktifkan absensi menggunakan QR code</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    name="enableQRCode"
                                    checked={settingsData.enableQRCode}
                                    onChange={handleSettingsChange}
                                    className="sr-only peer"
                                  />
                                  <div className="w-11 h-6 bg-blue-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                              </div>
                            </div>
                            <div className="flex justify-end">
                              <button
                                type="submit"
                                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all"
                              >
                                Simpan Absensi
                              </button>
                            </div>
                          </form>
                        )}

                        {settingsSection === 'notification' && (
                          <form onSubmit={(e) => handleSaveSettings('notification', e)} className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4 space-y-4">
                            <h3 className="text-base font-bold text-blue-800">🔔 Pengaturan Notifikasi</h3>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100">
                                <div>
                                  <p className="text-sm font-medium text-blue-800">Notifikasi Sistem</p>
                                  <p className="text-xs text-slate-500">Aktifkan notifikasi untuk aktivitas sistem</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    name="enableNotifications"
                                    checked={settingsData.enableNotifications}
                                    onChange={handleSettingsChange}
                                    className="sr-only peer"
                                  />
                                  <div className="w-11 h-6 bg-blue-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                              </div>
                              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100">
                                <div>
                                  <p className="text-sm font-medium text-blue-800">Laporan Email</p>
                                  <p className="text-xs text-slate-500">Kirim laporan absensi via email</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    name="enableEmailReports"
                                    checked={settingsData.enableEmailReports}
                                    onChange={handleSettingsChange}
                                    className="sr-only peer"
                                  />
                                  <div className="w-11 h-6 bg-blue-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                              </div>
                            </div>
                            <div className="flex justify-end">
                              <button
                                type="submit"
                                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all"
                              >
                                Simpan Notifikasi
                              </button>
                            </div>
                          </form>
                        )}

                        {/* ✨ TAMBAHAN: Pengaturan Event */}
                        {settingsSection === 'events' && (
                          <div className="space-y-4">
                            <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4">
                              <div className="flex justify-between items-center mb-4">
                                <h3 className="text-base font-bold text-blue-800">📅 Kelola Event Sekolah</h3>
                                <button 
                                  onClick={() => setShowAnnouncementModal_Event(true)}
                                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all"
                                >
                                  ➕ Tambah Event
                                </button>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {events.length === 0 ? (
                                  <p className="col-span-full text-center py-8 text-slate-400 italic text-sm">Belum ada event terdaftar.</p>
                                ) : (
                                  events.map(ev => (
                                    <div key={ev.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                      <img src={resolvePhotoUrl(ev.image)} className="w-12 h-12 rounded-lg object-cover bg-white" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-800 truncate">{ev.title}</p>
                                        <p className="text-[10px] text-slate-500">{ev.date}</p>
                                      </div>
                                      <button onClick={() => handleDeleteEvent(ev.id)} className="text-red-500 hover:text-red-700 p-2">🗑️</button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            {showEventModal && (
                              <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                                <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-fade-in-up">
                                  <h3 className="text-lg font-bold text-blue-900 mb-4">Tambah Event Baru</h3>
                                  <form onSubmit={handleSaveEvent} className="space-y-4">
                                    <div>
                                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nama Event / Hari Besar</label>
                                      <input type="text" required value={eventFormData.title} onChange={e => setEventFormData({...eventFormData, title: e.target.value})} className="w-full px-4 py-2 border-2 border-blue-50 rounded-xl text-sm" placeholder="Contoh: HUT RI ke-80" />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tanggal</label>
                                      <input type="date" required value={eventFormData.date} onChange={e => setEventFormData({...eventFormData, date: e.target.value})} className="w-full px-4 py-2 border-2 border-blue-50 rounded-xl text-sm" />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Gambar Event</label>
                                      <input type="file" accept="image/*" required onChange={e => {
                                        const file = e.target.files[0];
                                        if(file) {
                                          setEventFormData({...eventFormData, image: file});
                                          setEventImagePreview(URL.createObjectURL(file));
                                        }
                                      }} className="text-xs w-full" />
                                      {eventImagePreview && <img src={eventImagePreview} className="mt-2 w-full h-32 object-cover rounded-xl" />}
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                      <button type="button" onClick={() => setShowAnnouncementModal_Event(false)} className="flex-1 py-2.5 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-500">Batal</button>
                                      <button type="submit" disabled={isSavingEvent} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg">
                                        {isSavingEvent ? '⏳ Menyimpan...' : 'Simpan Event'}
                                      </button>
                                    </div>
                                  </form>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="space-y-4">
                        <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4">
                          <h3 className="text-lg font-bold text-blue-800 mb-2">💾 Aksi</h3>
                          <p className="text-sm text-slate-500 mb-3">Setiap kategori disimpan terpisah agar perubahan lebih mudah dikontrol.</p>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Yakin ingin mengembalikan pengaturan ke default?')) {
                                const defaultSettings = {
                                  schoolName: 'SMK Negeri 1',
                                  schoolAddress: 'Jl. Pendidikan No. 123',
                                  schoolPhone: '021-1234567',
                                  schoolEmail: 'info@smkn1.sch.id',
                                  academicYear: '2025/2026',
                                  attendanceStartTime: '07:00',
                                  attendanceEndTime: '08:00',
                                  lateThreshold: '08:00',
                                  enableNotifications: true,
                                  enableEmailReports: true,
                                  enableQRCode: true,
                                  themeColor: 'blue',
                                  attendanceSessionOpen: true,
                                  schoolEndTime: '15:30',
                                  autoMarkAbsentEnabled: true,
                                  limitOneScanPerDay: true,
                                  disableAttendanceOnHolidays: true,
                                  dashboardPhoto1: null,
                                  dashboardPhoto2: null,
                                  dashboardPhoto3: null,
                                  dashboardVideo: null,
                                };
                                setSettingsData(defaultSettings);
                                localStorage.setItem('school_settings', JSON.stringify(defaultSettings));
                                alert('✅ Pengaturan berhasil direset!');
                              }
                            }}
                            className="w-full px-6 py-3 border border-blue-200 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-50 transition-all"
                          >
                            🔄 Reset ke Default
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ✨ TAMBAHAN: Modal Detail Profil Siswa */}
              {showProfileModal && selectedProfileUser && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border-2 border-blue-200 animate-fade-in-up overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex justify-between items-center">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        <span>👤</span> Detail Profil Siswa
                      </h3>
                      <button onClick={() => setShowProfileModal(false)} className="text-white/80 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    
                    <div className="p-8 max-h-[80vh] overflow-y-auto">
                      <div className="flex flex-col items-center mb-8">
                        {/* ✨ Logic Pemetaan Mapel Siswa */}
                        {(() => {
                          const studentSubjects = schedules.filter(s => 
                            s.class_id?.toString() === selectedProfileUser.class_id?.toString() ||
                            s.class_name === selectedProfileUser.class_name
                          );
                          return (
                            <>
                        <div className="w-32 h-32 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden border-4 border-blue-200 shadow-md mb-4">
                          {selectedProfileUser.photo ? (
                            <img src={selectedProfileUser.photo} alt={selectedProfileUser.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-5xl text-blue-400 font-bold">{selectedProfileUser.name?.charAt(0) || 'S'}</span>
                          )}
                        </div>
                        <h3 className="text-2xl font-bold text-blue-900">{selectedProfileUser.name}</h3>
                        <p className="text-blue-600 font-medium">{getClassName(selectedProfileUser.class_id, selectedProfileUser.class_name)}</p>

                        {/* ✨ Info Wali Kelas & Mata Pelajaran Terkoneksi */}
                        <div className="mt-4 flex flex-col items-center gap-2">
                          <div className="flex items-center gap-2 bg-blue-50 px-4 py-1.5 rounded-full border border-blue-100 shadow-sm">
                            <span className="text-[11px] font-bold text-blue-700">👨‍🏫 Wali Kelas:</span>
                            <span className="text-[11px] font-black text-blue-900">
                              {classes.find(c => c.id?.toString() === selectedProfileUser.class_id?.toString())?.teacher_name || 'Tidak Diketahui'}
                            </span>
                          </div>
                          
                          <div className="mt-3 text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Mata Pelajaran Diikuti</p>
                            <div className="flex flex-wrap justify-center gap-1.5 max-w-sm">
                              {studentSubjects.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">Jadwal belum tersedia untuk kelas ini</p>
                              ) : (
                                Array.from(new Set(studentSubjects.map(s => s.subject_name))).map((sub, idx) => (
                                  <span key={idx} className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-200 shadow-sm">
                                    {sub}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                            </>
                          );
                        })()}
                      </div>

                      <div>
                        {[
                          { label: 'Email', value: selectedProfileUser.email || '-' },
                          { label: 'NIS/NIP', value: selectedProfileUser.user_id || '-' },
                          { label: 'Role', value: selectedProfileUser.role || 'Siswa', capitalize: true },
                          { label: 'Jenis Kelamin', value: selectedProfileUser.gender || '-' },
                          { label: 'No. Telepon', value: selectedProfileUser.phone || '-' },
                          { label: 'Kelas', value: getClassName(selectedProfileUser.class_id, selectedProfileUser.class_name) },
                        ].map((item, idx) => (
                          <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                            <p className={`text-slate-800 font-semibold ${item.capitalize ? 'capitalize' : ''}`}>{item.value}</p>
                          </div>
                        ))}
                      </div>

                      {selectedProfileUser.role === 'siswa' && (
                        <div className="bg-blue-50 rounded-2xl p-6 border-2 border-blue-100 mb-6">
                          <h4 className="font-bold text-blue-900 mb-4 flex items-center gap-2">
                            <span>👨‍👩‍👦</span> Informasi Orang Tua
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-bold text-blue-400 uppercase mb-1">Nama Orang Tua</p>
                              <p className="text-blue-800 font-semibold">{selectedProfileUser.parent_name || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-blue-400 uppercase mb-1">No. Telepon Orang Tua</p>
                              <p className="text-blue-800 font-semibold">{selectedProfileUser.parent_phone || '-'}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setShowProfileModal(false);
                            openEditModal(selectedProfileUser);
                          }}
                          className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg"
                        >
                          Edit Data
                        </button>
                        <button
                          onClick={() => setShowProfileModal(false)}
                          className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                        >
                          Tutup
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ✨ TAMBAHAN: TAB: Alumni */}
              {activeTab === 'alumni' && (
                <div className="animate-fade-in">
                  <div className="mb-6">
                    <h2 className="text-lg font-bold text-blue-800">🧑‍🎓 Data Alumni</h2>
                    <p className="text-slate-500 text-sm">Daftar siswa yang sudah lulus atau tidak lagi terdaftar di kelas aktif.</p>
                  </div>
                  {dataLoading ? (
                    <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-md p-12 text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                      <p className="text-blue-600 font-medium">Memuat data alumni...</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-md overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-blue-50 border-b-2 border-blue-200">
                            <tr>
                              {['No', 'Nama Siswa', 'NIS / ID', 'Kelas Terakhir', 'Status', 'Aksi'].map((h) => (
                                <th key={h} className="px-6 py-4 text-left text-xs font-semibold text-blue-700 uppercase tracking-wide">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-blue-50">
                            {(() => {
                              const alumniData = filterData(siswaData, searchQuery).filter(s => !['1', '2', '3'].includes(getClassGroup(s)));
                              return alumniData.length === 0 ? (
                                <tr>
                                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                                    <p className="text-4xl mb-3">📭</p>
                                    <p className="font-medium">Belum ada data alumni di sistem.</p>
                                  </td>
                                </tr>
                              ) : (
                                alumniData.map((siswa, index) => (
                                  <tr key={siswa.id} className="hover:bg-blue-50 transition-colors">
                                    <td className="px-6 py-4 text-sm text-slate-600">{index + 1}</td>
                                    <td className="px-6 py-4">
                                      <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shadow-sm overflow-hidden border-2 border-blue-200">
                                          {siswa.photo ? <img src={siswa.photo} alt={siswa.name} className="w-full h-full object-cover" /> : siswa.name?.charAt(0)}
                                        </div>
                                        <span className="font-medium text-blue-800 text-sm">{siswa.name}</span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600 font-mono">{siswa.user_id || siswa.nis || siswa.nisn || '-'}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600">{getClassName(siswa.class_id, siswa.class_name)}</td>
                                    <td className="px-6 py-4">
                                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase">ALUMNI / LULUS</span>
                                    </td>
                                    <td className="px-6 py-4">
                                      <button onClick={() => openEditModal(siswa)} className="text-blue-600 hover:text-blue-800 font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-all border border-blue-200">Edit</button>
                                      <button onClick={() => handleDeleteUser(siswa.id)} className="text-red-600 hover:text-red-800 font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all border border-red-200">Hapus</button>
                                    </td>
                                  </tr>
                                ))
                              );
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Success Notification */}
      {showSuccessNotification && (
        <div className="fixed bottom-10 right-10 z-[100] animate-bounce">
          <div className="bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border-2 border-emerald-400">
            <span className="text-xl">✅</span>
            <span className="font-bold">Pengaturan Berhasil Disimpan!</span>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.35s ease-out; }
        .animate-fade-in-up { animation: fadeInUp 0.4s ease-out; }
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
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
};

export default DashboardAdmin;