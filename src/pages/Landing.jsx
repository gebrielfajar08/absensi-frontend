import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { Html5Qrcode } from 'html5-qrcode';

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
  const [showQRNotification, setShowQRNotification] = useState(false);
  const [qrNotificationMessage, setQrNotificationMessage] = useState('');
  const [qrNotificationType, setQrNotificationType] = useState('error');

  const [showSubmitNotification, setShowSubmitNotification] = useState(false);
  const [submitNotificationMessage, setSubmitNotificationMessage] = useState('');
  const [submitNotificationType, setSubmitNotificationType] = useState('error');

  const [showStandaloneQRScanner, setShowStandaloneQRScanner] = useState(false);

  const [studentForm, setStudentForm] = useState({ user_id: '' });
  const [teacherForm, setTeacherForm] = useState({ nip: '' });
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
    attendanceEndTime: '08:00',
    lateThreshold: '08:00',
    schoolName: 'SMPK DON BOSCO',
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
      try {
        const token = localStorage.getItem('token');
      } catch (err) {
        console.log('Backend settings fetch skipped');
      }

      const savedSettings = localStorage.getItem('school_settings');
      if (savedSettings) {
        try {
          const settings = JSON.parse(savedSettings);
          setAttendanceSettings({
            attendanceStartTime: settings.attendanceStartTime || settings.jam_masuk || '07:00',
            attendanceEndTime: settings.attendanceEndTime || settings.jam_akhir || '08:00',
            lateThreshold: settings.lateThreshold || settings.batas_keterlambatan || '08:00',
            schoolName: settings.schoolName || 'SMPK DON BOSCO',
            schoolLogo: settings.schoolLogo || null,
            limitOneScanPerDay: settings.limit_one_scan_per_day || settings.limitOneScanPerDay || false
          });
        } catch (err) {
        }
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
      // Cleanup saat komponen unmount
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
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    if (currentTimeStr <= attendanceSettings.attendanceEndTime) {
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
      const formData = new FormData();
      formData.append('user_id', studentForm.user_id);
      formData.append('attendance_time', currentTime.toISOString());
      formData.append('status', status);

      const token = localStorage.getItem('token');
      const config = token ? {
        timeout: 120000,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      } : {
        timeout: 120000,
        headers: { 'Content-Type': 'multipart/form-data' }
      };

      const response = await api.post('/attendance/student/manual', formData, config);
      const statusText = status === 'hadir' ? '✅ Tepat Waktu' : '⚠️ Terlambat';
      showSubmitNotificationMessage(`Absensi siswa berhasil! ${statusText}`, 'success');
      setSubmitMessage({ type: 'success', text: `✅ Absensi siswa berhasil! ${statusText}` });
      
      if (status === 'hadir') {
        playSound('success');
      } else {
        playSound('late');
      }

      setStudentForm({ user_id: '' });
      localStorage.setItem('attendance_updated', Date.now().toString());
      
      setTimeout(() => {
        setShowAbsenModal(false);
        setSubmitMessage({ type: '', text: '' });
      }, 2000);
    } catch (err) {
      if (err.response?.status !== 401 && err.code !== 'ERR_NETWORK') {
        console.error('Error submitting attendance:', err);
      }
      const errorMsg = err.response?.data?.message || err.message || 'Gagal menyimpan absensi';
      showSubmitNotificationMessage(`❌ Gagal: ${errorMsg}`, 'error');
      setSubmitMessage({
        type: 'error',
        text: '❌ Gagal: ' + (err.response?.data?.message || err.message)
      });
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
      const formData = new FormData();
      formData.append('nip', teacherForm.nip);
      formData.append('attendance_time', currentTime.toISOString());
      formData.append('status', status);

      const token = localStorage.getItem('token');
      const config = token ? {
        timeout: 120000,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      } : {
        timeout: 120000,
        headers: { 'Content-Type': 'multipart/form-data' }
      };

      await api.post('/attendance/teacher/manual', formData, config);
      const statusText = status === 'hadir' ? '✅ Tepat Waktu' : '⚠️ Terlambat';
      showSubmitNotificationMessage(`Absensi guru berhasil! ${statusText}`, 'success');
      setSubmitMessage({ type: 'success', text: `✅ Absensi guru berhasil! ${statusText}` });
      
      if (status === 'hadir') {
        playSound('success');
      } else {
        playSound('late');
      }

      setTeacherForm({ nip: '' });
      localStorage.setItem('attendance_updated', Date.now().toString());
    } catch (err) {
      if (err.response?.status !== 401 && err.code !== 'ERR_NETWORK') {
        console.error('Gagal submit absen guru:', err);
      }
      const errorMsg = err.response?.data?.message || err.message || 'Gagal menyimpan absensi';
      showSubmitNotificationMessage(`❌ Gagal: ${errorMsg}`, 'error');
      setSubmitMessage({
        type: 'error',
        text: '❌ Gagal: ' + (err.response?.data?.message || err.message)
      });
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
      const formData = new FormData();
      formData.append('full_name', izinForm.fullName);
      formData.append('parent_phone', izinForm.parentPhone);
      formData.append('reason', izinForm.reason);
      formData.append('attendance_time', currentTime.toISOString());
      formData.append('status', 'izin');

      const token = localStorage.getItem('token');
      const config = token ? {
        timeout: 120000,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      } : {
        timeout: 120000,
        headers: { 'Content-Type': 'multipart/form-data' }
      };

      await api.post('/attendance/izin', formData, config);
      showSubmitNotificationMessage('✅ Pengajuan izin berhasil dikirim!', 'success');
      setSubmitMessage({ type: 'success', text: '✅ Pengajuan izin berhasil dikirim!' });
      playSound('success');

      setIzinForm({
        fullName: '',
        parentPhone: '',
        reason: ''
      });
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
      setSubmitMessage({
        type: 'error',
        text: '❌ Gagal: ' + (err.response?.data?.message || err.message)
      });
      playSound('failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQRScan = async (decodedText) => {
    try {
      console.log('📱 QR Data received:', decodedText);
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

      // Pastikan tidak mengirim double jika sedang proses
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
      console.log('📤 Submitting QR attendance:', qrData);
      console.log('🔑 Token:', token ? 'Tersedia' : 'Tidak Ada (Mode Publik)');
      
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

      console.log('📦 Request data:', requestData);
      
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

      console.log('✅ QR Submit Response:', response.data);
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
        console.info('⚠️ Already absent today:', backendMessage);
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
        console.error('❌ Error response:', err.response);
        console.error('❌ Error status:', status);
        console.error('❌ Error data:', err.response?.data);
      }

      const errorMsg = backendMessage || err.response?.data?.error || 'Gagal menyimpan absensi';
      playSound('failed');
      showQRNotificationMessage(`❌ ${errorMsg}`, 'error');
      showSubmitNotificationMessage(`❌ ${errorMsg}`, 'error');
      setSubmitMessage({
        type: 'error',
        text: '❌ Gagal: ' + errorMsg
      });
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const startQRScanner = async () => {
    try {
      setCameraError('');
      const readerElement = document.getElementById('qr-reader');
      if (!readerElement) {
        console.warn('qr-reader belum ada, menunggu render...');
        setTimeout(() => {
          startQRScanner();
        }, 300);
        return;
      }
      if (qrScanner) {
        console.warn('Scanner sudah aktif');
        return;
      }
      const scanner = new Html5Qrcode('qr-reader');
      setQrScanner(scanner);
      
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        (decodedText) => {
          handleQRScan(decodedText);
        },
        () => {
        }
      );
    } catch (err) {
      console.error('Failed to start QR scanner:', err);
      setCameraError('Tidak dapat mengakses kamera. Pastikan izin kamera diberikan.');
      showQRNotificationMessage('Gagal memulai scanner. Silakan coba lagi.', 'error');
    }
  };

  const stopQRScanner = async () => {
    const scanner = qrScanner;
    if (scanner) {
      setQrScanner(null);
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
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
    setTimeout(() => {
      setShowQRNotification(false);
    }, 3000);
  };

  const showSubmitNotificationMessage = (message, type = 'error') => {
    setSubmitNotificationMessage(message);
    setSubmitNotificationType(type);
    setShowSubmitNotification(true);
    setTimeout(() => {
      setShowSubmitNotification(false);
    }, 3000);
  };

  const handleOpenScanner = () => {
    setShowQRScanner(true);
    setCameraError('');
    setTimeout(() => {
      startQRScanner();
    }, 300); // Beri jeda sedikit lebih lama agar DOM siap
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
    setTimeout(() => {
      startQRScanner();
    }, 400);
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
    <div className="min-h-screen transition-colors duration-300 bg-gradient-to-br from-blue-50 via-white to-blue-100 text-gray-900">
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/95 backdrop-blur-md shadow-lg border-b border-blue-100' : 'bg-white/80 backdrop-blur-sm'
      }`}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-blue-600 to-blue-700">
                <img 
                  src={attendanceSettings.schoolLogo ? `${api.defaults.baseURL.replace('/api', '')}/${attendanceSettings.schoolLogo}` : "logo sekolah.jpeg"} 
                  alt="Logo" 
                  className="w-11 h-11 object-contain rounded-lg bg-white p-0.5"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-blue-900">
  {attendanceSettings.schoolName || 'SMPK DON BOSCO'}
</h1>
                <p className="text-xs font-medium text-blue-600">Sistem Absensi Digital</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl border bg-blue-50 border-blue-200">
                <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
</svg>
                <div className="text-right">
                  <p className="text-xs font-semibold text-blue-900">{formatDate(currentTime)}</p>
                  <p className="text-sm font-bold font-mono text-blue-600">{formatTime(currentTime)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <section className="pt-36 pb-24 px-6 relative overflow-hidden"> 
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
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/90 via-blue-800/90 to-blue-950/90"></div>
        </div>
        
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-2 z-20">
          {schoolBackgrounds.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentBgIndex(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentBgIndex ? 'bg-white w-8' : 'bg-white/50'
              }`}
            />
          ))}
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/15 backdrop-blur-sm rounded-full text-white text-sm font-medium mb-8 border border-white/25">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            Sistem Absensi Digital Modern
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Selamat Datang di<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-300">
              Sistem Absensi Digital
            </span>
          </h1>
          
          <p className="text-lg text-blue-100 mb-10 max-w-2xl mx-auto leading-relaxed">
            Platform absensi berbasis QR code untuk sekolah modern. 
            Pantau kehadiran real-time, laporan otomatis, dan akses multi-role.
          </p>
          
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => setShowAbsenModal(true)}
              className="px-8 py-3.5 bg-white text-blue-700 font-semibold rounded-xl shadow-xl hover:shadow-2xl hover:bg-blue-50 transition-all transform hover:-translate-y-1 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Mulai Absensi
            </button>
          </div>

          <p className="mt-6 text-blue-100/80 text-sm animate-fade-in">
            Belum punya akun?{' '}
            <Link to="/register" className="text-cyan-300 font-bold hover:underline hover:text-cyan-200 transition-colors">
              Buat akun di sini secara gratis
            </Link>
          </p>
        </div>
      </section>

      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold uppercase tracking-wider mb-3 text-blue-600">Portal Akses</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Pilih Role Anda</h2>
            <p className="mt-3 max-w-2xl mx-auto text-gray-600">Akses sistem sesuai dengan peran Anda di sekolah</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Link
              to="/login/guru"
              className="group p-7 rounded-2xl border-2 transition-all duration-300 bg-white border-gray-200 hover:border-blue-400 hover:shadow-2xl"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-3xl mb-5 group-hover:scale-110 transition-transform shadow-lg">
                🎓
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">Guru</h3>
              <p className="text-sm font-medium mb-3 text-blue-600">Input & Kelola Absensi</p>
              <p className="text-sm leading-relaxed text-gray-600">Akses dashboard untuk mengelola kelas, input kehadiran, dan lihat laporan siswa.</p>
              <div className="mt-5 flex items-center text-sm font-semibold group-hover:gap-2 transition-all text-blue-600">
                <span>Akses Dashboard</span>
                <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>

            <Link
              to="/login/siswa"
              className="group p-7 rounded-2xl border-2 transition-all duration-300 bg-white border-gray-200 hover:border-blue-400 hover:shadow-2xl"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-3xl mb-5 group-hover:scale-110 transition-transform shadow-lg">
                🧑‍🎓
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">Siswa</h3>
              <p className="text-sm font-medium mb-3 text-blue-600">Cek Kehadiran & Jadwal</p>
              <p className="text-sm leading-relaxed text-gray-600">Lihat riwayat absensi, jadwal pelajaran, dan download QR code pribadi.</p>
              <div className="mt-5 flex items-center text-sm font-semibold group-hover:gap-2 transition-all text-blue-600">
                <span>Lihat Profil</span>
                <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>

            <Link
              to="/login/admin"
              className="group p-7 rounded-2xl border-2 transition-all duration-300 bg-white border-gray-200 hover:border-blue-400 hover:shadow-2xl"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-3xl mb-5 group-hover:scale-110 transition-transform shadow-lg">
                👮
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">Admin</h3>
              <p className="text-sm font-medium mb-3 text-blue-600">Kelola Sistem & User</p>
              <p className="text-sm leading-relaxed text-gray-600">Kelola data user, kelas, dan monitoring seluruh aktivitas sistem sekolah.</p>
              <div className="mt-5 flex items-center text-sm font-semibold group-hover:gap-2 transition-all text-blue-600">
                <span>Panel Admin</span>
                <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-blue-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold uppercase tracking-wider mb-3 text-blue-600">Fitur Unggulan</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Mengapa Memilih Kami?</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="rounded-2xl p-7 shadow-lg border bg-white border-blue-100">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 bg-blue-100">
                <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold mb-3 text-gray-900">QR Code Absensi</h3>
              <p className="text-sm leading-relaxed text-gray-600">Absen dengan memindai QR Code, cepat dan akurat. Tidak perlu mengetik NIS/NIP.</p>
            </div>

            <div className="rounded-2xl p-7 shadow-lg border bg-white border-blue-100">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 bg-blue-100">
                <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m6 0a2 2 0 002-2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold mb-3 text-gray-900">Laporan Otomatis</h3>
              <p className="text-sm leading-relaxed text-gray-600">Laporan kehadiran yang tersedia secara real-time. Dapat diunduh dalam format Excel atau PDF.</p>
            </div>

            <div className="rounded-2xl p-7 shadow-lg border bg-white border-blue-100">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 bg-blue-100">
                <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold mb-3 text-gray-900">Multi-Role Access</h3>
              <p className="text-sm leading-relaxed text-gray-600">Akses sesuai peran Anda: Guru, Siswa, atau Admin dengan hak akses berbeda.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-8 px-6 bg-blue-900 text-blue-200">
        <div className="max-w-7xl mx-auto text-center">
          <p>&copy; 2026 SMPK Don Bosco Semboro. All rights reserved.</p>
        </div>
      </footer>

      {showQRNotification && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full transform transition-all animate-fade-in ${
            qrNotificationType === 'success' ? 'border-4 border-green-500' : 'border-4 border-red-500'
          }`}>
            <div className="text-center">
              <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
                qrNotificationType === 'success' ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {qrNotificationType === 'success' ? (
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <h3 className={`text-xl font-bold mb-2 ${
                qrNotificationType === 'success' ? 'text-green-700' : 'text-red-700'
              }`}>
                {qrNotificationType === 'success' ? '✅ Berhasil!' : '❌ Error!'}
              </h3>
              <p className="text-gray-600 mb-6">{qrNotificationMessage}</p>
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

      {showSubmitNotification && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full transform transition-all animate-fade-in ${
            submitNotificationType === 'success' ? 'border-4 border-green-500' : 'border-4 border-red-500'
          }`}>
            <div className="text-center">
              <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
                submitNotificationType === 'success' ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {submitNotificationType === 'success' ? (
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <h3 className={`text-xl font-bold mb-2 ${
                submitNotificationType === 'success' ? 'text-green-700' : 'text-red-700'
              }`}>
                {submitNotificationType === 'success' ? '✅ Berhasil!' : '❌ Error!'}
              </h3>
              <p className="text-gray-600 mb-6">{submitNotificationMessage}</p>
              <button
                onClick={() => setShowSubmitNotification(false)}
                className={`px-6 py-2.5 rounded-xl font-medium transition-all ${
                  submitNotificationType === 'success'
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

      {showStandaloneQRScanner && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl relative">
            <div className="sticky top-0 bg-white border-b border-blue-200 px-5 py-4 flex items-center justify-between z-10 rounded-t-2xl">
              <div>
                <h3 className="text-lg font-bold text-gray-800">📷 Scan QR Code</h3>
                <p className="text-xs text-gray-500">Scan QR untuk absensi (Guru/Siswa)</p>
              </div>
              <button
                onClick={handleCloseStandaloneQRScanner}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5">
              {showQRScanner ? (
                <div className="bg-white rounded-xl p-4 border border-blue-200">
                  <div id="qr-reader" className="mb-4 rounded-lg overflow-hidden"></div>
                  {cameraError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                      <p className="text-xs text-red-700">{cameraError}</p>
                    </div>
                  )}
                  <button
                    onClick={handleCloseStandaloneQRScanner}
                    className="w-full py-2.5 text-sm text-gray-600 hover:text-blue-700 font-medium rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    Tutup Scanner
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleOpenScanner}
                  className="w-full py-14 bg-blue-50 border-2 border-dashed border-blue-300 rounded-xl text-blue-700 font-medium hover:border-blue-500 hover:bg-blue-100 transition-all flex flex-col items-center gap-4"
                >
                  <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div className="text-center">
                    <span className="text-lg font-semibold">Klik untuk Buka Scanner</span>
                    <p className="text-sm text-gray-500 mt-1">Pastikan QR code terlihat jelas</p>
                  </div>
                </button>
              )}
              {qrResult && (
                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-700 font-medium mb-2">✅ QR Terdeteksi:</p>
                  <pre className="text-xs text-green-600 bg-white rounded p-3 overflow-x-auto">
                    {JSON.stringify(qrResult, null, 2)}
                  </pre>
                </div>
              )}
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2 text-sm flex items-center gap-1">
                  <span>ℹ️</span> Cara Scan
                </h4>
                <ul className="space-y-1.5 text-sm text-blue-800">
                  <li>• Klik tombol "Buka Scanner"</li>
                  <li>• Arahkan kamera ke QR code</li>
                  <li>• Tunggu hingga terdeteksi otomatis</li>
                  <li>• Data tersimpan otomatis</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAbsenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl my-8 shadow-2xl relative">
            <div className="sticky top-0 bg-white border-b border-blue-200 px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
              <div>
                <h3 className="text-lg font-bold text-gray-800">🚀 Absensi</h3>
                <p className="text-xs text-gray-500">Pilih role dan metode absensi</p>
              </div>
              <button
                onClick={() => {
                  handleCloseScanner();
                  setShowAbsenModal(false);
                  setSubmitMessage({ type: '', text: '' });
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              <div className="flex justify-center mb-6">
                <div className="inline-flex bg-blue-50 rounded-xl p-1">
                  <button
                    onClick={() => { setActiveUserRole('siswa'); setActiveMethodTab('scan'); }}
                    className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                      activeUserRole === 'siswa'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-gray-600 hover:text-blue-700'
                    }`}
                  >
                    <span>🧑‍🎓</span> Absen Siswa
                  </button>
                  <button
                    onClick={() => { setActiveUserRole('guru'); setActiveMethodTab('scan'); }}
                    className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                      activeUserRole === 'guru'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-gray-600 hover:text-blue-700'
                    }`}
                  >
                    <span>🎓</span> Absen Guru
                  </button>
                </div>
              </div>

              <div className="flex justify-center mb-6">
                <div className="inline-flex bg-gray-100 rounded-xl p-1">
                  <button
                    onClick={() => setActiveMethodTab('scan')}
                    className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeMethodTab === 'scan'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-gray-600 hover:text-blue-700'
                    }`}
                  >
                    📷 Scan
                  </button>
                  <button
                    onClick={() => setActiveMethodTab('manual')}
                    className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeMethodTab === 'manual'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-gray-600 hover:text-blue-700'
                    }`}
                  >
                    ✍️ Manual
                  </button>
                  <button
                    onClick={() => setActiveMethodTab('izin')}
                    className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeMethodTab === 'izin'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-gray-600 hover:text-blue-700'
                    }`}
                  >
                    📝 Izin
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl border border-blue-200 overflow-hidden">
                <div className="p-6 bg-white">
                  {activeMethodTab === 'scan' && (
                    <div className="text-center py-8">
                      <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <h4 className="text-lg font-semibold text-gray-800 mb-2">Scan QR Code</h4>
                      <p className="text-sm text-gray-600 mb-6">Arahkan kamera ke QR code {activeUserRole === 'siswa' ? 'siswa' : 'guru'}</p>
                      <button
                        onClick={() => { handleOpenStandaloneQRScanner(); setShowAbsenModal(false); }}
                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg"
                      >
                        Buka Scanner Kamera
                      </button>
                    </div>
                  )}

                  {activeMethodTab === 'manual' && activeUserRole === 'siswa' && (
                    <form onSubmit={handleStudentSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-2">
                          NIS *
                        </label>
                        <input
                          type="text"
                          value={studentForm.user_id}
                          onChange={(e) => setStudentForm(prev => ({ ...prev, user_id: e.target.value }))}
                          className="w-full px-4 py-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          placeholder="Masukkan NIS siswa"
                          required
                        />
                      </div>
                      {submitMessage.text && (
                        <div className={`p-3 rounded-xl text-xs ${
                          submitMessage.type === 'success'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {submitMessage.text}
                        </div>
                      )}
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Memproses...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Absen Siswa
                          </>
                        )}
                      </button>
                    </form>
                  )}

                  {activeMethodTab === 'manual' && activeUserRole === 'guru' && (
                    <form onSubmit={handleTeacherSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-2">
                          NIP *
                        </label>
                        <input
                          type="text"
                          value={teacherForm.nip}
                          onChange={(e) => setTeacherForm(prev => ({ ...prev, nip: e.target.value }))}
                          className="w-full px-4 py-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          placeholder="Masukkan NIP guru"
                          required
                        />
                      </div>
                      {submitMessage.text && (
                        <div className={`p-3 rounded-xl text-xs ${
                          submitMessage.type === 'success'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {submitMessage.text}
                        </div>
                      )}
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Memproses...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Absen Guru
                          </>
                        )}
                      </button>
                    </form>
                  )}

                  {activeMethodTab === 'izin' && (
                    <form onSubmit={handleIzinSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-2">
                          Nama Lengkap *
                        </label>
                        <input
                          type="text"
                          value={izinForm.fullName}
                          onChange={(e) => setIzinForm(prev => ({ ...prev, fullName: e.target.value }))}
                          className="w-full px-4 py-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          placeholder="Nama lengkap"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-2">
                          Nomor Telepon Orang Tua *
                        </label>
                        <input
                          type="tel"
                          value={izinForm.parentPhone}
                          onChange={(e) => setIzinForm(prev => ({ ...prev, parentPhone: e.target.value }))}
                          className="w-full px-4 py-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          placeholder="08123456789"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-2">
                          Keterangan *
                        </label>
                        <textarea
                          value={izinForm.reason}
                          onChange={(e) => setIzinForm(prev => ({ ...prev, reason: e.target.value }))}
                          className="w-full px-4 py-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                          rows="3"
                          placeholder="Alasan izin..."
                          required
                        />
                      </div>
                      {submitMessage.text && (
                        <div className={`p-3 rounded-xl text-xs ${
                          submitMessage.type === 'success'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {submitMessage.text}
                        </div>
                      )}
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Memproses...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Kirim Pengajuan Izin
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              </div>

              <div className="mt-5 bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h4 className="font-semibold text-blue-900 mb-2 text-xs flex items-center gap-1">
                  <span>ℹ️</span> Info Waktu
                </h4>
                <ul className="space-y-1.5 text-xs text-blue-800">
                  <li>• Jam masuk: <strong>{attendanceSettings.attendanceStartTime}</strong></li>
                  <li>• Batas terlambat: <strong>{attendanceSettings.lateThreshold}</strong></li>
                  <li>• Status ditentukan otomatis berdasarkan waktu</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default Landing;