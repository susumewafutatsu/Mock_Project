// src/services/courseService.js
// API khoá học — nơi chứa NGỮ PHÁP và CHỮ HÁN.

import api from './api';

const BASE = '/courses';

const courseService = {
  // ── Người ra đề ────────────────────────────────────────────────────

  /** Khoá tôi soạn, mọi trạng thái. */
  getMyCourses: () => api.get(`${BASE}/mine`).then((r) => r.data?.data ?? []),

  /** Tạo khoá. Luôn bắt đầu ở DRAFT — client không gửi trạng thái lên được. */
  createCourse: (data) => api.post(BASE, data).then((r) => r.data?.data),

  updateCourse: (courseId, data) =>
    api.put(`${BASE}/${courseId}`, data).then((r) => r.data?.data),

  /** Xoá khoá. Chỉ được khi chưa có ai ghi danh. */
  deleteCourse: (courseId) => api.delete(`${BASE}/${courseId}`),

  /** Gửi duyệt. Khoá chưa có bài nào thì backend trả 409. */
  submitForReview: (courseId) =>
    api.post(`${BASE}/${courseId}/submit`).then((r) => r.data?.data),

  /** Thêm bài học. */
  addLesson: (courseId, data) =>
    api.post(`${BASE}/${courseId}/lessons`, data).then((r) => r.data?.data),

  updateLesson: (courseId, lessonId, data) =>
    api.put(`${BASE}/${courseId}/lessons/${lessonId}`, data).then((r) => r.data?.data),

  deleteLesson: (courseId, lessonId) =>
    api.delete(`${BASE}/${courseId}/lessons/${lessonId}`).then((r) => r.data?.data),

  // ── Admin ──────────────────────────────────────────────────────────

  /** Hàng đợi duyệt. Khoá chờ lâu nhất lên đầu. */
  getPendingCourses: () => api.get(`${BASE}/pending`).then((r) => r.data?.data ?? []),

  approve: (courseId) =>
    api.post(`${BASE}/${courseId}/approve`).then((r) => r.data?.data),

  /** Từ chối. Lý do là BẮT BUỘC — backend trả 409 nếu thiếu. */
  reject: (courseId, note) =>
    api.post(`${BASE}/${courseId}/reject`, { note }).then((r) => r.data?.data),

  // ── Thí sinh ───────────────────────────────────────────────────────

  /** Khoá đã xuất bản. Truyền levelId để lọc theo trình độ. */
  browse: (levelId) =>
    api.get(BASE, { params: levelId ? { levelId } : {} }).then((r) => r.data?.data ?? []),

  /** Khoá tôi đang theo, kèm phần trăm. */
  getEnrolled: () => api.get(`${BASE}/enrolled`).then((r) => r.data?.data ?? []),

  /** Chi tiết khoá kèm danh sách bài. */
  getCourse: (courseId) => api.get(`${BASE}/${courseId}`).then((r) => r.data?.data),

  /** Ghi danh. Idempotent. */
  enroll: (courseId) =>
    api.post(`${BASE}/${courseId}/enroll`).then((r) => r.data?.data),

  /** Nội dung một bài để đọc. @returns LessonDetailResponse. */
  getLesson: (courseId, lessonId) =>
    api.get(`${BASE}/${courseId}/lessons/${lessonId}`).then((r) => r.data?.data),

  /** Đánh dấu đã đọc xong. Idempotent. */
  completeLesson: (courseId, lessonId) =>
    api.post(`${BASE}/${courseId}/lessons/${lessonId}/complete`).then((r) => r.data?.data),
};

export default courseService;
