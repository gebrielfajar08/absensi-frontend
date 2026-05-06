import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { Html5Qrcode } from 'html5-qrcode';

// Helper: Resolve URL foto/logo dengan fallback
const resolvePhotoUrl = (photo, fallbackBase = 'http://127.0.0.1:8000') => {
  if (!photo || typeof photo !== 'string') return null;
  const trimmed = photo.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http') || trimmed.startsWith('data:')) return trimmed;
  const base = api.defaults.baseURL?.replace(/\/api\/?$/, '') || fallbackBase;
  return `${base}/${trimmed.replace(/^\//, '')}`;
};

const Landing = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeUserRole, setActiveUserRole] = useState('siswa');
  const [activeMethodTab, setActiveMethodTab] = useState('scan');
  const [showAbsenModal, setShowAbsenModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentBgIndex, setCurrentBgIndex] = useState(0);
  const navigate = useNavigate();

  const schoolBackgrounds = [
    'https://images.unsplash.com/photo-1562774053-701939374585?w=1920&q=80',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&q=80',
    'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1920&q=80',
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=1920&q=80',
    'https://images.unsplash.com/photo-1505409627970-843228aebff4?w=1920&q=80'
  ];

  const qrScannerRef = useRef(null);
  const [qrScanner, setQrScanner] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [logoError, setLogoError] = useState(false);
  const [showQRNotification, setShowQRNotification] = useState(false);
  const [qrNotificationMessage, setQrNotificationMessage] = useState('');
  const [facingMode, setFacingMode] = useState('environment');
  const [qrNotificationType, setQrNotificationType] = useState('error');

  const [showSubmitNotification, setShowSubmitNotification] = useState(false);
  const [submitNotificationMessage, setSubmitNotificationMessage] = useState('');
  const [submitNotificationType, setSubmitNotificationType] = useState('error');

  const [showStandaloneQRScanner, setShowStandaloneQRScanner] = useState(false);

  const [studentForm, setStudentForm] = useState({ user_id: '', fullName: '' });
  const [teacherForm, setTeacherForm] = useState({ nip: '', fullName: '' });
  const [izinForm, setIzinForm] = useState({
    fullName: '',
    user_id: '',
    type: 'izin', // 'izin' or 'sakit'
    reason: '',
    attachment: null
  });

  const [fingerprintForm, setFingerprintForm] = useState({
    fullName: '',
    user_id: ''
  });

  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrResult, setQrResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [submitMessage, setSubmitMessage] = useState({ type: '', text: '' });

  const [attendanceSettings, setAttendanceSettings] = useState({
    attendanceStartTime: '',
    attendanceEndTime: '',
    lateThreshold: '',
    schoolEndTime: '',
    schoolName: '',
    schoolLogo: null,
    limitOneScanPerDay: true
  });

  const [attendanceStats, setAttendanceStats] = useState({
    totalHadir: 0,
    keterlambatan: 0
  });

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

  const countTodayAttendance = (records = []) => {
    const todayKey = getJakartaDateKey(new Date());
    const counter = { total: 0, hadir: 0, terlambat: 0, absen: 0 };
    if (!Array.isArray(records)) return counter;

    records.forEach((item) => {
      const dateKey = normalizeDateKey(item.date || item.attendance_time || item.created_at || item.time || item.scan_time);
      if (!dateKey || dateKey !== todayKey) return;
      const status = String(item.status || item.action || item.description || item.notes || '').toLowerCase();
      const isLate = item.is_late === true || ['terlambat', 'late', 'tardy'].some((flag) => status.includes(flag));
      const isPresent = ['hadir', 'tepat_waktu', 'present', 'on_time', 'on time'].some((flag) => status.includes(flag));
      const isAbsent = ['absen', 'absent', 'tidak hadir', 'missing', 'alpha'].some((flag) => status.includes(flag));

      if (isLate) {
        counter.terlambat += 1;
        counter.total += 1;
      } else if (isPresent) {
        counter.hadir += 1;
        counter.total += 1;
      } else if (isAbsent) {
        counter.absen += 1;
        counter.total += 1;
      } else {
        counter.total += 1;
      }
    });

    return counter;
  };

  const lakeBackgrounds = [
    'https://images.unsplash.com/photo-1549880338-65ddcdfd017b?w=1280&q=80',
    'https://images.unsplash.com/photo-1500534623283-312aade485b7?w=1280&q=80',
    'https://images.unsplash.com/photo-1476610182048-b716b8518aae?w=1280&q=80',
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1280&q=80'
  ];

  const holidayBackgrounds = {
    '01-01': {
      name: 'Tahun Baru Masehi',
      image: 'https://images.unsplash.com/photo-1483721310020-03333e577078?w=1280&q=80'
    },
    '05-01': {
      name: 'Hari Buruh Internasional',
      image: 'https://images.unsplash.com/photo-1514474959185-08fb602660ef?w=1280&q=80'
    },
    '06-01': {
      name: 'Hari Lahir Pancasila',
      image: 'https://images.unsplash.com/photo-1520923302269-6990cb8d0a23?w=1280&q=80'
    },
    '08-17': {
      name: 'Hari Kemerdekaan RI',
      image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=1280&q=80'
    },
    '11-10': {
      name: 'Hari Pahlawan',
      image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1280&q=80'
    },
    '12-25': {
      name: 'Hari Raya Natal',
      image: 'https://images.unsplash.com/photo-1511993226959-0f2ecb18f6a5?w=1280&q=80'
    }
  };

  const getHolidayInfo = (date) => {
    if (!date) return null;
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return holidayBackgrounds[`${month}-${day}`] || null;
  };

  const getSectionBackground = (date) => {
    const holiday = getHolidayInfo(date);
    if (holiday) {
      return {
        image: holiday.image,
        label: holiday.name,
        isHoliday: true
      };
    }

    const selectedLake = lakeBackgrounds[date.getDate() % lakeBackgrounds.length];
    return {
      image: selectedLake,
      label: 'Hari Biasa',
      isHoliday: false
    };
  };

  const audioContextRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBgIndex((prev) => (prev + 1) % schoolBackgrounds.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadSettings = async () => {
    try {
      const res = await api.get('/public/settings');
      const settings = res.data;

      const mappedSettings = {
        attendanceStartTime: settings.attendanceStartTime || settings.jam_masuk || '',
        attendanceEndTime: settings.attendanceEndTime || settings.jam_akhir || '',
        lateThreshold: settings.lateThreshold || settings.batas_keterlambatan || '',
        schoolEndTime: settings.schoolEndTime || settings.jam_pulang || '',
        schoolName: settings.schoolName || settings.nama_sekolah || '',
        schoolLogo: settings.schoolLogo || settings.logo || null,
        limitOneScanPerDay: settings.limitOneScanPerDay || false,
        disableAttendanceOnHolidays: settings.disableAttendanceOnHolidays ?? settings.disable_attendance_on_holidays ?? true
      };

      setAttendanceSettings(mappedSettings);
      localStorage.setItem('school_settings', JSON.stringify(mappedSettings));
    } catch (err) {
      console.warn('Gagal ambil dari API, pakai localStorage');
      const savedSettings = localStorage.getItem('school_settings');
      if (savedSettings) {
        try {
          setAttendanceSettings(JSON.parse(savedSettings));
        } catch {}
      }
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get('/public/stats');
      if (res && res.data != null) {
        const data = res.data;
        let stats = {
          totalAbsensi: 0,
          hadir: 0,
          terlambat: 0,
          tidakHadir: 0,
          hadirPercent: 0
        };

        if (Array.isArray(data)) {
          const counts = countTodayAttendance(data);
          stats = {
            totalHadir: counts.hadir + counts.terlambat,
            keterlambatan: counts.terlambat
          };
        } else if (Array.isArray(data.data)) {
          const counts = countTodayAttendance(data.data);
          stats = {
            totalHadir: counts.hadir + counts.terlambat,
            keterlambatan: counts.terlambat
          };
        } else {
          const hadirCount = data.total_hadir ?? data.hadir ?? 0;
          const terlambatCount = data.terlambat ?? data.total_terlambat ?? 0;
          const totalHadirCount = data.total_hadir ?? data.hadir ?? hadirCount + terlambatCount;

          stats = {
            totalHadir: totalHadirCount,
            keterlambatan: terlambatCount
          };
        }

        setAttendanceStats(stats);
      }
    } catch (err) {
      console.warn('Gagal mengambil data statistik landing dari database:', err.message);
    }
  };

  useEffect(() => {
    loadSettings();
    fetchStats();

    const syncInterval = setInterval(fetchStats, 30000);

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
      const timer = setTimeout(() => startQRScanner(), 500);
      return () => {
        clearTimeout(timer);
        stopQRScanner();
      };
    } else {
      stopQRScanner();
    }
  }, [showAbsenModal, activeMethodTab]);

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
    if (!attendanceSettings.disableAttendanceOnHolidays) return false;
    return currentTime.getDay() === 0; // Sunday
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

  const getAttendanceStatus = () => {
    const now = currentTime;
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${hours}:${minutes}`;
    
    const openTime = (attendanceSettings.attendanceStartTime || "07:00").substring(0, 5);
    const closeTime = (attendanceSettings.attendanceEndTime || "12:00").substring(0, 5);
    const lateTime = (attendanceSettings.lateThreshold || "08:00").substring(0, 5);

    if (checkIsHoliday()) return 'libur';
    if (currentTimeStr < openTime) return 'belum_buka';
    if (currentTimeStr > closeTime) return 'sudah_tutup';

    return currentTimeStr <= lateTime ? 'hadir' : 'terlambat';
  };

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage({ type: '', text: '' });
    try {
      if (checkIsHoliday()) {
        setSubmitMessage({ type: 'error', text: '❌ Hari ini libur. Absensi ditiadakan.' });
        return;
      }

      const status = getAttendanceStatus();

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

      const payload = {
        name: studentForm.fullName.trim(),
        full_name: studentForm.fullName.trim(),
        user_id: studentForm.user_id.trim(),
        nis: studentForm.user_id.trim(),
        attendance_time: currentTime.toISOString(),
        status: status,
        role: 'siswa',
        type: 'manual'
      };

      await api.post('/attendance/student/manual', payload, { 
        timeout: 60000 
      });

      const statusText = status === 'hadir' ? '✅ Tepat Waktu' : '⚠️ Terlambat';
      const successMsg = `Absensi siswa berhasil! ${statusText}`;
      showSubmitNotificationMessage(successMsg, 'success');
      setSubmitMessage({ type: 'success', text: successMsg });
      
      if (status === 'hadir') playSound('success');
      else playSound('late');

      setStudentForm({ user_id: '', fullName: '' });
      localStorage.setItem('attendance_updated', Date.now().toString());
      await fetchStats();
      
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
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage({ type: '', text: '' });
    try {
      if (checkIsHoliday()) {
        setSubmitMessage({ type: 'error', text: '❌ Hari ini libur. Absensi ditiadakan.' });
        return;
      }

      const status = getAttendanceStatus();

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

      const payload = {
        name: teacherForm.fullName.trim(),
        full_name: teacherForm.fullName.trim(),
        user_id: teacherForm.nip.trim(),
        nip: teacherForm.nip.trim(),
        attendance_time: currentTime.toISOString(),
        status: status,
        role: 'guru',
        type: 'manual'
      };

      await api.post('/attendance/teacher/manual', payload, { 
        timeout: 60000 
      });

      const statusText = status === 'hadir' ? '✅ Tepat Waktu' : '⚠️ Terlambat';
      const successMsg = `Absensi guru berhasil! ${statusText}`;
      showSubmitNotificationMessage(successMsg, 'success');
      setSubmitMessage({ type: 'success', text: successMsg });
      
      if (status === 'hadir') playSound('success');
      else playSound('late');

      setTeacherForm({ nip: '', fullName: '' });
      localStorage.setItem('attendance_updated', Date.now().toString());
      await fetchStats();
    } catch (err) {
      const responseData = err.response?.data;
      console.error('Teacher Attendance Error:', responseData || err);
      
      let errorMsg = responseData?.message || err.message || 'Gagal menyimpan absensi';

      if (!err.response && (err.code === 'ERR_NETWORK' || err.message.includes('Network Error'))) {
        errorMsg = 'Server tidak terjangkau. Periksa apakah Cloudflare Tunnel masih aktif.';
      }
      
      if (responseData?.errors) {
        errorMsg = Object.entries(responseData.errors)
          .map(([key, value]) => {
            const fieldName = key === 'user_id' || key === 'nip' ? 'NIP' : key;
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
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage({ type: '', text: '' });
    try {
      if (checkIsHoliday()) {
        setSubmitMessage({ type: 'error', text: '❌ Tidak dapat mengirim izin pada hari libur.' });
        return;
      }

      const status = getAttendanceStatus();
      if (status === 'belum_buka' || status === 'sudah_tutup') {
        const msg = `❌ Pengajuan izin hanya bisa dilakukan saat jam operasional absensi (${attendanceSettings.attendanceStartTime} - ${attendanceSettings.attendanceEndTime})`;
        showSubmitNotificationMessage(msg, 'error');
        setSubmitMessage({ type: 'error', text: msg });
        return;
      }

      const token = localStorage.getItem('token');
      
      if (!izinForm.user_id.trim()) {
        setSubmitMessage({ type: 'error', text: '❌ NIS/NIP harus diisi!' });
        return;
      }
      
      const payload = {
        full_name: izinForm.fullName.trim(),
        user_id: izinForm.user_id.trim(),
        nis: izinForm.user_id.trim(),
        type: izinForm.type,
        reason: izinForm.reason,
        attendance_time: currentTime.toISOString(),
        status: izinForm.type,
        role: activeUserRole === 'guru' ? 'guru' : 'siswa'
      };

      // Handle file upload if attachment exists
      if (izinForm.attachment) {
        const formData = new FormData();
        Object.keys(payload).forEach(key => formData.append(key, payload[key]));
        formData.append('attachment', izinForm.attachment);
        
        await api.post('/attendance/izin', formData, {
          timeout: 60000,
          headers: {
            'Content-Type': 'multipart/form-data',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        });
      } else {
        await api.post('/attendance/izin', payload, {
          timeout: 60000,
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
      }

      showSubmitNotificationMessage(`✅ Pengajuan ${izinForm.type} berhasil dikirim!`, 'success');
      setSubmitMessage({ type: 'success', text: `✅ Pengajuan ${izinForm.type} berhasil dikirim!` });
      playSound('success');

      setIzinForm({ fullName: '', user_id: '', type: 'izin', reason: '', attachment: null });
      localStorage.setItem('attendance_updated', Date.now().toString());
      
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

  const handleFingerprintSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage({ type: '', text: '' });
    try {
      if (checkIsHoliday()) {
        setSubmitMessage({ type: 'error', text: '❌ Hari ini adalah hari libur. Absensi ditiadakan.' });
        return;
      }

      const status = getAttendanceStatus();
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

      // Simulate fingerprint verification
      showSubmitNotificationMessage('🔍 Memverifikasi sidik jari...', 'info');
      
      // Simulate fingerprint scanning delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      const token = localStorage.getItem('token');
      const endpoint = activeUserRole === 'siswa' ? '/attendance/student/fingerprint' : '/attendance/teacher/fingerprint';
      
      const payload = {
        full_name: fingerprintForm.fullName.trim(),
        user_id: fingerprintForm.user_id.trim(),
        attendance_time: currentTime.toISOString(),
        type: 'fingerprint'
      };

      await api.post(endpoint, payload, {
        timeout: 60000,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      showSubmitNotificationMessage('✅ Absen sidik jari berhasil!', 'success');
      setSubmitMessage({ type: 'success', text: '✅ Absen sidik jari berhasil!' });
      playSound('success');

      setFingerprintForm({ fullName: '', user_id: '' });
      localStorage.setItem('attendance_updated', Date.now().toString());
      
      setTimeout(() => {
        setShowAbsenModal(false);
        setSubmitMessage({ type: '', text: '' });
      }, 2000);
    } catch (err) {
      if (err.response?.status !== 401 && err.code !== 'ERR_NETWORK') {
        console.error('Error submitting fingerprint:', err);
      }
      const errorMsg = err.response?.data?.message || err.message || 'Gagal memverifikasi sidik jari';
      showSubmitNotificationMessage(`❌ Gagal: ${errorMsg}`, 'error');
      setSubmitMessage({ type: 'error', text: '❌ Gagal: ' + errorMsg });
      playSound('failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQRScan = async (decodedText) => {
    try {
      const qrData = JSON.parse(decodedText);
      setQrResult(qrData);
      
      const validTypes = ['attendance_session', 'student_qr', 'teacher_qr'];
      if (qrData.type && !validTypes.includes(qrData.type)) {
        playSound('failed');
        showQRNotificationMessage('❌ QR Code tidak valid untuk absensi!', 'error');
        return;
      }

      if (!qrData.id && !qrData.student_id && !qrData.teacher_id) {
        playSound('failed');
        showQRNotificationMessage('❌ QR Code tidak memiliki ID yang valid!', 'error');
        return;
      }

      if (isSubmittingRef.current) return;

      setShowSubmitNotification(false);
      setSubmitNotificationType('error');
      setSubmitNotificationMessage('');

      await submitQRAttendance(qrData);
    } catch (err) {
      console.error('QR Parse Error:', err);
      playSound('failed');
      showQRNotificationMessage('❌ Format QR Code tidak dikenali!', 'error');
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

      const status = getAttendanceStatus();
      
      const requestData = {
        qr_data: qrData,
        scan_time: currentTime.toISOString(),
        status: status,
        type: qrData.type || 'student_qr',
        user_id: qrData.user_id || qrData.id || qrData.student_id || '',
        student_id: qrData.student_id || qrData.id || '',
        teacher_id: qrData.teacher_id || '',
        name: qrData.name || '',
        role: qrData.role || ''
      };

      const response = await api.post('/scan', requestData, {
        timeout: 120000,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
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

      const statusText = status === 'hadir' ? '✅ Tepat Waktu' : '⚠️ Terlambat';
      playSound('success');
      showQRNotificationMessage(`Absensi via QR berhasil! ${statusText}`, 'success');
      showSubmitNotificationMessage(`Absensi via QR berhasil! ${statusText}`, 'success');
      setSubmitMessage({ type: 'success', text: `✅ Absensi via QR berhasil! ${statusText}` });

      handleCloseScanner();
      setQrResult(null);
      localStorage.setItem('attendance_updated', Date.now().toString());
      await fetchStats();
      
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
    } catch (err) {
      console.error('Failed to start QR scanner:', err);
      setCameraError('Tidak dapat mengakses kamera. Pastikan izin kamera diberikan.');
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
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    return new Intl.DateTimeFormat('id-ID', options).format(date);
  };

  const formatDate = (date) => {
    const options = {
      timeZone: 'Asia/Jakarta',
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

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      
      {/* ========== NAVBAR ========== */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-white shadow-md' 
          : 'bg-white'
      }`}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm flex-shrink-0 overflow-hidden">
                {attendanceSettings.schoolLogo && !logoError ? (
                  <img 
                    src={resolvePhotoUrl(attendanceSettings.schoolLogo)} 
                    alt="Logo" 
                    className="w-full h-full object-contain"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                <h1 className="text-sm font-bold text-slate-900 leading-tight">
                  {attendanceSettings.schoolName || 'AbsensiPro'}
                </h1>
                <p className="text-xs text-slate-500">Absensi Digital Sekolah</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Link 
                to="/register" 
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all shadow-sm hover:shadow-md flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Register
              </Link>
              <Link 
                to="/login" 
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-all shadow-sm hover:shadow-md flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Login
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ========== MAIN CONTENT ========== */}
      <div className="pt-20 pb-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-6">
            
            {/* ========== LEFT COLUMN ========== */}
            <div className="space-y-4">
              
              {/* Hero Section */}
              <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white shadow-xl">
                <div className="absolute inset-0">
                  {schoolBackgrounds.map((bg, index) => (
                    <div
                      key={index}
                      className={`absolute inset-0 transition-opacity duration-1000 ${
                        index === currentBgIndex ? 'opacity-30' : 'opacity-0'
                      }`}
                      style={{
                        backgroundImage: `url(${bg})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }}
                    />
                  ))}
                </div>
                <div className="relative p-6 md:p-8">
                  <h2 className="text-2xl md:text-3xl font-bold mb-2">
                    Absensi Sekolah<br />
                    <span className="text-blue-200">Lebih Cerdas & Efisien</span>
                  </h2>
                  <p className="text-sm md:text-base text-blue-100 mb-6 leading-relaxed">
                    Sistem absensi digital berbasis QR Code untuk mempermudah pencatatan kehadiran secara cepat, akurat, dan real-time.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => setShowAbsenModal(true)}
                      className="flex-1 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                      Absen Sekarang
                    </button>
                    
                    <Link 
                      to="/login"
                      className="flex-1 px-6 py-3 bg-white hover:bg-blue-50 text-blue-900 font-medium rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                      Login Dashboard
                    </Link>
                  </div>
                </div>
              </div>

              {/* Status Absensi Hari Ini - Connected to Database */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900">Status Absensi Hari Ini</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                    <span className="text-xs font-medium text-blue-600">Live</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-slate-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs text-slate-500">Waktu Sekarang</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">{formatTimeShort(currentTime)}</p>
                    <p className="text-xs text-slate-500 mt-1">{formatDateShort(currentTime)}</p>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <span className="text-xs text-slate-500">Status Absensi</span>
                    </div>
                    {(() => {
                      const status = getAttendanceStatus();
                      const isUpcoming = status === 'belum_buka';
                      const isClosed = status === 'sudah_tutup';
                      const isHoliday = status === 'libur';
                      const isEmerald = status === 'hadir'; // ✅ FIX: Added missing variable
                      
                      return (
                        <>
                          <p className={`text-lg font-bold ${isHoliday ? 'text-red-700' : isUpcoming ? 'text-amber-600' : isClosed ? 'text-red-600' : isEmerald ? 'text-emerald-600' : 'text-emerald-600'}`}>
                            {isHoliday ? 'HARI LIBUR' : isUpcoming ? 'BELUM DIBUKA' : isClosed ? 'DITUTUP' : 'DIBUKA'}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">{isHoliday ? 'Sekolah Libur' : `${attendanceSettings.attendanceStartTime} - ${attendanceSettings.attendanceEndTime}`}</p>
                          <span className={`inline-flex items-center gap-1 mt-2 text-xs font-medium ${isHoliday ? 'text-red-700' : isUpcoming ? 'text-amber-600' : isClosed ? 'text-red-600' : 'text-emerald-600'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isHoliday ? 'bg-red-700' : isUpcoming ? 'bg-amber-500' : isClosed ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`}></span>
                            {isHoliday ? 'Libur' : isUpcoming ? 'Menunggu' : isClosed ? 'Selesai' : 'Berlangsung'}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span className="text-xs text-slate-600">Total Hadir Hari Ini</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-900">{attendanceStats.totalHadir}</p>
                    <p className="text-xs text-slate-500 mt-1">Siswa & Guru</p>
                  </div>
                  <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs text-slate-600">Keterlambatan</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-900">{attendanceStats.keterlambatan}</p>
                    <p className="text-xs text-slate-500 mt-1">Orang</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-100 via-white to-blue-50 rounded-2xl p-6 border border-blue-200">
                <div className="flex items-center justify-center gap-4">
                  <div className="relative">
                    <div className="w-20 h-20 bg-white rounded-full shadow-lg flex items-center justify-center">
                      <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="w-24 h-16 bg-blue-200 rounded-lg mb-2"></div>
                    <div className="w-16 h-4 bg-blue-200 rounded mx-auto"></div>
                  </div>

                  <div className="relative">
                    <div className="w-20 h-20 bg-white rounded-full shadow-lg flex items-center justify-center">
                      <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* ========== RIGHT COLUMN ========== */}
            <div className="space-y-4">
              
              {/* Hari / Tanggal Dinamis */}
              {(() => {
                const sectionBg = getSectionBackground(currentTime);
                return (
                  <div
                    className="relative overflow-hidden rounded-2xl border border-blue-100 p-6 text-white"
                    style={{
                      backgroundImage: `linear-gradient(rgba(15,23,42,0.7), rgba(15,23,42,0.7)), url(${sectionBg.image})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900/60 to-slate-900/30"></div>
                    <div className="relative">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-200/80 mb-3">
                        {sectionBg.isHoliday ? `Hari Besar: ${sectionBg.label}` : sectionBg.label}
                      </p>
                      <h3 className="text-2xl md:text-3xl font-bold mb-2">{formatDate(currentTime)}</h3>
                      <p className="text-sm text-slate-200/80 mb-6">
                        Tanggal hari ini ditampilkan otomatis sesuai zona waktu Jakarta.
                      </p>
                      <div className="inline-flex items-center gap-3 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-lg shadow-slate-900/20">
                        <span>{currentTime.getFullYear()}</span>
                        <span className="inline-block h-1 w-1 rounded-full bg-slate-200/70" />
                        <span>{currentTime.getDate()} {new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(currentTime)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Jam Operasional - Connected to Database */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="font-bold text-slate-900">Jam Operasional Absensi</h3>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                      <span className="text-sm text-slate-600">Absen Dibuka</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">{attendanceSettings.attendanceStartTime || '-'} WIB</span>
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      <span className="text-sm text-slate-600">Absen Ditutup</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">{attendanceSettings.attendanceEndTime || '-'} WIB</span>
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                      <span className="text-sm text-slate-600">Batas Terlambat Absensi</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">{attendanceSettings.lateThreshold || '-'} WIB</span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                      <span className="text-sm text-slate-600">Jam Pulang (Auto Alpha)</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">{attendanceSettings.schoolEndTime || '-'} WIB</span>
                  </div>
                </div>
              </div>

              {/* CTA Section */}
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2">Siap untuk Absen?</h3>
                    <p className="text-blue-100 text-sm mb-4">Mulai absen sekarang dan jadilah bagian dari sekolah digital.</p>
                    <button
                      onClick={() => setShowAbsenModal(true)}
                      className="px-6 py-3 bg-white text-blue-600 font-semibold rounded-xl hover:bg-blue-50 transition-all shadow-lg flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                      Absen Sekarang
                    </button>
                  </div>
                  <div className="w-24 h-24 bg-white rounded-xl p-2 shadow-lg">
                    <div className="w-full h-full bg-slate-900 rounded-lg flex items-center justify-center">
                      <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* ========== FOOTER ========== */}
      <footer className="bg-slate-900 text-slate-400 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              {attendanceSettings.schoolLogo && !logoError ? (
                <img 
                  src={resolvePhotoUrl(attendanceSettings.schoolLogo)} 
                  alt="Logo" 
                  className="w-6 h-6 object-contain"
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

      {/* ========== NOTIFICATIONS ========== */}
      {[
        { show: showQRNotification, message: qrNotificationMessage, type: qrNotificationType, onClose: () => setShowQRNotification(false) },
        { show: showSubmitNotification, message: submitNotificationMessage, type: submitNotificationType, onClose: () => setShowSubmitNotification(false) }
      ].map((notif, idx) => notif.show && (
        <div key={idx} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className={`bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full transform transition-all animate-fade-in border-t-4 ${
            notif.type === 'success' ? 'border-emerald-500' : notif.type === 'warning' ? 'border-amber-500' : 'border-red-500'
          }`}>
            <div className="text-center">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                notif.type === 'success' ? 'bg-emerald-50' : notif.type === 'warning' ? 'bg-amber-50' : 'bg-red-50'
              }`}>
                {notif.type === 'success' ? (
                  <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                ) : notif.type === 'warning' ? (
                  <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${
                notif.type === 'success' ? 'text-emerald-700' : notif.type === 'warning' ? 'text-amber-700' : 'text-red-700'
              }`}>
                {notif.type === 'success' ? 'Berhasil!' : notif.type === 'warning' ? 'Perhatian' : 'Terjadi Kesalahan'}
              </h3>
              <p className="text-slate-600 mb-5 text-sm whitespace-pre-line">{notif.message}</p>
              <button
                onClick={notif.onClose}
                className={`px-5 py-2 rounded-lg font-medium transition-all text-sm ${
                  notif.type === 'success'
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
              <div className="flex justify-center mb-6">
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
                      {role === 'siswa' ? '🧑‍🎓' : '👨‍'} {role === 'siswa' ? 'Siswa' : 'Guru'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Method Tabs */}
              <div className="flex justify-center mb-5">
                <div className="inline-flex bg-slate-50 rounded-2xl p-1 border border-slate-200 w-full">
                  {(activeUserRole === 'guru' ? [
                    { id: 'scan', label: 'Scan QR', icon: '📷' },
                    { id: 'manual', label: 'Manual', icon: '✍️' },
                    { id: 'fingerprint', label: 'Sidik Jari', icon: '👆' },
                    { id: 'izin', label: 'Izin', icon: '📝' }
                  ] : [
                    { id: 'scan', label: 'Scan QR', icon: '📷' },
                    { id: 'manual', label: 'Manual', icon: '✍️' },
                    { id: 'fingerprint', label: 'Sidik Jari', icon: '👆' },
                    { id: 'izin', label: 'Izin', icon: '📝' }
                  ]).map((tab) => (
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

                  {activeMethodTab === 'fingerprint' && (
                    <form onSubmit={handleFingerprintSubmit} className="space-y-4">
                      <div className="text-center mb-4">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <span className="text-2xl">👆</span>
                        </div>
                        <h3 className="text-sm font-medium text-slate-800 mb-1">Absen Sidik Jari</h3>
                        <p className="text-xs text-slate-500">Tempelkan jari Anda pada sensor</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">Nama Lengkap *</label>
                        <input
                          type="text"
                          value={fingerprintForm.fullName}
                          onChange={(e) => setFingerprintForm(prev => ({ ...prev, fullName: e.target.value }))}
                          className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          placeholder={activeUserRole === 'siswa' ? 'Nama lengkap siswa' : 'Nama lengkap guru'}
                          required
                        />
                      </div>
                      {activeUserRole === 'siswa' && (
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1.5">NIS *</label>
                          <input
                            type="text"
                            value={fingerprintForm.user_id}
                            onChange={(e) => setFingerprintForm(prev => ({ ...prev, user_id: e.target.value }))}
                            className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            placeholder="Masukkan NIS siswa"
                            required
                          />
                        </div>
                      )}
                      {activeUserRole === 'guru' && (
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1.5">NIP *</label>
                          <input
                            type="text"
                            value={fingerprintForm.user_id}
                            onChange={(e) => setFingerprintForm(prev => ({ ...prev, user_id: e.target.value }))}
                            className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            placeholder="Masukkan NIP guru"
                            required
                          />
                        </div>
                      )}
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
                        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Memverifikasi...
                          </>
                        ) : (
                          <>
                            <span>👆</span> Verifikasi Sidik Jari
                          </>
                        )}
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
                  Info Waktu
                </h4>
                <ul className="space-y-1 text-xs text-blue-800">
                  <li>• Absen Dibuka: <strong>{attendanceSettings.attendanceStartTime}</strong></li>
                  <li>• Absen Ditutup: <strong>{attendanceSettings.attendanceEndTime}</strong></li>
                  <li>• Status ditentukan otomatis berdasarkan waktu scan</li>
                </ul>
              </div>
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