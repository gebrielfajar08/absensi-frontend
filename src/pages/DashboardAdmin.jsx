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
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  return new Intl.DateTimeFormat('id-ID', options).format(date);
};

// ✨ TAMBAHAN: Helper untuk mendapatkan nama hari
const getDayName = (dateInput) => {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(date);
};

// ✨ TAMBAHAN: Helper untuk format tanggal saja (DD/MM/YYYY)
const formatDateSimple = (dateInput) => {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  }).format(date);
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

const normalizeBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return ['1', 'true', 'yes'].includes(value.toLowerCase());
  return false;
};

const normalizeTimeValue = (value) => {
  if (value === undefined || value === null || value === '') return '';
  return String(value).substring(0, 5);
};

const normalizeSettingsResponse = (data = {}) => {
  const getValue = (camelCaseKey, snakeCaseKey) =>
    data[camelCaseKey] ?? data[snakeCaseKey] ?? undefined;

  return {
    schoolName: getValue('schoolName', 'school_name') ?? '',
    schoolAddress: getValue('schoolAddress', 'school_address') ?? '',
    schoolPhone: getValue('schoolPhone', 'school_phone') ?? '',
    schoolEmail: getValue('schoolEmail', 'school_email') ?? '',
    academicYear: getValue('academicYear', 'academic_year') ?? '',

    attendanceStartTime: normalizeTimeValue(getValue('attendanceStartTime', 'attendance_start_time')) || '07:00',
    attendanceEndTime: normalizeTimeValue(getValue('attendanceEndTime', 'attendance_end_time')) || '08:00',
    lateThreshold: normalizeTimeValue(getValue('lateThreshold', 'late_threshold')) || '08:00',
    schoolEndTime: normalizeTimeValue(getValue('schoolEndTime', 'school_end_time')) || '15:30',

    enableQRCode: normalizeBoolean(getValue('enableQRCode', 'enable_qr_code')),
    attendanceSessionOpen: normalizeBoolean(getValue('attendanceSessionOpen', 'attendance_session_open')),
    enableNotifications: normalizeBoolean(getValue('enableNotifications', 'enable_notifications')),
    enableEmailReports: normalizeBoolean(getValue('enableEmailReports', 'enable_email_reports')),
    autoMarkAbsentEnabled: normalizeBoolean(getValue('autoMarkAbsentEnabled', 'auto_mark_absent_enabled')),
    activeDays: getValue('activeDays', 'active_days') || 'Senin,Selasa,Rabu,Kamis,Jumat',

    schoolLogo: getValue('schoolLogo', 'logo_url') ?? null,
    dashboardPhoto1: getValue('dashboardPhoto1', 'photo1_url') ?? null,
    dashboardPhoto2: getValue('dashboardPhoto2', 'photo2_url') ?? null,
    dashboardPhoto3: getValue('dashboardPhoto3', 'photo3_url') ?? null,
    dashboardVideo: getValue('dashboardVideo', 'video_url') ?? null,
    startSound: getValue('startSound', 'start_sound_url') ?? null,
    endSound: getValue('endSound', 'end_sound_url') ?? null,
  };
};

const persistSchoolSettings = (settings) => {
  localStorage.setItem('school_settings', JSON.stringify({
    ...settings,
    start_sound_url: settings.startSound ?? null,
    end_sound_url: settings.endSound ?? null,
    schoolLogo: settings.schoolLogo ?? null,
    dashboardPhoto1: settings.dashboardPhoto1 ?? null,
    dashboardPhoto2: settings.dashboardPhoto2 ?? null,
    dashboardPhoto3: settings.dashboardPhoto3 ?? null,
    dashboardVideo: settings.dashboardVideo ?? null,
  }));
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
  // ✨ TAMBAHAN: State untuk navigasi tab di Data Siswa
  const [activeSiswaSection, setActiveSiswaSection] = useState('1');
  // ✨ TAMBAHAN: State untuk navigasi tab di fitur lainnya
  const [activePromotionSection, setActivePromotionSection] = useState('1');
  const [activeWaSection, setActiveWaSection] = useState('1');
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  // ✨ TAMBAHAN: State untuk filter rekap absensi
  const [rekapRoleFilter, setRekapRoleFilter] = useState('all');

  // ✨ TAMBAHAN: State untuk media cycling (foto berkedip ganti sendiri)
  const [activePhotoIndex, setActivePhotoIndex] = useState(1);
  useEffect(() => {
    const timer = setInterval(() => setActivePhotoIndex((prev) => (prev % 3) + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  // State untuk data
  const [stats, setStats] = useState({
    totalUsers: 0, totalGuru: 0, totalSiswa: 0, totalKelas: 0, kehadiranHariIni: 0
  });
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [attendanceReports, setAttendanceReports] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [permissionDecisionLoading, setPermissionDecisionLoading] = useState(null);
  const [error, setError] = useState('');

  const addNotification = (message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

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

  const [startSoundFile, setStartSoundFile] = useState(null);
  const [startSoundPreview, setStartSoundPreview] = useState(null);
  const [endSoundFile, setEndSoundFile] = useState(null);
  const [endSoundPreview, setEndSoundPreview] = useState(null);

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
    startSound: null,
    endSound: null,
    activeDays: 'Senin,Selasa,Rabu,Kamis,Jumat,Sabtu', // Default hari aktif
  });

  const [settingsSection, setSettingsSection] = useState('school');

  const applySettingsToState = (settings) => {
    setSettingsData(prev => {
      const next = { ...prev };
      Object.entries(settings).forEach(([key, value]) => {
        if (value !== undefined) {
          next[key] = value;
        }
      });
      return next;
    });

    const resolvePreviewValue = (value) => {
      if (value === undefined || value === null || value === '') return null;
      return resolvePhotoUrl(value);
    };

    if (Object.prototype.hasOwnProperty.call(settings, 'schoolLogo')) {
      setLogoPreview(resolvePreviewValue(settings.schoolLogo));
    }

    setMediaPhotoPreviews(prev => ({
      ...prev,
      ...(Object.prototype.hasOwnProperty.call(settings, 'dashboardPhoto1') ? { 1: resolvePreviewValue(settings.dashboardPhoto1) } : {}),
      ...(Object.prototype.hasOwnProperty.call(settings, 'dashboardPhoto2') ? { 2: resolvePreviewValue(settings.dashboardPhoto2) } : {}),
      ...(Object.prototype.hasOwnProperty.call(settings, 'dashboardPhoto3') ? { 3: resolvePreviewValue(settings.dashboardPhoto3) } : {}),
    }));

    if (Object.prototype.hasOwnProperty.call(settings, 'dashboardVideo')) {
      setMediaVideoPreview(resolvePreviewValue(settings.dashboardVideo));
    }

    if (Object.prototype.hasOwnProperty.call(settings, 'startSound')) {
      setStartSoundPreview(resolvePreviewValue(settings.startSound));
    }

    if (Object.prototype.hasOwnProperty.call(settings, 'endSound')) {
      setEndSoundPreview(resolvePreviewValue(settings.endSound));
    }
  };

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
    setFeatureDataLoading(true);
    const token = localStorage.getItem('token');
    const res = await api.get('/admin/users?role=guru', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const rawData = res.data?.data || res.data || [];
    setGuruData(Array.isArray(rawData) ? rawData.map(normalizeUser) : []);
  } catch (err) {
    console.error('Gagal mengambil data guru:', err);
    setGuruData([]);
  } finally {
    setFeatureDataLoading(false);
  }
};

// Fetch Data Siswa
const fetchDataSiswa = async () => {
  try {
    setFeatureDataLoading(true);
    const token = localStorage.getItem('token');
    const res = await api.get('/admin/users?role=siswa', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const rawData = res.data?.data || res.data || [];
    setSiswaData(Array.isArray(rawData) ? rawData.map(normalizeUser) : []);
  } catch (err) {
    console.error('Gagal mengambil data siswa:', err);
    setSiswaData([]);
  } finally {
    setFeatureDataLoading(false);
  }
};

const fetchClasses = async () => {
  try {
    setFeatureDataLoading(true);
    const token = localStorage.getItem('token');
    const config = { headers: { Authorization: `Bearer ${token}` } };
    const res = await apiTryEndpoints('get', ['/admin/classes', '/classes', '/class'], config);
    setClasses(res.data?.data || res.data || []);
  } catch (err) {
    console.error('Gagal mengambil data kelas:', err);
    setClasses([]);
  } finally {
    setFeatureDataLoading(false);
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
      const config = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
      // Mencoba rute alternatif jika rute utama 404
      const res = await apiTryEndpoints('get', ['/admin/schedules', '/schedules', '/admin/schedule'], config);

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
      const rawData = await fetchAttendanceRecords(config);
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
  setSettingsLoading(true);
  const token = localStorage.getItem('token');
  const config = {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 60000 // Naikkan ke 60 detik karena server mungkin lambat saat proses data
  };

  try {
    const res = await fetchWithRetry(() => apiTryEndpoints('get', ['/admin/settings', '/settings'], config), 2, 2000);

    if (res?.data) {
      const backendSettings = normalizeSettingsResponse(res.data);
      console.log('✅ Settings loaded from database:', backendSettings);
      applySettingsToState(backendSettings);
      persistSchoolSettings(backendSettings);
    }

  } catch (err) {
    const status = err.response?.status || (err.code === 'ECONNABORTED' ? 'TIMEOUT' : 'NETWORK_ERROR');
    const message = err.response?.data?.message || err.message;
    console.error(`❌ Gagal mengambil pengaturan: [${status}] ${message}`);
    loadSettings();
  } finally {
    setSettingsLoading(false);
  }
};

  // ➕ Fungsi memuat dari memori lokal (Persistence)
  const loadSettings = () => {
    const saved = localStorage.getItem('school_settings');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        applySettingsToState(data);
      } catch (e) {
        console.error("Gagal parse cache settings", e);
      }
    }
  };

  // Jalankan loadSettings segera saat mount
  useEffect(() => {
    loadSettings();
  }, []);

  // 🔊 LOGIKA AUTO-PLAY BEL SEKOLAH
  const [lastRungMinute, setLastRungMinute] = useState('');

  useEffect(() => {
    const now = new Date();
    const currentMinute = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':');

    // Hindari bunyi berulang di menit yang sama
    if (currentMinute === lastRungMinute) return;

    // Cek Bel Masuk
    if (settingsData.attendanceStartTime && currentMinute === settingsData.attendanceStartTime.substring(0, 5)) {
      if (startSoundPreview) {
        const audio = new Audio(startSoundPreview);
        audio.play().catch(e => console.warn("Autoplay diblokir browser, butuh interaksi user.", e));
        setLastRungMinute(currentMinute);
        addNotification("🔊 Bel Masuk Sekolah Berbunyi!", "info");
      }
    }

    // Cek Bel Pulang
    if (settingsData.schoolEndTime && currentMinute === settingsData.schoolEndTime.substring(0, 5)) {
      if (endSoundPreview) {
        const audio = new Audio(endSoundPreview);
        audio.play().catch(e => console.warn("Autoplay diblokir browser, butuh interaksi user.", e));
        setLastRungMinute(currentMinute);
        addNotification("🔊 Bel Pulang Sekolah Berbunyi!", "info");
      }
    }
  }, [currentTime, settingsData.attendanceStartTime, settingsData.schoolEndTime, startSoundPreview, endSoundPreview, lastRungMinute]);

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
    } catch { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/'); }
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
        fetchWithRetry(() => apiTryEndpoints('get', ['/admin/stats', '/stats'], config)),
        fetchWithRetry(() => apiTryEndpoints('get', userEndpointCandidates.index, config)),
        fetchWithRetry(() => apiTryEndpoints('get', ['/admin/classes', '/classes', '/class'], config)),
        fetchWithRetry(() => fetchAttendanceRecords(config))
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
        const rawActivity = attendanceRes.value;
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
      addNotification('Gagal menghapus event', 'error');
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
      return addNotification('Nama, email, NIS/NIP, dan password wajib diisi.', 'error');
    }
    if (formData.role === 'siswa' && (!formData.class_id || !formData.parent_phone)) {
      return addNotification('Untuk siswa, pilih kelas dan isi nomor telepon orang tua.', 'error');
    }
    const emailExists = users.some((u) => (u.email || '').toLowerCase() === formData.email.toLowerCase());
    if (emailExists) {
      return addNotification('Email sudah terdaftar. Silakan gunakan email lain.', 'error');
    }
    const nisValue = formData.user_id?.toString().trim();
    if (nisValue) {
      const nisExists = users.some((u) => {
        const existingNis = (u.nis || u.user_id || u.nisn || '').toString().trim();
        return existingNis && existingNis === nisValue;
      });
      if (nisExists) {
        return addNotification('NIS/NIP sudah terdaftar. Silakan gunakan NIS/NIP lain.', 'error');
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
          addNotification('Pengguna baru tidak ditemukan saat reload. Cek backend.', 'warning');
          return;
        }
      }
      addNotification('User berhasil ditambahkan', 'success');
    } catch (err) {
      console.error('Create user failed:', err.response?.data || err.message);
      const apiMessage = err.response?.data?.message || err.message || 'Cek log';
      let details = '';
      if (err.response?.data?.errors) {
        details = Object.entries(err.response.data.errors)
          .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
          .join('\n');
      }
      addNotification(`Gagal menambah user: ${apiMessage}`, 'error');
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
      addNotification('Silakan pilih minimal satu siswa untuk dinaikkan kelasnya.', 'warning');
      return;
    }
    
    setConfirmModal({
      show: true,
      title: 'Naik Kelas',
      message: `Yakin ingin menaikkan ${studentIds.length} siswa ke tingkat berikutnya?`,
      onConfirm: async () => {
        setIsPromoting(true);
        try {
          const token = localStorage.getItem('token');
          const config = { headers: { Authorization: `Bearer ${token}` } };
          await api.post('/admin/students/promote', { student_ids: studentIds }, config);
          addNotification('Berhasil menaikkan kelas siswa!', 'success');
          setSelectedPromoteStudents([]);
          await fetchDataSiswa();
          await fetchAllData();
        } catch (err) {
          addNotification('Gagal menaikkan kelas', 'error');
        } finally {
          setIsPromoting(false);
          setConfirmModal({ show: false });
        }
      }
    });
  };

  // ✨ TAMBAHAN: Fungsi untuk memproses absensi Alpa secara instan (Manual Trigger)
  const handleProcessAutoAlpha = async () => {
    const todayName = new Date().toLocaleDateString('id-ID', { weekday: 'long' });
    const activeDaysList = (settingsData.activeDays || '').split(',');
    
    if (!activeDaysList.includes(todayName)) {
      return addNotification(`Hari ini (${todayName}) bukan hari aktif absensi. Silakan cek pengaturan hari aktif.`, 'warning');
    }

    if (!confirm('⚠️ Proses Alpa Sekarang? Semua siswa yang belum melakukan absen hari ini akan otomatis dicatat sebagai ALPA di database.')) return;
    
    setIsPromoting(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      // Mengirim request ke backend untuk memproses status alpa secara masal tanpa keterangan
      await api.post('/admin/attendance/process-alpha', {}, config);
      
      addNotification('Berhasil! Seluruh siswa yang tidak hadir telah dicatat sebagai Alpa.', 'success');
      await fetchAllData(); // Refresh statistik dan aktivitas terbaru untuk melihat hasilnya
    } catch (err) {
      addNotification(err.response?.data?.message || 'Gagal memproses alpa. Pastikan server backend mendukung fitur ini.', 'error');
    } finally {
      setIsPromoting(false);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.user_id) {
      return addNotification('Nama, email, dan NIS/NIP wajib diisi.', 'error');
    }
    if (formData.role === 'siswa' && (!formData.class_id || !formData.parent_phone)) {
      return addNotification('Untuk siswa, pilih kelas dan isi nomor telepon orang tua.', 'error');
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
        addNotification('Update disimpan namun tidak ditemukan lagi saat reload.', 'warning');
        return;
      }
      addNotification('User berhasil diupdate', 'success');
    } catch (err) {
      console.error('Update user failed:', err.response?.data || err.message);
      const apiMessage = err.response?.data?.message || err.message || 'Cek log';
      let details = '';
      if (err.response?.data?.errors) {
        details = Object.entries(err.response.data.errors)
          .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
          .join('\n');
      }
      addNotification(`Gagal mengupdate user: ${apiMessage}`, 'error');
    }
  };

  const handleDeleteUser = async (userId) => {
    setConfirmModal({
      show: true,
      title: 'Hapus User',
      message: 'Apakah Anda yakin ingin menghapus user ini?',
      onConfirm: async () => {
        try {
          const token = localStorage.getItem('token');
          await apiTryEndpoints('delete', userEndpointCandidates.delete(userId), { headers: { Authorization: `Bearer ${token}` } });
          addNotification('User berhasil dihapus', 'success');
          fetchAllData();
          if (activeTab === 'dataGuru') fetchDataGuru();
          if (activeTab === 'dataSiswa') fetchDataSiswa();
        } catch (err) {
          addNotification('Gagal menghapus user', 'error');
        } finally {
          setConfirmModal({ show: false });
        }
      }
    });
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
        addNotification('QR Code berhasil diunduh!', 'success');
      })
      .catch(err => {
        console.error('Gagal download QR:', err);
        addNotification('Gagal mengunduh QR Code', 'error');
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
    addNotification('Sesi habis, silakan login ulang.', 'error');
    return;
  }

  try {
    setIsPromoting(true);
    const data = new FormData();

    const config = {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 180000 // Naikkan ke 3 menit khusus untuk simpan karena ada proses auto-alpha
    };

    const appendField = (key, value) => {
      if (value === undefined || value === null || value === '') return;
      data.append(key, value);
    };

    const appendFileWithAliases = (primaryKey, file, aliasKeys = []) => {
      if (!(file instanceof File)) return;
      data.append(primaryKey, file);
      aliasKeys.forEach((aliasKey) => {
        if (aliasKey) {
          data.append(aliasKey, file);
        }
      });
    };

    const formatTime = (time) => {
      if (!time) return null;
      return time.toString().substring(0, 5);
    };

    if (section === 'school') {
      appendField('schoolName', settingsData.schoolName);
      appendField('schoolAddress', settingsData.schoolAddress);
      appendField('schoolPhone', settingsData.schoolPhone);
      appendField('schoolEmail', settingsData.schoolEmail);
      appendField('academicYear', settingsData.academicYear);
    }

    if (section === 'attendance') {
      appendField('attendanceStartTime', formatTime(settingsData.attendanceStartTime));
      appendField('attendanceEndTime', formatTime(settingsData.attendanceEndTime));
      appendField('lateThreshold', formatTime(settingsData.lateThreshold));
      appendField('schoolEndTime', formatTime(settingsData.schoolEndTime));
      appendField('activeDays', settingsData.activeDays);
      data.append('attendance_session_open', settingsData.attendanceSessionOpen || settingsData.attendance_session_open ? '1' : '0');
      data.append('auto_mark_absent_enabled', settingsData.autoMarkAbsentEnabled || settingsData.auto_mark_absent_enabled ? '1' : '0');
      data.append('enable_qr_code', settingsData.enableQRCode || settingsData.enable_qr_code ? '1' : '0');
      data.append('disable_attendance_on_holidays', settingsData.disableAttendanceOnHolidays ? '1' : '0');
    }

    if (section === 'notification') {
      data.append('enable_notifications', settingsData.enableNotifications ? '1' : '0');
      data.append('enable_email_reports', settingsData.enableEmailReports ? '1' : '0');
    }

    if (section === 'media') {
      appendFileWithAliases('logo', logoFile, ['school_logo', 'schoolLogo']);
      appendFileWithAliases('photo1', mediaPhotoFiles[1], ['dashboard_photo_1', 'dashboardPhoto1']);
      appendFileWithAliases('photo2', mediaPhotoFiles[2], ['dashboard_photo_2', 'dashboardPhoto2']);
      appendFileWithAliases('photo3', mediaPhotoFiles[3], ['dashboard_photo_3', 'dashboardPhoto3']);
      appendFileWithAliases('video_profile', mediaVideoFile, ['dashboard_video', 'dashboardVideo', 'video']);
    }

    if (section === 'sound') {
      appendField('attendanceStartTime', formatTime(settingsData.attendanceStartTime));
      appendField('schoolEndTime', formatTime(settingsData.schoolEndTime));
      appendFileWithAliases('start_sound', startSoundFile, ['start_sound_url', 'startSound']);
      appendFileWithAliases('end_sound', endSoundFile, ['end_sound_url', 'endSound']);
    }

    console.log('KIRIM DATA:');
    for (let pair of data.entries()) {
      console.log(pair[0], pair[1]);
    }

    let response;
    try {
      response = await apiTryEndpoints('post', ['/admin/settings', '/settings'], data, config);
    } catch (postErr) {
      const status = postErr?.response?.status;
      if (status === 404 || status === 405) {
        response = await apiTryEndpoints('put', ['/admin/settings', '/settings'], data, config);
      } else {
        throw postErr;
      }
    }

    if (response?.status === 200 || response?.status === 201) {
      const hasNewLogo = logoFile instanceof File;
      const hasNewPhoto1 = mediaPhotoFiles[1] instanceof File;
      const hasNewPhoto2 = mediaPhotoFiles[2] instanceof File;
      const hasNewPhoto3 = mediaPhotoFiles[3] instanceof File;
      const hasNewVideo = mediaVideoFile instanceof File;
      const hasNewStartSound = startSoundFile instanceof File;
      const hasNewEndSound = endSoundFile instanceof File;

      const savedSettings = normalizeSettingsResponse({
        ...settingsData,
        attendanceStartTime: formatTime(settingsData.attendanceStartTime),
        attendanceEndTime: formatTime(settingsData.attendanceEndTime),
        lateThreshold: formatTime(settingsData.lateThreshold),
        schoolEndTime: formatTime(settingsData.schoolEndTime),
        attendanceSessionOpen: settingsData.attendanceSessionOpen,
        autoMarkAbsentEnabled: settingsData.autoMarkAbsentEnabled,
        enableQRCode: settingsData.enableQRCode,
        enableNotifications: settingsData.enableNotifications,
        enableEmailReports: settingsData.enableEmailReports,
        schoolLogo: hasNewLogo ? logoPreview : (settingsData.schoolLogo ?? logoPreview ?? null),
        dashboardPhoto1: hasNewPhoto1 ? mediaPhotoPreviews[1] : (settingsData.dashboardPhoto1 ?? mediaPhotoPreviews[1] ?? null),
        dashboardPhoto2: hasNewPhoto2 ? mediaPhotoPreviews[2] : (settingsData.dashboardPhoto2 ?? mediaPhotoPreviews[2] ?? null),
        dashboardPhoto3: hasNewPhoto3 ? mediaPhotoPreviews[3] : (settingsData.dashboardPhoto3 ?? mediaPhotoPreviews[3] ?? null),
        dashboardVideo: hasNewVideo ? mediaVideoPreview : (settingsData.dashboardVideo ?? mediaVideoPreview ?? null),
        startSound: hasNewStartSound ? startSoundPreview : (settingsData.startSound ?? startSoundPreview ?? null),
        endSound: hasNewEndSound ? endSoundPreview : (settingsData.endSound ?? endSoundPreview ?? null),
      });

      applySettingsToState(savedSettings);
      persistSchoolSettings(savedSettings);

      try {
        await fetchSettings();
      } catch (syncErr) {
        console.warn('⚠️ Pengaturan tersimpan, tetapi gagal menyinkronkan ulang dari server.', syncErr);
      }

      setSettingsSaved(true);
      setShowSuccessNotification(true);
      setLogoFile(null);
      setMediaPhotoFiles({ 1: null, 2: null, 3: null });
      setMediaVideoFile(null);
      setStartSoundFile(null);
      setEndSoundFile(null);

      setTimeout(() => {
        setShowSuccessNotification(false);
        setSettingsSaved(false);
      }, 3000);
    }

  } catch (err) {
    console.log('🔥 INI ERROR ASLI DARI BACKEND:');
    console.log(err.response?.data);
    console.error('Error saving settings:', err);

    const apiErr = err.response?.data;
    let detailMsg = apiErr?.message || 'Gagal menyimpan pengaturan';

    if (apiErr?.errors) {
      detailMsg += '\n' + Object.entries(apiErr.errors)
        .map(([key, val]) => `• ${key}: ${val}`)
        .join('\n');
    }

    addNotification(`Kesalahan Validasi: ${detailMsg}`, 'error');
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

  const getExportFileName = (role, isPdf) => {
    const safeRole = role === 'all' ? 'semua' : role;
    const extension = isPdf ? 'pdf' : 'xlsx';
    return `rekap_${safeRole}_${new Date().toISOString().split('T')[0]}.${extension}`;
  };

  const buildExportCandidates = (role, isPdf) => {
    const format = isPdf ? 'pdf' : 'xlsx';
    const type = role === 'all'
      ? (isPdf ? 'attendance_pdf' : 'attendance')
      : `${role}_${isPdf ? 'pdf' : 'excel'}`;

    return [
      `/admin/export/${type}`,
      `/admin/export?type=${encodeURIComponent(type)}`,
      `/admin/export?role=${encodeURIComponent(role)}&format=${encodeURIComponent(format)}`
    ];
  };

  const triggerDownload = (blob, fileName, contentType) => {
    const url = window.URL.createObjectURL(new Blob([blob], { type: contentType }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      window.URL.revokeObjectURL(url);
    }, 100);
  };

  // ✨ TAMBAHAN: Handle Export Data
  const handleExportData = async (format) => {
    try {
      const role = rekapRoleFilter;
      const isPdf = format === 'pdf';
      addNotification(`Sedang menyiapkan file ${isPdf ? 'PDF' : 'Excel'} untuk ${role === 'all' ? 'Semua' : role}...`, 'info');

      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const fileName = getExportFileName(role, isPdf);
      const contentType = isPdf
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      let lastError;

      for (const endpoint of buildExportCandidates(role, isPdf)) {
        try {
          const response = await fetchWithRetry(() => api.get(endpoint, {
            headers,
            responseType: 'blob',
            timeout: 180000
          }));

          const blob = response.data instanceof Blob
            ? response.data
            : new Blob([response.data], { type: response.headers?.['content-type'] || contentType });

          if ((blob.type || '').includes('application/json') || (blob.type || '').includes('text/html')) {
            const text = await blob.text();
            throw new Error(text || 'Server mengembalikan respons non-file.');
          }

          triggerDownload(blob, fileName, blob.type || contentType);
          addNotification('Data berhasil diekspor!', 'success');
          return;
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError || new Error('Tidak ada endpoint export yang berhasil dipanggil.');
    } catch (err) {
      console.error('Export error:', err);
      const message = err?.response?.data?.message || err?.message || 'Periksa koneksi server atau backend belum mendukung fitur export.';
      addNotification(`Gagal mengekspor data: ${message}`, 'error');
    }
  };

  const handlePermissionDecision = async (request, decision) => {
    const requestId = request?.id || request?.attendance_id || request?.record_id || request?.request_id;

    if (!requestId) {
      addNotification('❌ ID pengajuan tidak ditemukan.', 'error');
      return;
    }

    setPermissionDecisionLoading(`${requestId}-${decision}`);

    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const payload = {
        status: request.status || (decision === 'approve' ? 'izin' : 'absen'),
        approval_status: decision === 'approve' ? 'approved' : 'rejected',
        is_approved: decision === 'approve',
        approved: decision === 'approve',
        is_pending: false,
        pending: false,
        reviewed_by: user?.name || user?.full_name || 'Admin',
        approved_by: decision === 'approve' ? (user?.name || user?.full_name || 'Admin') : null,
        approved_at: decision === 'approve' ? new Date().toISOString() : null,
        notes: decision === 'approve'
          ? `Pengajuan ${request.status || 'izin'} disetujui oleh admin.`
          : `Pengajuan ${request.status || 'izin'} ditolak oleh admin.`
      };

      const attempts = [
        { method: 'put', url: `/admin/attendances/${requestId}`, data: payload },
        { method: 'patch', url: `/admin/attendances/${requestId}`, data: payload },
        { method: 'put', url: `/admin/activity/${requestId}`, data: payload },
        { method: 'patch', url: `/admin/activity/${requestId}`, data: payload },
        { method: 'post', url: `/admin/attendances/${requestId}/approval`, data: payload },
        { method: 'post', url: `/admin/attendances/${requestId}/reject`, data: { ...payload, approval_status: 'rejected' } }
      ];

      let lastError;
      for (const attempt of attempts) {
        try {
          await api[attempt.method](attempt.url, attempt.data, { headers });
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
        }
      }

      if (lastError) {
        throw lastError;
      }

      addNotification(`✅ Pengajuan ${request.status || 'izin'} ${decision === 'approve' ? 'disetujui' : 'ditolak'}.`, 'success');
      localStorage.setItem('attendance_updated', Date.now().toString());
      await fetchAllData();
    } catch (err) {
      console.error('❌ Gagal memperbarui persetujuan:', err);
      addNotification(`❌ ${err.response?.data?.message || 'Gagal memperbarui persetujuan'}`, 'error');
    } finally {
      setPermissionDecisionLoading(null);
    }
  };

  // ✨ TAMBAHAN: Handle Send WhatsApp Message
  const handleSendWhatsApp = (parentPhone, studentName) => {
    if (!parentPhone) {
      addNotification('Nomor telepon orang tua tidak tersedia', 'error');
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
    { id: 'rekap', label: 'Rekap Absensi', icon: '📋' },
    { id: 'izin', label: 'Izin & Sakit', icon: '📝' },
    { id: 'classes', label: 'Data Kelas', icon: '🏫' },
    { id: 'alumni', label: 'Alumni', icon: '🧑‍🎓' },
    { id: 'settings', label: 'Pengaturan', icon: '⚙️' },
  ];

  const pendingPermissionRequests = attendanceReports.filter((item) => {
    const status = String(item.status || '').toLowerCase();
    const approval = String(item.approval_status || item.review_status || '').toLowerCase();
    const isPermission = ['izin', 'sakit'].includes(status);
    const approved = ['approved', 'disetujui', 'diterima', 'accepted'].includes(approval) || item.is_approved === true || item.approved === true;
    const pending = ['pending', 'requested', 'waiting', 'menunggu'].includes(approval) || item.is_pending === true || item.pending === true;
    return isPermission && !approved && (pending || approval === '');
  });

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

  const fetchAttendanceRecords = async (config = {}) => {
    const endpoints = [
      { url: '/admin/attendances', params: { page: 1, per_page: 1000 } },
      { url: '/admin/activity', params: { page: 1, per_page: 1000 } },
      { url: '/attendance/izin', params: { page: 1, per_page: 1000 } }
    ];

    const extractArray = (response) => {
      if (!response) return [];
      const payload = response.data;
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.data)) return payload.data;
      if (Array.isArray(payload?.results)) return payload.results;
      if (Array.isArray(payload?.items)) return payload.items;
      if (Array.isArray(payload?.records)) return payload.records;
      if (Array.isArray(payload?.permissions)) return payload.permissions;
      if (Array.isArray(payload?.requests)) return payload.requests;

      const nestedArrays = Object.values(payload || {}).filter(Array.isArray);
      if (nestedArrays.length > 0) return nestedArrays[0];

      return [];
    };

    const getRecordKey = (record) => {
      if (!record) return '';
      return [
        record.id,
        record.attendance_id,
        record.request_id,
        record.permission_id,
        record.user_id,
        record.nis,
        record.nip,
        record.status,
        record.date || record.created_at || record.attendance_time,
        record.notes || record.reason || record.keterangan
      ].filter(Boolean).join('|');
    };

    const mergedRecords = new Map();

    for (const endpoint of endpoints) {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        try {
          const response = await api.get(endpoint.url, {
            ...config,
            params: {
              ...(config.params || {}),
              page,
              per_page: 1000,
              ...endpoint.params
            }
          });

          const records = extractArray(response);
          records.forEach((record) => {
            const key = getRecordKey(record);
            if (key) {
              mergedRecords.set(key, record);
            }
          });

          const payload = response.data;
          const currentPage = Number(payload?.current_page ?? page);
          const lastPage = Number(payload?.last_page ?? payload?.meta?.last_page ?? currentPage);

          const isPaginatedResponse = [
            Array.isArray(payload),
            Array.isArray(payload?.data),
            Array.isArray(payload?.results),
            Array.isArray(payload?.items),
            Array.isArray(payload?.records),
            Array.isArray(payload?.permissions),
            Array.isArray(payload?.requests)
          ].some(Boolean);

          if (!isPaginatedResponse) {
            hasMore = false;
          } else if (currentPage >= lastPage || !payload?.next_page_url) {
            hasMore = false;
          } else {
            page += 1;
          }
        } catch (error) {
          if (endpoint.url === '/admin/activity') {
            throw error;
          }
          break;
        }
      }
    }

    return Array.from(mergedRecords.values());
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
    setConfirmModal({
      show: true,
      title: 'Hapus Mapel',
      message: 'Yakin ingin menghapus mata pelajaran ini?',
      onConfirm: async () => {
        try {
          const token = localStorage.getItem('token');
          await api.delete(`/admin/subjects/${id}`, { headers: { Authorization: `Bearer ${token}` } });
          addNotification('Mata pelajaran berhasil dihapus', 'success');
          fetchSubjects();
        } catch (err) {
          addNotification('Gagal menghapus mata pelajaran', 'error');
        } finally {
          setConfirmModal({ show: false });
        }
      }
    });
  };

  const handleDeleteSchedule = async (id) => {
    setConfirmModal({
      show: true,
      title: 'Hapus Jadwal',
      message: 'Yakin ingin menghapus jadwal ini?',
      onConfirm: async () => {
        try {
          const token = localStorage.getItem('token');
          await api.delete(`/admin/schedules/${id}`, { headers: { Authorization: `Bearer ${token}` } });
          addNotification('Jadwal berhasil dihapus', 'success');
          fetchSchedules();
        } catch (err) {
          addNotification('Gagal menghapus jadwal', 'error');
        } finally {
          setConfirmModal({ show: false });
        }
      }
    });
  };

  const handleDeleteAnnouncement = async (id) => {
    setConfirmModal({
      show: true,
      title: 'Hapus Pengumuman',
      message: 'Yakin ingin menghapus pengumuman ini?',
      onConfirm: async () => {
        try {
          const token = localStorage.getItem('token');
          await api.delete(`/admin/announcements/${id}`, { headers: { Authorization: `Bearer ${token}` } });
          addNotification('Pengumuman berhasil dihapus', 'success');
          fetchAnnouncements();
        } catch (err) {
          addNotification('Gagal menghapus pengumuman', 'error');
        } finally {
          setConfirmModal({ show: false });
        }
      }
    });
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
    
    // Coba konversi ke objek Date terlebih dahulu untuk normalisasi zona waktu
    let date = new Date(rawDate);
    
    // Jika gagal (Invalid Date), coba tangani format string manual
    if (isNaN(date.getTime())) {
    const str = String(rawDate).trim();
      if (!str) return '';

      // Jika formatnya murni tanggal YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

      // Jika formatnya timestamp
      if (/^\d{10}$/.test(str)) return getJakartaDateKey(new Date(Number(str) * 1000));
      if (/^\d{13}$/.test(str)) return getJakartaDateKey(new Date(Number(str)));

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
    }

    return getJakartaDateKey(date);
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

  // ✨ TAMBAHAN: Logika Grouping untuk Rekap (Datang & Pulang)
  const getGroupedRekapData = () => {
    const groups = {};
    attendanceReports.forEach(record => {
      const dateKey = normalizeDateKey(record.date || record.attendance_time);
      if (!dateKey) return;
      const userId = record.user_id || record.user?.user_id || record.id;
      const groupKey = `${userId}-${dateKey}`;
      
      if (!groups[groupKey]) {
        groups[groupKey] = {
          user_name: record.user_name || record.name,
          role: record.role || 'siswa',
          rawDate: record.date || record.attendance_time,
          arrival: record.attendance_time || record.scan_time || record.created_at,
          departure: null,
          mode: record.type || record.method || 'QR Code',
          status: record.status
        };
      } else {
        const currentTime = new Date(record.attendance_time || record.scan_time || record.created_at);
        const existingArrival = new Date(groups[groupKey].arrival);
        if (currentTime < existingArrival) {
          groups[groupKey].departure = groups[groupKey].arrival;
          groups[groupKey].arrival = record.attendance_time || record.scan_time || record.created_at;
        } else if (currentTime > existingArrival) {
          groups[groupKey].departure = record.attendance_time || record.scan_time || record.created_at;
        }
      }
    });
    return Object.values(groups).sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));
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

  // ✨ TAMBAHAN: Fungsi untuk mendapatkan tren mingguan (Senin - Minggu)
  const getWeeklyTrendData = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Penyesuaian ke hari Senin
    const monday = new Date(today);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);

    const dayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
    return dayNames.map((name, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dKey = getJakartaDateKey(d);
      const dayRecs = attendanceReports.filter(item => normalizeDateKey(item.date || item.created_at || item.attendance_time) === dKey);
      return {
        day: name,
        total: dayRecs.length,
        hadir: dayRecs.filter(item => ['hadir', 'tepat_waktu', 'present', 'on_time'].includes((item.status || '').toLowerCase())).length,
        terlambat: dayRecs.filter(item => item.is_late === true || ['terlambat', 'late', 'tardy'].includes((item.status || '').toLowerCase())).length,
        izin: dayRecs.filter(item => ['izin', 'permisi'].includes((item.status || '').toLowerCase())).length,
        sakit: dayRecs.filter(item => ['sakit', 'sick'].includes((item.status || '').toLowerCase())).length,
        absen: dayRecs.filter(item => ['absen', 'absent', 'tidak hadir', 'missing', 'alpha'].includes((item.status || '').toLowerCase())).length
      };
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
  const isSynchronizingData = dataLoading || featureDataLoading || settingsLoading;

  if (loading || !user) {
    return (
      <div className="theme-loader-screen min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="theme-loader-spinner animate-spin rounded-full h-14 w-14 border-4 mx-auto mb-5 shadow-lg"></div>
          <p className="theme-loader-text font-medium">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-white transition-all duration-500 ${isExiting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
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

          {/* ✨ TOAST NOTIFICATION CONTAINER (RIGHT TOP) */}
          <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-72 pointer-events-none">
            {notifications.map((n) => (
              <div key={n.id} className={`pointer-events-auto flex items-center p-4 rounded-xl shadow-2xl border-l-4 transform transition-all duration-300 animate-slide-in-right ${
                n.type === 'success' ? 'bg-white border-emerald-500 text-emerald-800' :
                n.type === 'error' ? 'bg-white border-red-500 text-red-800' :
                n.type === 'warning' ? 'bg-white border-amber-500 text-amber-800' :
                'bg-white border-blue-500 text-blue-800'
              }`}>
                <div className="flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider mb-0.5">
                    {n.type === 'success' ? 'Berhasil' : n.type === 'error' ? 'Error' : n.type === 'warning' ? 'Peringatan' : 'Info'}
                  </p>
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
              {isSynchronizingData && (
                <div className="theme-loader-overlay fixed top-[70px] inset-x-0 bottom-0 z-30 flex items-center justify-center backdrop-blur-sm">
                  <div className="text-center">
                    <div className="theme-loader-spinner animate-spin rounded-full h-12 w-12 border-4 mx-auto mb-4"></div>
                    <p className="theme-loader-text text-base font-bold">Memuat</p>
                  </div>
                </div>
              )}

              {/* ✨ MODAL KONFIRMASI CUSTOM */}
              {confirmModal.show && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
                  <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-fade-in-up">
                    <h3 className="text-lg font-bold text-blue-800 mb-2">{confirmModal.title}</h3>
                    <p className="text-slate-600 text-sm mb-6">{confirmModal.message}</p>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => setConfirmModal({ ...confirmModal, show: false })} className="flex-1 px-4 py-2 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-500">Batal</button>
                      <button type="button" onClick={confirmModal.onConfirm} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold shadow-lg">Ya, Lanjutkan</button>
                    </div>
                  </div>
                </div>
              )}

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

              {activeTab === 'overview' && (
                <div className="space-y-4 animate-fade-in">
                  {/* Banner Selamat Datang */}
                  <div className="bg-blue-600 border-2 border-blue-400 rounded-2xl p-3 sm:p-5 mx-4 lg:mx-8 shadow-lg flex flex-row items-center gap-3 sm:gap-4 relative overflow-hidden transition-all hover:border-blue-300">
                    <div className="absolute right-0 top-0 w-32 h-full bg-white/10 -skew-x-12 translate-x-16 pointer-events-none"></div>
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-xl flex items-center justify-center text-blue-600 text-xl sm:text-2xl shadow-md flex-shrink-0 relative z-10">👋</div>
                    <div className="text-left relative z-10">
                      <h2 className="text-sm sm:text-lg lg:text-xl font-bold text-white leading-tight">Selamat datang, {user?.name || 'Administrator'}!</h2>
                      <p className="text-blue-100 text-[10px] sm:text-xs lg:text-sm mt-0.5">Sistem siap digunakan. Anda memiliki kontrol penuh untuk memantau aktivitas sekolah hari ini.</p>
                    </div>
                  </div>

                  {/* ✨ 3 Kotak Statistik dengan Grafik Bergerak (Soft) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mx-4 lg:mx-8 mb-6">
                    {[
                      { label: 'Total Siswa', value: stats.totalSiswa, icon: '🧑‍🎓', fill: '#cbd5e1' }, // slate-300
                      { label: 'Total Guru', value: stats.totalGuru, icon: '👨‍🏫', fill: '#cbd5e1' }, // slate-300
                      { label: 'Total Admin', value: Math.max(0, stats.totalUsers - stats.totalGuru - stats.totalSiswa), icon: '👮', fill: '#cbd5e1' }, // slate-300
                    ].map((item, idx) => (
                      <div key={idx} className={`relative bg-slate-50 rounded-3xl border-2 border-slate-200 p-6 shadow-sm overflow-hidden group hover:border-slate-300 transition-all duration-500`}>
                        <div className="relative z-10 flex items-center justify-between">
                          <div>
                            <p className={`text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1`}>{item.label}</p>
                            <p className="text-3xl font-black text-slate-800">{item.value}</p>
                          </div>
                          <div className={`w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-3xl border border-slate-200 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-inner`}>
                            {item.icon}
                          </div>
                        </div>
                        
                        {/* Soft Animated Wave Graph - Opacity increased for visibility */}
                        <div className="absolute bottom-0 left-0 w-full h-16 opacity-60 pointer-events-none">
                          <svg viewBox="0 0 100 25" preserveAspectRatio="none" className="w-full h-full">
                            <path d="M0 25 L0 15 Q 25 5, 50 15 T 100 15 L 100 25 Z" fill={item.fill}>
                              <animate 
                                attributeName="d" 
                                dur={`${4 + idx}s`} 
                                repeatCount="indefinite"
                                values="M0 25 L0 15 Q 25 5, 50 15 T 100 15 L 100 25 Z;
                                        M0 25 L0 15 Q 25 25, 50 15 T 100 15 L 100 25 Z;
                                        M0 25 L0 15 Q 25 5, 50 15 T 100 15 L 100 25 Z"
                              />
                            </path>
                          </svg>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 📅 Grid Kalender & Event (Kecil & Sama Tinggi) */}
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 mx-4 lg:mx-8 mt-2">
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

                  {/* Statistik Utama */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6 mx-4 lg:mx-8">
                    {[
                      { label: 'Total', value: total, color: 'indigo', icon: '📅' },
                      { label: 'Hadir', value: hadir, color: 'emerald', icon: '✓' },
                      { label: 'Terlambat', value: terlambat, color: 'amber', icon: '⚠' },
                      { label: 'Izin', value: izin, color: 'sky', icon: '📋' },
                      { label: 'Sakit', value: sakit, color: 'violet', icon: '🏥' },
                      { label: 'Absen', value: absen, color: 'rose', icon: '✗' },
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
                          <span className="text-xs md:text-2xl group-hover:scale-110 transition-transform">{stat.icon}</span>
                          <span className={`hidden md:block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter bg-white/20 text-white border border-white/30`}>
                            Hari Ini
                          </span>
                        </div>
                        <p className="text-xs md:text-3xl font-black text-white">{stat.value}</p>
                        <p className="text-white/90 text-[8px] md:text-sm mt-0.5 md:mt-1 truncate font-bold leading-tight">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Progress Kehadiran & Weekly Trend */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6 mx-4 lg:mx-8">
                    <div className="bg-white rounded-2xl border-2 border-blue-200 p-4 shadow-lg min-h-[220px] flex flex-col justify-center">
                      <h3 className="font-semibold text-blue-800 mb-3 text-sm">Progress Kehadiran Hari Ini</h3>
                      <div className="flex flex-row items-center gap-4 sm:gap-6">
                        <div className="relative w-20 h-20 sm:w-24 sm:h-24 group flex-shrink-0">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="15.9155" fill="none" className="text-slate-100" stroke="currentColor" strokeWidth="3.5" />
                            <circle cx="18" cy="18" r="15.9155" fill="none" className={`${hadirPercent >= 80 ? 'text-emerald-500' : hadirPercent >= 60 ? 'text-amber-500' : 'text-rose-500'} transition-all duration-1000`} stroke="currentColor" strokeWidth="3.5" strokeDasharray={`${hadirPercent}, 100`} strokeLinecap="round" />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-sm sm:text-lg font-black ${hadirPercent >= 80 ? 'text-emerald-600' : hadirPercent >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>{hadirPercent}%</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase">Hadir</span>
                          </div>
                        </div>
                        <div className="flex-1 w-full">
                          <p className="text-sm text-blue-600 mb-2">Kehadiran mencapai <span className="font-bold text-blue-600">{hadirPercent}%</span> hari ini</p>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between"><span className="flex items-center gap-2"><span className="w-2 h-2 bg-emerald-500 rounded-full"></span> Hadir</span><span className="font-medium">{hadir}</span></div>
                            <div className="flex justify-between"><span className="flex items-center gap-2"><span className="w-2 h-2 bg-amber-500 rounded-full"></span> Terlambat</span><span className="font-medium">{terlambat}</span></div>
                            <div className="flex justify-between"><span className="flex items-center gap-2"><span className="w-2 h-2 bg-sky-500 rounded-full"></span> Izin / Sakit</span><span className="font-medium">{izin + sakit}</span></div>
                            <div className="flex justify-between"><span className="flex items-center gap-2"><span className="w-2 h-2 bg-rose-500 rounded-full"></span> Absen</span><span className="font-medium">{absen}</span></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border-2 border-blue-100 p-4 shadow-lg min-h-[220px] flex flex-col">
                      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-3">
                        <div>
                          <h3 className="text-sm font-black text-blue-900 tracking-tight">📈 Tren Kehadiran Mingguan</h3>
                          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Aktivitas Senin - Minggu</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { label: 'Total', color: '#4f46e5' },
                            { label: 'Hadir', color: '#10b981' },
                            { label: 'Telat', color: '#f59e0b' },
                            { label: 'Izin', color: '#0ea5e9' },
                            { label: 'Sakit', color: '#7c3aed' },
                            { label: 'Absen', color: '#e11d48' },
                          ].map((item, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">{item.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex-1 min-h-0 w-full relative">
                        {(() => {
                          const weeklyData = getWeeklyTrendData();
                          const maxVal = Math.max(...weeklyData.map(d => Math.max(d.total, d.hadir, d.terlambat, d.izin, d.sakit, d.absen, 5)));
                          const width = 1000;
                          const height = 180;

                          const generateSmoothPath = (key) => {
                            const points = weeklyData.map((d, i) => ({
                              x: (i / (weeklyData.length - 1)) * width,
                              y: height - (maxVal > 0 ? (d[key] / maxVal) * height : 0)
                            }));
                            let path = `M ${points[0].x},${points[0].y}`;
                            for (let i = 0; i < points.length - 1; i++) {
                              const p0 = points[i];
                              const p1 = points[i + 1];
                              const cp1x = p0.x + (p1.x - p0.x) / 2;
                              path += ` C ${cp1x},${p0.y} ${cp1x},${p1.y} ${p1.x},${p1.y}`;
                            }
                            return path;
                          };

                          return (
                            <div className="w-full h-full">
                              <svg viewBox={`0 -20 ${width} ${height + 40}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
                                {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
                                  <line key={i} x1="0" y1={height * p} x2={width} y2={height * p} stroke="#f1f5f9" strokeWidth="2" strokeDasharray="5,5" />
                                ))}

                                <path d={generateSmoothPath('total')} fill="none" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" className="opacity-40" />
                                <path d={generateSmoothPath('hadir')} fill="none" stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" />
                                <path d={generateSmoothPath('terlambat')} fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
                                <path d={generateSmoothPath('izin')} fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" />
                                <path d={generateSmoothPath('sakit')} fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" />
                                <path d={generateSmoothPath('absen')} fill="none" stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round" />

                                {weeklyData.map((d, i) => {
                                  const x = (i / (weeklyData.length - 1)) * width;
                                  const yHadir = height - (maxVal > 0 ? (d.hadir / maxVal) * height : 0);
                                  return (
                                    <g key={i}>
                                      <circle cx={x} y={yHadir} r="4.5" fill="white" stroke="#10b981" strokeWidth="2.5" />
                                      {d.hadir > 0 && (
                                        <text x={x} y={yHadir - 12} textAnchor="middle" className="text-[12px] font-black fill-emerald-600">{d.hadir}</text>
                                      )}
                                    </g>
                                  );
                                })}
                              </svg>

                              <div className="flex justify-between mt-2">
                                {weeklyData.map((d, i) => (
                                  <div key={i} className="text-center">
                                    <p className="text-[10px] font-black text-blue-900 uppercase tracking-tighter">{d.day}</p>
                                    <div className="mt-1 flex flex-col gap-0.5">
                                      {d.total > 0 ? (
                                        <>
                                          <span className="text-[8px] font-bold text-emerald-500">{d.hadir}H</span>
                                          <span className="text-[8px] font-bold text-rose-500">{d.absen}A</span>
                                        </>
                                      ) : (
                                        <span className="text-[8px] font-bold text-slate-300">-</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-50 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center text-xs">💡</div>
                        <p className="text-[9px] font-bold text-slate-400 italic leading-relaxed">
                          Grafik ini menarik data riwayat absensi secara real-time.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Seksi Media & Kegiatan Sekolah - Dipindahkan ke bawah sendiri */}
                  <div className="bg-green-800 rounded-2xl border-2 border-green-700 p-5 shadow-md mx-4 lg:mx-8 mt-6">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-sm"><span>🖼️</span> Media & Kegiatan Sekolah</h3>
                    <div className="grid grid-cols-2 gap-3 sm:gap-6">
                      <div className="overflow-hidden relative w-full aspect-video rounded-xl border-2 border-blue-100 bg-slate-900/50 shadow-inner">
                        <div key={activePhotoIndex} className="animate-fade-in w-full h-full">
                          {settingsData[`dashboardPhoto${activePhotoIndex}`] ? (
                            <img src={resolvePhotoUrl(settingsData[`dashboardPhoto${activePhotoIndex}`])} alt={`Sekolah ${activePhotoIndex}`} className="w-full h-full object-cover" />
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                              <span className="text-lg sm:text-xl">📸</span>
                              <p className="text-[10px] mt-1 font-medium">Foto {activePhotoIndex}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="rounded-xl overflow-hidden border-2 border-blue-50 bg-black shadow-inner aspect-video">
                        {settingsData.dashboardVideo ? (
                          <video src={resolvePhotoUrl(settingsData.dashboardVideo)} controls className="w-full h-full object-contain" />
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

              {/* ✨ TAB: Rekap Absensi (Siswa & Guru) */}
              {activeTab === 'rekap' && (
                <div className="animate-fade-in space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-blue-900">📋 Rekap Absensi Real-Time</h2>
                      <p className="text-slate-500 text-sm">Data kedatangan dan kepulangan seluruh warga sekolah</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Filter Pilihan di Atas Tabel */}
                      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl shadow-inner border border-slate-200">
                        <button 
                          onClick={() => setRekapRoleFilter('all')}
                          className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all uppercase tracking-tighter ${rekapRoleFilter === 'all' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                          👥 Semua
                        </button>
                        <button 
                          onClick={() => setRekapRoleFilter('siswa')}
                          className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all uppercase tracking-tighter ${rekapRoleFilter === 'siswa' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                          🧑‍🎓 Siswa
                        </button>
                        <button 
                          onClick={() => setRekapRoleFilter('guru')}
                          className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all uppercase tracking-tighter ${rekapRoleFilter === 'guru' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                          👨‍🏫 Guru
                        </button>
                      </div>

                      {/* Tombol Export yang Mengikuti Filter Terpilih */}
                      <div className="flex gap-2">
                        <button onClick={() => handleExportData('pdf')} className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-rose-700 transition-all flex items-center gap-2" title="Download PDF sesuai filter">
                          <span>📄</span> PDF
                        </button>
                        <button onClick={() => handleExportData('excel')} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-emerald-700 transition-all flex items-center gap-2" title="Download Excel sesuai filter">
                          <span>📊</span> Excel
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl border-2 border-blue-100 shadow-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-blue-600 text-white">
                            <th className="px-4 py-4 text-left font-bold uppercase tracking-wider">Hari</th>
                            <th className="px-4 py-4 text-left font-bold uppercase tracking-wider">Tanggal</th>
                            <th className="px-4 py-4 text-left font-bold uppercase tracking-wider">Nama</th>
                            <th className="px-4 py-4 text-left font-bold uppercase tracking-wider">Role</th>
                            <th className="px-4 py-4 text-left font-bold uppercase tracking-wider">Datang</th>
                            <th className="px-4 py-4 text-left font-bold uppercase tracking-wider">Pulang</th>
                            <th className="px-4 py-4 text-left font-bold uppercase tracking-wider">Mode</th>
                            <th className="px-4 py-4 text-left font-bold uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(() => {
                            const filteredData = getGroupedRekapData().filter(item => 
                              rekapRoleFilter === 'all' || (item.role || '').toLowerCase() === rekapRoleFilter
                            );

                            return filteredData.length > 0 ? filteredData.map((item, idx) => (
                              <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                                <td className="px-4 py-4 font-bold text-slate-700">{getDayName(item.rawDate)}</td>
                                <td className="px-4 py-4 text-slate-600">{formatDateSimple(item.rawDate)}</td>
                                <td className="px-4 py-4">
                                  <div className="font-bold text-blue-900">{item.user_name}</div>
                                </td>
                                <td className="px-4 py-4">
                                  <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase border ${
                                    item.role === 'guru' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                  }`}>
                                    {item.role}
                                  </span>
                                </td>
                                <td className="px-4 py-4 font-mono font-bold text-emerald-600">
                                  {formatTimeOnly(item.arrival)}
                                </td>
                                <td className="px-4 py-4 font-mono font-bold text-rose-600">
                                  {item.departure ? formatTimeOnly(item.departure) : '--:--'}
                                </td>
                                <td className="px-4 py-4">
                                  <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                    {item.mode}
                                  </span>
                                </td>
                                <td className="px-4 py-4">
                                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                    item.status === 'hadir' ? 'bg-green-100 text-green-700' : 
                                    item.status === 'terlambat' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {item.status}
                                  </span>
                                </td>
                              </tr>
                            )) : (
                              <tr><td colSpan="8" className="px-4 py-12 text-center text-slate-400 italic">Tidak ada data {rekapRoleFilter !== 'all' ? rekapRoleFilter : ''} untuk ditampilkan.</td></tr>
                            );
                          })()}
                        </tbody>
                      </table>
                    </div>

                    {(() => {
                      const filteredData = getGroupedRekapData().filter(item => 
                        rekapRoleFilter === 'all' || (item.role || '').toLowerCase() === rekapRoleFilter
                      );

                      if (filteredData.length === 0) return null;

                      return (
                        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-slate-50 border-t border-blue-100 text-sm text-slate-600 font-medium">
                          Menampilkan <span className="font-bold text-blue-600">{filteredData.length}</span> data dari seluruh database tanpa pembatasan.
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {activeTab === 'izin' && (
                <div className="animate-fade-in space-y-6">
                  <div className="bg-white rounded-3xl border-2 border-amber-100 shadow-xl p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-bold text-amber-900">📝 Persetujuan Izin & Sakit</h2>
                        <p className="text-sm text-slate-500">Tinjau permintaan dari siswa atau guru dan putuskan apakah disetujui atau ditolak.</p>
                      </div>
                      <div className="px-4 py-2 rounded-full bg-amber-50 text-amber-700 text-xs font-black">
                        {pendingPermissionRequests.length} menunggu
                      </div>
                    </div>
                  </div>

                  {pendingPermissionRequests.length === 0 ? (
                    <div className="bg-white rounded-2xl border-2 border-slate-100 p-10 text-center text-slate-500">
                      Tidak ada permintaan izin atau sakit yang menunggu persetujuan.
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {pendingPermissionRequests.map((request) => {
                        const loadingKey = `${request.id || request.attendance_id || request.record_id || request.request_id}-approve`;
                        const rejectKey = `${request.id || request.attendance_id || request.record_id || request.request_id}-reject`;
                        return (
                          <div key={request.id || request.attendance_id || request.record_id || request.request_id} className="bg-white rounded-2xl border-2 border-amber-100 shadow-lg p-5">
                            <div className="flex flex-col lg:flex-row lg:justify-between gap-4">
                              <div className="space-y-3">
                                <div>
                                  <p className="text-xs font-black text-amber-700 uppercase tracking-wide">{request.status === 'sakit' ? 'Sakit' : 'Izin'}</p>
                                  <h3 className="text-lg font-bold text-slate-900">{request.user_name || request.name || request.full_name || 'Pengguna'}</h3>
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                                  <span className="px-2.5 py-1 rounded-full bg-slate-100">Role: {request.role || '-'}</span>
                                  <span className="px-2.5 py-1 rounded-full bg-slate-100">Tanggal: {formatDateSimple(request.date || request.created_at || request.attendance_time)}</span>
                                </div>
                                <p className="text-sm text-slate-600 leading-relaxed">{request.notes || request.reason || request.keterangan || 'Tidak ada alasan tambahan.'}</p>
                              </div>
                              <div className="flex flex-col gap-2 lg:min-w-[220px]">
                                <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-black text-center">Menunggu Persetujuan</span>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handlePermissionDecision(request, 'approve')}
                                    disabled={permissionDecisionLoading === loadingKey}
                                    className="flex-1 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-60"
                                  >
                                    {permissionDecisionLoading === loadingKey ? 'Memproses...' : 'Setujui'}
                                  </button>
                                  <button
                                    onClick={() => handlePermissionDecision(request, 'reject')}
                                    disabled={permissionDecisionLoading === rejectKey}
                                    className="flex-1 px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold disabled:opacity-60"
                                  >
                                    {permissionDecisionLoading === rejectKey ? 'Memproses...' : 'Tolak'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                      <h2 className="text-2xl font-black text-blue-900 tracking-tight">🎓 Manajemen Data Guru</h2>
                      <p className="text-slate-500 text-sm">Kelola profil tenaga pendidik, NIP, dan akses pengajaran</p>
                    </div>
                    <button onClick={() => openCreateModal({ role: 'guru' })} className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl text-sm font-black hover:shadow-lg transition-all flex items-center gap-2 border-2 border-blue-400">
                      <span>➕</span> Tambah Guru
                    </button>
                  </div>

                  <div className="bg-white rounded-3xl border-2 border-blue-100 shadow-sm p-4 mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-xl shadow-lg border-2 border-blue-400 text-white">
                        👨‍🏫
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase text-blue-900 tracking-tighter">Daftar Tenaga Pendidik</p>
                        <p className="text-[10px] font-medium text-slate-400">Total guru terdaftar: {guruData.length} Orang</p>
                      </div>
                      <div className="ml-auto relative max-w-xs w-full hidden sm:block">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                        <input
                          type="text"
                          placeholder="Cari nama atau NIP..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl border-2 border-blue-200 shadow-xl overflow-hidden">
                    <div className="px-6 py-4 bg-blue-50 border-b-2 border-blue-100 flex justify-between items-center">
                      <h3 className="font-black text-blue-900 uppercase tracking-wider text-xs">Informasi Guru Aktif</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50/50 border-b border-slate-100">
                          <tr>
                            {['Profil Guru', 'Email', 'NIP / ID', 'Aksi'].map((h) => (
                              <th key={h} className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {guruData.length === 0 ? (
                            <tr>
                              <td colSpan="4" className="px-6 py-16 text-center text-slate-400 italic">Belum ada data guru.</td>
                            </tr>
                          ) : (
                            filterData(guruData, searchQuery).map((guru) => (
                              <tr key={guru.id} className="group hover:bg-blue-50/30 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center overflow-hidden border border-blue-200 group-hover:scale-105 transition-transform">
                                      {guru.photo ? (
                                        <img src={guru.photo} alt={guru.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="font-black text-blue-600">{guru.name?.charAt(0)}</span>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-slate-800 truncate">{guru.name}</p>
                                      <p className="text-[10px] font-medium text-blue-500 uppercase tracking-tighter">Tenaga Pendidik</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-xs font-bold text-slate-600">{guru.email}</td>
                                <td className="px-6 py-4">
                                  <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                                    {guru.user_id || '-'}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleShowQR(guru, 'guru')}
                                      className="p-2 bg-white text-blue-600 rounded-xl border border-blue-100 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                      title="Lihat QR Code"
                                    >
                                      📱
                                    </button>
                                    <button 
                                      onClick={() => { setSelectedProfileUser(guru); setShowProfileModal(true); }}
                                      className="p-2 bg-white text-indigo-600 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                      title="Detail Profil"
                                    >
                                      👤
                                    </button>
                                    <button 
                                      onClick={() => openEditModal(guru)}
                                      className="p-2 bg-white text-emerald-600 rounded-xl border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                    >
                                      ✏️
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteUser(guru.id)}
                                      className="p-2 bg-white text-red-600 rounded-xl border border-red-100 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                    >
                                      🗑️
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
                </div>
              )}

              {/* TAB: Data Siswa */}
              {activeTab === 'dataSiswa' && (
                <div className="animate-fade-in">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                      <h2 className="text-2xl font-black text-blue-900 tracking-tight">🧑‍🎓 Manajemen Data Siswa</h2>
                      <p className="text-slate-500 text-sm">Kelola data profil, NIS, dan penempatan kelas siswa</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => openCreateModal({ role: 'siswa' })} className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-sm font-bold hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-md flex items-center gap-2 border-2 border-emerald-300">
                        <span>➕</span> Tambah Siswa
                      </button>
                    </div>
                  </div>

                  {/* Tab Selector (Gaya Pengaturan) */}
                  <div className="bg-white rounded-3xl border-2 border-blue-100 shadow-sm p-4 mb-8">
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                      {[
                        { id: '1', label: 'Kelas 1', icon: '🏫', desc: 'Siswa Tingkat 1' },
                        { id: '2', label: 'Kelas 2', icon: '🏫', desc: 'Siswa Tingkat 2' },
                        { id: '3', label: 'Kelas 3', icon: '🏫', desc: 'Siswa Tingkat 3' },
                        { id: 'alumni', label: 'Alumni', icon: '🎓', desc: 'Siswa Lulus' },
                      ].map((section) => (
                        <button
                          key={section.id}
                          type="button"
                          onClick={() => setActiveSiswaSection(section.id)}
                          className={`min-w-[160px] flex-shrink-0 group rounded-2xl border-2 p-3 transition-all text-left ${activeSiswaSection === section.id ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-600 hover:border-blue-200 hover:bg-white'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${activeSiswaSection === section.id ? 'bg-white/20' : 'bg-white shadow-sm border border-slate-100'}`}>
                              {section.icon}
                            </div>
                            <div>
                              <p className="text-xs font-black uppercase tracking-tight">{section.label}</p>
                              <p className={`text-[10px] font-medium ${activeSiswaSection === section.id ? 'text-blue-100' : 'text-slate-400'}`}>{section.desc}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Search Bar khusus area siswa */}
                  <div className="mb-6 relative max-w-md">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                    <input
                      type="text"
                      placeholder="Cari nama atau NIS siswa..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                    />
                  </div>

                  <div className="space-y-6">
                    {/* Render Konten sesuai Tab yang dipilih */}
                    <div className="bg-white rounded-3xl border-2 border-blue-200 shadow-xl overflow-hidden">
                      <div className="px-6 py-4 bg-blue-50 border-b-2 border-blue-100 flex justify-between items-center">
                        <h3 className="font-black text-blue-900 uppercase tracking-wider text-sm">
                          {activeSiswaSection === 'alumni' ? '🎓 Daftar Alumni' : `🏫 Daftar Siswa Kelas ${activeSiswaSection}`}
                        </h3>
                        <span className="px-3 py-1 bg-white text-blue-600 rounded-full text-[10px] font-black border border-blue-200">
                          TOTAL: {activeSiswaSection === 'alumni' 
                            ? filterData(siswaData, searchQuery).filter(s => !['1', '2', '3'].includes(getClassGroup(s))).length 
                            : filterData(siswaData, searchQuery).filter(s => getClassGroup(s) === activeSiswaSection).length} JIWA
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-50/50 border-b border-slate-100">
                            <tr>
                              {['Nama Lengkap', 'NIS / ID', 'Kontak', 'QR Code', 'Opsi'].map((h) => (
                                <th key={h} className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(() => {
                              const currentData = activeSiswaSection === 'alumni'
                                ? filterData(siswaData, searchQuery).filter(s => !['1', '2', '3'].includes(getClassGroup(s)))
                                : filterData(siswaData, searchQuery).filter(s => getClassGroup(s) === activeSiswaSection);

                              if (currentData.length === 0) return (
                                <tr>
                                  <td colSpan={4} className="px-6 py-16 text-center">
                                    <div className="flex flex-col items-center opacity-30">
                                      <span className="text-5xl mb-3">📂</span>
                                      <p className="text-sm font-bold text-slate-900">Data Tidak Ditemukan</p>
                                      <p className="text-xs">Coba sesuaikan kata kunci pencarian Anda.</p>
                                    </div>
                                  </td>
                                </tr>
                              );

                              return currentData.map((siswa) => (
                                <tr key={siswa.id} className="group hover:bg-blue-50/30 transition-colors">
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 group-hover:border-blue-300 group-hover:scale-105 transition-all">
                                        {siswa.photo ? (
                                          <img src={siswa.photo} alt={siswa.name} className="w-full h-full object-cover" />
                                        ) : (
                                          <span className="text-sm font-black text-slate-400">{siswa.name?.charAt(0) || 'S'}</span>
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-800 truncate">{siswa.name}</p>
                                        <p className="text-[10px] font-medium text-slate-400 truncate">{siswa.email || 'Email belum diatur'}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">
                                      {siswa.user_id || siswa.nis || '-'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-xs font-bold text-slate-600">
                                    {siswa.phone || '-'}
                                  </td>
                                  <td className="px-6 py-4">
                                    <button
                                      onClick={() => handleShowQR(siswa, 'siswa')}
                                      className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black hover:bg-blue-600 hover:text-white transition-all border border-blue-100 flex items-center gap-1 shadow-sm"
                                      title="Lihat QR Code Siswa"
                                    >
                                      <span>📱</span> QR
                                    </button>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 opacity-10 lg:opacity-100 group-hover:opacity-100 transition-opacity">
                                      <button 
                                        onClick={() => { setSelectedProfileUser(siswa); setShowProfileModal(true); }}
                                        className="p-2 bg-white text-blue-600 rounded-xl border border-blue-100 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                        title="Detail Profil"
                                      >
                                        👤
                                      </button>
                                      <button 
                                        onClick={() => openEditModal(siswa)}
                                        className="p-2 bg-white text-emerald-600 rounded-xl border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                        title="Edit Data"
                                      >
                                        ✏️
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteUser(siswa.id)}
                                        className="p-2 bg-white text-red-600 rounded-xl border border-red-100 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                        title="Hapus Siswa"
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ));
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
                <div className="animate-fade-in space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-black text-blue-900 tracking-tight">🚀 Manajemen Naik Kelas</h2>
                      <p className="text-slate-500 text-sm mt-1">Proses kenaikan tingkat siswa ke jenjang berikutnya</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handlePromoteStudents(siswaData.map(s => s.id))}
                        disabled={siswaData.length === 0 || isPromoting}
                        className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border-2 border-indigo-200 hover:bg-indigo-200 transition-all shadow-sm"
                      >
                        Naikkan Semua Siswa
                      </button>
                      <button
                        onClick={() => handlePromoteStudents(selectedPromoteStudents)}
                        disabled={selectedPromoteStudents.length === 0 || isPromoting}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 border-2 border-blue-400"
                      >
                        {isPromoting ? '⏳ Memproses...' : `🚀 Naikkan Terpilih (${selectedPromoteStudents.length})`}
                      </button>
                    </div>
                  </div>

                  {/* Tab Selector untuk Naik Kelas (Sama dengan desain Data Siswa) */}
                  <div className="bg-white rounded-3xl border-2 border-blue-100 shadow-sm p-4">
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                      {[
                        { id: '1', label: 'Kelas 1', icon: '🚀', desc: 'Promosi Tingkat 1' },
                        { id: '2', label: 'Kelas 2', icon: '🚀', desc: 'Promosi Tingkat 2' },
                        { id: '3', label: 'Kelas 3', icon: '🎓', desc: 'Kelulusan' },
                      ].map((section) => (
                        <button
                          key={section.id}
                          type="button"
                          onClick={() => setActivePromotionSection(section.id)}
                          className={`min-w-[160px] flex-shrink-0 group rounded-2xl border-2 p-3 transition-all text-left ${activePromotionSection === section.id ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-600 hover:border-blue-200 hover:bg-white'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${activePromotionSection === section.id ? 'bg-white/20' : 'bg-white shadow-sm border border-slate-100'}`}>
                              {section.icon}
                            </div>
                            <div>
                              <p className="text-xs font-black uppercase tracking-tight">{section.label}</p>
                              <p className={`text-[10px] font-medium ${activePromotionSection === section.id ? 'text-blue-100' : 'text-slate-400'}`}>{section.desc}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    {(() => {
                      const studentsInClass = siswaData.filter(s => getClassGroup(s) === activePromotionSection);
                      const currentClassData = classes.find(c => c.name?.includes(activePromotionSection) || c.id?.toString() === activePromotionSection);
                      const walikelas = currentClassData?.teacher_name || '-';
                      
                      return (
                        <div className="bg-white rounded-3xl border-2 border-blue-200 shadow-xl overflow-hidden">
                          <div className="px-6 py-4 bg-blue-50 border-b-2 border-blue-100 flex flex-col md:flex-row md:items-center justify-between gap-2">
                            <div>
                              <h3 className="font-black text-blue-900 uppercase tracking-wider text-sm">
                                {activePromotionSection === '3' ? '🎓 Daftar Siswa Kelulusan' : `🏫 Promosi Siswa Kelas ${activePromotionSection}`}
                              </h3>
                              <p className="text-[10px] font-bold text-blue-600 bg-white px-3 py-1 rounded-full border border-blue-200 inline-block mt-1">
                                👨‍🏫 Wali Kelas: {walikelas}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <button 
                                onClick={() => handleSelectAllInClass(studentsInClass)}
                                className="px-4 py-2 bg-white text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-tighter border border-blue-200 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                              >
                                {studentsInClass.length > 0 && studentsInClass.every(s => selectedPromoteStudents.includes(s.id)) ? 'Lepas Semua' : 'Pilih Semua Siswa'}
                              </button>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-slate-50/50 border-b border-slate-100">
                                <tr>
                                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] w-16">#</th>
                                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Siswa</th>
                                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">NIS / ID</th>
                                  <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Pilih</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {studentsInClass.length === 0 ? (
                                  <tr>
                                    <td colSpan="4" className="px-6 py-16 text-center">
                                      <div className="flex flex-col items-center opacity-30">
                                        <span className="text-5xl mb-3">📂</span>
                                        <p className="text-sm font-bold text-slate-900">Tidak ada siswa aktif</p>
                                        <p className="text-xs">Data kelas {activePromotionSection} kosong.</p>
                                      </div>
                                    </td>
                                  </tr>
                                ) : (
                                  studentsInClass.map((siswa, idx) => (
                                    <tr 
                                      key={siswa.id} 
                                      className={`group hover:bg-blue-50/30 transition-colors cursor-pointer ${selectedPromoteStudents.includes(siswa.id) ? 'bg-blue-50/60' : ''}`}
                                      onClick={() => togglePromoteSelection(siswa.id)}
                                    >
                                      <td className="px-6 py-4 text-xs font-bold text-slate-400">{idx + 1}</td>
                                      <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 group-hover:border-blue-300 transition-all">
                                            {siswa.photo ? <img src={siswa.photo} className="w-full h-full object-cover" /> : <span className="font-black text-slate-400">{siswa.name?.charAt(0)}</span>}
                                          </div>
                                          <span className="font-bold text-slate-800 text-sm">{siswa.name}</span>
                                        </div>
                                      </td>
                                      <td className="px-6 py-4">
                                        <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">
                                          {siswa.user_id}
                                        </span>
                                      </td>
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
                    })()}
                  </div>
                </div>
              )}

              {/* ✨ TAMBAHAN: TAB: Pesan WhatsApp */}
              {activeTab === 'pesanWA' && (
                <div className="animate-fade-in">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                      <h2 className="text-2xl font-black text-emerald-900 tracking-tight">💬 Komunikasi Orang Tua</h2>
                      <p className="text-slate-500 text-sm">Kirim notifikasi atau pesan personal ke nomor WhatsApp orang tua</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    <div className="lg:col-span-2 bg-white rounded-3xl border-2 border-emerald-100 p-6 shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-xl">📝</span>
                        <p className="text-xs font-black uppercase text-emerald-900 tracking-widest">Template Pesan Otomatis</p>
                      </div>
                      <textarea
                        value={waMessageTemplate}
                        onChange={(e) => setWaMessageTemplate(e.target.value)}
                        rows="3"
                        className="w-full p-4 bg-emerald-50/30 border-2 border-emerald-100 rounded-2xl text-sm focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all resize-none"
                        placeholder="Tulis template pesan di sini..."
                      />
                      <p className="mt-3 text-[10px] font-bold text-slate-400">💡 Tip: Nama siswa akan otomatis disematkan di akhir pesan untuk kemudahan personalisasi.</p>
                    </div>
                    <div className="bg-emerald-600 rounded-3xl p-6 text-white shadow-lg border-2 border-emerald-400 flex flex-col justify-center">
                      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl mb-4">📱</div>
                      <h4 className="text-lg font-black leading-tight mb-2">WhatsApp Gateway Aktif</h4>
                      <p className="text-emerald-100 text-xs font-medium">Pastikan browser Anda memberikan izin pop-up untuk membuka jendela percakapan WhatsApp.</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl border-2 border-emerald-100 shadow-sm p-4 mb-8">
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                      {['1', '2', '3'].map((kelas) => (
                        <button
                          key={kelas}
                          onClick={() => setActiveWaSection(kelas)}
                          className={`min-w-[150px] flex-shrink-0 group rounded-2xl border-2 p-3 transition-all text-left ${activeWaSection === kelas ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-600 hover:border-emerald-200'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${activeWaSection === kelas ? 'bg-white/20' : 'bg-white border border-slate-100 shadow-sm'}`}>🏫</div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-tight">Pilih Kelas</p>
                              <p className={`text-xs font-bold ${activeWaSection === kelas ? 'text-emerald-100' : 'text-slate-800'}`}>Tingkat {kelas}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-white rounded-3xl border-2 border-emerald-200 shadow-xl overflow-hidden">
                      <div className="px-6 py-4 bg-emerald-50 border-b-2 border-emerald-100 flex justify-between items-center">
                        <h3 className="font-black text-emerald-900 uppercase tracking-wider text-xs">Kontak Orang Tua Siswa Kelas {activeWaSection}</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-50/50 border-b border-slate-100">
                            <tr>
                              {['Siswa', 'Nama Orang Tua', 'Nomor WhatsApp', 'Aksi'].map((h) => (
                                <th key={h} className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(() => {
                              const currentData = filterSiswaForWA(siswaData.filter(s => getClassGroup(s) === activeWaSection), waSearchQuery);
                              if (currentData.length === 0) return (
                                <tr><td colSpan="4" className="px-6 py-12 text-center text-slate-400 italic">Tidak ada data siswa untuk dihubungi.</td></tr>
                              );
                              return currentData.map((siswa) => (
                                <tr key={siswa.id} className="group hover:bg-emerald-50/30 transition-colors">
                                  <td className="px-6 py-4">
                                    <p className="text-sm font-bold text-slate-800">{siswa.name}</p>
                                    <p className="text-[10px] font-medium text-slate-400 font-mono">NIS: {siswa.user_id}</p>
                                  </td>
                                  <td className="px-6 py-4 text-xs font-bold text-slate-600">{siswa.parent_name || '-'}</td>
                                  <td className="px-6 py-4">
                                    <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                                      {siswa.parent_phone || 'Tidak ada nomor'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <button 
                                      onClick={() => handleSendWhatsApp(siswa.parent_phone, siswa.name)}
                                      disabled={!siswa.parent_phone}
                                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-emerald-700 transition-all shadow-md disabled:bg-slate-200 disabled:shadow-none"
                                    >
                                      <span>💬</span> Kirim Pesan
                                    </button>
                                  </td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
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

                              <div className="space-y-2 pr-2">
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
                                    Array.from(new Set(classSubjects.map(s => s.subject_name))).map((sub, idx) => (
                                      <span key={idx} className="text-[9px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md border border-indigo-100 shadow-sm">
                                        {sub}
                                      </span>
                                    ))
                                  )}
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
                          { id: 'media', title: 'Media', icon: '🖼️', description: 'Foto/Video' },
                          { id: 'sound', title: 'Sound', icon: '🔊', description: 'Bel Sekolah' },
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
                            <h3 className="text-base font-bold text-blue-800">🏫 Identitas Sekolah</h3>
                            <div className="space-y-4">
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
                                Simpan Identitas
                              </button>
                            </div>
                          </form>
                        )}

                        {settingsSection === 'sound' && (
                          <form onSubmit={(e) => handleSaveSettings('sound', e)} className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4 space-y-6">
                            <div className="flex items-center justify-between">
                              <h3 className="text-base font-bold text-blue-800">🔊 Pengaturan Sound Bel Sekolah</h3>
                              <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black animate-pulse">LIVE MONITORING</span>
                            </div>
                            
                            <div className="space-y-6">
                              {/* Group Bel Masuk */}
                              <div className="p-4 bg-slate-50 rounded-2xl border-2 border-blue-50 space-y-4">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                  <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Jam Masuk Sekolah</label>
                                    <input
                                      type="time"
                                      name="attendanceStartTime"
                                      value={settingsData.attendanceStartTime}
                                      onChange={handleSettingsChange}
                                      className="w-full px-3 py-2 border-2 border-blue-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">File Audio/Video Bel Masuk</label>
                                    <input
                                      type="file"
                                      accept="audio/*,video/*"
                                      onChange={(e) => {
                                        const file = e.target.files[0];
                                        if (file) {
                                          setStartSoundFile(file);
                                          setStartSoundPreview(URL.createObjectURL(file));
                                        }
                                      }}
                                      className="w-full text-[10px]"
                                    />
                                  </div>
                                </div>
                                {startSoundPreview && <audio src={startSoundPreview} controls className="w-full h-8" />}
                              </div>

                              {/* Group Bel Pulang */}
                              <div className="p-4 bg-slate-50 rounded-2xl border-2 border-blue-50 space-y-4">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                  <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Jam Pulang Sekolah</label>
                                    <input
                                      type="time"
                                      name="schoolEndTime"
                                      value={settingsData.schoolEndTime}
                                      onChange={handleSettingsChange}
                                      className="w-full px-3 py-2 border-2 border-blue-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">File Audio/Video Bel Pulang</label>
                                    <input
                                      type="file"
                                      accept="audio/*,video/*"
                                      onChange={(e) => {
                                        const file = e.target.files[0];
                                        if (file) {
                                          setEndSoundFile(file);
                                          setEndSoundPreview(URL.createObjectURL(file));
                                        }
                                      }}
                                      className="w-full text-[10px]"
                                    />
                                  </div>
                                </div>
                                {endSoundPreview && <audio src={endSoundPreview} controls className="w-full h-8" />}
                              </div>
                            </div>
                            <div className="flex justify-end pt-2">
                              <button
                                type="submit"
                                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg"
                              >
                                Simpan Sound & Jam
                              </button>
                            </div>
                          </form>
                        )}

                        {settingsSection === 'media' && (
                          <form onSubmit={(e) => handleSaveSettings('media', e)} className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4 space-y-4">
                            <h3 className="text-base font-bold text-blue-800">🖼️ Media & Galeri Sekolah</h3>
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
                            </div>
                            <div className="flex justify-end">
                              <button
                                type="submit"
                                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all"
                              >
                                Simpan Media
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

                            {/* ✨ TAMBAHAN: Pengaturan Hari Aktif */}
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                              <label className="block text-xs font-bold text-slate-600 mb-3 uppercase tracking-wide">Hari Aktif Absensi</label>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map((day) => {
                              const isActive = (settingsData.activeDays || '').split(',').includes(day);
                                  return (
                                    <label key={day} className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-blue-300 transition-all">
                                      <input 
                                        type="checkbox" 
                                        checked={isActive}
                                        onChange={(e) => {
                                          const currentDays = settingsData.activeDays.split(',').filter(d => d !== "");
                                          const nextDays = e.target.checked 
                                            ? [...currentDays, day] 
                                            : currentDays.filter(d => d !== day);
                                          setSettingsData(prev => ({...prev, activeDays: nextDays.join(',')}));
                                        }}
                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                      />
                                      <span className="text-xs font-medium text-slate-700">{day}</span>
                                    </label>
                                  );
                                })}
                              </div>
                              <p className="text-[10px] text-slate-500 mt-2 italic">Hanya hari yang dicentang yang bisa digunakan untuk melakukan absensi.</p>
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
                              setConfirmModal({
                                show: true,
                                title: 'Reset Pengaturan',
                                message: 'Yakin ingin mengembalikan pengaturan ke default?',
                                onConfirm: () => {
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
                                  addNotification('Pengaturan berhasil direset!', 'success');
                                  setConfirmModal({ show: false });
                                }
                              });
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