// src/services/roomService.js
// API phòng thi — thay cho classService.js thời còn lớp học.
//
// Khác biệt lớn nhất so với bản cũ, và nó không chỉ là đổi tên đường dẫn:
// người ra đề KHÔNG thêm từng người vào phòng nữa. Vì thế ở đây không có
// addMember; thay vào đó là join() do chính thí sinh gọi với mã phòng.
//
// Tất cả nằm dưới /api/rooms chứ không tách theo vai, vì phòng thi là nơi hai
// vai gặp nhau: cùng một tài nguyên, hai góc nhìn. Việc phân quyền do backend
// làm — người không phải chủ phòng nhận 404 chứ không phải 403.
//
// Mọi endpoint trả ApiResponse<T> nên giá trị thật nằm ở data.data.

import api from './api';

const BASE = '/rooms';

const roomService = {
  // ── Người ra đề ────────────────────────────────────────────────────

  /**
   * Phòng do tôi mở.
   * @returns RoomResponse[]
   *   { roomId, name, code, ownerName, levelId, levelName, subjectName,
   *     capacity, memberCount, seatsLeft, joinPolicy, status,
   *     startTime, endTime, examCount, owner, myStatus, mySeatNo }
   */
  getMyRooms: () => api.get(`${BASE}/mine`).then((r) => r.data?.data ?? []),

  /**
   * Mở phòng mới. Mã phòng do server sinh — không gửi code lên.
   *
   * Phòng luôn bắt đầu ở trạng thái DRAFT: phải gắn ít nhất một bài thi rồi
   * mới mở được, nếu không thí sinh vào và thấy một phòng trống rỗng.
   *
   * @param {{ name: string, levelId?: number, capacity?: number,
   *           joinPolicy?: 'OPEN'|'CODE'|'APPROVAL',
   *           startTime?: string, endTime?: string }} data
   *   capacity bỏ trống = không giới hạn người.
   */
  createRoom: (data) => api.post(BASE, data).then((r) => r.data?.data),

  /** Sửa phòng. Mã phòng KHÔNG sửa được — đã đọc cho cả phòng rồi. */
  updateRoom: (roomId, data) =>
    api.put(`${BASE}/${roomId}`, data).then((r) => r.data?.data),

  /** Xoá phòng. Chỉ được khi chưa có ai vào; đã có người thì đóng phòng. */
  deleteRoom: (roomId) => api.delete(`${BASE}/${roomId}`),

  /**
   * Ai đang trong phòng, theo thứ tự ghế.
   * @returns RoomMemberResponse[] { userId, fullName, email, seatNo, status, joinedAt }
   */
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

  // ── Thí sinh ───────────────────────────────────────────────────────

  /** Phòng tôi đang tham gia. */
  getJoinedRooms: () => api.get(`${BASE}/joined`).then((r) => r.data?.data ?? []),

  /** Phòng đang mở cho bất kỳ ai — không cần mã. Danh sách này không kèm mã phòng. */
  getOpenRooms: () => api.get(`${BASE}/open`).then((r) => r.data?.data ?? []),

  /**
   * Vào phòng bằng mã.
   *
   * Idempotent: đã ở trong phòng thì nhận lại đúng ghế cũ. Phòng hết chỗ trả
   * về lỗi 409 — đó là câu trả lời đúng cho "ai nhanh thì vào", không phải lỗi
   * hệ thống, nên hiện nguyên câu thông báo của server cho người dùng.
   */
  joinByCode: (code) =>
    api.post(`${BASE}/join`, { code }).then((r) => r.data?.data),

  /** Tự rời phòng. */
  leaveRoom: (roomId) => api.delete(`${BASE}/${roomId}/membership`),

  /** Danh mục trình độ để đổ vào dropdown. */
  getLevels: () => api.get('/teacher/levels').then((r) => r.data?.data ?? []),
};

export default roomService;
