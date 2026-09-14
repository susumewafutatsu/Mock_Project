// src/services/teacherExamService.js
// Quản lý đề thi phía người ra đề.

import api from './api';

const BASE = '/teacher/exams';

/** Chuyển ngày + giờ từ 2 input rời của form thành chuỗi ISO local (yyyy-MM-ddTHH:mm:ss) mà backend đọc được vào LocalDateTime. */
export function toLocalDateTime(date, time) {
  if (!date) return null;
  return `${date}T${time && time.length >= 4 ? time : '00:00'}:00`;
}

/** Đề thi do người ra đề đang đăng nhập tạo → TeacherExamResponse[] */
export async function getMyExams() {
  const { data } = await api.get(BASE);
  return data.data ?? [];
}

/** Tạo đề thi mới. */
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
