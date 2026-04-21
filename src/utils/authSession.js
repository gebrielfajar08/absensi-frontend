/**
 * Simpan token + user dari API login; normalisasi role agar redirect dashboard konsisten.
 */
export function persistAuthResponse(res) {
  const u = res?.data?.user;
  if (!u) return;
  const normalized = {
    ...u,
    role: String(u.role || '')
      .toLowerCase()
      .trim(),
  };
  localStorage.setItem('token', res.data.token);
  localStorage.setItem('user', JSON.stringify(normalized));
  return normalized;
}

export function dashboardPathForRole(role) {
  const r = String(role || '')
    .toLowerCase()
    .trim();
  if (['admin', 'guru', 'siswa'].includes(r)) return `/dashboard/${r}`;
  return '/';
}

export function getRoleDisplayName(role) {
  const r = String(role || '').toLowerCase().trim();
  if (r === 'admin') return 'Administrator';
  if (r === 'guru') return 'Guru';
  if (r === 'siswa') return 'Siswa';
  return role;
}
