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

const resolvePhotoUrl = (photo) => {
  if (!photo) return null;
  if (typeof photo !== 'string') return null;
  const trimmed = photo.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http') || trimmed.startsWith('data:')) return trimmed;
  const base = api.defaults.baseURL?.replace(/\/api\/?$/, '') || '';
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
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isExiting, setIsExiting] = useState(false);
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  // State untuk data
  const [stats, setStats] = useState({
    totalUsers: 0, totalGuru: 0, totalSiswa: 0, totalKelas: 0, kehadiranHariIni: 0
  });
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState('');
  
  // ✨ TAMBAHAN: State untuk fitur baru
  const [subjects, setSubjects] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [attendanceReports, setAttendanceReports] = useState([]);
  
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
    schoolName: 'SMK Negeri 1',
    schoolAddress: 'Jl. Pendidikan No. 123',
    schoolPhone: '021-1234567',
    schoolEmail: 'info@smkn1.sch.id',
    academicYear: '2025/2026',
    schoolLogo: null,
    attendanceStartTime: '07:00',
    attendanceOpenTime: '06:00',
    attendanceCloseTime: '10:00',
    attendanceEndTime: '08:00',
    lateThreshold: '07:30',
    enableNotifications: true,
    enableEmailReports: true,
    enableQRCode: true,
    themeColor: 'blue',
    attendanceSessionOpen: true,
    schoolEndTime: '15:30',
    autoMarkAbsentEnabled: true,
    limitOneScanPerDay: true,
    dashboardPhoto1: null,
    dashboardPhoto2: null,
    dashboardPhoto3: null,
    dashboardVideo: null,
  });

  // Fetch Data Guru
const fetchDataGuru = async () => {
  try {
    const token = localStorage.getItem('token');
    const config = { headers: { Authorization: `Bearer ${token}` } };

    const res = await api.get('/admin/users', config);

    const allUsers = Array.isArray(res.data)
      ? res.data
      : (res.data.data || []);

    const gurus = allUsers.filter(u => u.role === 'guru');

    setGuruData(gurus);
  } catch (err) {
    console.error('Gagal mengambil data guru:', err);
    setGuruData([]);
  }
};

// Fetch Data Siswa
const fetchDataSiswa = async () => {
  try {
    const token = localStorage.getItem('token');
    const config = { headers: { Authorization: `Bearer ${token}` } };

    const res = await api.get('/admin/users', config);

    const allUsers = Array.isArray(res.data)
      ? res.data
      : (res.data.data || []);

    const siswas = allUsers.filter(u => u.role === 'siswa');

    setSiswaData(siswas);
  } catch (err) {
    console.error('Gagal mengambil data siswa:', err);
    setSiswaData([]);
  }
};

const fetchClasses = async () => {
  try {
    const token = localStorage.getItem('token');
    const config = { headers: { Authorization: `Bearer ${token}` } };

    const res = await api.get('/admin/classes', config);

    const data = Array.isArray(res.data)
      ? res.data
      : (res.data.data || []);

    setClasses(data);
  } catch (err) {
    console.error('Gagal mengambil data kelas:', err);
    setClasses([]);
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
    const config = { headers: { Authorization: `Bearer ${token}` }, timeout: 120000 };
    try {
      const res = await api.get('/admin/settings', config);
      if (res?.data) {
        const backendSettings = {
          schoolName: res.data.nama_sekolah || res.data.schoolName || settingsData.schoolName,
          schoolAddress: res.data.alamat_sekolah || res.data.schoolAddress || settingsData.schoolAddress,
          schoolPhone: res.data.telepon || res.data.schoolPhone || settingsData.schoolPhone,
          schoolEmail: res.data.email || res.data.schoolEmail || settingsData.schoolEmail,
          academicYear: res.data.tahun_ajaran || res.data.academicYear || settingsData.academicYear,
          schoolLogo: res.data.logo || res.data.schoolLogo || settingsData.schoolLogo,
          attendanceOpenTime: res.data.jam_buka || res.data.attendanceOpenTime || settingsData.attendanceOpenTime,
          attendanceCloseTime: res.data.jam_tutup || res.data.attendanceCloseTime || settingsData.attendanceCloseTime,
          attendanceStartTime: res.data.jam_masuk || res.data.attendanceStartTime || settingsData.attendanceStartTime,
          attendanceEndTime: res.data.jam_akhir || res.data.attendanceEndTime || settingsData.attendanceEndTime,
          lateThreshold: res.data.batas_keterlambatan || res.data.lateThreshold || settingsData.lateThreshold,
          enableNotifications: res.data.enable_notifications ?? res.data.enableNotifications ?? settingsData.enableNotifications,
          enableEmailReports: res.data.enable_email_reports ?? res.data.enableEmailReports ?? settingsData.enableEmailReports,
          enableQRCode: res.data.enable_qr_code ?? res.data.enableQRCode ?? settingsData.enableQRCode,
          themeColor: res.data.themeColor || settingsData.themeColor,
          attendanceSessionOpen: res.data.attendance_session_open ?? res.data.attendanceSessionOpen ?? true,
          limitOneScanPerDay: res.data.limit_one_scan_per_day ?? settingsData.limitOneScanPerDay,
          schoolEndTime: res.data.jam_pulang || res.data.schoolEndTime || '15:30',
          autoMarkAbsentEnabled: res.data.auto_mark_absent_enabled ?? res.data.autoMarkAbsentEnabled ?? true,
          dashboardPhoto1: res.data.dashboard_photo_1 || res.data.dashboardPhoto1 || null,
          dashboardPhoto2: res.data.dashboard_photo_2 || res.data.dashboardPhoto2 || null,
          dashboardPhoto3: res.data.dashboard_photo_3 || res.data.dashboardPhoto3 || null,
          dashboardVideo: res.data.dashboard_video || res.data.dashboardVideo || settingsData.dashboardVideo,
        };
        setSettingsData(backendSettings);
        if (backendSettings.schoolLogo) setLogoPreview(resolvePhotoUrl(backendSettings.schoolLogo));
        setMediaPhotoPreviews({
          1: resolvePhotoUrl(backendSettings.dashboardPhoto1),
          2: resolvePhotoUrl(backendSettings.dashboardPhoto2),
          3: resolvePhotoUrl(backendSettings.dashboardPhoto3),
        });
        if (backendSettings.dashboardVideo) setMediaVideoPreview(resolvePhotoUrl(backendSettings.dashboardVideo));
        localStorage.setItem('school_settings', JSON.stringify(backendSettings));
        return;
      }
    } catch (err) {
      console.error('❌ Server Error (Settings):', err?.message);
    }
    const savedSettings = localStorage.getItem('school_settings');
    if (savedSettings) {
      try {
        setSettingsData(JSON.parse(savedSettings));
      } catch (err) {
        console.error('Failed to load settings from localStorage:', err);
      }
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
      fetchClasses();
    }
    if (activeTab === 'classes') {
      fetchClasses();
      fetchDataSiswa();
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

  const fetchAllData = async () => {
    setDataLoading(true);
    try {
      setError('');
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` }, timeout: 120000 };
      const [statsRes, usersRes, classesRes] = await Promise.allSettled([
        apiTryEndpoints('get', ['/admin/stats', '/stats'], config),
        apiTryEndpoints('get', userEndpointCandidates.index, config),
        apiTryEndpoints('get', ['/admin/classes', '/classes', '/class'], config)
      ]);
      let activityRes;
      try {
        activityRes = await api.get('/admin/attendances', config);
      } catch (err) {
        activityRes = await api.get('/admin/activity', config);
      }
      // ✨ Perbaikan: Ambil data dari properti .value karena menggunakan Promise.allSettled
      if (statsRes.status === 'fulfilled' && statsRes.value) {
        setStats(statsRes.value.data);
      }
      
      if (usersRes.status === 'fulfilled' && usersRes.value) {
        const uData = usersRes.value?.data;
        const rawUsers = Array.isArray(uData) ? uData : (uData?.data || []);
        setUsers(rawUsers.map(normalizeUser));
      }

      if (classesRes.status === 'fulfilled' && classesRes.value) {
        const cData = classesRes.value?.data;
        setClasses(Array.isArray(cData) ? cData : (cData?.data || []));
      }

      const rawActivity = extractRecordsFromResponse(activityRes);
      const normalizedActivity = rawActivity.map(act => normalizeAttendanceRecord(act));
      setRecentActivity(normalizedActivity);
      setAttendanceReports(normalizedActivity);
      console.debug('🟢 DashboardAdmin attendanceReports loaded', normalizedActivity.length, normalizedActivity[0]);
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

  // ✨ TAMBAHAN: Fetch functions untuk fitur baru
function DashboardAdmin() {

  const BASE = "https://oasis-labs-artwork-congressional.trycloudflare.com";

  const fetchSubjects = async () => {
    try {
      setFeatureDataLoading(true);
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await api.get('/admin/subjects', config);
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
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await api.get('/admin/schedules', config);
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

  // Fetch Data Guru dari database
  const fetchDataGuru = async () => {
  try {
    const token = localStorage.getItem('token');

    const res = await api.get('/admin/users?role=guru', {
      headers: { Authorization: `Bearer ${token}` }
    });

    setGuruData(res.data?.data || res.data || []);
  } catch (err) {
    console.error('Gagal mengambil data guru:', err);
    setGuruData([]);
  }
};

  // Fetch Data Siswa dari database
  const fetchDataSiswa = async () => {
  try {
    const token = localStorage.getItem('token');

    const res = await api.get('/admin/users?role=siswa', {
      headers: { Authorization: `Bearer ${token}` }
    });

    setSiswaData(res.data?.data || res.data || []);
  } catch (err) {
    console.error('Gagal mengambil data siswa:', err);
    setSiswaData([]);
  }
};

  // ✨ FIX: Fetch Classes untuk dropdown
  const fetchClasses = async () => {
  try {
    const token = localStorage.getItem('token');

    const res = await api.get('/admin/classes', {
      headers: { Authorization: `Bearer ${token}` }
    });

    setClasses(res.data?.data || res.data || []);
  } catch (err) {
    console.error('Gagal mengambil data kelas:', err);
    setClasses([]);
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

return (
    <div>

      {/* KOMPONEN LAIN */}

      {settings.dashboard_photo_1 && (
        <img
          src={`${BASE}/storage/${settings.dashboard_photo_1}`}
          width="200"
        />
      )}

      {settings.dashboard_video && (
        <video
          src={`${BASE}/storage/${settings.dashboard_video}`}
          controls
          width="300"
        />
      )}

    </div>
  );
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

  // ✨ TAMBAHAN: Handle Settings Change
  const handleSettingsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettingsData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // ✨ TAMBAHAN: Handle Save Settings
  const handleSaveSettings = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      setIsPromoting(true); // Gunakan state loading agar user tidak klik berkali-kali

      // ✨ PENTING: Jangan set Content-Type secara manual. 
      // Axios akan otomatis mendeteksi FormData dan menyetel boundary yang benar.
      const config = { 
        headers: { Authorization: `Bearer ${token}` } 
      };

      const data = new FormData();

// ====================
// TEXT (IKUT BACKEND)
// ====================
data.append('schoolName', settingsData.schoolName || '');
data.append('schoolAddress', settingsData.schoolAddress || '');
data.append('schoolPhone', settingsData.schoolPhone || '');
data.append('schoolEmail', settingsData.schoolEmail || '');
data.append('academicYear', settingsData.academicYear || '');

// ====================
// TIME
// ====================
data.append('attendanceStartTime', settingsData.attendanceStartTime?.slice(0,5) || '07:00');
data.append('attendanceEndTime', settingsData.attendanceEndTime?.slice(0,5) || '08:00');
data.append('lateThreshold', settingsData.lateThreshold?.slice(0,5) || '08:00');
data.append('schoolEndTime', settingsData.schoolEndTime?.slice(0,5) || '15:30');

// ====================
// BOOLEAN
// ====================
data.append('enableNotifications', settingsData.enableNotifications ? '1' : '0');
data.append('enableEmailReports', settingsData.enableEmailReports ? '1' : '0');
data.append('enableQRCode', settingsData.enableQRCode ? '1' : '0');
data.append('attendanceSessionOpen', settingsData.attendanceSessionOpen ? '1' : '0');
data.append('autoMarkAbsentEnabled', settingsData.autoMarkAbsentEnabled ? '1' : '0');

// ====================
// FILE (IKUT BACKEND)
// ====================
if (logoFile instanceof File) {
  data.append('logo', logoFile);
}

// if (mediaPhotoFiles[1] instanceof File) {
//   data.append('dashboard_photo_1', mediaPhotoFiles[1]);
// }

// if (mediaPhotoFiles[2] instanceof File) {
//   data.append('dashboard_photo_2', mediaPhotoFiles[2]);
// }

// if (mediaPhotoFiles[3] instanceof File) {
//   data.append('dashboard_photo_3', mediaPhotoFiles[3]);
// }

// if (mediaVideoFile instanceof File) {
//   data.append('dashboard_video', mediaVideoFile);
// }

for (let pair of data.entries()) {
  console.log(pair[0], pair[1]);
}

for (let pair of data.entries()) {
  console.log(pair[0], pair[1]);
}

console.log("VIDEO:", mediaVideoFile);
console.log("PHOTO1:", mediaPhotoFiles[1]);
console.log("LOGO:", logoFile);

      // ✨ KEMBALI KE POST: Karena backend menggunakan Route::post dan error 405 muncul jika dipaksa PUT.
      const response = await api.post('/admin/settings', data, { ...config, timeout: 120000 });
      
      if (response.status === 200 || response.status === 201) {
        // ✨ AGAR LANGSUNG MUNCUL: Refresh settings dari server
        await fetchSettings(); 
        
        setSettingsSaved(true);
        setShowSuccessNotification(true);
        
        // Reset form file agar tidak dikirim ulang jika klik simpan lagi
        setLogoFile(null);
        setMediaPhotoFiles({ 1: null, 2: null, 3: null });
        setMediaVideoFile(null);

        setTimeout(() => {
          setShowSuccessNotification(false);
          setSettingsSaved(false);
        }, 3000);
      }
    } catch (err) {
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
    { id: 'activity', label: 'Aktivitas', icon: '⏰' },
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

  const normalizeDateKey = (rawDate) => {
    if (!rawDate) return '';
  
  if (rawDate instanceof Date) {
    return rawDate.toLocaleDateString('en-CA');
    }

  const str = String(rawDate).trim();
  
  // Handle format ISO (2026-03-31T...)
  const isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  // Handle format DD-MM-YYYY atau DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }

    const d = new Date(str);
    if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('en-CA');
    }

    const parts = str.split(' ');
    return parts[0] || '';
  };

  const getTodayAttendance = () => {
    const todayKey = new Date().toLocaleDateString('en-CA');
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
    const hadir = today.filter(item => ['hadir', 'tepat_waktu', 'present', 'on_time'].includes((item.status || '').toString().toLowerCase())).length;
    const terlambat = today.filter(item => ['terlambat', 'late', 'tardy'].includes((item.status || '').toString().toLowerCase()) || item.is_late === true).length;
    const absen = today.filter(item => ['absen', 'absent', 'tidak hadir', 'missing'].includes((item.status || '').toString().toLowerCase())).length;
    const hadirPercent = total ? Math.round((hadir / total) * 100) : 0;
    return { total, hadir, terlambat, absen, hadirPercent };
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
      
      const dateKey = targetDate.toLocaleDateString('en-CA');
      
      const studentsPresentCount = attendanceReports.filter((item) => {
        // Filter siswa & tanggal
        if (item.role && item.role !== 'siswa') return false;
        const itemKey = normalizeDateKey(item.date || item.created_at || item.attendance_time);
        if (itemKey !== dateKey) return false;
        
        const status = (item.status || '').toString().toLowerCase();
        return ['hadir', 'tepat_waktu', 'present', 'on_time', 'terlambat', 'late', 'tardy'].includes(status) || item.is_late === true;
      }).length;
      
      return { label: name, count: studentsPresentCount, date: dateKey };
    });
  };

  const getMonthlyAttendanceTrend = () => {
    const now = new Date();
    const monthsRef = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('id-ID', { month: 'short', year: '2-digit' });
      monthsRef.push({ year: d.getFullYear(), month: d.getMonth(), label });
    }
    const trend = monthsRef.map((m) => {
      const count = attendanceReports.reduce((acc, item) => {
        const rawDate = item.attendance_time || item.created_at || item.time || item.date;
        if (!rawDate) return acc;
        let d = new Date(rawDate);
        if (isNaN(d.getTime())) {
          const normalized = normalizeDateKey(rawDate);
          if (!normalized) return acc;
          const parts = normalized.split('-').map(Number);
          if (parts.length < 3) return acc;
          if (parts[0] === m.year && parts[1] - 1 === m.month) return acc + 1;
          return acc;
        }
        if (d.getFullYear() === m.year && d.getMonth() === m.month) return acc + 1;
        return acc;
      }, 0);
      return { ...m, count };
    });
    return trend;
  };

  const { total, hadir, terlambat, absen, hadirPercent } = getAttendanceStats();

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
        {/* ✨ TAMBAHAN: Overlay untuk mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}
        
        {/* SIDEBAR - Responsive dengan hamburger menu */}
        <aside className={`fixed lg:static inset-y-0 left-0 z-50 bg-white border-r-2 border-blue-200 flex flex-col shadow-lg transition-all duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0 w-72' : sidebarCollapsed ? '-translate-x-full lg:translate-x-0 w-20 lg:w-20' : '-translate-x-full lg:translate-x-0 lg:w-72'}`}>
          {/* Logo */}
          <div className="p-6 border-b-2 border-blue-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg overflow-hidden shadow-md border-2 border-blue-200">
                  <img
                    src={settingsData.schoolLogo ? resolvePhotoUrl(settingsData.schoolLogo) : "/logo sekolah.jpeg"}
                    alt="Logo Sekolah"
                    className="w-full h-full object-contain bg-white"
                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/40/2563eb/ffffff?text=S'; }}
                  />
                </div>
                {!sidebarCollapsed && <span className="text-lg font-bold text-blue-800 truncate max-w-[150px]">{settingsData.schoolName || 'SMPK Don Bosco'}</span>}
              </div>
              {/* Tombol close untuk mobile */}
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
          
          {/* Navigation */}
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2' : 'gap-3 px-4 py-3'} rounded-xl text-left transition-all duration-200 group border-2 ${activeTab === item.id
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium border-blue-300 shadow-md'
                    : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700 border-transparent hover:border-blue-200'
                  }`}
              >
                <span className="text-lg transition-transform group-hover:scale-110">{item.icon}</span>
                {!sidebarCollapsed && <span className="text-sm font-medium">{item.label}</span>}
              </button>
            ))}
          </nav>
          
          {/* Logout */}
          <div className="p-4 border-t-2 border-blue-100">
            {!sidebarCollapsed && (
              <div className="mb-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border-2 border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-white rounded-full flex items-center justify-center shadow-sm flex-shrink-0 border-2 border-blue-300 overflow-hidden">
                    <img
                      src={resolvePhotoUrl(user.photo) || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email || 'Admin')}&background=2563eb&color=ffffff`}
                      alt="User Avatar"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email || 'Admin')}&background=2563eb&color=ffffff`; }}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-blue-800 font-semibold text-sm truncate max-w-[140px]" title={user.name}>{user.name || 'Admin'}</p>
                    <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200">
                      👮 Admin
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

        {/* ✅ MAIN CONTENT */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-white border-b-2 border-blue-200 px-4 lg:px-8 py-4 sticky top-0 z-30 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* ✨ HAMBURGER MENU */}
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
                {/* Theme Toggle */}
                <div>
                  <h1 className="text-lg lg:text-xl font-bold text-blue-800">
                    {activeTab === 'overview' && '📊 Ringkasan Dashboard'}
                    {activeTab === 'users' && '👥 Kelola Pengguna'}
                    {activeTab === 'dataGuru' && '🎓 Data Guru'}
                    {activeTab === 'dataSiswa' && '🧑‍🎓 Data Siswa'}
                    {activeTab === 'pesanWA' && '💬 Pesan WhatsApp'}
                    {activeTab === 'classes' && '🏫 Data Kelas'}
                    {activeTab === 'activity' && '⏰ Aktivitas Sistem'}
                    {activeTab === 'settings' && '⚙️ Pengaturan Sistem'}
                  </h1>
                  <p className="text-slate-500 text-xs lg:text-sm mt-0.5">
                    Monitor dan kelola sistem absensi dengan mudah
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 lg:gap-3">
                {(activeTab === 'users' || activeTab === 'dataGuru' || activeTab === 'dataSiswa' || activeTab === 'pesanWA') && (
                  <input
                    type="text"
                    placeholder="Cari..."
                    value={activeTab === 'pesanWA' ? waSearchQuery : searchQuery}
                    onChange={(e) => activeTab === 'pesanWA' ? setWaSearchQuery(e.target.value) : setSearchQuery(e.target.value)}
                    className="hidden sm:block px-4 py-2 border-2 border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                )}
                <span className="text-xs text-slate-400 bg-blue-50 px-2 lg:px-3 py-1.5 rounded-full border border-blue-200">
                  {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                <div className="flex items-center gap-2 bg-white border border-blue-200 px-3 py-1.5 rounded-full shadow-sm">
                  <div className="w-7 h-7 rounded-full overflow-hidden bg-blue-500 border-2 border-blue-200">
                    <img
                      src={resolvePhotoUrl(user.photo) || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email || 'Admin')}&background=2563eb&color=ffffff`}
                      alt="User Avatar"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email || 'Admin')}&background=2563eb&color=ffffff`; }}
                    />
                  </div>
                  <div className="hidden sm:block text-xs text-blue-700 leading-tight">
                    <div className="font-semibold truncate max-w-[130px]">{user.name || user.email || 'Admin'}</div>
                    <div className="text-blue-400">Admin</div>
                  </div>
                </div>
              </div>
            </div>
          </header>

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
                <div className="bg-gradient-to-r from-purple-200 to-indigo-100 border border-purple-200 rounded-2xl p-6 mx-4 lg:mx-8 mt-4 shadow-lg mb-8">
                  <div className="flex flex-col lg:flex-row items-center gap-6">
                    <div className="flex-1">
                      <h2 className="text-2xl lg:text-3xl font-bold text-slate-800">Selamat datang, {user?.name ? user.name : 'Admin'}!</h2>
                      <p className="text-slate-600 mt-1">Siap memantau absensi & perkembangan sekolah hari ini?</p>
                      <p className="text-sm text-slate-500 mt-2">Gunakan menu di samping untuk navigasi cepat ke data pengguna, pengumuman, jadwal, dan laporan.</p>
                    </div>
                    <div className="w-full lg:w-56 h-40 rounded-2xl bg-white shadow-inner flex items-center justify-center border border-purple-200">
                    </div>
                  </div>
                </div>
              )}

              {/* ✨ SEKSI MEDIA (GABUNGAN KE OVERVIEW) */}
              {activeTab === 'overview' && (
                <div className="bg-white rounded-xl border-2 border-blue-200 p-5 shadow-lg mb-8 mx-4 lg:mx-8">
                  <h3 className="font-semibold text-blue-800 mb-4 flex items-center gap-2">
                    <span>🖼️</span> Media & Kegiatan Sekolah
                  </h3>
                  <div className="flex flex-col gap-4">
                    {/* Baris Foto: Sliding Left Animation */}
                    <div className="overflow-hidden relative w-full py-1">
                      <div className="flex gap-4 animate-slide-left w-max">
                        {[1, 2, 3, 1, 2, 3].map((i, idx) => {
                          const photoNum = i;
                          const photoUrl = settingsData[`dashboardPhoto${photoNum}`];
                          return (
                            <div key={`overview-photo-${idx}`} className="w-48 sm:w-72 flex-shrink-0 rounded-lg overflow-hidden border border-blue-100 bg-slate-50 shadow-sm">
                              {photoUrl ? (
                                <img src={resolvePhotoUrl(photoUrl)} alt={`Sekolah ${photoNum}`} className="w-full h-24 sm:h-40 object-cover hover:scale-110 transition-transform duration-700" />
                            ) : (
                              <div className="h-24 sm:h-40 flex flex-col items-center justify-center text-slate-400">
                                <span className="text-2xl">📸</span>
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* Baris Video: Di bawah foto */}
                    <div className="rounded-lg overflow-hidden border border-blue-100 bg-black shadow-md">
                      {settingsData.dashboardVideo ? (
                        <video src={resolvePhotoUrl(settingsData.dashboardVideo)} controls className="w-full h-40 sm:h-64 object-contain" />
                      ) : (
                        <div className="h-32 bg-slate-50 flex flex-col items-center justify-center text-slate-400">
                          <span className="text-2xl">🎥</span><p className="text-[10px]">Belum ada video terbaru</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: Overview */}
              {activeTab === 'overview' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    {[
                      { label: 'Total Absensi', value: total, color: 'blue', icon: '📋' },
                      { label: 'Tepat Waktu', value: hadir, color: 'emerald', icon: '✅' },
                      { label: 'Terlambat', value: terlambat, color: 'yellow', icon: '⚠️' },
                      { label: 'Absen', value: absen, color: 'red', icon: '✗' },
                    ].map((stat, i) => (
                      <div key={i} className="bg-white rounded-2xl p-5 border-2 border-blue-100 shadow-md hover:shadow-lg transition-all group">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-2xl group-hover:scale-110 transition-transform">{stat.icon}</span>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${stat.color === 'blue' ? 'bg-blue-50 text-blue-600 border-blue-200' : stat.color === 'emerald' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : stat.color === 'yellow' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                            Hari Ini
                          </span>
                        </div>
                        <p className="text-3xl font-bold text-blue-800">{stat.value}</p>
                        <p className="text-slate-500 text-sm mt-1">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                  
                  {/* Laporan Kehadiran Hari Ini */}
                  <div className="grid gap-6 mt-4 lg:grid-cols-3">
                    <div className="lg:col-span-2 bg-white rounded-2xl border-2 border-blue-100 shadow-md p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-blue-800 text-lg">Kehadiran Siswa Mingguan</h3>
                          <p className="text-slate-500 text-xs">Jumlah siswa hadir (Minggu - Sabtu)</p>
                        </div>
                        <div className="text-xs text-blue-500 px-2 py-1 rounded-full border border-blue-200">Weekly</div>
                      </div>
                      <div className="h-64 w-full rounded-xl overflow-hidden border border-blue-100 p-4 bg-gradient-to-b from-white to-blue-50">
                        {(() => {
                          const weeklyData = getAttendanceChartData();
                          const maxVal = Math.max(1, ...weeklyData.map(d => d.count));
                          return (
                            <div className="h-full flex flex-col justify-end">
                              <div className="flex-1 flex items-end gap-3 px-2">
                                {weeklyData.map((day, i) => {
                                  const height = (day.count / maxVal) * 100 || 5;
                                  const isToday = day.date === new Date().toISOString().slice(0, 10);
                                  return (
                                    <div key={i} className="flex-1 flex flex-col justify-end items-center group">
                                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-800 text-white text-[10px] px-1.5 py-0.5 rounded mb-1 whitespace-nowrap">
                                        {day.count} Siswa
                                      </div>
                                      <div
                                        className={`w-full rounded-t-lg transition-all duration-500 ${isToday ? 'bg-gradient-to-t from-blue-600 to-blue-400 shadow-lg' : 'bg-gradient-to-t from-blue-400 to-blue-200 hover:from-blue-500 hover:to-blue-300'}`}
                                        style={{ height: `${height}%` }}
                                        title={`${day.label}: ${day.count} Siswa`}
                                      ></div>
                                      <span className={`text-[10px] mt-2 font-semibold ${isToday ? 'text-blue-700' : 'text-slate-500'}`}>{day.label}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl border-2 border-blue-100 shadow-md p-5">
                      <h3 className="font-bold text-blue-800 mb-3">Statistik Kehadiran</h3>
                      <ul className="space-y-2 text-sm">
                        <li className="flex justify-between"><span>Total Absen</span><span>{total}</span></li>
                        <li className="flex justify-between"><span>Hadir</span><span>{hadir} ({hadirPercent}%)</span></li>
                        <li className="flex justify-between"><span>Terlambat</span><span>{terlambat}</span></li>
                        <li className="flex justify-between"><span>Tidak hadir</span><span>{absen}</span></li>
                      </ul>
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
                            <th className="px-4 py-3 text-left">Kelas</th>
                            <th className="px-4 py-3 text-left">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-blue-50">
                          {attendanceReports.slice(-8).reverse().map((item, idx) => {
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
                                <td className="px-4 py-3 text-slate-600">{className}</td>
                                <td className="px-4 py-3 text-sm font-semibold text-slate-700">{statusLabel}</td>
                              </tr>
                            );
                          })}
                          {attendanceReports.length === 0 && (
                            <tr>
                              <td colSpan="4" className="px-4 py-8 text-center text-slate-400">Belum ada data absensi</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
                    <div className="bg-white rounded-2xl border-2 border-blue-100 shadow-md p-4">
                      <h4 className="font-semibold text-blue-800 mb-2">Data Siswa Aktif</h4>
                      <p className="text-slate-500 text-xs">{stats.totalSiswa} siswa terdaftar</p>
                    </div>
                    <div className="bg-white rounded-2xl border-2 border-blue-100 shadow-md p-4">
                      <h4 className="font-semibold text-blue-800 mb-2">Data Guru Aktif</h4>
                      <p className="text-slate-500 text-xs">{stats.totalGuru} guru terdaftar</p>
                    </div>
                  </div>
                  
                  {/* Tabel Aktivitas Terbaru - Terpisah Terlambat dan Tepat Waktu */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Tabel Siswa Terlambat */}
                    <div className="bg-white rounded-2xl border-2 border-red-200 shadow-md overflow-hidden">
                      <div className="px-6 py-4 border-b-2 border-red-100 bg-red-50 flex items-center justify-between">
                        <h3 className="font-semibold text-red-800 flex items-center gap-2">
                          <span>⚠️</span> Siswa Terlambat
                        </h3>
                        <span className="text-xs text-red-600 bg-red-100 px-2.5 py-1 rounded-full border border-red-200">
                          {getLateActivities().length} Siswa
                        </span>
                      </div>
                      <div className="divide-y divide-red-50">
                        {getLateActivities().length === 0 ? (
                          <div className="p-10 text-center text-slate-500">
                            <p className="text-4xl mb-3">✅</p>
                            <p className="font-medium">Tidak ada siswa terlambat</p>
                          </div>
                        ) : (
                          getLateActivities().map((act, i) => {
                            const indoTime = formatToIndonesiaTime(act.created_at || act.time);
                            const indoDate = indoTime.split(' ')[0];
                            const indoClock = indoTime.split(' ')[1];
                            return (
                              <div key={i} className="p-4 flex items-center justify-between hover:bg-red-50 transition-colors">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm border-2 bg-red-100 text-red-600 border-red-200">
                                    {act.user?.charAt(0) || '?'}
                                  </div>
                                  <div>
                                    <p className="font-medium text-red-800 text-sm">{act.user}</p>
                                    <p className="text-slate-500 text-xs">{act.action}</p>
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
                    
                    {/* Tabel Siswa Tepat Waktu */}
                    <div className="bg-white rounded-2xl border-2 border-green-200 shadow-md overflow-hidden">
                      <div className="px-6 py-4 border-b-2 border-green-100 bg-green-50 flex items-center justify-between">
                        <h3 className="font-semibold text-green-800 flex items-center gap-2">
                          <span>✅</span> Siswa Tepat Waktu
                        </h3>
                        <span className="text-xs text-green-600 bg-green-100 px-2.5 py-1 rounded-full border border-green-200">
                          {getOnTimeActivities().length} Siswa
                        </span>
                      </div>
                      <div className="divide-y divide-green-50">
                        {getOnTimeActivities().length === 0 ? (
                          <div className="p-10 text-center text-slate-500">
                            <p className="text-4xl mb-3">📭</p>
                            <p className="font-medium">Belum ada aktivitas</p>
                          </div>
                        ) : (
                          getOnTimeActivities().map((act, i) => {
                            const indoTime = formatToIndonesiaTime(act.created_at || act.time);
                            const indoDate = indoTime.split(' ')[0];
                            const indoClock = indoTime.split(' ')[1];
                            return (
                              <div key={i} className="p-4 flex items-center justify-between hover:bg-green-50 transition-colors">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm border-2 bg-green-100 text-green-600 border-green-200">
                                    {act.user?.charAt(0) || '?'}
                                  </div>
                                  <div>
                                    <p className="font-medium text-green-800 text-sm">{act.user}</p>
                                    <p className="text-slate-500 text-xs">{act.action}</p>
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

                    {/* ✨ TAMBAHAN: Daftar Alumni (Setelah Lulus) di Tab Promotion */}
                    <div className="bg-white rounded-2xl border-2 border-slate-300 shadow-md overflow-hidden">
                      <div className="px-6 py-4 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-slate-700 text-lg">🎓 Daftar Alumni (Lulus)</h3>
                          <p className="text-xs text-slate-500">Siswa yang sudah menyelesaikan pendidikan (Tingkat Akhir)</p>
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
                              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Kelas Terakhir</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(() => {
                              const alumni = siswaData.filter(s => !['1', '2', '3'].includes(getClassGroup(s)));
                              return alumni.length === 0 ? (
                                <tr>
                                  <td colSpan="5" className="px-6 py-8 text-center text-slate-400 text-sm italic">Belum ada data alumni di sistem.</td>
                                </tr>
                              ) : (
                                alumni.map((siswa, idx) => (
                                  <tr key={`alumni-promote-${siswa.id}`} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-xs text-slate-400">{idx + 1}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-800">{siswa.name}</td>
                                    <td className="px-6 py-4 text-sm text-slate-500 font-mono">{siswa.user_id}</td>
                                    <td className="px-6 py-4 text-sm text-slate-500">{siswa.class_name || '-'}</td>
                                    <td className="px-6 py-4"><span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase">ALUMNI / LULUS</span></td>
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
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-md p-6">
                      <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                        <span>🏫</span> Informasi Sekolah
                      </h3>
                      <form onSubmit={handleSaveSettings} className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Logo Sekolah</label>
                          <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-xl border-2 border-blue-100">
                            <div className="w-16 h-16 rounded-lg bg-white flex items-center justify-center overflow-hidden border-2 border-blue-200 shadow-sm">
                              {logoPreview ? (
                                <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                              ) : (
                                <span className="text-2xl">🏫</span>
                              )}
                            </div>
                            <div className="flex-1">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleLogoChange}
                                className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 transition-all"
                              />
                            </div>
                          </div>
                        </div>
                        {/* Update Media (3 Photos & Video) */}
                        <div className="space-y-4">
                          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">Galeri Foto (Maks 3)</label>
                          <div className="grid grid-cols-3 gap-2">
                            {[1, 2, 3].map(i => (
                              <div key={`setting-photo-slot-${i}`} className="p-2 bg-blue-50 rounded-xl border-2 border-blue-100">
                                <div className="w-full aspect-square mb-2 rounded-lg bg-white overflow-hidden border">
                                  {mediaPhotoPreviews[i] ? <img src={mediaPhotoPreviews[i]} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-lg">📸</div>}
                                </div>
                                <input type="file" accept="image/*" 
                                  onChange={(e) => {
                                    const file = e.target.files[0];
                                    if(file) {
                                      setMediaPhotoFiles(prev => ({ ...prev, [i]: file }));
                                      const reader = new FileReader();
                                      reader.onloadend = () => setMediaPhotoPreviews(prev => ({ ...prev, [i]: reader.result }));
                                      reader.readAsDataURL(file);
                                    }
                                  }} 
                                  className="w-full text-[10px]" />
                              </div>
                            ))}
                          </div>
                          
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">Video Profil</label>
                            <div className="p-3 bg-blue-50 rounded-xl border-2 border-blue-100">
                              <div className="w-full h-32 mb-2 rounded-lg bg-white overflow-hidden border flex items-center justify-center">
                                {mediaVideoPreview ? <span className="text-green-600 font-bold text-xs">Video Terpilih ✅</span> : <div className="text-2xl">🎥</div>}
                              </div>
                              <input type="file" accept="video/*" 
                                onChange={(e) => {
                                  const file = e.target.files[0];
                                  if(file) {
                                    setMediaVideoFile(file);
                                    setMediaVideoPreview(URL.createObjectURL(file));
                                  }
                                }} 
                                className="w-full text-xs" />
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Nama Sekolah</label>
                          <input
                            type="text"
                            name="schoolName"
                            value={settingsData.schoolName}
                            onChange={handleSettingsChange}
                            className="w-full px-4 py-2.5 border-2 border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Alamat Sekolah</label>
                          <textarea
                            name="schoolAddress"
                            value={settingsData.schoolAddress}
                            onChange={handleSettingsChange}
                            rows="2"
                            className="w-full px-4 py-2.5 border-2 border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
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
                              className="w-full px-4 py-2.5 border-2 border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Email</label>
                            <input
                              type="email"
                              name="schoolEmail"
                              value={settingsData.schoolEmail}
                              onChange={handleSettingsChange}
                              className="w-full px-4 py-2.5 border-2 border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
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
                            className="w-full px-4 py-2.5 border-2 border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          />
                        </div>
                      </form>
                    </div>
                    <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-md p-6">
                      <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                        <span>⏰</span> Pengaturan Absensi
                      </h3>
                      <form onSubmit={handleSaveSettings} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Jam Absen Dibuka</label>
                            <input
                              type="time"
                              name="attendance_start_time"
                              value={settingsData.attendance_start_time}
                              onChange={handleSettingsChange}
                              className="w-full px-4 py-2.5 border-2 border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Jam Absen Ditutup</label>
                            <input
                              type="time"
                              name="attendanceCloseTime"
                              value={settingsData.attendanceCloseTime}
                              onChange={handleSettingsChange}
                              className="w-full px-4 py-2.5 border-2 border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Jam Masuk</label>
                            <input
                              type="time"
                              name="attendanceStartTime"
                              value={settingsData.attendanceStartTime}
                              onChange={handleSettingsChange}
                              className="w-full px-4 py-2.5 border-2 border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Jam Akhir</label>
                            <input
                              type="time"
                              name="attendanceEndTime"
                              value={settingsData.attendanceEndTime}
                              onChange={handleSettingsChange}
                              className="w-full px-4 py-2.5 border-2 border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
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
                            className="w-full px-4 py-2.5 border-2 border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Jam Pulang Sekolah (auto absen)</label>
                          <input
                            type="time"
                            name="schoolEndTime"
                            value={settingsData.schoolEndTime}
                            onChange={handleSettingsChange}
                            className="w-full px-4 py-2.5 border-2 border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          />
                          <p className="text-xs text-slate-500 mt-1">Setelah jam ini, scheduler bisa menandai siswa tanpa absen sebagai alpha/absen (jalankan `php artisan schedule:work` atau cron).</p>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border-2 border-amber-200">
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
                            <div className="w-11 h-6 bg-amber-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                          </label>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border-2 border-slate-200">
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
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-700"></div>
                          </label>
                        </div>
                      </form>
                    </div>
                    <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-md p-6">
                      <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                        <span>🔔</span> Pengaturan Notifikasi
                      </h3>
                      <form onSubmit={handleSaveSettings} className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border-2 border-blue-200">
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
                            <div className="w-11 h-6 bg-blue-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-blue-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border-2 border-blue-200">
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
                            <div className="w-11 h-6 bg-blue-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-blue-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border-2 border-blue-200">
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
                            <div className="w-11 h-6 bg-blue-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-blue-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border-2 border-blue-200">
                          <div>
                            <p className="text-sm font-medium text-blue-900">Batasi 1x Absen Sehari</p>
                            <p className="text-xs text-slate-500">Mencegah dobel absensi (Siswa & Guru)</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              name="limitOneScanPerDay"
                              checked={settingsData.limitOneScanPerDay}
                              onChange={handleSettingsChange}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-blue-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                      </form>
                    </div>
                    <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-md p-6 flex flex-col justify-center">
                      <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                        <span>💾</span> Aksi
                      </h3>
                      <div className="space-y-3">
                        <button
                          onClick={handleSaveSettings}
                          className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 border-2 border-blue-300"
                        >
                          <span>💾</span>
                          <span>Simpan Pengaturan</span>
                        </button>
                        <button
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
                                dashboardPhoto1: null,
                                dashboardPhoto2: null,
                                dashboardPhoto3: null,
                              };
                              setSettingsData(defaultSettings);
                              localStorage.setItem('school_settings', JSON.stringify(defaultSettings));
                              alert('✅ Pengaturan berhasil direset!');
                            }
                          }}
                          className="w-full px-6 py-3 border-2 border-blue-200 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                        >
                          <span>🔄</span>
                          <span>Reset ke Default</span>
                        </button>
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
                        <div className="w-32 h-32 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden border-4 border-blue-200 shadow-md mb-4">
                          {selectedProfileUser.photo ? (
                            <img src={selectedProfileUser.photo} alt={selectedProfileUser.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-5xl text-blue-400 font-bold">{selectedProfileUser.name?.charAt(0) || 'S'}</span>
                          )}
                        </div>
                        <h3 className="text-2xl font-bold text-blue-900">{selectedProfileUser.name}</h3>
                        <p className="text-blue-600 font-medium">{getClassName(selectedProfileUser.class_id, selectedProfileUser.class_name)}</p>
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