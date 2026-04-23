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
  const [facingMode, setFacingMode] = useState('environment'); // 'user' atau 'environment'
  const [qrNotificationType, setQrNotificationType] = useState('error');

  const [showSubmitNotification, setShowSubmitNotification] = useState(false);
  const [submitNotificationMessage, setSubmitNotificationMessage] = useState('');
  const [submitNotificationType, setSubmitNotificationType] = useState('error');

  const [showStandaloneQRScanner, setShowStandaloneQRScanner] = useState(false);

  const [studentForm, setStudentForm] = useState({ user_id: '', fullName: '' });
  const [teacherForm, setTeacherForm] = useState({ nip: '', fullName: '' });
  const [izinForm, setIzinForm] = useState({
    fullName: '',
    parentPhone: '',
    reason: ''
  });

  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrResult, setQrResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [submitMessage, setSubmitMessage] = useState({ type: '', text: '' });

  const [attendanceSettings, setAttendanceSettings] = useState({
    attendanceStartTime: '07:00',
    attendanceOpenTime: '06:00',
    attendanceCloseTime: '12:00',
    attendanceEndTime: '08:00',
    lateThreshold: '08:00',
    schoolName: 'AbsensiPro',
    schoolLogo: null,
    limitOneScanPerDay: true
  });

  const audioContextRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBgIndex((prev) => (prev + 1) % schoolBackgrounds.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      // Load settings dari localStorage yang disimpan oleh Admin
      const savedSettings = localStorage.getItem('school_settings');
      if (savedSettings) {
        try {
          const settings = JSON.parse(savedSettings);
          setAttendanceSettings({
            attendanceStartTime: settings.attendanceStartTime || settings.jam_masuk || '07:00',
            attendanceOpenTime: settings.attendanceOpenTime || settings.jam_buka || '06:00',
            attendanceCloseTime: settings.attendanceCloseTime || settings.jam_tutup || '10:00',
            attendanceEndTime: settings.attendanceEndTime || settings.jam_akhir || '08:00',
            lateThreshold: settings.lateThreshold || settings.batas_keterlambatan || '08:00',
            schoolName: settings.schoolName || settings.nama_sekolah || 'SMPK DON BOSCO',
            schoolLogo: settings.schoolLogo || settings.logo || null,
            limitOneScanPerDay: settings.limit_one_scan_per_day || settings.limitOneScanPerDay || false
          });
        } catch (err) {}
      }
    };

    loadSettings();

    const handleStorageChange = (e) => {
      if (e.key === 'school_settings') {
        loadSettings();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Manajemen Scanner di dalam modal absensi
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
    // Paksa ambil HH:mm dari jam laptop/HP (format Indonesia)
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${hours}:${minutes}`;
    
    // Pastikan kita hanya membandingkan HH:mm (ambil 5 karakter pertama)
    const openTime = (attendanceSettings.attendanceOpenTime || "06:00").substring(0, 5);
    const closeTime = (attendanceSettings.attendanceCloseTime || "10:00").substring(0, 5);
    const endTime = (attendanceSettings.attendanceEndTime || "08:00").substring(0, 5);

    if (currentTimeStr < openTime) return 'belum_buka';
    if (currentTimeStr > closeTime) return 'sudah_tutup';

    if (currentTimeStr <= endTime) {
      return 'hadir';
    } else {
      return 'terlambat';
    }
  };

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage({ type: '', text: '' });
    try {
      const status = getAttendanceStatus();

      if (status === 'belum_buka') {
        const msg = `❌ Absen belum dibuka! Silakan absen mulai jam ${attendanceSettings.attendanceOpenTime}`;
        showSubmitNotificationMessage(msg, 'error');
        setSubmitMessage({ type: 'error', text: msg });
        return;
      }
      if (status === 'sudah_tutup') {
        const msg = `❌ Absen sudah ditutup! Batas akhir jam ${attendanceSettings.attendanceCloseTime}`;
        showSubmitNotificationMessage(msg, 'error');
        setSubmitMessage({ type: 'error', text: msg });
        return;
      }

      // ✨ PERBAIKAN: Payload ganda (Redundant) untuk memastikan kecocokan key di backend
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

      // ✨ Tambahkan timeout 60 detik karena Cloudflare Tunnel sering lambat
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

      // ✨ PERBAIKAN: Deteksi Tunnel Mati (ERR_NAME_NOT_RESOLVED)
      if (!err.response && (err.code === 'ERR_NETWORK' || err.message.includes('Network Error'))) {
        errorMsg = 'Server tidak terjangkau. Link Cloudflare Tunnel Anda mungkin sudah expired (Mati). Mohon update file .env dengan link baru dan restart terminal.';
      }
      
      // ✨ PERBAIKAN: Tampilkan detail error validasi (422) agar tahu field yang salah
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
      const status = getAttendanceStatus();

      if (status === 'belum_buka') {
        const msg = `❌ Absen belum dibuka! Silakan absen mulai jam ${attendanceSettings.attendanceOpenTime}`;
        showSubmitNotificationMessage(msg, 'error');
        setSubmitMessage({ type: 'error', text: msg });
        return;
      }
      if (status === 'sudah_tutup') {
        const msg = `❌ Absen sudah ditutup! Batas akhir jam ${attendanceSettings.attendanceCloseTime}`;
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

      // ✨ Tambahkan timeout 60 detik
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
      const status = getAttendanceStatus();
      if (status === 'belum_buka' || status === 'sudah_tutup') {
        const msg = `❌ Pengajuan izin hanya bisa dilakukan saat jam operasional absensi (${attendanceSettings.attendanceOpenTime} - ${attendanceSettings.attendanceCloseTime})`;
        showSubmitNotificationMessage(msg, 'error');
        setSubmitMessage({ type: 'error', text: msg });
        return;
      }

        const token = localStorage.getItem('token');
      
      // ✨ PERBAIKAN: Gunakan JSON payload
      const payload = {
        full_name: izinForm.fullName.trim(),
        parent_phone: izinForm.parentPhone.trim(),
        reason: izinForm.reason,
        attendance_time: currentTime.toISOString(),
        status: 'izin'
      };

      // ✨ Tambahkan timeout 60 detik
      await api.post('/attendance/izin', payload, {
        timeout: 60000,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      showSubmitNotificationMessage('✅ Pengajuan izin berhasil dikirim!', 'success');
      setSubmitMessage({ type: 'success', text: '✅ Pengajuan izin berhasil dikirim!' });
      playSound('success');

      setIzinForm({ fullName: '', parentPhone: '', reason: '' });
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
      const readerElement = document.getElementById('qr-reader');
      if (!readerElement) {
        console.warn('QR reader element not found yet...');
        return;
      }
      if (qrScanner) return;
      
      const scanner = new Html5Qrcode('qr-reader');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 text-slate-900 font-sans">
      
      {/* ========== NAVBAR ========== */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-white/95 backdrop-blur-md shadow-md border-b border-blue-100' 
          : 'bg-slate-900/40 backdrop-blur-sm border-b border-white/10'
      }`}>
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md flex-shrink-0">
              {attendanceSettings.schoolLogo && !logoError ? (
                  <img 
                    src={resolvePhotoUrl(attendanceSettings.schoolLogo)} 
                    alt="Logo" 
                    className="w-7 h-7 object-contain bg-white rounded-md p-0.5 shadow-inner"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                )}
              </div>
              <div className="flex flex-col">
                <h1 className={`text-sm font-bold leading-tight transition-colors duration-300 ${isScrolled ? 'text-blue-900' : 'text-white'}`}>
                  {attendanceSettings.schoolName || 'SMPK DON BOSCO'}
                </h1>
                <div className={`flex items-center gap-1.5 text-[10px] font-medium transition-colors duration-300 ${isScrolled ? 'text-slate-500' : 'text-slate-300'}`}>
                  <span>{formatDate(currentTime)}</span>
                  <span className={isScrolled ? 'text-slate-300' : 'text-white/20'}>•</span>
                  <span className={`font-mono ${isScrolled ? 'text-blue-600' : 'text-cyan-400'}`}>{formatTime(currentTime)}</span>
                </div>
              </div>
            </div>
            
            {/* Unified Login Button */}
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
      </nav>

      {/* ========== HERO SECTION ========== */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden"> 
        {/* Background Slider */}
        <div className="absolute inset-0">
          {schoolBackgrounds.map((bg, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                index === currentBgIndex ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                backgroundImage: `url(${bg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/85 via-slate-800/80 to-indigo-900/85"></div>
        </div>
        
        {/* Background Dots Pattern */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }}></div>
        
        {/* Background Indicators */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-2 z-20">
          {schoolBackgrounds.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentBgIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentBgIndex ? 'bg-white w-6' : 'bg-white/40 hover:bg-white/60'
              }`}
              aria-label={`Background ${index + 1}`}
            />
          ))}
        </div>

        {/* Hero Content */}
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-white/90 text-xs font-medium mb-8 border border-white/20">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
            Sistem Absensi Digital • Real-time
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight tracking-tight">
            Absensi Sekolah<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-cyan-300 to-indigo-300">
              Lebih Cerdas & Efisien
            </span>
          </h1>
          
          <p className="text-lg text-slate-200 mb-10 max-w-2xl mx-auto leading-relaxed font-light">
            Platform absensi berbasis QR code untuk sekolah modern. 
            Pantau kehadiran real-time, laporan otomatis, dan akses multi-role dalam satu sistem terintegrasi.
          </p>
          
          {/* Action Buttons - Clean & Minimal */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
            <button
              onClick={() => setShowAbsenModal(true)}
              className="group px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center gap-2.5"
            >
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Absensi Cepat
            </button>
            
            <Link 
              to="/login"
              className="px-8 py-3.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 text-white font-medium rounded-xl transition-all flex items-center gap-2.5"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Login Ke Dashboard
            </Link>
          </div>

          <p className="mt-8 text-slate-300/80 text-sm">
            Belum terdaftar?{' '}
            <Link to="/register" className="text-cyan-300 font-medium hover:text-cyan-200 transition-colors hover:underline">
              Buat akun gratis →
            </Link>
          </p>
        </div>
      </section>

      {/* ========== FEATURES SECTION ========== */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-blue-600">Fitur Utama</p>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Mengapa Memilih Kami?</h2>
            <p className="mt-4 text-slate-600 max-w-2xl mx-auto">
              Solusi absensi digital yang dirancang untuk kebutuhan sekolah modern Indonesia
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="group rounded-2xl p-6 border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all bg-white">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">QR Code Absensi</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Absen dengan memindai QR Code dalam hitungan detik. Cepat, akurat, dan tanpa antrian.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group rounded-2xl p-6 border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all bg-white">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m6 0a2 2 0 002-2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Laporan Otomatis</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Rekap kehadiran real-time yang bisa diunduh dalam format Excel atau PDF kapan saja.
              </p>
            </div>

            {/* Feature 3 */}
            <Link 
              to="/login"
              state={{ role: 'siswa' }} // Contoh: default ke portal siswa
              className="group rounded-2xl p-6 border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all bg-white text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Multi-Role Access</h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                Klik di sini untuk memilih akses: Siswa, Guru, atau Admin.
              </p>
              <span className="text-xs font-bold text-blue-600">Pilih Role →</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="py-8 px-6 bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto text-center text-sm">
          <p>&copy; {new Date().getFullYear()} {attendanceSettings.schoolName || 'SMPK Don Bosco'}. All rights reserved.</p>
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
                  {/* ✨ Tambahkan whitespace-pre-line agar poin-poin error 422 muncul berbaris */}
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

      {/* ========== STANDALONE QR SCANNER MODAL ========== */}
      {showStandaloneQRScanner && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl relative">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between z-10 rounded-t-2xl">
              <div>
                <h3 className="text-base font-semibold text-slate-800">Scan QR Code</h3>
                <p className="text-xs text-slate-500">Arahkan kamera ke QR code absensi</p>
              </div>
              <button
                onClick={handleCloseStandaloneQRScanner}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5">
              {showQRScanner ? (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div id="qr-reader" className="mb-4 rounded-lg overflow-hidden bg-white"></div>
                  {cameraError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                      <p className="text-xs text-red-700">{cameraError}</p>
                    </div>
                  )}
                  <button
                    onClick={toggleCamera}
                    className="w-full mb-3 py-2 px-4 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
                  >
                    <span className="text-lg">🔄</span>
                    Ganti Kamera ({facingMode === 'environment' ? 'Belakang' : 'Depan'})
                  </button>
                  <button
                    onClick={handleCloseStandaloneQRScanner}
                    className="w-full py-2.5 text-sm text-slate-600 hover:text-slate-800 font-medium rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    Tutup Scanner
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleOpenScanner}
                  className="w-full py-12 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl text-slate-600 font-medium hover:border-blue-400 hover:bg-blue-50 transition-all flex flex-col items-center gap-4"
                >
                  <svg className="w-14 h-14 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div className="text-center">
                    <span className="text-base font-medium">Klik untuk Mulai Scan</span>
                    <p className="text-sm text-slate-500 mt-1">Pastikan QR code terlihat jelas di kamera</p>
                  </div>
                </button>
              )}
              {qrResult && (
                <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <p className="text-sm text-emerald-700 font-medium mb-2">✅ QR Terdeteksi:</p>
                  <pre className="text-xs text-emerald-700 bg-white rounded p-3 overflow-x-auto max-h-32">
                    {JSON.stringify(qrResult, null, 2)}
                  </pre>
                </div>
              )}
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2 text-sm flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Panduan Scan
                </h4>
                <ul className="space-y-1.5 text-sm text-blue-800">
                  <li>• Klik tombol "Mulai Scan"</li>
                  <li>• Arahkan kamera ke QR code</li>
                  <li>• Tunggu hingga terdeteksi otomatis</li>
                  <li>• Data tersimpan secara real-time</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

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
                      {role === 'siswa' ? '🧑‍🎓' : '👨‍🏫'} {role === 'siswa' ? 'Siswa' : 'Guru'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Method Tabs */}
              <div className="flex justify-center mb-5">
                <div className="inline-flex bg-slate-50 rounded-2xl p-1 border border-slate-200 w-full">
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
                  {activeMethodTab === 'scan' && (
                    <div className="animate-fade-in text-center">
                      <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl mb-4 mx-auto max-w-[280px] aspect-square relative border-4 border-blue-50">
                        <div id="qr-reader" className="w-full h-full"></div>
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
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">No. Telepon Orang Tua *</label>
                        <input
                          type="tel"
                          value={izinForm.parentPhone}
                          onChange={(e) => setIzinForm(prev => ({ ...prev, parentPhone: e.target.value }))}
                          className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          placeholder="08123456789"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">Keterangan *</label>
                        <textarea
                          value={izinForm.reason}
                          onChange={(e) => setIzinForm(prev => ({ ...prev, reason: e.target.value }))}
                          className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                          rows="3"
                          placeholder="Alasan izin..."
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
            <li>• Absen Dibuka: <strong>{attendanceSettings.attendanceOpenTime}</strong></li>
            <li>• Absen Ditutup: <strong>{attendanceSettings.attendanceCloseTime}</strong></li>
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