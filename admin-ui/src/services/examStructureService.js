// src/services/examStructureService.js
// Cấu trúc đề theo chuẩn JLPT: phần thi (có đồng hồ riêng) và bài đọc.

import api from './api';

const examStructureService = {
  // ── Phần thi ───────────────────────────────────────────────────────

  /** @returns ExamSectionView[] { sectionId, name, orderNo, durationMinutes, totalQuestions } */
  getSections: (examId) =>
    api.get(`/teacher/exams/${examId}/sections`).then((r) => r.data?.data ?? []),

  /** Thay toàn bộ danh sách phần. */
  replaceSections: (examId, sections) =>
    api.put(`/teacher/exams/${examId}/sections`, sections).then((r) => r.data?.data ?? []),

  /** Áp cấu trúc chuẩn của cấp JLPT gắn với đề, và bật chấm theo thang quy đổi. */
  applyJlptTemplate: (examId) =>
    api.post(`/teacher/exams/${examId}/sections/jlpt-template`).then((r) => r.data?.data ?? []),

  deleteSections: (examId) => api.delete(`/teacher/exams/${examId}/sections`),

  // ── Bài đọc ────────────────────────────────────────────────────────

  /** @returns ReadingPassageResponse[] { passageId, title, content, questionCount } */
  getPassages: (bankId) =>
    api.get(`/teacher/question-banks/${bankId}/passages`).then((r) => r.data?.data ?? []),

  createPassage: (bankId, data) =>
    api.post(`/teacher/question-banks/${bankId}/passages`, data).then((r) => r.data?.data),

  updatePassage: (bankId, passageId, data) =>
    api.put(`/teacher/question-banks/${bankId}/passages/${passageId}`, data).then((r) => r.data?.data),

  /** Backend trả 409 nếu còn câu hỏi đang dùng bài đọc này. */
  deletePassage: (bankId, passageId) =>
    api.delete(`/teacher/question-banks/${bankId}/passages/${passageId}`),
};

export default examStructureService;
