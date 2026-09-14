// src/services/adminService.js
// API trang quản trị (/api/admin/**, chỉ vai ADMIN).

import api from './api';

/** Số liệu tổng quan — toàn phép đếm, gọi mỗi lần mở trang. */
export async function getStats() {
  const { data } = await api.get('/admin/stats');
  return data.data;
}

/** Một trang người dùng. */
export async function getUsers({ role = null, locked = null, q = '', page = 0, size = 20 } = {}) {
  const params = { page, size };
  // Bỏ hẳn key khi không lọc, thay vì gửi chuỗi rỗng / "null".
  if (role) params.role = role;
  if (locked != null) params.locked = locked;
  if (q.trim()) params.q = q.trim();
  const { data } = await api.get('/admin/users', { params });
  return data.data;
}

/** Chỉ STUDENT ↔ TEACHER. Server trả 409 kèm lý do nếu không đổi được. */
export async function changeRole(userId, role) {
  const { data } = await api.put(`/admin/users/${userId}/role`, { role });
  return data.data;
}

/** Lý do bắt buộc — server trả 409 nếu thiếu. */
export async function lockUser(userId, reason) {
  const { data } = await api.post(`/admin/users/${userId}/lock`, { reason });
  return data.data;
}

export async function unlockUser(userId) {
  const { data } = await api.post(`/admin/users/${userId}/unlock`);
  return data.data;
}
