import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Html5Qrcode } from 'html5-qrcode';
import axios from 'axios';

// Helper: Resolve URL foto/logo dengan fallback
const resolvePhotoUrl = (photo, fallbackBase = 'http://127.0.0.1:8000') => {
  if (!photo || typeof photo !== 'string') return null;
  const trimmed = photo.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http') || trimmed.startsWith('data:')) return trimmed;
  const base = api.defaults.baseURL?.replace(/\/api\/?$/, '') || fallbackBase;
  return `${base}/${trimmed.replace(/^\//, '')}`;
};

// Helper untuk mendapatkan waktu lokal format YYYY-MM-DD HH:mm:ss
const getLocalTimestamp = (date) => {
  const pad = (n) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
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
      const isNetworkError = error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK' || error.message?.includes('timeout');
      if (isNetworkError) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

const Landing = ({ theme, toggleTheme }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeUserRole, setActiveUserRole] = useState('siswa');
  const [activeAttendanceAction, setActiveAttendanceAction] = useState('datang');
  const [activeMethodTab, setActiveMethodTab] = useState('scan');
  const [showAbsenModal, setShowAbsenModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showAttendanceListModal, setShowAttendanceListModal] = useState(false);
  const navigate = useNavigate();
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLandingLoading, setIsLandingLoading] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [backendStatus, setBackendError] = useState(null);

  useEffect(() => {
    let interval;
    if (isLandingLoading) {
      interval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev >= 99) return 99;
          return prev + 1;
        });
      }, 20);
    } else {
      setLoadingProgress(100);
    }
    return () => clearInterval(interval);
  }, [isLandingLoading]);

  const schoolBackgrounds = [
    'https://images.unsplash.com/photo-1562774053-701939374585?w=1920&q=80',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&q=80',
    'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1920&q=80'
  ];

  const qrScannerRef = useRef(null);
  const [qrScanner, setQrScanner] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [logoError, setLogoError] = useState(false);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [showQRNotification, setShowQRNotification] = useState(false);
  const [qrNotificationMessage, setQrNotificationMessage] = useState('');
  const [qrNotificationType, setQrNotificationType] = useState('error');
  const [showSubmitNotification, setShowSubmitNotification] = useState(false);
  const [submitNotificationMessage, setSubmitNotificationMessage] = useState('');
  const [submitNotificationType, setSubmitNotificationType] = useState('error');
  const isSubmittingRef = useRef(false);
  const lastScannedDataRef = useRef(null);
  const lastScannedAtRef = useRef(0);
  const [facingMode, setFacingMode] = useState('environment');
  const [showStandaloneQRScanner, setShowStandaloneQRScanner] = useState(false);

  const [studentForm, setStudentForm] = useState({ user_id: '', fullName: '' });
  const [teacherForm, setTeacherForm] = useState({ nip: '', fullName: '' });
  const [izinForm, setIzinForm] = useState({
    fullName: '',
    user_id: '',
    type: 'izin',
    reason: '',
    attachment: null,
    parent_phone: ''
  });

  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrResult, setQrResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState({ type: '', text: '' });

  const [attendanceSettings, setAttendanceSettings] = useState({
    attendanceStartTime: '07:00',
    attendanceEndTime: '12:00',
    lateThreshold: '08:00',
    pulangStartTime: '15:00',
    pulangEndTime: '16:00',
    schoolEndTime: '15:30',
    schoolName: '',
    schoolLogo: null,
    limitOneScanPerDay: true,
    disableAttendanceOnHolidays: true,
    activeDays: 'Senin,Selasa,Rabu,Kamis,Jumat,Sabtu'
  });

  const [attendanceStats, setAttendanceStats] = useState({
    totalHadir: 0,
    keterlambatan: 0
  });
  const [todayAttendanceRecords, setTodayAttendanceRecords] = useState([]);
  const [showLandingNotification, setShowLandingNotification] = useState(false);
  const [landingNotificationMessage, setSubmitLandingNotificationMessage] = useState('');

  const getJakartaDateKey = (date) => {
    if (!date) return '';
    try {
      const dt = date instanceof Date ? date : new Date(date);
      if (isNaN(dt.getTime())) return '';
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(dt);
    } catch (err) {
      console.warn('Gagal normalisasi tanggal:', err, date);
      return '';
    }
  };

  const normalizeDateKey = (rawDate) => {
    if (!rawDate) return '';
    if (rawDate instanceof Date) return getJakartaDateKey(rawDate);
    const str = String(rawDate).trim();
    if (!str) return '';

    const iso = new Date(str.replace(' ', 'T'));
    if (!isNaN(iso.getTime())) return getJakartaDateKey(iso);

    const dmy = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})(?:[ T](\d{2}:\d{2}:\d{2}))?/);
    if (dmy) {
      const [, day, month, year, timePart] = dmy;
      const [hour = '00', minute = '00', second = '00'] = (timePart || '00:00:00').split(':');
      const dateObj = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
      return getJakartaDateKey(dateObj);
    }

    return '';
  };

  // ✅ DIPERBAIKI: Lebih robust dalam mengenali field tanggal & status
  const countTodayAttendance = (records = []) => {
    const todayKey = getJakartaDateKey(new Date());
    const counter = { total: 0, hadir: 0, terlambat: 0, absen: 0 };
    if (!Array.isArray(records)) return { counter, todayRecords: [] };
    const todayRecords = [];
    const matchedRecords = [];

    records.forEach((item) => {
      // Coba banyak kemungkinan nama field tanggal dari backend
      const rawDate = item.date || item.attendance_time || item.created_at ||
                      item.time || item.scan_time || item.tanggal ||
                      item.waktu || item.timestamp || item.check_in ||
                      item.absen_time || item.updated_at || item.attendance_date;

      const dateKey = normalizeDateKey(rawDate);

      // Skip kalau tanggal tidak cocok dengan hari ini (tapi catat untuk fallback)
      if (dateKey && dateKey !== todayKey) return;

      const status = String(
        item.status || item.action || item.description ||
        item.notes || item.type || item.kehadiran || item.state || ''
      ).toLowerCase().trim();

      const isLate = item.is_late === true || item.isLate === true ||
                     item.terlambat === true ||
                     ['terlambat', 'late', 'tardy'].some((flag) => status.includes(flag));
      const isPresent = ['hadir', 'tepat_waktu', 'present', 'on_time', 'on time',
                         'hadir_tepat_waktu', 'tepat waktu'].some((flag) => status.includes(flag));
      const isAbsent = ['absen', 'absent', 'tidak hadir', 'missing', 'alpha'].some((flag) => status.includes(flag));

      let displayStatus = 'lain-lain';
      if (isLate) {
        counter.terlambat += 1;
        displayStatus = 'terlambat';
      } else if (isPresent) {
        counter.hadir += 1;
        displayStatus = 'hadir';
      } else if (isAbsent) {
        counter.absen += 1;
        displayStatus = 'absen';
      } else {
        displayStatus = status || 'hadir';
      }

      counter.total += 1;
      const recordEntry = {
        ...item,
        displayStatus,
        userName: item.user_name || item.name || item.full_name || item.fullName || 'Unknown',
        scanTime: item.scan_time || item.attendance_time || item.created_at || item.time || item.tanggal || new Date().toISOString(),
        role: item.role || 'Unknown'
      };
      todayRecords.push(recordEntry);
      matchedRecords.push(recordEntry);
    });

    // ✅ FALLBACK: Kalau tidak ada yang match hari ini tapi ada records,
    // anggap semua records sebagai data terbaru (darurat agar stats tidak 0 terus)
    if (matchedRecords.length === 0 && records.length > 0) {
      records.forEach((item) => {
        const status = String(
          item.status || item.action || item.description ||
          item.notes || item.type || item.kehadiran || item.state || ''
        ).toLowerCase().trim();

        const isLate = item.is_late === true || item.isLate === true ||
                       item.terlambat === true ||
                       ['terlambat', 'late', 'tardy'].some((flag) => status.includes(flag));
        const isPresent = ['hadir', 'tepat_waktu', 'present', 'on_time', 'on time',
                           'hadir_tepat_waktu', 'tepat waktu'].some((flag) => status.includes(flag));
        const isAbsent = ['absen', 'absent', 'tidak hadir', 'missing', 'alpha'].some((flag) => status.includes(flag));

        let displayStatus = 'lain-lain';
        if (isLate) {
          counter.terlambat += 1;
          displayStatus = 'terlambat';
        } else if (isPresent) {
          counter.hadir += 1;
          displayStatus = 'hadir';
        } else if (isAbsent) {
          counter.absen += 1;
          displayStatus = 'absen';
        } else {
          displayStatus = status || 'hadir';
        }

        counter.total += 1;
        todayRecords.push({
          ...item,
          displayStatus,
          userName: item.user_name || item.name || item.full_name || item.fullName || 'Unknown',
          scanTime: item.scan_time || item.attendance_time || item.created_at || item.time || item.tanggal || new Date().toISOString(),
          role: item.role || 'Unknown'
        });
      });
    }

    return { counter, todayRecords };
  };

  const audioContextRef = useRef(null);

  const loadSettings = async () => {
    try {
      const res = await fetchWithRetry(() => api.get('/public/settings', { timeout: 15000 }));
      const settings = res.data?.data || res.data;

      if (!settings) return;

      const mappedSettings = {
        attendanceStartTime: settings.attendanceStartTime || settings.attendance_start_time || settings.jam_masuk || '07:00',
        attendanceEndTime: settings.attendanceEndTime || settings.attendance_end_time || settings.jam_akhir || '12:00',
        lateThreshold: settings.lateThreshold || settings.late_threshold || settings.batas_keterlambatan || '08:00',
        pulangStartTime: settings.pulangStartTime || settings.pulang_start_time || settings.jam_pulang_mulai || settings.jam_pulang || '15:00',
        pulangEndTime: settings.pulangEndTime || settings.pulang_end_time || settings.jam_pulang_akhir || '17:00',
        schoolEndTime: settings.schoolEndTime || settings.jam_pulang || '',
        schoolName: settings.schoolName || settings.nama_sekolah || '',
        schoolLogo: settings.schoolLogo || settings.logo || null,
        limitOneScanPerDay: settings.limitOneScanPerDay || false,
        disableAttendanceOnHolidays: settings.disableAttendanceOnHolidays ?? settings.disable_attendance_on_holidays ?? true,
        activeDays: settings.activeDays || settings.active_days || 'Senin,Selasa,Rabu,Kamis,Jumat,Sabtu'
      };

      setAttendanceSettings(mappedSettings);
      localStorage.setItem('school_settings', JSON.stringify(mappedSettings));
      setBackendError(null);
    } catch (err) {
      console.warn('⚠️ Gagal ambil settings dari API, menggunakan cache local');
      const savedSettings = localStorage.getItem('school_settings');
      if (savedSettings) {
        try {
          setAttendanceSettings(JSON.parse(savedSettings));
        } catch (e) {
          console.error("Error parsing cached settings", e);
        }
      }
      if (err.response?.status === 500 || err.code === 'ERR_NETWORK') {
        setBackendError('Koneksi ke server bermasalah. Pastikan database aktif.');
      }
    }
  };

  // ✅ DIPERBAIKI: Jauh lebih robust dalam menangani berbagai format response backend
  const fetchStats = async () => {
    try {
      const res = await fetchWithRetry(() => api.get('/public/stats', { timeout: 10000 }));

      if (res && res.data != null) {
        const raw = res.data;
        let statsSummary = { totalHadir: 0, keterlambatan: 0 };
        let recordsForToday = [];

        // ✅ Coba cari array records dari berbagai kemungkinan struktur response
        const dataArray = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
            ? raw.data
            : Array.isArray(raw?.records)
              ? raw.records
              : Array.isArray(raw?.data_records)
                ? raw.data_records
                : null;

        if (dataArray && dataArray.length > 0) {
          const result = countTodayAttendance(dataArray);
          statsSummary = {
            totalHadir: result.counter.hadir + result.counter.terlambat,
            keterlambatan: result.counter.terlambat
          };
          recordsForToday = result.todayRecords;
        } else {
          // ✅ Handle object response - cek nested .data dulu, lalu root
          const statsObj = (raw?.data && typeof raw.data === 'object' && !Array.isArray(raw.data))
            ? raw.data
            : raw;

          // ✅ Coba banyak kemungkinan nama field untuk hadir & terlambat
          const hadirCount = Number(
            statsObj?.total_hadir ?? statsObj?.hadir ?? statsObj?.totalHadir ??
            statsObj?.total_hadir_hari_ini ?? statsObj?.hadir_hari_ini ??
            statsObj?.present_count ?? statsObj?.on_time ?? 0
          ) || 0;

          const terlambatCount = Number(
            statsObj?.terlambat ?? statsObj?.total_terlambat ?? statsObj?.keterlambatan ??
            statsObj?.late_count ?? statsObj?.terlambat_hari_ini ??
            statsObj?.totalLate ?? statsObj?.total_late ?? 0
          ) || 0;

          statsSummary = {
            totalHadir: hadirCount + terlambatCount,
            keterlambatan: terlambatCount
          };

          // Coba ambil records dari nested structure juga
          const nestedRecords = statsObj?.records || statsObj?.data_records ||
                                raw?.records || raw?.data_records || [];
          if (Array.isArray(nestedRecords) && nestedRecords.length > 0) {
            const result = countTodayAttendance(nestedRecords);
            recordsForToday = result.todayRecords;
            // Kalau dari records ada hasilnya, pakai itu (lebih akurat)
            if (result.counter.hadir + result.counter.terlambat > 0) {
              statsSummary = {
                totalHadir: result.counter.hadir + result.counter.terlambat,
                keterlambatan: result.counter.terlambat
              };
            }
          }
        }

        setTodayAttendanceRecords(recordsForToday);
        setAttendanceStats(statsSummary);
        setBackendError(null);
      }
    } catch (err) {
      console.warn('⚠️ Gagal mengambil data statistik landing:', err.message);
      if (err.response?.status === 500) {
        setBackendError('Server sedang maintenance (Database connection error).');
      } else {
        setBackendError('Gagal memuat data statistik terbaru.');
      }
    }
  };  

  useEffect(() => {
    const initLanding = async () => {
      setIsLandingLoading(true);
      await loadSettings();
      await fetchStats();
      setIsLandingLoading(false);
    };

    initLanding();

    const syncInterval = setInterval(fetchStats, 60000);

    const handleStorageChange = (e) => {
      if (e.key === 'school_settings') {
        loadSettings();
      }
      if (e.key === 'attendance_updated') {
        fetchStats();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(syncInterval);
    };
  }, []);

  useEffect(() => {
    if (showAbsenModal && activeMethodTab === 'scan') {
      isSubmittingRef.current = false;
      lastScannedDataRef.current = null;
      const timer = setTimeout(() => startQRScanner(), 500);
      return () => {
        clearTimeout(timer);
        stopQRScanner();
      };
    } else {
      stopQRScanner();
    }
  }, [showAbsenModal, activeMethodTab]);

  const handleNavigate = (path) => {
    setIsNavigating(true);
    navigate(path);
  };

  const playSound = (type) => {
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      if (type === 'ready') {
        oscillator.frequency.setValueAtTime(880, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.08);
      } else if (type === 'success') {
        oscillator.frequency.setValueAtTime(660, ctx.currentTime);
        oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
        oscillator.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.16);
        gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.35);
      } else if (type === 'late') {
        oscillator.frequency.setValueAtTime(440, ctx.currentTime);
        oscillator.frequency.setValueAtTime(330, ctx.currentTime + 0.12);
        gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.4);
      } else if (type === 'already') {
        oscillator.frequency.setValueAtTime(220, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.22, ctx.currentTime);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.12);
      } else if (type === 'failed') {
        oscillator.frequency.setValueAtTime(220, ctx.currentTime);
        oscillator.frequency.setValueAtTime(160, ctx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.35, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.45);
      }
    } catch (err) {
      console.warn('Audio play error (ignored):', err.message);
    }
  };

  const checkIsHoliday = () => {
    if (attendanceSettings.disableAttendanceOnHolidays !== true) {
      return false;
    }

    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const currentDay = dayNames[currentTime.getDay()];
    const activeDays = attendanceSettings.activeDays
      ? attendanceSettings.activeDays.split(',').map(d => d.trim())
      : ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    return !activeDays.includes(currentDay);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      const cleanup = async () => {
        await stopQRScanner();
      };
      cleanup();
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getAttendanceStatus = (action = 'datang') => {
    const now = currentTime;
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${hours}:${minutes}`;

    const openTime = (attendanceSettings.attendanceStartTime || "07:00").substring(0, 5);
    const closeTime = (attendanceSettings.attendanceEndTime || "12:00").substring(0, 5);
    const lateTime = (attendanceSettings.lateThreshold || "08:00").substring(0, 5);
    const pulangOpenTime = (attendanceSettings.pulangStartTime || "15:00").substring(0, 5);
    const pulangCloseTime = (attendanceSettings.pulangEndTime || "16:00").substring(0, 5);

    const schoolEnd = (attendanceSettings.schoolEndTime || attendanceSettings.pulangStartTime || "15:30").substring(0, 5);

    if (checkIsHoliday()) return 'libur';
    if (action === 'pulang') {
      if (currentTimeStr < schoolEnd && currentTimeStr < pulangOpenTime) return 'belum_pulang';
      if (currentTimeStr > pulangCloseTime) return 'sudah_tutup_pulang';
      return 'pulang';
    }
    if (currentTimeStr < openTime) return 'belum_buka';
    if (currentTimeStr > closeTime) return 'sudah_tutup';

    return currentTimeStr <= lateTime ? 'hadir' : 'terlambat';
  };

  const handleTryOpenAbsen = (action = 'datang') => {
    const status = getAttendanceStatus(action);

    if (status === 'libur') {
      showSubmitNotificationMessage("❌ Hari ini adalah hari libur (sesuai pengaturan). Absensi tidak tersedia.", "error");
      return;
    }
    if (action === 'datang') {
      if (status === 'belum_buka') {
        showSubmitNotificationMessage(`❌ Absensi belum dibuka. Silakan kembali pada jam ${attendanceSettings.attendanceStartTime}.`, "warning");
        return;
      }
      if (status === 'sudah_tutup') {
        showSubmitNotificationMessage(`❌ Absensi sudah ditutup pada jam ${attendanceSettings.attendanceEndTime}.`, "error");
        return;
      }
    }
    if (action === 'pulang' && status === 'belum_pulang') {
      showSubmitNotificationMessage(`❌ Belum jam pulang. Silakan kembali pada jam ${attendanceSettings.pulangStartTime || attendanceSettings.schoolEndTime}.`, "warning");
      return;
    }
    if (action === 'pulang' && status === 'sudah_tutup_pulang') {
      showSubmitNotificationMessage(`❌ Absensi pulang sudah ditutup pada jam ${attendanceSettings.pulangEndTime || attendanceSettings.schoolEndTime}.`, "error");
      return;
    }

    setActiveAttendanceAction(action);
    setShowAbsenModal(true);
  };

  // ✅ Helper: Refresh stats dengan delay untuk hindari race condition
  const refreshStatsAfterSubmit = async () => {
    localStorage.setItem('attendance_updated', Date.now().toString());
    // Tunggu sebentar agar backend selesai insert data
    await new Promise(resolve => setTimeout(resolve, 800));
    await fetchStats();
    // Refresh sekali lagi setelah 2 detik untuk memastikan data terbaru
    setTimeout(() => fetchStats(), 2000);
  };

  const handleStudentSubmit = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitMessage({ type: '', text: '' });
    try {
      if (checkIsHoliday()) {
        setSubmitMessage({ type: 'error', text: '❌ Hari ini libur. Absensi ditiadakan.' });
        return;
      }

      const status = getAttendanceStatus(activeAttendanceAction);

      if (activeAttendanceAction === 'datang') {
        if (status === 'belum_buka') {
          const msg = `❌ Absen belum dibuka! Silakan absen mulai jam ${attendanceSettings.attendanceStartTime}`;
          showSubmitNotificationMessage(msg, 'error');
          setSubmitMessage({ type: 'error', text: msg });
          return;
        }
        if (status === 'sudah_tutup') {
          const msg = `❌ Absen sudah ditutup! Batas akhir jam ${attendanceSettings.attendanceEndTime}`;
          showSubmitNotificationMessage(msg, 'error');
          setSubmitMessage({ type: 'error', text: msg });
          return;
        }
      }
      if (activeAttendanceAction === 'pulang' && status === 'belum_pulang') {
        const msg = `❌ Belum jam pulang! Silakan kembali pada jam ${attendanceSettings.pulangStartTime || attendanceSettings.schoolEndTime}`;
        showSubmitNotificationMessage(msg, 'warning');
        setSubmitMessage({ type: 'error', text: msg });
        return;
      }
      if (activeAttendanceAction === 'pulang' && status === 'sudah_tutup_pulang') {
        const msg = `❌ Absensi pulang sudah ditutup! Batas akhir jam ${attendanceSettings.pulangEndTime || attendanceSettings.schoolEndTime}`;
        showSubmitNotificationMessage(msg, 'error');
        setSubmitMessage({ type: 'error', text: msg });
        return;
      }

      const payload = {
        name: studentForm.fullName.trim(),
        user_id: studentForm.user_id.trim(),
        nis: studentForm.user_id.trim(),
        attendance_time: getLocalTimestamp(currentTime),
        scan_time: getLocalTimestamp(currentTime),
        status: activeAttendanceAction === 'pulang' ? 'hadir' : status,
        role: 'siswa',
        type: activeAttendanceAction === 'pulang' ? 'pulang' : 'manual',
        action: activeAttendanceAction
      };

      // Gunakan axios mentah untuk menghindari interceptor redirect ke login admin
      const baseUrl = api.defaults.baseURL || 'http://127.0.0.1:8000/api';
      await axios.post(`${baseUrl}/siswa/attendance/scan`, payload, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      });

      const statusText = activeAttendanceAction === 'pulang'
        ? '✅ Pulang tercatat'
        : status === 'hadir' ? '✅ Tepat Waktu' : '⚠️ Terlambat';
      const successMsg = `Absensi siswa berhasil! ${statusText}`;
      showSubmitNotificationMessage(successMsg, 'success');
      setSubmitMessage({ type: 'success', text: successMsg });

      if (activeAttendanceAction === 'pulang') playSound('success');
      else if (status === 'hadir') playSound('success');
      else playSound('late');

      setStudentForm({ user_id: '', fullName: '' });
      await refreshStatsAfterSubmit();

      setTimeout(() => {
        setShowAbsenModal(false);
        setSubmitMessage({ type: '', text: '' });
      }, 2000);
    } catch (err) {
      const responseData = err.response?.data;
      console.error('Student Attendance Error:', responseData || err);

      let errorMsg = responseData?.message || 'Gagal menyimpan absensi';

      if (err.code === 'ECONNABORTED' || err.message.includes('timeout') || err.message.includes('exceeded')) {
        errorMsg = 'Koneksi Timeout (60 detik). Cloudflare Tunnel lambat atau sudah mati. Mohon perbarui link di file .env dan jalankan ulang tunnel!';
      }

      if (!err.response && (err.code === 'ERR_NETWORK' || err.message.includes('Network Error'))) {
        errorMsg = 'Server tidak terjangkau. Link Cloudflare Tunnel Anda mungkin sudah expired (Mati). Mohon update file .env dengan link baru dan restart terminal.';
      }

      if (responseData?.errors) {
        errorMsg = Object.entries(responseData.errors)
          .map(([key, value]) => {
            const fieldName = key === 'user_id' || key === 'nis' ? 'NIS' : key;
            return `• ${fieldName}: ${Array.isArray(value) ? value[0] : value}`;
          })
          .join('\n');
      }

      showSubmitNotificationMessage(`❌ Gagal: ${errorMsg}`, 'error');
      setSubmitMessage({ type: 'error', text: '❌ Gagal: ' + errorMsg });
      playSound('failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTeacherSubmit = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitMessage({ type: '', text: '' });
    try {
      if (checkIsHoliday()) {
        setSubmitMessage({ type: 'error', text: '❌ Hari ini libur. Absensi ditiadakan.' });
        return;
      }

      const status = getAttendanceStatus(activeAttendanceAction);

      if (activeAttendanceAction === 'datang') {
        if (status === 'belum_buka') {
          const msg = `❌ Absen belum dibuka! Silakan absen mulai jam ${attendanceSettings.attendanceStartTime}`;
          showSubmitNotificationMessage(msg, 'error');
          setSubmitMessage({ type: 'error', text: msg });
          return;
        }
        if (status === 'sudah_tutup') {
          const msg = `❌ Absen sudah ditutup! Batas akhir jam ${attendanceSettings.attendanceEndTime}`;
          showSubmitNotificationMessage(msg, 'error');
          setSubmitMessage({ type: 'error', text: msg });
          return;
        }
      }
      if (activeAttendanceAction === 'pulang' && status === 'belum_pulang') {
        const msg = `❌ Belum jam pulang! Silakan kembali pada jam ${attendanceSettings.pulangStartTime || attendanceSettings.schoolEndTime}`;
        showSubmitNotificationMessage(msg, 'warning');
        setSubmitMessage({ type: 'error', text: msg });
        return;
      }
      if (activeAttendanceAction === 'pulang' && status === 'sudah_tutup_pulang') {
        const msg = `❌ Absensi pulang sudah ditutup! Batas akhir jam ${attendanceSettings.pulangEndTime || attendanceSettings.schoolEndTime}`;
        showSubmitNotificationMessage(msg, 'error');
        setSubmitMessage({ type: 'error', text: msg });
        return;
      }

      const payload = {
        name: teacherForm.fullName.trim(),
        full_name: teacherForm.fullName.trim(),
        user_id: teacherForm.nip.trim(),
        nis: teacherForm.nip.trim(),
        nip: teacherForm.nip.trim(),
        teacher_id: teacherForm.nip.trim(),
        student_id: teacherForm.nip.trim(),
        attendance_time: getLocalTimestamp(currentTime),
        scan_time: getLocalTimestamp(currentTime),
        status: activeAttendanceAction === 'pulang' ? 'hadir' : status,
        role: 'guru',
        type: activeAttendanceAction === 'pulang' ? 'pulang' : 'manual',
        action: activeAttendanceAction
      };

      // Gunakan axios mentah untuk menghindari interceptor redirect ke login admin
      const baseUrl = api.defaults.baseURL || 'http://127.0.0.1:8000/api';
      await axios.post(`${baseUrl}/attendance/teacher/manual`, payload, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      });

      const statusText = activeAttendanceAction === 'pulang'
        ? '✅ Pulang tercatat'
        : status === 'hadir' ? '✅ Tepat Waktu' : '⚠️ Terlambat';
      const successMsg = `Absensi guru berhasil! ${statusText}`;
      showSubmitNotificationMessage(successMsg, 'success');
      setSubmitMessage({ type: 'success', text: successMsg });

      if (activeAttendanceAction === 'pulang') playSound('success');
      else if (status === 'hadir') playSound('success');
      else playSound('late');

      setTeacherForm({ nip: '', fullName: '' });
      await refreshStatsAfterSubmit();
    } catch (err) {
      const responseData = err.response?.data;
      console.error('Teacher Attendance Error:', responseData || err);

      let errorMsg = responseData?.message || err.message || 'Gagal menyimpan absensi';

      if (err.code === 'ECONNABORTED' || err.message.includes('timeout') || err.message.includes('exceeded')) {
        errorMsg = 'Koneksi Timeout (60 detik). Cloudflare Tunnel lambat atau sudah mati. Mohon perbarui link di file .env dan jalankan ulang tunnel!';
      }

      if (!err.response && (err.code === 'ERR_NETWORK' || err.message.includes('Network Error'))) {
        errorMsg = 'Server tidak terjangkau. Periksa apakah Cloudflare Tunnel masih aktif.';
      }

      if (responseData?.errors) {
        errorMsg = Object.entries(responseData.errors)
          .map(([key, value]) => {
            const fieldName = key === 'user_id' || key === 'nip' || key === 'teacher_id' ? 'NIP' : key;
            return `• ${fieldName}: ${Array.isArray(value) ? value[0] : value}`;
          })
          .join('\n');
      }

      showSubmitNotificationMessage(`❌ Gagal: ${errorMsg}`, 'error');
      setSubmitMessage({ type: 'error', text: '❌ Gagal: ' + errorMsg });
      playSound('failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleIzinSubmit = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitMessage({ type: '', text: '' });
    try {
      if (checkIsHoliday()) {
        setSubmitMessage({ type: 'error', text: '❌ Tidak dapat mengirim izin pada hari libur.' });
        return;
      }

      const token = localStorage.getItem('token');

      if (!izinForm.user_id.trim()) {
        setSubmitMessage({ type: 'error', text: '❌ NIS/NIP harus diisi!' });
        return;
      }

      const payload = {
        name: izinForm.fullName.trim(),
        full_name: izinForm.fullName.trim(),
        type: 'manual',
        approval_status: 'pending',
        is_pending: true,
        pending: true,
        reason: izinForm.reason,
        notes: izinForm.reason,
        keterangan: izinForm.reason,
        attendance_time: getLocalTimestamp(currentTime),
        scan_time: getLocalTimestamp(currentTime),
        date: getJakartaDateKey(currentTime),
        status: izinForm.type,
        role: activeUserRole === 'guru' ? 'guru' : 'siswa'
      };
      if (activeUserRole === 'siswa') {
        payload.user_id = izinForm.user_id.trim();
        payload.nis = izinForm.user_id.trim();
        payload.student_id = izinForm.user_id.trim();
        payload.parent_phone = izinForm.parent_phone.trim();
      } else if (activeUserRole === 'guru') {
        payload.user_id = izinForm.user_id.trim();
        payload.nip = izinForm.user_id.trim();
        payload.teacher_id = izinForm.user_id.trim();
      }

      if (izinForm.attachment) {
        const formData = new FormData();
        Object.keys(payload).forEach(key => formData.append(key, payload[key]));
        formData.append('attachment', izinForm.attachment);

        const baseUrl = api.defaults.baseURL || 'http://127.0.0.1:8000/api';
        await axios.post(`${baseUrl}/attendance/izin`, formData, {
          timeout: 30000,
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        });
      } else {
        const baseUrl = api.defaults.baseURL || 'http://127.0.0.1:8000/api';
        await axios.post(`${baseUrl}/attendance/izin`, payload, {
          timeout: 60000,
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
      }

      showSubmitNotificationMessage(`✅ Pengajuan ${izinForm.type} berhasil dikirim!`, 'success');
      setSubmitMessage({ type: 'success', text: `✅ Pengajuan ${izinForm.type} berhasil dikirim!` });
      playSound('success');

      setIzinForm({ fullName: '', user_id: '', type: 'izin', reason: '', attachment: null, parent_phone: '' });
      await refreshStatsAfterSubmit();

      setTimeout(() => {
        setShowAbsenModal(false);
        setSubmitMessage({ type: '', text: '' });
      }, 2000);
    } catch (err) {
      if (err.response?.status !== 401 && err.code !== 'ERR_NETWORK') {
        console.error('Error submitting izin:', err);
      }
      const errorMsg = err.response?.data?.message || err.message || 'Gagal mengirim pengajuan izin';
      showSubmitNotificationMessage(`❌ Gagal: ${errorMsg}`, 'error');
      setSubmitMessage({ type: 'error', text: '❌ Gagal: ' + errorMsg });
      playSound('failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQRScan = async (decodedText) => {
    try {
      const now = Date.now();
      if (decodedText === lastScannedDataRef.current && now - lastScannedAtRef.current < 2500) {
        return;
      }
      lastScannedDataRef.current = decodedText;
      lastScannedAtRef.current = now;

      const qrData = JSON.parse(decodedText);
      setQrResult(qrData);

      const validTypes = ['attendance_session', 'student_qr', 'teacher_qr'];
      if (qrData.type && !validTypes.includes(qrData.type)) {
        playSound('failed');
        showQRNotificationMessage('❌ QR Code tidak valid untuk absensi!', 'error');
        return;
      }

      if (!qrData.id && !qrData.student_id && !qrData.teacher_id && !qrData.user_id && !qrData.nis && !qrData.nip) {
        playSound('failed');
        showQRNotificationMessage('❌ QR Code tidak memiliki ID yang valid!', 'error');
        return;
      }

      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;

      setShowSubmitNotification(false);
      setSubmitNotificationType('error');
      setSubmitNotificationMessage('');

      await stopQRScanner();
      await submitQRAttendance(qrData);
    } catch (err) {
      console.error('QR Parse Error:', err);
      playSound('failed');
      showQRNotificationMessage('❌ Format QR Code tidak dikenali!', 'error');
    } finally {
      if (!isSubmittingRef.current) {
        isSubmittingRef.current = false;
      }
    }
  };

  const submitQRAttendance = async (qrData) => {
    if (isSubmittingRef.current) return;
    const token = localStorage.getItem('token');
    setIsSubmitting(true);
    isSubmittingRef.current = true;
    try {
      if (checkIsHoliday()) {
        showQRNotificationMessage('❌ Hari ini libur. Absensi ditiadakan.', 'error');
        return;
      }

      const status = getAttendanceStatus(activeAttendanceAction);
      if (activeAttendanceAction === 'pulang' && status === 'belum_pulang') {
        showQRNotificationMessage(`❌ Belum jam pulang! Silakan kembali pada jam ${attendanceSettings.pulangStartTime || attendanceSettings.schoolEndTime}`, 'warning');
        return;
      }
      if (activeAttendanceAction === 'pulang' && status === 'sudah_tutup_pulang') {
        showQRNotificationMessage(`❌ Absensi pulang sudah ditutup pada jam ${attendanceSettings.pulangEndTime || attendanceSettings.schoolEndTime}`, 'error');
        return;
      }

      const requestData = {
        qr_data: qrData,
        scan_time: getLocalTimestamp(currentTime),
        status: activeAttendanceAction === 'pulang' ? 'hadir' : status,
        type: activeAttendanceAction === 'pulang' ? 'pulang' : (qrData.type || (activeUserRole === 'guru' ? 'teacher_qr' : 'student_qr')),
        user_id: qrData.user_id || qrData.nis || qrData.nip || qrData.id || qrData.student_id || qrData.teacher_id || '',
        student_id: qrData.student_id || qrData.nis || qrData.id || '',
        teacher_id: qrData.teacher_id || qrData.nip || qrData.id || '',
        name: qrData.name || qrData.nama || qrData.full_name || '',
        role: qrData.role || activeUserRole,
        action: activeAttendanceAction
      };

      const endpoint = requestData.role === 'guru' ? '/attendance/teacher/manual' : '/siswa/attendance/scan';

      const baseUrl = api.defaults.baseURL || 'http://127.0.0.1:8000/api';
      const response = await axios.post(`${baseUrl}${endpoint}`, requestData, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      if (response.data.already_absent) {
        playSound('already');
        setShowQRNotification(false);
        showQRNotificationMessage('⚠️ Anda sudah absen hari ini!', 'warning');
        showSubmitNotificationMessage('⚠️ Anda sudah absen hari ini!', 'warning');
        await stopQRScanner();
        setQrResult(null);
        return;
      }

      const statusText = activeAttendanceAction === 'pulang'
        ? '✅ Pulang tercatat'
        : status === 'hadir' ? '✅ Tepat Waktu' : '⚠️ Terlambat';
      playSound('success');
      showQRNotificationMessage(`Absensi via QR berhasil! ${statusText}`, 'success');
      showSubmitNotificationMessage(`Absensi via QR berhasil! ${statusText}`, 'success');
      setSubmitMessage({ type: 'success', text: `✅ Absensi via QR berhasil! ${statusText}` });

      handleCloseScanner();
      setQrResult(null);
      await refreshStatsAfterSubmit();

      setTimeout(() => {
        setShowAbsenModal(false);
        setSubmitMessage({ type: '', text: '' });
      }, 2000);
    } catch (err) {
      const status = err.response?.status;
      const backendMessage = err.response?.data?.message;

      if (status === 400 && backendMessage && backendMessage.toLowerCase().includes('sudah absen')) {
        playSound('already');
        showQRNotificationMessage(`⚠️ ${backendMessage}`, 'warning');
        showSubmitNotificationMessage(`⚠️ ${backendMessage}`, 'warning');
        setSubmitMessage({ type: 'warning', text: `⚠️ ${backendMessage}` });
        await stopQRScanner();
        setQrResult(null);
        return;
      }

      if (status !== 401 && err.code !== 'ERR_NETWORK') {
        console.error('❌ QR Submit Error:', err);
      }

      const errorMsg = backendMessage || err.response?.data?.error || 'Gagal menyimpan absensi';
      playSound('failed');
      showQRNotificationMessage(`❌ ${errorMsg}`, 'error');
      showSubmitNotificationMessage(`❌ ${errorMsg}`, 'error');
      setSubmitMessage({ type: 'error', text: '❌ Gagal: ' + errorMsg });
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const startQRScanner = async (mode = facingMode) => {
    try {
      setIsCameraStarting(true);
      setCameraError('');
      const readerElement = document.getElementById(
        showStandaloneQRScanner ? 'qr-reader-standalone' : 'qr-reader-main'
      );
      if (!readerElement) {
        console.warn('QR reader element not found yet...');
        return;
      }
      if (qrScanner) return;

      const scanner = new Html5Qrcode(
        showStandaloneQRScanner ? 'qr-reader-standalone' : 'qr-reader-main'
      );
      setQrScanner(scanner);

      await scanner.start(
        { facingMode: mode },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1.0
        },
        (decodedText) => handleQRScan(decodedText),
        () => {}
      );
      setIsCameraStarting(false);
    } catch (err) {
      console.error('Failed to start QR scanner:', err);
      setCameraError('Tidak dapat mengakses kamera. Pastikan izin kamera diberikan.');
      setIsCameraStarting(false);
      showQRNotificationMessage('Gagal memulai scanner. Silakan coba lagi.', 'error');
    }
  };

  const toggleCamera = async () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    await stopQRScanner();
    setTimeout(() => startQRScanner(newMode), 300);
  };

  const stopQRScanner = async () => {
    const scanner = qrScanner;
    if (scanner) {
      setQrScanner(null);
      setIsCameraStarting(false);
      try {
        if (scanner.isScanning) await scanner.stop();
        await scanner.clear();
      } catch (err) {
        console.warn('QR scanner stop warning:', err.message);
      }
    }
  };

  const showQRNotificationMessage = (message, type = 'error') => {
    setQrNotificationMessage(message);
    setQrNotificationType(type);
    setShowQRNotification(true);
    setTimeout(() => setShowQRNotification(false), 3000);
  };

  const showSubmitNotificationMessage = (message, type = 'error') => {
    setSubmitNotificationMessage(message);
    setSubmitNotificationType(type);
    setShowSubmitNotification(true);
    setTimeout(() => setShowSubmitNotification(false), 3000);
  };

  const handleOpenScanner = () => {
    setShowQRScanner(true);
    setCameraError('');
    setTimeout(() => startQRScanner(), 300);
  };

  const handleCloseScanner = async () => {
    await stopQRScanner();
    setShowQRScanner(false);
    setQrResult(null);
    setCameraError('');
  };

  const handleOpenStandaloneQRScanner = async () => {
    setShowStandaloneQRScanner(true);
    setShowQRScanner(true);
    setCameraError('');
    setTimeout(() => startQRScanner(), 400);
  };

  const handleCloseStandaloneQRScanner = async () => {
    await stopQRScanner();
    setShowStandaloneQRScanner(false);
    setShowQRScanner(false);
    setQrResult(null);
    setCameraError('');
  };

  const formatTime = (date) => {
    const options = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    return new Intl.DateTimeFormat('id-ID', options).format(date);
  };

  const formatDate = (date) => {
    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return new Intl.DateTimeFormat('id-ID', options).format(date);
  };

  const formatTimeShort = (date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const formatDateShort = (date) => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const isPageLoading = (isLandingLoading || loadingProgress < 100) || isNavigating;

  if (isPageLoading && !isNavigating) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white dark:bg-slate-900 transition-colors duration-500 px-6">
        <div className="w-full max-w-[280px] sm:max-w-xs">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/20 animate-bounce">
              <span className="text-3xl">⚡</span>
            </div>
          </div>
          <div className="relative h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-4">
            <div
              className="absolute top-0 left-0 h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
          <div className="flex justify-between items-center px-1">
            <div>
              <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest opacity-80">Loading</h2>
              <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-tighter">Synchronizing...</p>
            </div>
            <span className="text-2xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">{loadingProgress}%</span>
          </div>
        </div>
      </div>
    );
  }
  //Mobile Layout
  const MobileLayout = () => (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 pb-28">
      {/* Header */}
      <div className="bg-blue-600 dark:bg-gradient-to-br dark:from-blue-600 dark:via-blue-700 dark:to-indigo-900 px-4 pt-12 pb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              {attendanceSettings.schoolLogo && !logoError ? (
                <img
                  src={resolvePhotoUrl(attendanceSettings.schoolLogo)}
                  alt="Logo"
                  className="w-10 h-10 object-contain rounded-full"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              )}
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">{attendanceSettings.schoolName || 'AbsensiPro'}</h1>
              <p className="text-blue-100 text-xs">Mobile Presence</p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 transition-all"
            aria-label="Toggle tema"
          >
            <span>{theme === 'dark' ? '🌙' : '☀️'}</span>
            <span className="hidden sm:inline">{theme === 'dark' ? 'Gelap' : 'Terang'}</span>
          </button>
        </div>

        <div className="text-center py-6">
          <p className="text-blue-200 text-sm mb-1">Halo, Selamat Datang!</p>
          <h2 className="text-white text-2xl font-bold mb-2">{attendanceSettings.schoolName || 'Sistem Absensi'}</h2>
          <p className="text-blue-100 text-xs">Gunakan sistem absensi ini untuk memonitor kehadiran</p>
        </div>

        {/* Welcome Illustration - Restored */}
        <div className="flex justify-center items-end gap-2 h-32 mb-4">
          <div className="w-20 h-24 bg-gradient-to-t from-pink-500 to-red-400 rounded-t-3xl flex items-center justify-center">
            <div className="text-white text-4xl">👨</div>
          </div>
          <div className="w-16 h-16 bg-gradient-to-t from-blue-500 to-cyan-400 rounded-t-3xl flex items-center justify-center -mb-2">
            <div className="text-white text-3xl">👩</div>
          </div>
        </div>
      </div>

      {/* Main Content - adapts to light/dark theme */}
      <div className="bg-white dark:bg-slate-950 rounded-t-3xl -mt-6 min-h-screen px-4 pt-6">
        {/* Quick Actions Grid */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <button
            onClick={() => { setActiveMethodTab('scan'); setShowAbsenModal(true); }}
            className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-blue-50 hover:bg-blue-100 transition dark:bg-slate-800 dark:text-white"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-slate-700 text-center">Scan QR</span>
          </button>

          <button
            onClick={() => { setActiveMethodTab('manual'); setActiveUserRole('siswa'); setShowAbsenModal(true); }}
            className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 transition dark:bg-slate-800 dark:text-white"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-slate-700 text-center">Siswa</span>
          </button>

          <button
            onClick={() => { setActiveMethodTab('manual'); setActiveUserRole('guru'); setShowAbsenModal(true); }}
            className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-purple-50 hover:bg-purple-100 transition dark:bg-slate-800 dark:text-white"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-slate-700 text-center">Guru</span>
          </button>

          <button
            onClick={() => { setActiveMethodTab('izin'); setShowAbsenModal(true); }}
            className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-orange-50 hover:bg-orange-100 transition dark:bg-slate-800 dark:text-white"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-slate-700 text-center">Izin</span>
          </button>
        </div>

        {/* Stats Section */}
        <div className="mb-8">
          <h3 className="text-slate-900 font-black mb-4 text-xs uppercase tracking-widest">Catatan Kehadiran</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50 dark:bg-slate-900 rounded-2xl p-4 border border-emerald-100 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-xs text-emerald-700 font-medium">Hadir</span>
              </div>
              <p className="text-2xl font-bold text-emerald-700">{attendanceStats.totalHadir}</p>
              <p className="text-xs text-emerald-600 mt-1">Orang</p>
            </div>

            <div className="bg-orange-50 dark:bg-slate-900 rounded-2xl p-4 border border-orange-100 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-xs text-orange-700 font-medium">Terlambat</span>
              </div>
              <p className="text-2xl font-bold text-orange-700">{attendanceStats.keterlambatan}</p>
              <p className="text-xs text-orange-600 mt-1">Orang</p>
            </div>
          </div>
        </div>

        {/* Time Info */}
        <div className="bg-slate-50 dark:bg-slate-900 rounded-[24px] p-6 mb-8 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Waktu Sekarang</span>
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{formatTimeShort(currentTime)}</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Datang Dibuka</span>
              <span className="font-semibold text-slate-800">{attendanceSettings.attendanceStartTime}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Datang Ditutup</span>
              <span className="font-semibold text-slate-800">{attendanceSettings.attendanceEndTime}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Pulang Dibuka</span>
              <span className="font-semibold text-slate-800">{attendanceSettings.pulangStartTime}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Pulang Ditutup</span>
              <span className="font-semibold text-slate-800">{attendanceSettings.pulangEndTime}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 mb-10">
          <button
            onClick={() => handleNavigate('/login')}
            className="w-full bg-slate-900 text-white py-3.5 rounded-2xl font-semibold text-sm hover:bg-slate-800 transition shadow-lg"
          >
            Login
          </button>
          <button
            onClick={() => handleNavigate('/register')}
            className="w-full bg-blue-100 text-blue-700 py-3.5 rounded-2xl font-semibold text-sm hover:bg-slate-800 transition"
          >
            Register
          </button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-40 dark:bg-slate-900 dark:border-slate-800">
        <button className="flex flex-col items-center gap-1 text-blue-600">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-[10px] font-medium">Home</span>
        </button>

        <button
          onClick={() => setShowAttendanceListModal(true)}
          className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="text-[10px] font-medium">Absensi</span>
        </button>

        <button
          onClick={() => { setActiveMethodTab('scan'); setShowAbsenModal(true); }}
          className="flex flex-col items-center -mt-8"
        >
          <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center shadow-lg border-4 border-white">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
        </button>

        <button
          onClick={() => {
            setSubmitLandingNotificationMessage(`🔔 Info Kehadiran Hari Ini:\n- Total Hadir: ${attendanceStats.totalHadir}\n- Terlambat: ${attendanceStats.keterlambatan}\n\nData diperbarui secara real-time.`);
            setShowLandingNotification(true);
          }}
          className={`flex flex-col items-center gap-1 transition-colors ${showLandingNotification ? 'text-blue-600' : 'text-slate-400'}`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="text-[10px] font-medium">Notif</span>
        </button>

        <button
          onClick={() => handleNavigate('/login')}
          className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-[10px] font-medium">Akun</span>
        </button>
      </div>
    </div>
  );

  // Desktop/Laptop Layout
  const DesktopLayout = () => (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Top Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white shadow-md dark:bg-slate-900 dark:shadow-slate-950/20' : 'bg-white dark:bg-slate-900'}`}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
                {attendanceSettings.schoolLogo && !logoError ? (
                  <img
                    src={resolvePhotoUrl(attendanceSettings.schoolLogo)}
                    alt="Logo"
                    className="w-10 h-10 object-contain rounded-full"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">{attendanceSettings.schoolName || 'AbsensiPro'}</h1>
                <p className="text-xs text-slate-500">Sistem Absensi Digital</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-all"
                aria-label="Toggle tema"
              >
                <span>{theme === 'dark' ? '🌙' : '☀️'}</span>
                <span className="hidden sm:inline">{theme === 'dark' ? 'Gelap' : 'Terang'}</span>
              </button>
              <button
                onClick={() => handleNavigate('/register')}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
              >
                Register
              </button>
              <button
                onClick={() => handleNavigate('/login')}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
              >
                Login
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-24 pb-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8">

            {/* Left Column - Welcome & Quick Actions */}
            <div className="space-y-6">
              {/* Welcome Card */}
              <div className="bg-blue-600 dark:bg-gradient-to-br dark:from-blue-600 dark:via-blue-700 dark:to-indigo-900 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 dark:bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/20 rounded-full -ml-24 -mb-24 blur-2xl"></div>

                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-blue-100">Live System</span>
                  </div>

                  <h2 className="text-3xl font-bold mb-3 text-white">Halo, Selamat Datang!</h2>
                  <p className="text-blue-100 mb-8 leading-relaxed">Gunakan sistem absensi digital ini untuk memonitor kehadiran siswa dan guru dengan lebih mudah dan efisien.</p>
                  {/* Illustration */}
                  <div className="flex justify-center items-end gap-4 h-40 mb-8">
                    <div className="w-28 h-32 bg-gradient-to-t from-pink-500 to-red-400 rounded-t-3xl flex items-center justify-center shadow-xl">
                      <div className="text-white text-5xl">👨</div>
                    </div>
                    <div className="w-24 h-24 bg-gradient-to-t from-blue-500 to-cyan-400 rounded-t-3xl flex items-center justify-center shadow-xl -mb-4">
                      <div className="text-white text-4xl">👩</div>
                    </div>
                  </div>

        {/* Server Error Warning */}
        {backendStatus && (
          <div className="mx-4 mb-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-2xl flex items-center gap-2 animate-pulse">
            <span className="text-lg">⚠️</span>
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-tight">Koneksi Server</p>
              <p className="text-[10px] opacity-80">{backendStatus}</p>
            </div>
          </div>
        )}

                  {/* Quick Action Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => { setActiveMethodTab('scan'); setShowAbsenModal(true); }}
                      className="bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-2xl p-4 text-left transition-all group dark:bg-slate-800 dark:text-white"
                    >
                      <div className="w-12 h-12 bg-white/30 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                      </div>
                      <span className="font-semibold text-sm">Scan QR Code</span>
                    </button>

                    <button
                      onClick={() => { setActiveMethodTab('manual'); setActiveUserRole('siswa'); setShowAbsenModal(true); }}
                      className="bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-2xl p-4 text-left transition-all group dark:bg-slate-800 dark:text-white"
                    >
                      <div className="w-12 h-12 bg-white/30 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <span className="font-semibold text-sm">Absen Manual</span>
                    </button>

                    <button
                      onClick={() => { setActiveMethodTab('izin'); setShowAbsenModal(true); }}
                      className="bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-2xl p-4 text-left transition-all group dark:bg-slate-800 dark:text-white"
                    >
                      <div className="w-12 h-12 bg-white/30 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <span className="font-semibold text-sm">Izin/Sakit</span>
                    </button>

                    <button
                      onClick={() => handleNavigate('/login')}
                      className="bg-white hover:bg-slate-50 rounded-2xl p-4 text-left transition-all group dark:bg-slate-900 dark:text-white"
                    >
                      <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                      </div>
                      <span className="font-semibold text-sm text-slate-900">Login Akun</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-sm text-slate-600 font-medium">Total Hadir</span>
                  </div>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{attendanceStats.totalHadir}</p>
                  <p className="text-xs text-slate-500 mt-1">Hari ini</p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-sm text-slate-600 font-medium">Terlambat</span>
                  </div>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{attendanceStats.keterlambatan}</p>
                  <p className="text-xs text-slate-500 mt-1">Hari ini</p>
                </div>
              </div>
            </div>

            {/* Right Column - Info & Details */}
            <div className="space-y-6">
              {/* Main Balance Card */}
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-blue-200 text-sm mb-1">Statistik Kehadiran</p>
                    <h3 className="text-4xl font-bold">{attendanceStats.totalHadir} Hadir</h3>
                  </div>
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleTryOpenAbsen('datang')}
                    className="bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-xl py-3 text-sm font-semibold transition"
                  >
                    Absen Datang
                  </button>
                  <button
                    onClick={() => handleTryOpenAbsen('pulang')}
                    className="bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-xl py-3 text-sm font-semibold transition"
                  >
                    Absen Pulang
                  </button>
                </div>
              </div>

              {/* Time Info Card */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-slate-900 text-lg">Jam Operasional</h3>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      <span className="text-sm text-slate-600">Absen Dibuka</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{attendanceSettings.attendanceStartTime} WIB</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-sm text-slate-600">Absen Ditutup</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{attendanceSettings.attendanceEndTime} WIB</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-sm text-slate-600">Batas Terlambat</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{attendanceSettings.lateThreshold} WIB</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                      <span className="text-sm text-slate-600">Jam Pulang</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{attendanceSettings.schoolEndTime} WIB</span>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Waktu Sekarang</span>
                    <span className="text-lg font-bold text-blue-600">{formatTimeShort(currentTime)}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{formatDateShort(currentTime)}</p>
                </div>
              </div>

              {/* CTA Card */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-xl">
                <h3 className="text-xl font-bold mb-2">Siap untuk Absen?</h3>
                <p className="text-slate-300 text-sm mb-4">Mulai absen sekarang dan jadilah bagian dari sekolah digital.</p>
                <button
                  onClick={() => { setActiveMethodTab('scan'); setShowAbsenModal(true); }}
                  className="w-full bg-white text-slate-900 py-3 rounded-xl font-semibold hover:bg-slate-100 transition flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  Mulai Absensi
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-6">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              {attendanceSettings.schoolLogo && !logoError ? (
                <img
                  src={resolvePhotoUrl(attendanceSettings.schoolLogo)}
                  alt="Logo"
                  className="w-6 h-6 object-contain rounded-full"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <svg className="w-5 h-5 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              )}
            </div>
            <span className="font-bold text-white">{attendanceSettings.schoolName || 'AbsensiPro'}</span>
          </div>
          <p className="text-xs">© 2026 {attendanceSettings.schoolName || 'AbsensiPro'}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );

  return (
    <div className={`font-sans ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Responsive: Mobile untuk layar < 1024px, Desktop untuk >= 1024px */}
      <div className="lg:hidden">
        <MobileLayout />
      </div>
      <div className="hidden lg:block">
        <DesktopLayout />
      </div>

      {/* ========== NOTIFICATIONS ========== */}
      {[
        { show: showQRNotification, message: qrNotificationMessage, type: qrNotificationType, onClose: () => setShowQRNotification(false) },
        { show: showSubmitNotification, message: submitNotificationMessage, type: submitNotificationType, onClose: () => setShowSubmitNotification(false) },
        { show: showLandingNotification, message: showLandingNotification ? landingNotificationMessage : '', type: 'info', onClose: () => setShowLandingNotification(false) }
      ].map((notif, idx) => notif.show && (
        <div key={idx} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className={`bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full transform transition-all animate-fade-in border-t-4 ${
            notif.type === 'success' ? 'border-emerald-500' : notif.type === 'warning' ? 'border-amber-500' : notif.type === 'info' ? 'border-blue-500' : 'border-red-500'
          }`}>
            <div className="text-center">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                notif.type === 'success' ? 'bg-emerald-50' : notif.type === 'warning' ? 'bg-amber-50' : notif.type === 'info' ? 'bg-blue-50' : 'bg-red-50'
              }`}>
                {notif.type === 'success' || notif.type === 'info' ? (
                  <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={notif.type === 'success' ? "M5 13l4 4L19 7" : "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"} />
                  </svg>
                ) : notif.type === 'warning' ? (
                  <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${
                notif.type === 'success' ? 'text-emerald-700' : notif.type === 'warning' ? 'text-amber-700' : notif.type === 'info' ? 'text-blue-700' : 'text-red-700'
              }`}>
                {notif.type === 'success' ? 'Berhasil!' : notif.type === 'warning' ? 'Perhatian' : notif.type === 'info' ? 'Informasi' : 'Terjadi Kesalahan'}
              </h3>
              <p className="text-slate-600 mb-5 text-sm whitespace-pre-line">{notif.message}</p>
              <button
                onClick={notif.onClose}
                className={`px-5 py-2 rounded-lg font-medium transition-all text-sm ${
                  notif.type === 'success' || notif.type === 'info'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : notif.type === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* ========== ABSEN MODAL ========== */}
      {showAbsenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-md my-auto shadow-2xl relative overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
              <div>
                <h3 className="text-base font-semibold text-slate-800">Absensi</h3>
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Metode: {activeMethodTab}</p>
              </div>
              <button
                onClick={() => {
                  handleCloseScanner();
                  setShowAbsenModal(false);
                  setSubmitMessage({ type: '', text: '' });
                }}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {/* Role Tabs */}
              <div className="flex justify-center mb-6 space-x-2 flex-wrap">
                <div className="inline-flex bg-slate-100 rounded-xl p-1">
                  {['siswa', 'guru'].map((role) => (
                    <button
                      key={role}
                      onClick={() => { setActiveUserRole(role); setActiveMethodTab('scan'); }}
                      className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                        activeUserRole === role
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-800'
                      }`}
                    >
                      {role === 'siswa' ? '🧑‍🎓' : '👨‍🏫'} {role === 'siswa' ? 'Siswa' : 'Guru'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Method Tabs */}
              <div className="flex justify-center mb-5 space-x-3 flex-wrap">
                <div className="inline-flex bg-slate-50 rounded-2xl p-1 border border-slate-200 w-full md:w-auto">
                  {[
                    { id: 'scan', label: 'Scan QR', icon: '📷' },
                    { id: 'manual', label: 'Manual', icon: '✍️' },
                    { id: 'izin', label: 'Izin', icon: '📝' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveMethodTab(tab.id)}
                      className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                        activeMethodTab === tab.id
                          ? 'bg-blue-600 text-white shadow-lg border border-blue-400'
                          : 'text-slate-600 hover:text-slate-800'
                      }`}
                    >
                      <span>{tab.icon}</span> {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Area */}
              <div className="bg-white rounded-2xl border-2 border-slate-100 shadow-inner overflow-hidden min-h-[380px] flex flex-col justify-center transition-all duration-300">
                <div className="p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400 mb-1">Aksi Absensi</p>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {activeMethodTab === 'izin'
                          ? 'Pengajuan Izin'
                          : activeAttendanceAction === 'pulang'
                            ? 'Absensi Pulang'
                            : 'Absensi Datang'}
                      </h3>
                    </div>
                    {activeMethodTab !== 'izin' && (
                      <div className="inline-flex rounded-full bg-slate-100 p-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-600">
                        <button
                          type="button"
                          onClick={() => setActiveAttendanceAction('datang')}
                          className={`px-3 py-2 rounded-full transition ${activeAttendanceAction === 'datang' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
                        >
                          Datang
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveAttendanceAction('pulang')}
                          className={`px-3 py-2 rounded-full transition ${activeAttendanceAction === 'pulang' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
                        >
                          Pulang
                        </button>
                      </div>
                    )}
                  </div>

                  {isCameraStarting && (
                    <div className="absolute inset-0 z-[60] bg-blue-600/90 backdrop-blur-md flex flex-col items-center justify-center text-white p-6 text-center animate-fade-in">
                      <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center animate-pulse mb-4">
                        <span className="text-4xl">📸</span>
                      </div>
                      <h3 className="text-xl font-black mb-2 uppercase tracking-tight">Izinkan Kamera</h3>
                      <p className="text-blue-100 text-sm leading-relaxed max-w-[250px]">
                        Mohon klik <b>"Allow/Izinkan"</b> pada notifikasi browser untuk memulai proses absensi.
                      </p>
                    </div>
                  )}

                  {activeMethodTab === 'scan' && (
                    <div className="animate-fade-in text-center">
                      <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl mb-4 mx-auto max-w-[280px] aspect-square relative border-4 border-blue-50">
                        <div id="qr-reader-main" className="w-full h-full"></div>
                      </div>

                      {cameraError && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-[10px] text-red-600 font-bold">
                          ⚠️ {cameraError}
                        </div>
                      )}

                      <button
                        onClick={toggleCamera}
                        className="w-full py-3 bg-blue-50 text-blue-700 rounded-xl text-xs font-black border-2 border-blue-100 hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
                      >
                        <span>🔄</span> Putar Kamera ({facingMode === 'environment' ? 'Belakang' : 'Depan'})
                      </button>
                      <p className="mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        Arahkan Ke QR {activeUserRole}
                      </p>
                    </div>
                  )}

                  {activeMethodTab === 'manual' && activeUserRole === 'siswa' && (
                    <form onSubmit={handleStudentSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">Nama Lengkap *</label>
                        <input
                          type="text"
                          value={studentForm.fullName}
                          onChange={(e) => setStudentForm(prev => ({ ...prev, fullName: e.target.value }))}
                          className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          placeholder="Nama lengkap sesuai data"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">NIS *</label>
                        <input
                          type="text"
                          value={studentForm.user_id}
                          onChange={(e) => setStudentForm(prev => ({ ...prev, user_id: e.target.value }))}
                          className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          placeholder="Masukkan NIS siswa"
                          required
                        />
                      </div>
                      {submitMessage.text && (
                        <div className={`p-3 rounded-lg text-xs ${
                          submitMessage.type === 'success'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {submitMessage.text}
                        </div>
                      )}
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Memproses...
                          </>
                        ) : 'Absen Siswa'}
                      </button>
                    </form>
                  )}

                  {activeMethodTab === 'manual' && activeUserRole === 'guru' && (
                    <form onSubmit={handleTeacherSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">Nama Lengkap *</label>
                        <input
                          type="text"
                          value={teacherForm.fullName}
                          onChange={(e) => setTeacherForm(prev => ({ ...prev, fullName: e.target.value }))}
                          className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          placeholder="Nama lengkap guru"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">NIP *</label>
                        <input
                          type="text"
                          value={teacherForm.nip}
                          onChange={(e) => setTeacherForm(prev => ({ ...prev, nip: e.target.value }))}
                          className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          placeholder="Masukkan NIP guru"
                          required
                        />
                      </div>
                      {submitMessage.text && (
                        <div className={`p-3 rounded-lg text-xs ${
                          submitMessage.type === 'success'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {submitMessage.text}
                        </div>
                      )}
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Memproses...
                          </>
                        ) : 'Absen Guru'}
                      </button>
                    </form>
                  )}

                  {activeMethodTab === 'izin' && (
                    <form onSubmit={handleIzinSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">{activeUserRole === 'guru' ? 'NIP' : 'NIS'} *</label>
                        <input
                          type="text"
                          value={izinForm.user_id}
                          onChange={(e) => setIzinForm(prev => ({ ...prev, user_id: e.target.value }))}
                          className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          placeholder={activeUserRole === 'guru' ? 'Masukkan NIP' : 'Masukkan NIS'}
                          required
                        />
                      </div>
                      {activeUserRole === 'siswa' && (
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1.5">No. Telepon Orang Tua *</label>
                          <input
                            type="tel"
                            value={izinForm.parent_phone}
                            onChange={(e) => setIzinForm(prev => ({ ...prev, parent_phone: e.target.value }))}
                            className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            placeholder="Contoh: 08123456789"
                            required
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">Nama Lengkap *</label>
                        <input
                          type="text"
                          value={izinForm.fullName}
                          onChange={(e) => setIzinForm(prev => ({ ...prev, fullName: e.target.value }))}
                          className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          placeholder="Nama lengkap"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">Jenis *</label>
                        <select
                          value={izinForm.type}
                          onChange={(e) => setIzinForm(prev => ({ ...prev, type: e.target.value }))}
                          className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          required
                        >
                          <option value="izin">Izin</option>
                          <option value="sakit">Sakit</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">Keterangan *</label>
                        <textarea
                          value={izinForm.reason}
                          onChange={(e) => setIzinForm(prev => ({ ...prev, reason: e.target.value }))}
                          className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                          rows="3"
                          placeholder="Alasan izin/sakit..."
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">Lampiran (Opsional)</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setIzinForm(prev => ({ ...prev, attachment: e.target.files[0] }))}
                          className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        <p className="text-xs text-slate-500 mt-1">Upload gambar bukti (surat dokter, dll)</p>
                      </div>
                      {submitMessage.text && (
                        <div className={`p-3 rounded-lg text-xs ${
                          submitMessage.type === 'success'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {submitMessage.text}
                        </div>
                      )}
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Memproses...
                          </>
                        ) : 'Kirim Pengajuan'}
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {/* Info Box */}
              <div className="mt-5 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2 text-xs flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                Info Waktu {activeAttendanceAction === 'pulang' ? 'Pulang' : 'Datang'}
                </h4>
                <ul className="space-y-1 text-xs text-blue-800">
                <li>
                  • Absen Dibuka: <strong>{activeAttendanceAction === 'pulang' ? attendanceSettings.pulangStartTime : attendanceSettings.attendanceStartTime}</strong>
                </li>
                <li>
                  • Absen Ditutup: <strong>{activeAttendanceAction === 'pulang' ? attendanceSettings.pulangEndTime : attendanceSettings.attendanceEndTime}</strong>
                </li>
                  <li>• Status ditentukan otomatis berdasarkan waktu scan</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== ATTENDANCE LIST MODAL ========== */}
      {showAttendanceListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-md my-auto shadow-2xl relative overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
              <h3 className="text-base font-semibold text-slate-800">Daftar Absensi Hari Ini</h3>
              <button
                onClick={() => setShowAttendanceListModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {todayAttendanceRecords.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                  <p className="text-4xl mb-3">📭</p>
                  <p className="font-medium">Belum ada absensi tercatat hari ini.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayAttendanceRecords.map((record, index) => (
                    <div key={index} className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                          record.displayStatus === 'hadir' ? 'bg-emerald-500' :
                          record.displayStatus === 'terlambat' ? 'bg-amber-500' :
                          record.displayStatus === 'absen' ? 'bg-red-500' : 'bg-blue-500'
                        }`}>
                          {record.userName?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{record.userName}</p>
                          <p className="text-xs text-slate-500 capitalize">{record.role}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900">{formatTimeShort(new Date(record.scanTime))}</p>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          record.displayStatus === 'hadir' ? 'bg-emerald-100 text-emerald-700' :
                          record.displayStatus === 'terlambat' ? 'bg-amber-100 text-amber-700' :
                          record.displayStatus === 'absen' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {record.displayStatus === 'hadir' ? 'Hadir' :
                           record.displayStatus === 'terlambat' ? 'Terlambat' :
                           record.displayStatus === 'absen' ? 'Absen' :
                           record.displayStatus === 'izin' ? 'Izin' :
                           record.displayStatus === 'sakit' ? 'Sakit' : 'Lain-lain'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-200">
              <button
                onClick={() => setShowAttendanceListModal(false)}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== ANIMATIONS ========== */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.25s ease-out; }
      `}</style>
    </div>
  );
};

export default Landing;