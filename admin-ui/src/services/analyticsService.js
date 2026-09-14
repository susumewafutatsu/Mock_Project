// src/services/analyticsService.js
// Kết quả & phân tích cho người ra đề.

import api from './api';

const BASE = '/teacher/analytics';

const analyticsService = {
  /** Số liệu màn Tổng quan. @returns { totalExams, publicExams, examsWithoutQuestions, totalRooms, roomsInProgress. */
  getOverview: () => api.get(`${BASE}/overview`).then((r) => r.data?.data),

  /** Bài nộp của một đề, mới nhất trước. */
  getExamSubmissions: (examId) =>
    api.get(`${BASE}/exams/${examId}/submissions`).then((r) => r.data?.data ?? []),

  /** Bài nộp của mọi đề trong một phòng, chỉ tính thành viên phòng đó. */
  getRoomSubmissions: (roomId) =>
    api.get(`${BASE}/rooms/${roomId}/submissions`).then((r) => r.data?.data ?? []),

  /** Bài làm đầy đủ của một lượt nộp — cùng khuôn với màn thí sinh xem lại bài. */
  getPaper: (submissionId) =>
    api.get(`${BASE}/submissions/${submissionId}`).then((r) => r.data?.data),

  /** Tỉ lệ đúng từng câu, câu sai nhiều nhất lên đầu. */
  getQuestionStats: (examId, roomId) =>
    api.get(`${BASE}/exams/${examId}/questions`, { params: roomId ? { roomId } : undefined })
      .then((r) => r.data?.data ?? []),

  /** Tỉ lệ đúng gộp theo tag (≈ kỹ năng), cùng phạm vi như trên. */
  getTagStats: (examId, roomId) =>
    api.get(`${BASE}/exams/${examId}/tags`, { params: roomId ? { roomId } : undefined })
      .then((r) => r.data?.data ?? []),

  /** Thí sinh trong các phòng của tôi, kèm tiến độ làm bài. */
  getStudents: () => api.get(`${BASE}/students`).then((r) => r.data?.data ?? []),
};

/** Dựng và tải một file CSV từ mảng object. */
export function downloadCsv(filename, columns, rows) {
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v);
    // Bọc trong ngoặc kép khi có dấu phẩy, xuống dòng hoặc chính dấu nháy kép; nháy kép bên trong được nhân đôi.
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const head = columns.map((c) => escape(c.label)).join(',');
  const body = rows.map((row) => columns.map((c) => escape(row[c.key])).join(',')).join('\r\n');
  const blob = new Blob([`﻿${head}\r\n${body}`], { type: 'text/csv;charset=utf-8' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default analyticsService;
