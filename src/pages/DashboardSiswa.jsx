import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Html5Qrcode } from 'html5-qrcode';

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
    izinDays: 0,
    sakitDays: 0,
    percentage: 0,
  });
  const [sessionInfo, setSessionInfo] = useState(null);
  const [izinForm, setIzinForm] = useState({ 
    fullName: '', 
    parentPhone: '', 
    reason: '', 
    tanggal: new Date().toISOString().split('T')[0] 
  });
  const [izinSubmitting, setIzinSubmitting] = useState(false);
  const [izinMessage, setIzinMessage] = useState({ type: '', text: '' });
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [classInfo, setClassInfo] = useState(null);
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  const [manualForm, setManualForm] = useState({ nis: '' });
  const qrReaderRef = useRef(null);
  const audioContextRef = useRef(null);
  const modalContentRef = useRef(null);

  const [attendanceSettings, setAttendanceSettings] = useState({
    schoolName: 'SMPK DON BOSCO',
    schoolLogo: null,
    dashboardPhoto1: null,
    dashboardPhoto2: null,
    dashboardPhoto3: null,
    dashboardVideo: null,
    limitOneScanPerDay: true
  });

  // State untuk QR Code
  const [myQRCode, setMyQRCode] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);

  // State untuk Absensi
  const [showAbsenModal, setShowAbsenModal] = useState(false);
  const [activeAbsenTab, setActiveAbsenTab] = useState('scan');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [qrScanner, setQrScanner] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [qrResult, setQrResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState({ type: '', text: '' });
  const [showQRNotification, setShowQRNotification] = useState(false);
  const [qrNotificationMessage, setQrNotificationMessage] = useState('');
  const [qrNotificationType, setQrNotificationType] = useState('error');

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
            limitOneScanPerDay: settings.limit_one_scan_per_day || settings.limitOneScanPerDay || false
          });
        } catch (err) {
          console.error("Error parsing settings", err);
        }
      }
    };

    loadSettings();
    // Listen jika ada perubahan di tab lain (misal admin baru save)
    window.addEventListener('storage', loadSettings);
    return () => window.removeEventListener('storage', loadSettings);
  }, []);

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
      // Pre-populate NIS
      setManualForm({ nis: user.nis || user.user_id || '' });
      setIzinForm(prev => ({ ...prev, fullName: user.name || '' }));

      const syncInterval = setInterval(() => {
        if (document.visibilityState === 'visible' && user?.id) {
          fetchStudentData(true);
        }
      }, 30000);
      return () => clearInterval(syncInterval);
    }
  }, [user?.id]); // Gunakan user.id agar tidak terjadi infinite loop saat merge data profil

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
    setLastSync(new Date());
    
  } catch (err) {
    console.error('❌ Gagal mengambil data siswa:', err);
    if (!silent) alert('⚠️ Gagal memuat data. Periksa koneksi server.');
    } finally {
      setLoading(false);
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

  // Fungsi play sound effect
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
      if (type === 'success') {
        oscillator.frequency.setValueAtTime(523.25, ctx.currentTime);
        oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.4);
      } else if (type === 'failed') {
        oscillator.frequency.setValueAtTime(150, ctx.currentTime);
        oscillator.frequency.setValueAtTime(100, ctx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
      }
    } catch (err) {
      console.warn('Audio play error:', err.message);
    }
  };

  // Fungsi QR Scanner
  const startQRScanner = async () => {
    try {
      setCameraError('');
      console.log('🎥 Memulai QR Scanner...');
      
      // Cek apakah element sudah ada di DOM
      const readerElement = document.getElementById('qr-reader-absen');
      if (!readerElement) {
        console.warn('QR reader element not found in DOM yet.');
        return;
      }

      // Cek izin kamera dengan timeout yang lebih longgar
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' }
        });
        stream.getTracks().forEach(track => track.stop());
      } catch (permError) {
        setCameraError('Izin kamera ditolak. Mohon izinkan akses kamera di browser Anda.');
        return;
      }
      
      const scanner = new Html5Qrcode("qr-reader-absen");
      html5QrcodeScannerRef.current = scanner;
      
      // ✨ DIPERBAIKI: Ukuran QR box lebih kecil agar tidak terlalu zoom
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1.0,
          disableFlip: false
        },
        (decodedText) => {
          console.log('📱 QR Code terdeteksi:', decodedText);
          handleQRScan(decodedText);
        },
        () => {}
      );
      
      console.log('✅ QR Scanner berhasil dimulai');
    } catch (err) {
      console.error('❌ Failed to start QR scanner:', err);
      let errorMsg = 'Gagal mengakses kamera. ';
      
      if (err.name === 'NotAllowedError') { 
        errorMsg += 'Izin kamera ditolak. Mohon izinkan akses kamera di browser Anda.';
      } else if (err.name === 'NotFoundError') {
        errorMsg += 'Kamera tidak ditemukan pada perangkat ini.';
      } else if (err.name === 'NotReadableError') {
        errorMsg += 'Kamera sedang digunakan oleh aplikasi lain.';
      } else {
        errorMsg += 'Pastikan kamera tersedia dan izin diberikan.'; 
      }
      setCameraError(errorMsg);
      html5QrcodeScannerRef.current = null;
    }
  };

  const stopQRScanner = async () => { 
    const scanner = html5QrcodeScannerRef.current;
    if (scanner) {
      html5QrcodeScannerRef.current = null;
      try {
        console.log('🛑 Menghentikan QR Scanner...');
        if (scanner.isScanning) {
          await scanner.stop();
        }
        await scanner.clear();
        console.log('✅ QR Scanner berhasil dihentikan');
      } catch (err) {
        console.warn('⚠️ QR scanner stop warning:', err.message);
      }
    }
  };

  const showQRNotificationMessage = (message, type = 'error') => {
    setQrNotificationMessage(message);
    setQrNotificationType(type);
    setShowQRNotification(true);
    setTimeout(() => {
      setShowQRNotification(false);
    }, 3000);
  };

  const handleQRScan = async (decodedText) => {
    try {
      const qrData = JSON.parse(decodedText);
      setQrResult(qrData);
      
      if (!qrData.type || !['attendance_session', 'student_qr', 'teacher_qr'].includes(qrData.type)) {
        playSound('failed');
        showQRNotificationMessage('❌ QR Code tidak valid untuk absensi!', 'error');
        return;
      }
      
      if (!qrData.id && !qrData.student_id && !qrData.teacher_id) {
        playSound('failed');
        showQRNotificationMessage('❌ QR Code tidak memiliki ID yang valid!', 'error');
        return;
      }
      
      await submitQRAttendance(qrData);
    } catch (err) {
      console.error('❌ QR Parse Error:', err);
      playSound('failed');
      showQRNotificationMessage('❌ Format QR Code tidak dikenali!', 'error');
    }
  };

  const submitQRAttendance = async (qrData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const status = getAttendanceStatus();
      const requestData = {
        qr_data: qrData,
        scan_time: currentTime.toISOString(),
        status: status,
        type: qrData.type || 'student_qr',
        user_id: qrData.user_id || qrData.id || qrData.student_id || '',
        student_id: qrData.student_id || qrData.id || '',
        teacher_id: qrData.teacher_id || '',
        name: qrData.name || user.name || '',
        role: qrData.role || user.role || 'siswa',
        generated_at: qrData.generated_at || new Date().toISOString()
      };
      
      console.log('📤 Mengirim absensi QR:', requestData);
      
      // DIPERBAIKI: Endpoint API yang benar
      const response = await api.post('/scan', requestData, {
        timeout: 120000,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Absensi QR berhasil:', response.data);

      const attendance = response.data?.data || {};
      const finalStatus = attendance.status || response.data?.status || 'hadir';
      const isLate = finalStatus === 'terlambat';
      const message = isLate
        ? '⚠️ Absensi berhasil, tetapi kamu tercatat TERLAMBAT.'
        : '✅ Absensi via QR berhasil!';

      playSound('success');
      showQRNotificationMessage(message, 'success');
      setSubmitMessage({ type: 'success', text: message });
      setQrResult(null);
      
      localStorage.setItem('attendance_updated', Date.now().toString());
      
      setTimeout(() => {
        setShowAbsenModal(false);
        setSubmitMessage({ type: '', text: '' });
        stopQRScanner();
      }, 2000);
    } catch (err) {
      console.error('❌ QR Submit Error:', err);
      const errorMsg = err.response?.data?.message || 'Gagal menyimpan absensi';
      playSound('failed');
      showQRNotificationMessage(`❌ ${errorMsg}`, 'error');
      setSubmitMessage({ type: 'error', text: '❌ Gagal: ' + errorMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle submit manual
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage({ type: '', text: '' });
    try {
      const token = localStorage.getItem('token');

      const status = getAttendanceStatus();
      // Kirim hanya nama dan NIS
      const requestData = {
        name: user.name || user.full_name || '',
        user_id: manualForm.nis || user.nis || user.user_id || '',
        attendance_time: currentTime.toISOString(),
        status: status,
        role: 'siswa',
        type: 'manual'
      };
      
      console.log('📤 Mengirim absensi manual:', requestData);
      
      const res = await api.post('/attendance/student/manual', requestData, {
        timeout: 120000,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Absensi manual berhasil', res.data);

      const attendance = res.data?.data || {};
      const finalStatus = attendance.status || res.data?.status || 'hadir';
      const isLate = finalStatus === 'terlambat';
      const message = isLate
        ? '⚠️ Absensi berhasil, tetapi kamu tercatat TERLAMBAT.'
        : '✅ Absensi manual berhasil!';

      playSound('success');
      showQRNotificationMessage(message, 'success');
      setSubmitMessage({ type: 'success', text: message });
      
      // Reset form
      setManualForm({ 
        nis: ''
      });
      
      // Broadcast ke storage
      localStorage.setItem('attendance_updated', Date.now().toString());
      
      // Refresh data ringkasan
      await fetchStudentData(true);
      
      setTimeout(() => {
        setShowAbsenModal(false);
        setSubmitMessage({ type: '', text: '' });
      }, 2000);
    } catch (err) {
      console.error('❌ Manual Submit Error:', err);
      const errorMsg = err.response?.data?.message || 'Gagal menyimpan absensi';
      playSound('failed');
      showQRNotificationMessage(`❌ ${errorMsg}`, 'error');
      setSubmitMessage({ type: 'error', text: '❌ Gagal: ' + errorMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenScanner = () => {
    setActiveAbsenTab('scan');
    setShowAbsenModal(true);
  };

  const handleCloseScanner = () => {
    stopQRScanner();
    setQrResult(null);
    setCameraError('');
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

  // Helper to determine status based on time
  const getAttendanceStatus = () => {
    const now = currentTime;
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // Check against attendanceEndTime from settings or default
    const endTime = attendanceSettings.attendanceEndTime || "08:00";
    return currentTimeStr <= endTime ? 'hadir' : 'terlambat';
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

  const handleIzinSubmit = async (e) => {
    e.preventDefault();
    setIzinSubmitting(true);
    setIzinMessage({ type: '', text: '' });
    try {
      const token = localStorage.getItem('token');
      const requestData = {
        full_name: izinForm.fullName || user.name,
        user_id: user.nis || user.user_id,
        parent_phone: izinForm.parentPhone,
        reason: izinForm.reason,
        tanggal: izinForm.tanggal,
        status: 'izin',
        attendance_time: currentTime.toISOString()
      };

      // Mengirim ke endpoint absensi izin
      await api.post('/attendance/izin', requestData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setIzinMessage({ type: 'success', text: '✅ Pengajuan izin berhasil terkirim ke database.' });
      playSound('success');
      
      // Reset Form
      setIzinForm({ fullName: '', parentPhone: '', reason: '', tanggal: new Date().toISOString().split('T')[0] });
      
      // Broadcast & Refresh data
      localStorage.setItem('attendance_updated', Date.now().toString());
      await fetchStudentData(true);

      setTimeout(() => {
        setShowAbsenModal(false);
        setIzinMessage({ type: '', text: '' });
      }, 2500);
    } catch (err) {
      setIzinMessage({
        type: 'error',
        text: err.response?.data?.message || 'Gagal mengirim izin',
      });
    } finally {
      setIzinSubmitting(false);
    }
  };

  const menuItems = [
    { id: 'ringkasan', label: 'Ringkasan', icon: '📊' },
    { id: 'absensi', label: 'Absensi', icon: '✅' },
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
                    {attendanceSettings.schoolName || 'SMPK DON BOSCO'}
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
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
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
                      src={resolvePhotoUrl(user.photo) || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email || 'Siswa')}&background=2563eb&color=ffffff`}
                      alt="User Avatar"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email || 'Siswa')}&background=2563eb&color=ffffff`; }}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-blue-800 font-semibold text-sm truncate max-w-[140px]" title={user.name}>{user.name || 'Siswa'}</p>
                    <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200">
                      🧑‍🎓 Siswa
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

        {/* Main UI Column */}
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
                <div>
                  <div className="bg-white rounded-xl border-2 border-blue-200 p-6 mb-6 shadow-lg">
                    <h2 className="text-xl font-bold text-blue-800 mb-1">Halo, {user.name}! 👋</h2>
                    <p className="text-blue-600 text-sm">Ini ringkasan kehadiranmu</p>
                  </div>

                  {/* ✨ SEKSI MEDIA (DIPINDAHKAN KE BAWAH SALAM) */}
                  <div className="bg-white rounded-xl border-2 border-blue-200 p-5 shadow-lg mb-6">
                    <h3 className="font-semibold text-blue-800 mb-4 flex items-center gap-2">
                      <span>🖼️</span> Media & Kegiatan Sekolah
                    </h3>
                    <div className="flex flex-col gap-4">
                      {/* Baris Foto: Sliding Left Animation */}
                      <div className="overflow-hidden relative w-full py-1">
                        <div className="flex gap-4 animate-slide-left w-max">
                          {[1, 2, 3, 1, 2, 3].map((i, idx) => (
                            <div key={`siswa-photo-slide-${idx}`} className="w-48 sm:w-72 flex-shrink-0 rounded-lg overflow-hidden border border-blue-100 bg-slate-50 shadow-sm">
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
                <div>
                  <div className="bg-white rounded-xl border-2 border-blue-200 p-6 mb-6 shadow-lg">
                    <h2 className="text-xl font-bold text-blue-800 mb-1">✅ Absensi</h2>
                    <p className="text-blue-600 text-sm">Lakukan absensi menggunakan QR Code atau manual</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                    <button
                      onClick={() => {
                        setActiveAbsenTab('my-qr');
                        setShowAbsenModal(true);
                      }}
                      className="p-8 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl hover:shadow-xl transition-all text-left shadow-lg group border-2 border-indigo-300"
                    >
                      <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">🪪</div>
                      <h3 className="font-bold text-xl mb-1">Unduh Kode QR</h3>
                      <p className="text-indigo-100 text-sm">Tampilkan dan unduh QR identitasmu</p>
                    </button>
                    <button
                      onClick={() => {
                        setActiveAbsenTab('scan');
                        setShowAbsenModal(true);
                      }}
                      disabled={sessionInfo?.attendanceSessionOpen === false}
                      className="p-8 bg-gradient-to-br from-blue-500 to-cyan-600 text-white rounded-2xl hover:shadow-xl transition-all text-left shadow-lg disabled:opacity-50 group border-2 border-blue-300"
                    >
                      <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">✅</div>
                      <h3 className="font-bold text-xl mb-1">Absen Sekarang</h3>
                      <p className="text-blue-100 text-sm">Scan QR, Manual, atau kirim Izin</p>
                    </button>
                  </div>
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 shadow-lg">
                    <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                      <span>ℹ️</span> Cara Absensi
                    </h4>
                    <ul className="space-y-2 text-sm text-blue-800">
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">1</span>
                        <span>Pilih metode absensi (Scan QR atau Manual)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">2</span>
                        <span>Untuk scan QR, arahkan kamera ke QR code yang disediakan guru</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">3</span>
                        <span>Untuk manual, isi nama lengkap dan NIS</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">4</span>
                        <span>Data absensi akan tersimpan otomatis</span>
                      </li>
                    </ul>
                  </div>
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
                      <p className="text-blue-600 text-sm">{classInfo?.name || 'Siswa'}</p>
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
                          <span className="font-medium">{classInfo?.name || '-'}</span>
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
                                <td className="px-6 py-4 text-sm text-blue-600">{item.class_name || classInfo?.name}</td>
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

      {/* MODAL ABSENSI */}
{showAbsenModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
    <div className="bg-white rounded-2xl w-full max-w-md my-8 shadow-2xl relative border-2 border-blue-200 overflow-hidden flex flex-col">
      
      {/* Header Modal */}
      <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
        <div>
          <h3 className="text-base font-bold text-slate-800">
            {activeAbsenTab === 'my-qr' ? '🪪 Kode QR Saya' : '✅ Absensi'}
          </h3>
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
            {activeAbsenTab === 'my-qr' ? 'Identitas digital Anda' : 'Scan QR, Manual, atau Izin'}
          </p>
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content Modal */}
      <div className="p-5 flex-1 overflow-y-auto" ref={modalContentRef}>
        
        {/* Waktu & Tanggal */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200">
            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-mono font-bold text-sm text-slate-700">{formatTime(currentTime)}</span>
            <span className="text-slate-300 text-xs">|</span>
            <span className="text-xs text-slate-500 font-medium">{formatDate(currentTime)}</span>
          </div>
        </div>

        {/* Tab Navigation */}
        {activeAbsenTab !== 'my-qr' && (
          <div className="flex justify-center mb-4">
            <div className="inline-flex bg-slate-50 rounded-2xl p-1 border border-slate-200 w-full">
              <button
                onClick={() => setActiveAbsenTab('scan')}
                className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeAbsenTab === 'scan' ? 'bg-blue-600 text-white shadow-lg border border-blue-400' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>📱</span> Scan QR
              </button>
              <button
                onClick={() => setActiveAbsenTab('manual')}
                className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeAbsenTab === 'manual' ? 'bg-blue-600 text-white shadow-lg border border-blue-400' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>✍️</span> Manual
              </button>
              <button
                onClick={() => setActiveAbsenTab('izin')}
                className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeAbsenTab === 'izin' ? 'bg-blue-600 text-white shadow-lg border border-blue-400' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>📋</span> Izin
              </button>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="bg-white rounded-2xl border-2 border-slate-100 shadow-inner overflow-hidden min-h-[380px] flex flex-col justify-center transition-all duration-300">
          <div className="p-5">
            
            {/* TAB: Scan QR */}
            {activeAbsenTab === 'scan' && (
              <div className="animate-fade-in text-center">
                <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl mb-4 mx-auto max-w-[280px] aspect-square relative border-4 border-blue-50">
                  <div id="qr-reader-absen" className="w-full h-full" ref={qrReaderRef}></div>
                </div>
                
                {cameraError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-[10px] text-red-600 font-bold">
                    ⚠️ {cameraError}
                  </div>
                )}

                {!qrScanner ? (
                  <button
                    onClick={startQRScanner}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl text-xs font-black shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                  >
                    <span>📷</span> Mulai Scanner
                  </button>
                ) : (
                  <button
                    onClick={handleCloseScanner}
                    className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-black hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                  >
                    Tutup Scanner
                  </button>
                )}
                
                <p className="mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  Arahkan Ke QR Absensi
                </p>
              </div>
            )}

            {/* TAB: Manual */}
            {activeAbsenTab === 'manual' && (
              <div className="animate-fade-in">
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5 uppercase tracking-wider">NIS Siswa *</label>
                    <input
                      type="text"
                      value={manualForm.nis}
                      onChange={(e) => setManualForm(prev => ({...prev, nis: e.target.value}))}
                      className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      placeholder="Masukkan NIS Anda"
                      required
                    />
                  </div>
                  <div className="text-[10px] text-blue-500 font-bold italic">
                    Status: {getAttendanceStatus() === 'hadir' ? '✅ Tepat Waktu' : '⚠️ Terlambat'}
                  </div>
                  {submitMessage.text && (
                    <div className={`p-3 rounded-lg text-xs font-medium ${
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
                    className="w-full py-3 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? 'Memproses...' : 'Absen Sekarang'}
                  </button>
                </form>
              </div>
            )}

            {/* TAB: My QR */}
            {activeAbsenTab === 'my-qr' && (
              <div className="animate-fade-in text-center">
                <div className="mb-4">
                  <h4 className="font-bold text-slate-800">QR Code Identitas</h4>
                  <p className="text-xs text-slate-500">Gunakan untuk verifikasi kehadiran</p>
                </div>
                
                {qrLoading ? (
                  <div className="p-8"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div></div>
                ) : myQRCode ? (
                  <div className="inline-block p-3 bg-white rounded-2xl border-2 border-slate-100 shadow-md mb-6">
                    <img src={myQRCode} alt="QR Saya" className="w-40 h-40 mx-auto" />
                  </div>
                ) : (
                  <div className="p-8 text-slate-400 text-xs italic">QR Code tidak tersedia</div>
                )}

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <button onClick={downloadQRCode} className="py-2.5 bg-blue-600 text-white text-[11px] font-black rounded-xl hover:bg-blue-700 transition-all shadow-md">
                    ⬇️ Unduh QR
                  </button>
                  <button onClick={fetchMyQRCode} className="py-2.5 bg-slate-100 text-slate-600 text-[11px] font-black rounded-xl hover:bg-slate-200 border border-slate-200 transition-all">
                    🔄 Refresh
                  </button>
                </div>

                <div className="text-left bg-slate-50 rounded-xl p-4 text-[10px] text-slate-600 space-y-2 border border-slate-100">
                  <div className="flex justify-between border-b border-slate-200 pb-1"><span>Nama:</span><span className="font-bold text-slate-800">{user.name}</span></div>
                  <div className="flex justify-between border-b border-slate-200 pb-1"><span>NIS:</span><span className="font-bold text-slate-800">{user.nis || '-'}</span></div>
                  <div className="flex justify-between uppercase tracking-tighter"><span>Role:</span><span className="font-bold text-blue-600">{user.role || 'siswa'}</span></div>
                </div>
              </div>
            )}

            {/* TAB: Izin */}
            {activeAbsenTab === 'izin' && (
              <div className="animate-fade-in">
                <form onSubmit={handleIzinSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5 uppercase tracking-wider">Tanggal</label>
                    <input
                      type="date"
                      value={izinForm.tanggal}
                      onChange={(e) => setIzinForm((p) => ({ ...p, tanggal: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5 uppercase tracking-wider">Keterangan *</label>
                    <textarea
                      required
                      rows={3}
                      value={izinForm.reason}
                      onChange={(e) => setIzinForm((p) => ({ ...p, reason: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm resize-none"
                      placeholder="Alasan izin..."
                    />
                  </div>
                  {izinMessage.text && (
                    <div className={`p-3 rounded-lg text-xs font-medium border ${izinMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                      {izinMessage.text}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={izinSubmitting}
                    className="w-full py-3 bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-lg hover:bg-emerald-700 transition-all disabled:opacity-50"
                  >
                    {izinSubmitting ? 'Mengirim...' : 'Kirim Pengajuan Izin'}
                  </button>
                </form>
              </div>
            )}

          </div>
        </div>

        {/* Help Section */}
        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
          <h4 className="font-bold text-slate-800 mb-1.5 text-xs flex items-center gap-1.5">
            <span>ℹ️</span> Cara Pakai
          </h4>
          <ul className="space-y-1 text-[10px] text-slate-500 font-medium">
            <li>• Pilih tab Scan QR atau Manual</li>
            <li>• Untuk scan, arahkan kamera ke QR code</li>
            <li>• Untuk manual, isi nama dan NIS</li>
            <li>• Data tersimpan otomatis</li>
          </ul>
        </div>

      </div>
    </div>
  </div>
)}

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

      {/* NOTIFIKASI QR CODE */}
      {showQRNotification && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full transform transition-all animate-fade-in border-4 ${
            qrNotificationType === 'success' ? 'border-green-500' : 'border-red-500'
          }`}>
            <div className="text-center">
              <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
                qrNotificationType === 'success' ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {qrNotificationType === 'success' ? (
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <h3 className={`text-xl font-bold mb-2 ${
                qrNotificationType === 'success' ? 'text-green-700' : 'text-red-700'
              }`}>
                {qrNotificationType === 'success' ? '✅ Berhasil!' : '❌ Error!'}
              </h3>
              <p className="text-blue-600 mb-6">{qrNotificationMessage}</p>
              <button
                onClick={() => setShowQRNotification(false)}
                className={`px-6 py-2.5 rounded-xl font-medium transition-all ${
                  qrNotificationType === 'success'
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                Tutup
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
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        #qr-reader-absen {
          width: 100%;
          min-height: 250px;
        }
        .animate-slide-left {
          animation: slideLeft 25s linear infinite;
        }
        .animate-slide-left:hover {
          animation-play-state: paused;
        }
        #qr-reader-absen video {
          width: 100% !important;
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
};

export default DashboardSiswa;