// src/services/teacherExamService.js
// Quản lý đề thi phía người ra đề.
//
// Khác examService.js (dành cho phòng thi của thí sinh): ở đây là CRUD đề thi.
// Câu hỏi của đề gắn riêng qua questionService.attachQuestionsToExam — đề mới
// tạo luôn ở trạng thái NO_QUESTIONS cho tới khi gắn ít nhất một câu.
//
// Mọi endpoint trả ApiResponse<T> = { success, message, data, error }.

import api from './api';

const BASE = '/teacher/exams';

/**
 * Chuyển ngày + giờ từ 2 input rời của form thành chuỗi ISO local
 * (yyyy-MM-ddTHH:mm:ss) mà backend đọc được vào LocalDateTime.
 * Không dùng toISOString() vì hàm đó đổi sang UTC, lệch múi giờ VN 7 tiếng.
 */
export function toLocalDateTime(date, time) {
  if (!date) return null;
  return `${date}T${time && time.length >= 4 ? time : '00:00'}:00`;
}

/** Đề thi do người ra đề đang đăng nhập tạo → TeacherExamResponse[] */
export async function getMyExams() {
  const { data } = await api.get(BASE);
  return data.data ?? [];
}

/**
 * Tạo đề thi mới.
 * @param payload { title, classId?, levelId, durationMinutes, startTime, endTime,
 *                  adaptive?, maxAttempts?, allowReview? }
 *        classId để trống = đề luyện tập tự do, mọi thí sinh đều thấy.
 *        maxAttempts null = không giới hạn số lượt làm (mặc định của backend).
 *        allowReview mặc định true = thí sinh xem được đáp án sau khi nộp.
 */
export async function createExam(payload) {
  const { data } = await api.post(BASE, payload);
  return data.data;
}

/** Sửa đề. Backend trả 409 nếu đề đã có thí sinh làm bài. */
export async function updateExam(examId, payload) {
  const { data } = await api.put(`${BASE}/${examId}`, payload);
  return data.data;
}

/** Xóa đề. Backend trả 409 nếu đề đã có thí sinh làm bài. */
export async function deleteExam(examId) {
  await api.delete(`${BASE}/${examId}`);
}
