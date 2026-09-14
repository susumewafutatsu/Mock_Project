// src/pages/admin/adminFormat.js
// Định dạng dùng chung cho các tab của trang quản trị.

const pad = (n) => String(n).padStart(2, '0');

/** "12/03 09:30" — cho mốc gần đây, không cần năm. */
export function formatWhen(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "12/03/2026" — ngày tạo tài khoản, có thể từ năm trước. */
export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Chữ viết tắt cho avatar: chữ đầu của từ đầu và từ cuối. */
export function initialsOf(name = '') {
  const words = name
    .replace(/\(.*?\)/g, ' ')
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w));
  if (!words.length) return '?';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export const ROLE_LABELS = {
  STUDENT: 'Thí sinh',
  TEACHER: 'Người ra đề',
  ADMIN: 'Quản trị',
};
