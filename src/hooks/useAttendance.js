import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import api from '../api/axios';
import { 
  getLocalTimestamp, 
  getJakartaDateKey, 
  checkIsHoliday, 
  getAttendanceStatus, 
  fetchWithRetry,
  countTodayAttendance
} from '../utils/attendance';

const useAttendance = (currentTime) => {
  const [activeUserRole, setActiveUserRole] = useState('siswa');
  const [activeAttendanceAction, setActiveAttendanceAction] = useState('datang');
  const [activeMethodTab, setActiveMethodTab] = useState('scan');
  const [showAbsenModal, setShowAbsenModal] = useState(false);
  const [showAttendanceListModal, setShowAttendanceListModal] = useState(false);
  const [showQRNotification, setShowQRNotification] = useState(false);
  const [qrNotificationMessage, setQrNotificationMessage] = useState('');
  const [qrNotificationType, setQrNotificationType] = useState('error');
  const [showSubmitNotification, setShowSubmitNotification] = useState(false);
  const [submitNotificationMessage, setSubmitNotificationMessage] = useState('');
  const [submitNotificationType, setSubmitNotificationType] = useState('error');
  const [showLandingNotification, setShowLandingNotification] = useState(false);
  const [landingNotificationMessage, setLandingNotificationMessage] = useState('');
  const [backendStatus, setBackendStatus] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState({ type: '', text: '' });
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState('');

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

  const isSubmittingRef = useRef(false);
  const lastScannedDataRef = useRef(null);
  const lastScannedAtRef = useRef(0);
  const audioContextRef = useRef(null);

// ✅ Load settings - TANPA RETRY SPAM
const loadSettings = async () => {
  try {
    // Hanya 1x percobaan, timeout 10 detik
    const res = await api.get('/public/settings', { 
      timeout: 10000,
      headers: { 'Cache-Control': 'no-cache' }
    });
    
    const settings = res.data?.data || res.data;
    if (!settings) return;

    const mappedSettings = {
      attendanceStartTime: settings.attendanceStartTime || settings.attendance_start_time || settings.jam_masuk || '07:00',
      attendanceEndTime: settings.attendanceEndTime || settings.attendance_end_time || settings.jam_akhir || '12:00',
      lateThreshold: settings.lateThreshold || settings.late_threshold || settings.batas_keterlambatan || '08:00',
      pulangStartTime: settings.pulangStartTime || settings.pulang_start_time || settings.jam_pulang_mulai || settings.jam_pulang || '15:00',
      pulangEndTime: settings.pulangEndTime || settings.pulang_end_time || settings.jam_pulang_akhir || '17:00',
      schoolEndTime: settings.schoolEndTime || settings.jam_pulang || '15:30',
      schoolName: settings.schoolName || settings.nama_sekolah || 'SMPK DON BOSCO',
      schoolLogo: settings.schoolLogo || settings.logo || null,
      limitOneScanPerDay: settings.limitOneScanPerDay || false,
      disableAttendanceOnHolidays: settings.disableAttendanceOnHolidays ?? settings.disable_attendance_on_holidays ?? true,
      activeDays: settings.activeDays || settings.active_days || 'Senin,Selasa,Rabu,Kamis,Jumat,Sabtu'
    };

    setAttendanceSettings(mappedSettings);
    localStorage.setItem('school_settings', JSON.stringify(mappedSettings));
    setBackendStatus(null);
  } catch (err) {
    // Silent fail - jangan spam console
    console.warn('⚠️ Gagal ambil settings, gunakan cache');
    const savedSettings = localStorage.getItem('school_settings');
    if (savedSettings) {
      try {
        setAttendanceSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error("Error parsing cache", e);
      }
    }
  }
};

// ✅ Fetch stats - TANPA RETRY SPAM
const fetchStats = async () => {
  try {
    // Hanya 1x percobaan, timeout 10 detik
    const res = await api.get('/public/stats', { 
      timeout: 10000,
      headers: { 'Cache-Control': 'no-cache' }
    });

    if (res && res.data != null) {
      const raw = res.data;
      let statsSummary = { totalHadir: 0, keterlambatan: 0 };
      let recordsForToday = [];

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
        const statsObj = (raw?.data && typeof raw.data === 'object' && !Array.isArray(raw.data))
          ? raw.data
          : raw;

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

        const nestedRecords = statsObj?.records || statsObj?.data_records ||
                              raw?.records || raw?.data_records || [];
        if (Array.isArray(nestedRecords) && nestedRecords.length > 0) {
          const result = countTodayAttendance(nestedRecords);
          recordsForToday = result.todayRecords;
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
      setBackendStatus(null);
    }
  } catch (err) {
    // Silent fail - jangan spam console
    console.warn('⚠️ Stats API gagal, gunakan 0');
    setAttendanceStats({ totalHadir: 0, keterlambatan: 0 });
  }
};

  // Play sound
  const playSound = (type) => {
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();
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

  // Refresh stats
  const refreshStatsAfterSubmit = async () => {
    localStorage.setItem('attendance_updated', Date.now().toString());
    await new Promise(resolve => setTimeout(resolve, 500));
    await fetchStats();
    setTimeout(() => fetchStats(), 1500);
  };

  // Show notifications
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

  // Try open absen
  const handleTryOpenAbsen = (action = 'datang') => {
    const status = getAttendanceStatus(currentTime, attendanceSettings, action);

    if (status === 'libur') {
      showSubmitNotificationMessage("❌ Hari ini adalah hari libur. Absensi tidak tersedia.", "error");
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

  // Student submit
  const handleStudentSubmit = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitMessage({ type: '', text: '' });
    try {
      if (checkIsHoliday(currentTime, attendanceSettings)) {
        setSubmitMessage({ type: 'error', text: '❌ Hari ini libur. Absensi ditiadakan.' });
        return;
      }

      const status = getAttendanceStatus(currentTime, attendanceSettings, activeAttendanceAction);

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

      const baseUrl = api.defaults.baseURL || 'http://127.0.0.1:8000/api';
      await axios.post(`${baseUrl}/public/attendance/student`, payload, {
        timeout: 15000,
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
        errorMsg = 'Koneksi Timeout. Server lambat atau tidak merespons.';
      }

      if (!err.response && (err.code === 'ERR_NETWORK' || err.message.includes('Network Error'))) {
        errorMsg = 'Server tidak terjangkau. Periksa koneksi internet.';
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

  // Teacher submit
  const handleTeacherSubmit = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitMessage({ type: '', text: '' });
    try {
      if (checkIsHoliday(currentTime, attendanceSettings)) {
        setSubmitMessage({ type: 'error', text: '❌ Hari ini libur. Absensi ditiadakan.' });
        return;
      }

      const status = getAttendanceStatus(currentTime, attendanceSettings, activeAttendanceAction);

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

      const payload = {
        name: teacherForm.fullName.trim(),
        full_name: teacherForm.fullName.trim(),
        user_id: teacherForm.nip.trim(),
        nis: teacherForm.nip.trim(),
        nip: teacherForm.nip.trim(),
        teacher_id: teacherForm.nip.trim(),
        attendance_time: getLocalTimestamp(currentTime),
        scan_time: getLocalTimestamp(currentTime),
        status: activeAttendanceAction === 'pulang' ? 'hadir' : status,
        role: 'guru',
        type: activeAttendanceAction === 'pulang' ? 'pulang' : 'manual',
        action: activeAttendanceAction
      };

      const baseUrl = api.defaults.baseURL || 'http://127.0.0.1:8000/api';
      await axios.post(`${baseUrl}/public/attendance/teacher`, payload, {
        timeout: 15000,
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

      if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        errorMsg = 'Koneksi Timeout. Server lambat atau tidak merespons.';
      }

      if (!err.response && (err.code === 'ERR_NETWORK' || err.message.includes('Network Error'))) {
        errorMsg = 'Server tidak terjangkau. Periksa koneksi internet.';
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

  // ✅ Izin submit - sudah diperbaiki, hapus duplikasi komentar
  const handleIzinSubmit = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitMessage({ type: '', text: '' });
    
    try {
      if (checkIsHoliday(currentTime, attendanceSettings)) {
        setSubmitMessage({ type: 'error', text: '❌ Tidak dapat mengirim izin pada hari libur.' });
        return;
      }

      const token = localStorage.getItem('token');

      if (!izinForm.user_id.trim()) {
        setSubmitMessage({ type: 'error', text: '❌ NIS/NIP harus diisi!' });
        return;
      }

      const payload = {
        user_id: izinForm.user_id.trim(),
        full_name: izinForm.fullName.trim(),
        name: izinForm.fullName.trim(),
        status: izinForm.type,
        reason: izinForm.reason || izinForm.keterangan || '',
        keterangan: izinForm.reason || izinForm.keterangan || '',
        notes: izinForm.reason || izinForm.keterangan || '',
        role: activeUserRole === 'guru' ? 'guru' : 'siswa',
        date: getJakartaDateKey(currentTime),
        attendance_time: getLocalTimestamp(currentTime),
        scan_time: getLocalTimestamp(currentTime),
        type: 'manual',
        approval_status: 'pending',
        is_pending: true,
        pending: true,
      };

      if (activeUserRole === 'siswa') {
        payload.parent_phone = izinForm.parent_phone?.trim() || '';
        payload.student_id = izinForm.user_id.trim();
        payload.nis = izinForm.user_id.trim();
      } else if (activeUserRole === 'guru') {
        payload.nip = izinForm.user_id.trim();
        payload.teacher_id = izinForm.user_id.trim();
      }

      const baseUrl = api.defaults.baseURL || 'http://127.0.0.1:8000/api';

      let response;
      if (izinForm.attachment) {
        const formData = new FormData();
        Object.keys(payload).forEach(key => {
          if (payload[key] !== null && payload[key] !== undefined) {
            formData.append(key, payload[key]);
          }
        });
        formData.append('attachment', izinForm.attachment);

        response = await axios.post(`${baseUrl}/public/attendance/izin`, formData, {
          timeout: 30000,
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
      } else {
        response = await axios.post(`${baseUrl}/public/attendance/izin`, payload, {
          timeout: 30000,
          headers: token ? { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          } : {
            'Content-Type': 'application/json'
          }
        });
      }

      showSubmitNotificationMessage(`✅ Pengajuan ${izinForm.type} berhasil dikirim!`, 'success');
      setSubmitMessage({ type: 'success', text: `✅ Pengajuan ${izinForm.type} berhasil dikirim!` });
      playSound('success');

      setIzinForm({ 
        fullName: '', 
        user_id: '', 
        type: 'izin', 
        reason: '', 
        attachment: null, 
        parent_phone: '' 
      });
      
      await refreshStatsAfterSubmit();

      setTimeout(() => {
        setShowAbsenModal(false);
        setSubmitMessage({ type: '', text: '' });
      }, 2000);
      
    } catch (err) {
      console.error('Error submitting izin:', err);
      
      let errorMsg = 'Gagal mengirim pengajuan izin';
      
      if (err.response) {
        errorMsg = err.response.data?.message || err.response.data?.error || errorMsg;
        console.error('Backend error:', err.response.data);
      } else if (err.code === 'ECONNABORTED') {
        errorMsg = 'Request timeout. Server lambat atau tidak merespons.';
      } else if (err.code === 'ERR_NETWORK') {
        errorMsg = 'Server tidak terjangkau. Periksa koneksi atau backend.';
      } else {
        errorMsg = err.message || errorMsg;
      }
      
      showSubmitNotificationMessage(`❌ ${errorMsg}`, 'error');
      setSubmitMessage({ type: 'error', text: `❌ ${errorMsg}` });
      playSound('failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // QR Scan handler
  const handleQRScan = async (decodedText) => {
    try {
      const now = Date.now();
      if (decodedText === lastScannedDataRef.current && now - lastScannedAtRef.current < 2500) {
        return;
      }
      lastScannedDataRef.current = decodedText;
      lastScannedAtRef.current = now;

      const qrData = JSON.parse(decodedText);

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

// Submit QR - DIPERBAIKI agar data masuk database
const submitQRAttendance = async (qrData) => {
  if (isSubmittingRef.current) return;
  const token = localStorage.getItem('token');
  setIsSubmitting(true);
  isSubmittingRef.current = true;
  
  try {
    if (checkIsHoliday(currentTime, attendanceSettings)) {
      showQRNotificationMessage('❌ Hari ini libur. Absensi ditiadakan.', 'error');
      return;
    }

    const status = getAttendanceStatus(currentTime, attendanceSettings, activeAttendanceAction);
    if (activeAttendanceAction === 'pulang' && status === 'belum_pulang') {
      showQRNotificationMessage(`❌ Belum jam pulang! Silakan kembali pada jam ${attendanceSettings.pulangStartTime || attendanceSettings.schoolEndTime}`, 'warning');
      return;
    }
    if (activeAttendanceAction === 'pulang' && status === 'sudah_tutup_pulang') {
      showQRNotificationMessage(`❌ Absensi pulang sudah ditutup pada jam ${attendanceSettings.pulangEndTime || attendanceSettings.schoolEndTime}`, 'error');
      return;
    }

    // ✅ Ekstrak data dari QR dengan fallback yang lebih baik
    const userId = qrData.user_id || qrData.nis || qrData.nip || qrData.id || qrData.student_id || qrData.teacher_id || '';
    const userName = qrData.name || qrData.nama || qrData.full_name || 'User';
    const userRole = qrData.role || activeUserRole;
    
    if (!userId) {
      showQRNotificationMessage('❌ QR Code tidak memiliki ID yang valid!', 'error');
      playSound('failed');
      return;
    }

    // ✅ Payload yang SESUAI dengan validasi backend
    const requestData = {
      name: userName,  // ← WAJIB ADA untuk backend
      user_id: userId, // ← WAJIB ADA untuk backend
      nis: userId,     // ← Alias untuk user_id
      nip: userId,     // ← Alias untuk user_id
      attendance_time: getLocalTimestamp(currentTime),
      scan_time: getLocalTimestamp(currentTime),
      status: activeAttendanceAction === 'pulang' ? 'hadir' : status,
      role: userRole,
      type: activeAttendanceAction === 'pulang' ? 'pulang' : 'qr_scan',
      action: activeAttendanceAction,
      qr_data: qrData  // ← Kirim juga qr_data untuk fallback
    };

    // ✅ Pilih endpoint berdasarkan role
    const endpoint = userRole === 'guru' 
      ? '/public/attendance/teacher' 
      : '/public/attendance/student';
    
    const baseUrl = api.defaults.baseURL || 'http://127.0.0.1:8000/api';
    
    console.log('📤 QR Scan Request:', { endpoint, requestData }); // Debug log
    
    const response = await axios.post(`${baseUrl}${endpoint}`, requestData, {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });

    console.log('✅ QR Scan Response:', response.data); // Debug log

    if (response.data.already_absent) {
      playSound('already');
      showQRNotificationMessage('⚠️ Anda sudah absen hari ini!', 'warning');
      showSubmitNotificationMessage('⚠️ Anda sudah absen hari ini!', 'warning');
      return;
    }

    const statusText = activeAttendanceAction === 'pulang'
      ? '✅ Pulang tercatat'
      : status === 'hadir' ? '✅ Tepat Waktu' : '⚠️ Terlambat';
    
    playSound('success');
    showQRNotificationMessage(`Absensi via QR berhasil! ${statusText}`, 'success');
    showSubmitNotificationMessage(`Absensi via QR berhasil! ${statusText}`, 'success');
    setSubmitMessage({ type: 'success', text: `✅ Absensi via QR berhasil! ${statusText}` });

    setShowAbsenModal(false);
    await refreshStatsAfterSubmit();

    setTimeout(() => {
      setSubmitMessage({ type: '', text: '' });
    }, 2000);
    
  } catch (err) {
    console.error('❌ QR Submit Error:', err);
    console.error('❌ Error Response:', err.response?.data);
    
    const status = err.response?.status;
    const backendMessage = err.response?.data?.message;

    if (status === 400 && backendMessage && backendMessage.toLowerCase().includes('sudah absen')) {
      playSound('already');
      showQRNotificationMessage(`⚠️ ${backendMessage}`, 'warning');
      showSubmitNotificationMessage(`⚠️ ${backendMessage}`, 'warning');
      setSubmitMessage({ type: 'warning', text: `⚠️ ${backendMessage}` });
      return;
    }

    let errorMsg = backendMessage || err.response?.data?.error || 'Gagal menyimpan absensi';
    
    if (err.code === 'ECONNABORTED') {
      errorMsg = 'Koneksi timeout. Server lambat atau tidak merespons.';
    } else if (err.code === 'ERR_NETWORK') {
      errorMsg = 'Server tidak terjangkau. Periksa koneksi internet.';
    }
    
    playSound('failed');
    showQRNotificationMessage(`❌ ${errorMsg}`, 'error');
    showSubmitNotificationMessage(`❌ ${errorMsg}`, 'error');
    setSubmitMessage({ type: 'error', text: '❌ Gagal: ' + errorMsg });
  } finally {
    setIsSubmitting(false);
    isSubmittingRef.current = false;
  }
};

  return {
    // States
    activeUserRole, setActiveUserRole,
    activeAttendanceAction, setActiveAttendanceAction,
    activeMethodTab, setActiveMethodTab,
    showAbsenModal, setShowAbsenModal,
    showAttendanceListModal, setShowAttendanceListModal,
    showQRNotification, qrNotificationMessage, qrNotificationType, setShowQRNotification,
    showSubmitNotification, submitNotificationMessage, submitNotificationType, setShowSubmitNotification,
    showLandingNotification, setShowLandingNotification, landingNotificationMessage, setLandingNotificationMessage,
    backendStatus,
    facingMode, setFacingMode,
    isSubmitting, submitMessage, setSubmitMessage,
    isCameraStarting, cameraError,
    studentForm, setStudentForm,
    teacherForm, setTeacherForm,
    izinForm, setIzinForm,
    attendanceSettings, setAttendanceSettings,
    attendanceStats,
    todayAttendanceRecords,

    // Functions
    loadSettings,
    fetchStats,
    handleTryOpenAbsen,
    handleStudentSubmit,
    handleTeacherSubmit,
    handleIzinSubmit,
    handleQRScan,
    showSubmitNotificationMessage,
    refreshStatsAfterSubmit
  };
};

export default useAttendance;