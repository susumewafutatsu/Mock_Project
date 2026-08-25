// src/services/authService.js
// Gọi API xác thực của backend + khởi động luồng Google SSO.

import api, { tokenStore } from './api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

// Gốc của backend (bỏ hậu tố /api) — dùng cho endpoint OAuth2 của Spring Security
const BACKEND_BASE_URL =
  import.meta.env.VITE_BACKEND_BASE_URL || API_BASE_URL.replace(/\/api\/?$/, '');

const OAUTH2_REDIRECT_URL =
  import.meta.env.VITE_OAUTH2_REDIRECT_URL || `${window.location.origin}/auth/callback`;

/** Đăng nhập email + mật khẩu → { accessToken, refreshToken, user } */
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

export async function refreshToken() {
  const { data } = await api.post('/auth/refresh', {
    refreshToken: tokenStore.getRefreshToken(),
  });
  const auth = data.data;
  tokenStore.save(auth);
  return auth;
}

/**
 * URL bắt đầu luồng Google SSO.
 * Backend (Spring Security) sẽ redirect sang Google, sau đó redirect về
 * OAUTH2_REDIRECT_URL kèm ?accessToken=...&refreshToken=...&role=...
 */
export function getGoogleLoginUrl(role = '') {
  let url = `${BACKEND_BASE_URL}/oauth2/authorization/google?redirect_uri=${encodeURIComponent(
    OAUTH2_REDIRECT_URL
  )}`;
  if (role) {
    url += `&role=${role}`;
  }
  return url;
}

/** Chuyển trang sang Google để đăng nhập */
export function loginWithGoogle(role = '') {
  window.location.href = getGoogleLoginUrl(role);
}

export function logout() {
  tokenStore.clear();
}

export { tokenStore };
