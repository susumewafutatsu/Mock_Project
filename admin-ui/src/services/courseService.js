// src/services/courseService.js
// API khoá học — nơi chứa NGỮ PHÁP và CHỮ HÁN.
//
// Vì sao có khoá học khi đã có bộ thẻ (studyService.js): thẻ lật chỉ hợp với từ
// vựng, một từ ứng một nghĩa. Ngữ pháp cần một trang giải thích cấu trúc, cách
// nối và sắc thái; chữ Hán cần mặt chữ, âm On/Kun, bộ thủ và từ ghép. Cả hai
// thứ đó không nhét vừa mặt sau một tấm thẻ.
//
// Ba vai dùng chung tiền tố /courses, backend tự phân quyền theo vai:
//   - Người ra đề soạn nội dung rồi gửi duyệt
//   - Admin duyệt hoặc từ chối kèm lý do
//   - Thí sinh chỉ thấy khoá đã xuất bản
//
// Mọi endpoint trả ApiResponse<T> nên giá trị thật nằm ở data.data.

import api from './api';

const BASE = '/courses';

const courseService = {
  // ── Người ra đề ────────────────────────────────────────────────────

  /**
   * Khoá tôi soạn, mọi trạng thái.
   * @returns CourseResponse[]
   *   { courseId, title, description, levelId, levelName, subjectName,
   *     authorName, status: 'DRAFT'|'PENDING'|'PUBLISHED'|'REJECTED',
   *     reviewNote, reviewedByName, reviewedAt, totalLessons, enrolledCount,
   *     enrolled, completedLessons, progressPercent, author }
   */
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

  /**
   * Thêm bài học.
   * @param data { title, lessonType, content, estimatedMinutes, deckId?, examId?, orderNo? }
   *   lessonType: 'GRAMMAR' | 'KANJI' | 'VOCAB' | 'READING' | 'LISTENING'
   *   deckId/examId để trống được — bài ngữ pháp thường chẳng cần thẻ nào.
   * @returns CourseDetailResponse { course, lessons }
   */
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

  /**
   * Từ chối. Lý do là BẮT BUỘC — backend trả 409 nếu thiếu, vì từ chối suông
   * thì tác giả chỉ biết là bị trả về chứ không biết sửa gì.
   */
  reject: (courseId, note) =>
    api.post(`${BASE}/${courseId}/reject`, { note }).then((r) => r.data?.data),

  // ── Thí sinh ───────────────────────────────────────────────────────

  /** Khoá đã xuất bản. Truyền levelId để lọc theo trình độ. */
  browse: (levelId) =>
    api.get(BASE, { params: levelId ? { levelId } : {} }).then((r) => r.data?.data ?? []),

  /** Khoá tôi đang theo, kèm phần trăm. */
  getEnrolled: () => api.get(`${BASE}/enrolled`).then((r) => r.data?.data ?? []),

  /**
   * Chi tiết khoá kèm danh sách bài.
   * @returns { course: CourseResponse,
   *            lessons: [{ lessonId, orderNo, title, lessonType,
   *                        estimatedMinutes, hasDeck, hasExam, completed }] }
   *   Danh sách bài cố ý KHÔNG kèm nội dung — 30 bài kèm lý thuyết là vài trăm
   *   KB cho một màn hình chỉ hiện tên bài.
   */
  getCourse: (courseId) => api.get(`${BASE}/${courseId}`).then((r) => r.data?.data),

  /** Ghi danh. Idempotent. */
  enroll: (courseId) =>
    api.post(`${BASE}/${courseId}/enroll`).then((r) => r.data?.data),

  /**
   * Nội dung một bài để đọc.
   * @returns LessonDetailResponse — có sẵn previousLessonId/nextLessonId nên
   *   client không phải giữ cả danh sách bài chỉ để biết đi tiếp đâu.
   */
  getLesson: (courseId, lessonId) =>
    api.get(`${BASE}/${courseId}/lessons/${lessonId}`).then((r) => r.data?.data),

  /**
   * Đánh dấu đã đọc xong. Idempotent.
   * @returns CourseResponse kèm phần trăm mới, để màn hình cập nhật ngay.
   */
  completeLesson: (courseId, lessonId) =>
    api.post(`${BASE}/${courseId}/lessons/${lessonId}/complete`).then((r) => r.data?.data),
};

export default courseService;
