import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAttendance from '../hooks/useAttendance';
import { resolvePhotoUrl, formatTimeShort, formatDateShort } from '../utils/attendance';
import Notification from '../components/attendance/Notification';
import AttendanceModal from '../components/attendance/AttendanceModal';
import AttendanceListModal from '../components/attendance/AttendanceListModal';
import FloatingMagazine from '../components/FloatingMagazine';

const Landing = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLandingLoading, setIsLandingLoading] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);

  // Gunakan custom hook untuk semua logic absensi
  const attendance = useAttendance(currentTime);

  // Loading progress
  useEffect(() => {
    let interval;
    if (isLandingLoading) {
      interval = setInterval(() => {
        setLoadingProgress((prev) => prev >= 99 ? 99 : prev + 1);
      }, 20);
    } else {
      setLoadingProgress(100);
    }
    return () => clearInterval(interval);
  }, [isLandingLoading]);

// Init landing - DIPERBAIKI: tanpa interval spam
useEffect(() => {
  let isMounted = true; // Flag untuk mencegah update state jika unmount
  
  const initLanding = async () => {
    setIsLandingLoading(true);
    
    // Load dari cache dulu (instant, tanpa network)
    const savedSettings = localStorage.getItem('school_settings');
    if (savedSettings) {
      try {
        const data = JSON.parse(savedSettings);
        attendance.setAttendanceSettings(data);
      } catch (e) {
        console.warn('⚠️ Cache settings invalid');
      }
    }
    
    // Fetch dari API hanya SEKALI (tidak ada retry spam)
    if (isMounted) {
      try {
        await Promise.allSettled([
          attendance.loadSettings(),
          attendance.fetchStats()
        ]);
      } catch (err) {
        console.warn('⚠️ Initial fetch failed, using cache');
      }
    }
    
    if (isMounted) {
      setIsLandingLoading(false);
    }
  };
  
  initLanding();

  // Storage listener untuk sync antar tab (TIDAK ADA INTERVAL)
  const handleStorageChange = (e) => {
    if (!isMounted) return;
    if (e.key === 'school_settings') attendance.loadSettings();
    if (e.key === 'attendance_updated') attendance.fetchStats();
  };
  
  window.addEventListener('storage', handleStorageChange);
  
  return () => {
    isMounted = false; // Cleanup flag
    window.removeEventListener('storage', handleStorageChange);
  };
}, []); // ← Dependency array kosong = hanya jalan SEKALI saat mount

  // Timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Scroll
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavigate = (path) => {
    setIsNavigating(true);
    navigate(path);
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

  // Logo component
  const LogoIcon = ({ size = "w-7 h-7" }) => (
    attendance.attendanceSettings.schoolLogo ? (
      <img
        src={resolvePhotoUrl(attendance.attendanceSettings.schoolLogo)}
        alt="Logo"
        className={`${size} object-contain rounded-full`}
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    ) : (
      <svg className={`${size} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    )
  );

  // Mobile Layout
  const MobileLayout = () => (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 pb-28">
      {/* Header */}
      <div className="bg-blue-600 dark:bg-gradient-to-br dark:from-blue-600 dark:via-blue-700 dark:to-indigo-900 px-4 pt-12 pb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <LogoIcon size="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">{attendance.attendanceSettings.schoolName || 'AbsensiPro'}</h1>
              <p className="text-blue-100 text-xs">Mobile Presence</p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 transition-all"
          >
            <span>{theme === 'dark' ? '🌙' : '☀️'}</span>
            <span className="hidden sm:inline">{theme === 'dark' ? 'Gelap' : 'Terang'}</span>
          </button>
        </div>

        <div className="text-center py-6">
          <p className="text-blue-200 text-sm mb-1">Halo, Selamat Datang!</p>
          <h2 className="text-white text-2xl font-bold mb-2">{attendance.attendanceSettings.schoolName || 'Sistem Absensi'}</h2>
          <p className="text-blue-100 text-xs">Gunakan sistem absensi ini untuk memonitor kehadiran</p>
        </div>

        <div className="flex justify-center items-end gap-2 h-32 mb-4">
          <div className="w-20 h-24 bg-gradient-to-t from-pink-500 to-red-400 rounded-t-3xl flex items-center justify-center">
            <div className="text-white text-4xl">👨</div>
          </div>
          <div className="w-16 h-16 bg-gradient-to-t from-blue-500 to-cyan-400 rounded-t-3xl flex items-center justify-center -mb-2">
            <div className="text-white text-3xl">👩</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white dark:bg-slate-950 rounded-t-3xl -mt-6 min-h-screen px-4 pt-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <button
            onClick={() => { attendance.setActiveMethodTab('scan'); attendance.setShowAbsenModal(true); }}
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
            onClick={() => { attendance.setActiveMethodTab('manual'); attendance.setActiveUserRole('siswa'); attendance.setShowAbsenModal(true); }}
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
            onClick={() => { attendance.setActiveMethodTab('manual'); attendance.setActiveUserRole('guru'); attendance.setShowAbsenModal(true); }}
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
            onClick={() => { attendance.setActiveMethodTab('izin'); attendance.setShowAbsenModal(true); }}
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

        {/* Stats */}
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
              <p className="text-2xl font-bold text-emerald-700">{attendance.attendanceStats.totalHadir}</p>
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
              <p className="text-2xl font-bold text-orange-700">{attendance.attendanceStats.keterlambatan}</p>
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
              <span className="font-semibold text-slate-800">{attendance.attendanceSettings.attendanceStartTime}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Datang Ditutup</span>
              <span className="font-semibold text-slate-800">{attendance.attendanceSettings.attendanceEndTime}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Pulang Dibuka</span>
              <span className="font-semibold text-slate-800">{attendance.attendanceSettings.pulangStartTime}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Pulang Ditutup</span>
              <span className="font-semibold text-slate-800">{attendance.attendanceSettings.pulangEndTime}</span>
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

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-40 dark:bg-slate-900 dark:border-slate-800">
        <button className="flex flex-col items-center gap-1 text-blue-600">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-[10px] font-medium">Home</span>
        </button>

        <button
          onClick={() => attendance.setShowAttendanceListModal(true)}
          className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="text-[10px] font-medium">Absensi</span>
        </button>

        <button
          onClick={() => { attendance.setActiveMethodTab('scan'); attendance.setShowAbsenModal(true); }}
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
            attendance.setLandingNotificationMessage(`🔔 Info Kehadiran Hari Ini:\n- Total Hadir: ${attendance.attendanceStats.totalHadir}\n- Terlambat: ${attendance.attendanceStats.keterlambatan}\n\nData diperbarui secara real-time.`);
            attendance.setShowLandingNotification(true);
          }}
          className={`flex flex-col items-center gap-1 transition-colors ${attendance.showLandingNotification ? 'text-blue-600' : 'text-slate-400'}`}
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

  // Desktop Layout
  const DesktopLayout = () => (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Top Nav */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white shadow-md dark:bg-slate-900' : 'bg-white dark:bg-slate-900'}`}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
                <LogoIcon size="w-10 h-10" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">{attendance.attendanceSettings.schoolName || 'AbsensiPro'}</h1>
                <p className="text-xs text-slate-500">Sistem Absensi Digital</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-all"
              >
                <span>{theme === 'dark' ? '🌙' : '☀️'}</span>
                <span className="hidden sm:inline">{theme === 'dark' ? 'Gelap' : 'Terang'}</span>
              </button>
              <button
                onClick={() => handleNavigate('/register')}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md"
              >
                Register
              </button>
              <button
                onClick={() => handleNavigate('/login')}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-all shadow-md"
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
            {/* Left Column */}
            <div className="space-y-6">
              {/* Welcome Card */}
              <div className="bg-blue-600 dark:bg-gradient-to-br dark:from-blue-600 dark:via-blue-700 dark:to-indigo-900 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/20 rounded-full -ml-24 -mb-24 blur-2xl"></div>

                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-blue-100">Live System</span>
                  </div>

                  <h2 className="text-3xl font-bold mb-3 text-white">Halo, Selamat Datang!</h2>
                  <p className="text-blue-100 mb-8 leading-relaxed">Gunakan sistem absensi digital ini untuk memonitor kehadiran siswa dan guru dengan lebih mudah dan efisien.</p>
                  
                  <div className="flex justify-center items-end gap-4 h-40 mb-8">
                    <div className="w-28 h-32 bg-gradient-to-t from-pink-500 to-red-400 rounded-t-3xl flex items-center justify-center shadow-xl">
                      <div className="text-white text-5xl">👨</div>
                    </div>
                    <div className="w-24 h-24 bg-gradient-to-t from-blue-500 to-cyan-400 rounded-t-3xl flex items-center justify-center shadow-xl -mb-4">
                      <div className="text-white text-4xl">👩</div>
                    </div>
                  </div>

                  {attendance.backendStatus && (
                    <div className="mx-4 mb-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-2xl flex items-center gap-2 animate-pulse">
                      <span className="text-lg">⚠️</span>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-tight">Koneksi Server</p>
                        <p className="text-[10px] opacity-80">{attendance.backendStatus}</p>
                      </div>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => { attendance.setActiveMethodTab('scan'); attendance.setShowAbsenModal(true); }}
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
                      onClick={() => { attendance.setActiveMethodTab('manual'); attendance.setActiveUserRole('siswa'); attendance.setShowAbsenModal(true); }}
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
                      onClick={() => { attendance.setActiveMethodTab('izin'); attendance.setShowAbsenModal(true); }}
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
              {/* <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-sm text-slate-600 font-medium">Total Hadir</span>
                  </div>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{attendance.attendanceStats.totalHadir}</p>
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
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{attendance.attendanceStats.keterlambatan}</p>
                  <p className="text-xs text-slate-500 mt-1">Hari ini</p>
                </div>
              </div> */}
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Main Balance Card */}
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-blue-200 text-sm mb-1">Statistik Kehadiran</p>
                    <h3 className="text-4xl font-bold">{attendance.attendanceStats.totalHadir} Hadir</h3>
                  </div>
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => attendance.handleTryOpenAbsen('datang')}
                    className="bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-xl py-3 text-sm font-semibold transition"
                  >
                    Absen Datang
                  </button>
                  <button
                    onClick={() => attendance.handleTryOpenAbsen('pulang')}
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
                    <span className="text-sm font-bold text-slate-900">{attendance.attendanceSettings.attendanceStartTime} WIB</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-sm text-slate-600">Absen Ditutup</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{attendance.attendanceSettings.attendanceEndTime} WIB</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-sm text-slate-600">Batas Terlambat</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{attendance.attendanceSettings.lateThreshold} WIB</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                      <span className="text-sm text-slate-600">Jam Pulang</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{attendance.attendanceSettings.schoolEndTime} WIB</span>
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
              {/* <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-xl">
                <h3 className="text-xl font-bold mb-2">Siap untuk Absen?</h3>
                <p className="text-slate-300 text-sm mb-4">Mulai absen sekarang dan jadilah bagian dari sekolah digital.</p>
                <button
                  onClick={() => { attendance.setActiveMethodTab('scan'); attendance.setShowAbsenModal(true); }}
                  className="w-full bg-white text-slate-900 py-3 rounded-xl font-semibold hover:bg-slate-100 transition flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  Mulai Absensi
                </button>
              </div> */}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-6">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <LogoIcon size="w-6 h-6" />
            </div>
            <span className="font-bold text-white">{attendance.attendanceSettings.schoolName || 'AbsensiPro'}</span>
          </div>
          <p className="text-xs">© 2026 {attendance.attendanceSettings.schoolName || 'AbsensiPro'}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );

  return (
    <div className={`font-sans ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <div className="lg:hidden">
        <MobileLayout />
      </div>
      <div className="hidden lg:block">
        <DesktopLayout />
      </div>

      {/* Notifications */}
      <Notification
        show={attendance.showQRNotification}
        message={attendance.qrNotificationMessage}
        type={attendance.qrNotificationType}
        onClose={() => attendance.setShowQRNotification(false)}
      />
      <Notification
        show={attendance.showSubmitNotification}
        message={attendance.submitNotificationMessage}
        type={attendance.submitNotificationType}
        onClose={() => attendance.setShowSubmitNotification(false)}
      />
      <Notification
        show={attendance.showLandingNotification}
        message={attendance.landingNotificationMessage}
        type="info"
        onClose={() => attendance.setShowLandingNotification(false)}
      />

      {/* Attendance Modal */}
      <AttendanceModal
        show={attendance.showAbsenModal}
        onClose={() => {
          attendance.setShowAbsenModal(false);
        }}
        activeUserRole={attendance.activeUserRole}
        setActiveUserRole={attendance.setActiveUserRole}
        activeMethodTab={attendance.activeMethodTab}
        setActiveMethodTab={attendance.setActiveMethodTab}
        activeAttendanceAction={attendance.activeAttendanceAction}
        setActiveAttendanceAction={attendance.setActiveAttendanceAction}
        studentForm={attendance.studentForm}
        setStudentForm={attendance.setStudentForm}
        teacherForm={attendance.teacherForm}
        setTeacherForm={attendance.setTeacherForm}
        izinForm={attendance.izinForm}
        setIzinForm={attendance.setIzinForm}
        onStudentSubmit={attendance.handleStudentSubmit}
        onTeacherSubmit={attendance.handleTeacherSubmit}
        onIzinSubmit={attendance.handleIzinSubmit}
        onQRScan={attendance.handleQRScan}
        isSubmitting={attendance.isSubmitting}
        submitMessage={attendance.submitMessage}
        attendanceSettings={attendance.attendanceSettings}
        facingMode={attendance.facingMode}
        setFacingMode={attendance.setFacingMode}
        cameraError={attendance.cameraError}
        isCameraStarting={attendance.isCameraStarting}
      />

      {/* Attendance List Modal */}
      <AttendanceListModal
        show={attendance.showAttendanceListModal}
        records={attendance.todayAttendanceRecords}
        onClose={() => attendance.setShowAttendanceListModal(false)}
      />

      {/* ✅ Floating Magazine Button - muncul di mobile & desktop */}
      <FloatingMagazine />

      {/* Animations */}
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