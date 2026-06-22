// Helper functions untuk absensi

/**
 * Resolve URL foto/logo dengan fallback
 */
export const resolvePhotoUrl = (photo, fallbackBase = 'http://127.0.0.1:8000') => {
  if (!photo || typeof photo !== 'string') return null;
  const trimmed = photo.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http') || trimmed.startsWith('data:')) return trimmed;
  return `${fallbackBase}/${trimmed.replace(/^\//, '')}`;
};

/**
 * Mendapatkan waktu lokal format YYYY-MM-DD HH:mm:ss
 */
export const getLocalTimestamp = (date) => {
  const pad = (n) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

/**
 * Mendapatkan tanggal key dalam zona waktu Jakarta (YYYY-MM-DD)
 */
export const getJakartaDateKey = (date) => {
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

/**
 * Normalisasi date key dari berbagai format
 */
export const normalizeDateKey = (rawDate) => {
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

/**
 * Format waktu HH:mm:ss
 */
export const formatTimeShort = (date) => {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

/**
 * Format tanggal panjang Indonesia
 */
export const formatDateShort = (date) => {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

/**
 * Cek apakah hari ini hari libur
 */
export const checkIsHoliday = (currentTime, settings) => {
  if (settings.disableAttendanceOnHolidays !== true) return false;
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const currentDay = dayNames[currentTime.getDay()];
  const activeDays = settings.activeDays
    ? settings.activeDays.split(',').map(d => d.trim())
    : ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return !activeDays.includes(currentDay);
};

/**
 * Mendapatkan status absensi berdasarkan waktu
 */
export const getAttendanceStatus = (currentTime, settings, action = 'datang') => {
  const hours = currentTime.getHours().toString().padStart(2, '0');
  const minutes = currentTime.getMinutes().toString().padStart(2, '0');
  const currentTimeStr = `${hours}:${minutes}`;

  const openTime = (settings.attendanceStartTime || "07:00").substring(0, 5);
  const closeTime = (settings.attendanceEndTime || "12:00").substring(0, 5);
  const lateTime = (settings.lateThreshold || "08:00").substring(0, 5);
  const pulangOpenTime = (settings.pulangStartTime || "15:00").substring(0, 5);
  const pulangCloseTime = (settings.pulangEndTime || "16:00").substring(0, 5);
  const schoolEnd = (settings.schoolEndTime || settings.pulangStartTime || "15:30").substring(0, 5);

  if (checkIsHoliday(currentTime, settings)) return 'libur';

  if (action === 'pulang') {
    if (currentTimeStr < schoolEnd && currentTimeStr < pulangOpenTime) return 'belum_pulang';
    if (currentTimeStr > pulangCloseTime) return 'sudah_tutup_pulang';
    return 'pulang';
  }

  if (currentTimeStr < openTime) return 'belum_buka';
  if (currentTimeStr > closeTime) return 'sudah_tutup';
  return currentTimeStr <= lateTime ? 'hadir' : 'terlambat';
};

/**
 * Retry fetch dengan delay
 */
export const fetchWithRetry = async (apiCall, maxRetries = 3, delay = 1500) => {
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

/**
 * Hitung absensi hari ini dari records
 */
export const countTodayAttendance = (records = []) => {
  const todayKey = getJakartaDateKey(new Date());
  const counter = { total: 0, hadir: 0, terlambat: 0, absen: 0 };
  if (!Array.isArray(records)) return { counter, todayRecords: [] };
  const todayRecords = [];
  const matchedRecords = [];

  records.forEach((item) => {
    const rawDate = item.date || item.attendance_time || item.created_at ||
                    item.time || item.scan_time || item.tanggal ||
                    item.waktu || item.timestamp || item.check_in ||
                    item.absen_time || item.updated_at || item.attendance_date;

    const dateKey = normalizeDateKey(rawDate);
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
    todayRecords.push({
      ...item,
      displayStatus,
      userName: item.user_name || item.name || item.full_name || item.fullName || 'Unknown',
      scanTime: item.scan_time || item.attendance_time || item.created_at || item.time || item.tanggal || new Date().toISOString(),
      role: item.role || 'Unknown'
    });
    matchedRecords.push(item);
  });

  // Fallback jika tidak ada match hari ini
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