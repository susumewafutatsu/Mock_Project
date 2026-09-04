// src/services/classService.js
// API calls cho quản lý lớp học

import api from './api';

const BASE = '/teacher/classes';
const STUDENT_BASE = '/student/classes';

const classService = {
  /**
   * Lấy danh sách lớp học của giáo viên đang đăng nhập.
   * GET /api/teacher/classes
   */
  getMyClasses: () => api.get(BASE).then((r) => r.data?.data ?? []),

  /**
   * Lấy danh sách trình độ (kèm tên môn học) để đổ vào dropdown "Trình độ".
   * GET /api/teacher/levels
   */
  getLevels: () => api.get('/teacher/levels').then((r) => r.data?.data ?? []),

  /**
   * Lấy danh sách lớp học mà học sinh đang đăng ký.
   * GET /api/student/classes
   */
  getMyEnrolledClasses: () => api.get(STUDENT_BASE).then((r) => r.data?.data ?? []),

  /**
   * Tạo lớp học mới.
   * POST /api/teacher/classes
   * @param {{ className: string, courseCode?: string, levelId: number }} data
   */
  createClass: (data) => api.post(BASE, data).then((r) => r.data?.data),

  /**
   * Cập nhật lớp học.
   * PUT /api/teacher/classes/:id
   */
  updateClass: (classId, data) =>
    api.put(`${BASE}/${classId}`, data).then((r) => r.data?.data),

  /**
   * Xóa lớp học (xóa cả danh sách học sinh đăng ký).
   * DELETE /api/teacher/classes/:id
   */
  deleteClass: (classId) => api.delete(`${BASE}/${classId}`),

  /**
   * Lấy danh sách học sinh trong lớp.
   * GET /api/teacher/classes/:id/students
   */
  getStudents: (classId) =>
    api.get(`${BASE}/${classId}/students`).then((r) => r.data?.data ?? []),

  /**
   * Thêm học sinh vào lớp bằng email.
   * POST /api/teacher/classes/:id/students
   * @param {string} studentEmail
   */
  addStudent: (classId, studentEmail) =>
    api.post(`${BASE}/${classId}/students`, { studentEmail }),

  /**
   * Xóa học sinh khỏi lớp.
   * DELETE /api/teacher/classes/:id/students/:studentId
   */
  removeStudent: (classId, studentId) =>
    api.delete(`${BASE}/${classId}/students/${studentId}`),
};

export default classService;
