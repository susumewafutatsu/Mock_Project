// src/services/authService.js
// Gọi API xác thực của backend + khởi động luồng Google SSO.

import api, { tokenStore } from './api';
import { pushLeftoverDraftsKeepalive } from './examService';
import { clearAllDrafts } from '../utils/examDraft';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

// Gốc của backend (bỏ hậu tố /api) — dùng cho endpoint OAuth2 của Spring Security
const BACKEND_BASE_URL =
  import.meta.env.VITE_BACKEND_BASE_URL || API_BASE_URL.replace(/\/api\/?$/, '');

const OAUTH2_REDIRECT_URL =
  import.meta.env.VITE_OAUTH2_REDIRECT_URL || `${window.location.origin}/auth/callback`;

/** Đăng nhập email + mật khẩu → { accessToken, user }. */
export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  const auth = data.data;
  tokenStore.save(auth);
  return auth;
}

export async function register(payload) {
  const { data } = await api.post('/auth/register', payload);
  return data.data;
}

/** Lấy user hiện tại từ access token đang lưu */
export async function getCurrentUser() {
  const { data } = await api.get('/auth/me');
  return data.data;
}

/** Làm mới phiên bằng cookie refresh (trình duyệt tự gửi). */
export async function refreshToken() {
  const { data } = await api.post('/auth/refresh');
  const auth = data.data;
  tokenStore.save(auth);
  return auth;
}

/** URL bắt đầu luồng Google SSO. */
export function getGoogleLoginUrl() {
  return `${BACKEND_BASE_URL}/oauth2/authorization/google?redirect_uri=${encodeURIComponent(
    OAUTH2_REDIRECT_URL
  )}`;
}

/** Chuyển trang sang Google để đăng nhập */
export function loginWithGoogle() {
  window.location.href = getGoogleLoginUrl();
}

export function logout() {
  // Bài làm dở chưa gửi: bắn nốt lên server khi token còn đó, rồi xoá khỏi máy.
  pushLeftoverDraftsKeepalive();
  clearAllDrafts();
  // Xoá cookie refresh ở server.
  api.post('/auth/logout').catch(() => {});
  tokenStore.clear();
}

/** Gốc backend — để dựng đường dẫn tuyệt đối cho file /media/**. */
export const backendBaseUrl = BACKEND_BASE_URL;

export { tokenStore };
