// src/services/api.js
// Axios instance dùng chung: tự gắn Bearer token, tự làm mới phiên khi 401.

import axios from 'axios';
import { STORAGE_KEYS } from '../utils/constants';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
  headers: { 'Content-Type': 'application/json' },
  // Cần để trình duyệt gửi/nhận cookie refresh với API chạy khác cổng.
  withCredentials: true,
});

export const tokenStore = {
  getAccessToken: () => localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
  save: ({ accessToken }) => {
    if (accessToken) localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    // Dọn refresh token do bản cũ để lại trong localStorage.
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
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

// Nhiều request cùng 401 một lúc thì chỉ làm mới phiên MỘT lần.
let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;

    const isAuthCall = (config?.url ?? '').includes('/auth/');
    if (response?.status === 401 && config && !config._retried && !isAuthCall
        && tokenStore.getAccessToken()) {
      config._retried = true;
      try {
        refreshPromise =
          refreshPromise ||
          axios.post(`${api.defaults.baseURL}/auth/refresh`, null, { withCredentials: true });
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

    // Backend trả về ApiResponse { success, message, data, error } cho lỗi có handler riêng.
    const body = response?.data;
    let message =
      (body?.success === false ? body?.error : null) ||
      body?.message ||
      body?.error ||
      error.message;

    // 403 = token hợp lệ nhưng sai vai trò (thường do tab khác đăng nhập tài khoản khác, localStorage dùng chung).
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
