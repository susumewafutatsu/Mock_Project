// src/services/roomService.js
// API phòng thi — thay cho classService.js thời còn lớp học.

import api from './api';

const BASE = '/rooms';

const roomService = {
  // ── Người ra đề ────────────────────────────────────────────────────

  /** Phòng do tôi mở. @returns RoomResponse[] { roomId, name, code, ownerName, levelId, levelName, subjectName. */
  getMyRooms: () => api.get(`${BASE}/mine`).then((r) => r.data?.data ?? []),

  /** Mở phòng mới. Mã phòng do server sinh — không gửi code lên. */
  createRoom: (data) => api.post(BASE, data).then((r) => r.data?.data),

  /** Sửa phòng. Mã phòng KHÔNG sửa được — đã đọc cho cả phòng rồi. */
  updateRoom: (roomId, data) =>
    api.put(`${BASE}/${roomId}`, data).then((r) => r.data?.data),

  /** Xoá phòng. Chỉ được khi chưa có ai vào; đã có người thì đóng phòng. */
  deleteRoom: (roomId) => api.delete(`${BASE}/${roomId}`),

  /** Ai đang trong phòng, theo thứ tự ghế. */
  getMembers: (roomId) =>
    api.get(`${BASE}/${roomId}/members`).then((r) => r.data?.data ?? []),

  /** Mời một người ra khỏi phòng. Ghế của họ không được cấp lại cho ai. */
  kickMember: (roomId, userId) =>
    api.delete(`${BASE}/${roomId}/members/${userId}`),

  /** Gắn một bài thi vào phòng. Bài thi phải do chính mình tạo. */
  attachExam: (roomId, examId) =>
    api.post(`${BASE}/${roomId}/exams/${examId}`).then((r) => r.data?.data),

  /** Gỡ bài thi khỏi phòng. Bài thi vẫn còn trong ngân hàng. */
  detachExam: (roomId, examId) =>
    api.delete(`${BASE}/${roomId}/exams/${examId}`).then((r) => r.data?.data),

  /** "Bắt đầu làm bài": sảnh chờ → đang thi ngay lúc này. */
  startExam: (roomId) => api.post(`${BASE}/${roomId}/start`).then((r) => r.data?.data),

  /** Kết thúc phòng. Đang thi thì thu bài cả phòng ngay và mở bảng xếp hạng. */
  endExam: (roomId) => api.post(`${BASE}/${roomId}/end`).then((r) => r.data?.data),

  /** Chi tiết một phòng (chủ phòng hoặc thành viên). */
  getRoom: (roomId) => api.get(`${BASE}/${roomId}`).then((r) => r.data?.data),

  /** Tiến độ làm bài của cả phòng. */
  getMonitor: (roomId) => api.get(`${BASE}/${roomId}/monitor`).then((r) => r.data?.data),

  /** Tạo buổi thi mới từ phòng cũ. */
  duplicateRoom: (roomId, data = {}) =>
    api.post(`${BASE}/${roomId}/duplicate`, data).then((r) => r.data?.data),

  /** Bảng xếp hạng của phòng, mỗi đề một bảng. */
  getLeaderboard: (roomId) =>
    api.get(`${BASE}/${roomId}/leaderboard`).then((r) => r.data?.data),

  // ── Thí sinh ───────────────────────────────────────────────────────

  /** Phòng tôi đang tham gia. */
  getJoinedRooms: () => api.get(`${BASE}/joined`).then((r) => r.data?.data ?? []),

  /** Phòng đang mở cho bất kỳ ai — không cần mã. Danh sách này không kèm mã phòng. */
  getOpenRooms: () => api.get(`${BASE}/open`).then((r) => r.data?.data ?? []),

  /** Vào phòng bằng mã. */
  joinByCode: (code) =>
    api.post(`${BASE}/join`, { code }).then((r) => r.data?.data),

  /** Vào phòng công khai không cần mã. */
  joinOpen: (roomId) => api.post(`${BASE}/${roomId}/join-open`).then((r) => r.data?.data),

  /** Báo đang mở trang phòng. */
  ping: (roomId) => api.post(`${BASE}/${roomId}/presence`),

  /** Tự rời phòng. */
  leaveRoom: (roomId) => api.delete(`${BASE}/${roomId}/membership`),

  /** Danh mục trình độ để đổ vào dropdown. */
  getLevels: () => api.get('/teacher/levels').then((r) => r.data?.data ?? []),
};

export default roomService;
