// src/services/api.js
// Axios instance dùng chung: tự gắn Bearer token, tự refresh khi 401.

import axios from 'axios';
import { STORAGE_KEYS } from '../utils/constants';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
  headers: { 'Content-Type': 'application/json' },
});

export const tokenStore = {
  getAccessToken: () => localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
  getRefreshToken: () => localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN),
  save: ({ accessToken, refreshToken }) => {
    if (accessToken) localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    if (refreshToken) localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  },
  clear: () => {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
  },
};

api.interceptors.request.use((config) => {
  const token = tokenStore.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Chỉ refresh một lần cho mỗi request thất bại, tránh vòng lặp vô hạn
let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;

    if (response?.status === 401 && !config._retried && tokenStore.getRefreshToken()) {
      config._retried = true;
      try {
        refreshPromise =
          refreshPromise ||
          axios.post(`${api.defaults.baseURL}/auth/refresh`, {
            refreshToken: tokenStore.getRefreshToken(),
          });
        const refreshed = await refreshPromise;
        refreshPromise = null;

        tokenStore.save(refreshed.data?.data || {});
        config.headers.Authorization = `Bearer ${tokenStore.getAccessToken()}`;
        return api(config);
      } catch {
        refreshPromise = null;
        tokenStore.clear();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    // Backend trả về ApiResponse { success, message, data, error } cho lỗi có
    // handler riêng, còn lỗi do @ResponseStatus thì rơi vào body mặc định của
    // Spring { status, error: "Conflict", message, path } — ở đó `error` chỉ là
    // tên HTTP status nên phải ưu tiên `message`.
    const body = response?.data;
    let message =
      (body?.success === false ? body?.error : null) ||
      body?.message ||
      body?.error ||
      error.message;

    // 403 = token hợp lệ nhưng sai vai trò (thường do tab khác đăng nhập tài
    // khoản khác, localStorage dùng chung). Body mặc định của Spring chỉ có chữ
    // "Forbidden" nên phải nói rõ cho người dùng biết phải làm gì.
    if (response?.status === 403 && (!message || /^forbidden$/i.test(message))) {
      message = 'Tài khoản đang đăng nhập không có quyền dùng chức năng này. '
        + 'Hãy đăng xuất và đăng nhập lại bằng đúng tài khoản.';
    }

    // Giữ lại status: phòng thi cần phân biệt 409 (hết giờ / đã nộp) với 404.
    const wrapped = new Error(message);
    wrapped.status = response?.status;
    wrapped.body = body;
    return Promise.reject(wrapped);
  }
);

export default api;
