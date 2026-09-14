// src/services/engagementService.js
// Những thứ giúp người dùng tự quay lại và tự định hướng.

import api from './api';
import { backendBaseUrl } from './authService';

const unwrap = (r) => r.data?.data;

// ── Thông báo ──────────────────────────────────────────────────────
export const notificationApi = {
  list: () => api.get('/notifications').then((r) => unwrap(r) ?? []),
  unreadCount: () => api.get('/notifications/unread-count').then((r) => unwrap(r)?.unread ?? 0),
  markRead: (id) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
};

// ── Tìm kiếm ───────────────────────────────────────────────────────
/** @returns { exams: [{examId,title,levelName,durationMinutes}], courses: [{courseId,title,levelName}] } */
export const search = (q) =>
  api.get('/search', { params: { q } }).then((r) => unwrap(r) ?? { exams: [], courses: [] });

// ── Câu đã đánh dấu ────────────────────────────────────────────────
export const bookmarkApi = {
  list: () => api.get('/student/bookmarks').then((r) => unwrap(r) ?? []),
  save: (questionId, note) =>
    api.put(`/student/bookmarks/${questionId}`, { note: note ?? null }).then(unwrap),
  remove: (questionId) => api.delete(`/student/bookmarks/${questionId}`),
};

// ── Gợi ý ôn + xếp trình độ ────────────────────────────────────────
export const getInsights = () => api.get('/student/insights').then(unwrap);

// ── Phần nghe ──────────────────────────────────────────────────────
/** Người ra đề tải file nghe lên → { url: "/media/audio/…" } */
export const uploadAudio = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/teacher/media/audio', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(unwrap);
};

/** Thí sinh xin phát file nghe; server đếm lượt, hết lượt thì trả 409. */
export const requestAudioPlay = (examId, questionId) =>
  api.post(`/student/exams/${examId}/questions/${questionId}/audio-play`).then(unwrap);

/** Đường dẫn tương đối "/media/…" → tuyệt đối theo gốc backend. */
export const mediaUrl = (path) => (path ? `${backendBaseUrl}${path}` : null);
