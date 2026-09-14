// src/services/examService.js
// Gọi API phòng thi của thí sinh.

import api, { tokenStore } from './api';
import { ackAnswers, clearDraft, listPendingDrafts, toPayload } from '../utils/examDraft';

// ── Tìm đề ───────────────────────────────────────────────────────────
// Đề được giao và đề tự do; trạng thái mở/đóng (availability) do server tính.

/** Trang chủ: đề đã nhóm sẵn theo lớp, cộng vài đề luyện tập gợi ý. */
export async function getExamBoard() {
  const { data } = await api.get('/student/exams');
  return data.data;
}

/** Toàn bộ đề của MỘT phòng thi — không phân trang vì một phòng hiếm khi có nhiều đề. */
export async function getRoomExams(roomId) {
  const { data } = await api.get(`/student/rooms/${roomId}/exams`);
  return data.data;
}

/** Một trang đề luyện tập tự do, kèm bộ lọc trình độ. */
export async function getPracticeExams({
  levelId = null,
  subjectId = null,
  allLevels = false,
  page = 0,
  size = 12,
} = {}) {
  const params = { page, size };
  // Bỏ hẳn key khi không lọc, thay vì gửi levelId=null — chuỗi "null" trên URL
  // sẽ khiến Spring cố ép kiểu và trả 400.
  if (levelId != null) params.levelId = levelId;
  if (subjectId != null) params.subjectId = subjectId;
  // Phải nói rõ "tôi muốn xem tất cả", vì không gửi bộ lọc mang nghĩa khác.
  if (allLevels) params.allLevels = true;

  const { data } = await api.get('/student/practice-exams', { params });
  return data.data;
}

// ── Phiên làm bài ────────────────────────────────────────────────────

/** Vào phòng thi. Idempotent — gọi lại là "vào lại phòng thi" chứ không phải "thi lại" */
export async function startExam(examId) {
  const { data } = await api.post(`/student/exams/${examId}/start`);
  return data.data;
}

/** Đọc lại phiên đang dở, không tạo mới. */
export async function getSession(examId) {
  const { data } = await api.get(`/student/exams/${examId}/session`);
  return data.data;
}

/** Đẩy một lô đáp án đã gom trong localStorage (utils/examDraft.js). */
export async function saveAnswers(examId, submissionId, answers) {
  const { data } = await api.put(`/student/exams/${examId}/answers/batch`, {
    submissionId,
    answers,
  });
  return data.data;
}

/** fetch keepalive có giới hạn 64KB cho tổng các request đang treo của trang. */
const KEEPALIVE_MAX_BYTES = 60 * 1024;

/** Bản "bắn rồi quên" của saveAnswers, dùng lúc tab bị ẩn / trang sắp đóng. */
export function saveAnswersKeepalive(examId, submissionId, answers) {
  const body = JSON.stringify({ submissionId, answers });
  // Đếm byte UTF-8 chứ không đếm ký tự: một chữ Nhật là 3 byte.
  if (!answers.length || new Blob([body]).size > KEEPALIVE_MAX_BYTES) {
    return null;
  }
  const token = tokenStore.getAccessToken();
  return fetch(`${api.defaults.baseURL}/student/exams/${examId}/answers/batch`, {
    method: 'PUT',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
  }).then(async (res) => {
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      // Cùng thứ tự đọc message với interceptor trong api.js.
      const err = new Error(
        (payload?.success === false ? payload?.error : null) ||
          payload?.message ||
          payload?.error ||
          `HTTP ${res.status}`
      );
      err.status = res.status;
      throw err;
    }
    return payload?.data;
  });
}

/** Đẩy các bản nháp còn sót trên máy này. */
export async function pushLeftoverDrafts() {
  for (const draft of listPendingDrafts()) {
    const sentRevs = Object.fromEntries(
      Object.entries(draft.pending).map(([qid, entry]) => [qid, entry.rev])
    );
    try {
      await saveAnswers(draft.examId, draft.submissionId, toPayload(draft.pending));
      ackAnswers(draft.submissionId, sentRevs);
    } catch (err) {
      if (isSessionClosedError(err)) clearDraft(draft.submissionId);
    }
  }
}

/** Như trên nhưng bắn bằng keepalive — dùng ngay trước khi đăng xuất xoá token. */
export function pushLeftoverDraftsKeepalive() {
  for (const draft of listPendingDrafts()) {
    saveAnswersKeepalive(draft.examId, draft.submissionId, toPayload(draft.pending))?.catch(
      () => {}
    );
  }
}

/** Lưu một câu. Endpoint cũ, phòng thi không còn dùng — giữ cho tương thích. */
export async function saveAnswer(examId, answer) {
  const { data } = await api.put(`/student/exams/${examId}/answers`, answer);
  return data.data;
}

/** Nhịp sống của client, gọi mỗi 15-30 giây. */
export async function heartbeat(examId) {
  const { data } = await api.post(`/student/exams/${examId}/heartbeat`);
  return data.data;
}

/** Nộp bài. Đáp án đã autosave từ trước nên body thường để rỗng. */
export async function submitExam(examId, pendingAnswers = []) {
  const { data } = await api.post(`/student/exams/${examId}/submit`, {
    answers: pendingAnswers,
  });
  return data.data;
}

// ── Kết quả ──────────────────────────────────────────────────────────

/** Bảng xếp hạng của một đề tự do: tốp 20 + dòng của chính mình (myRow), kể cả khi mình nằm ngoài tốp. */
export async function getExamLeaderboard(examId) {
  const { data } = await api.get(`/student/exams/${examId}/leaderboard`);
  return data.data;
}

export async function getResult(submissionId) {
  const { data } = await api.get(`/student/submissions/${submissionId}/result`);
  return data.data;
}

/** Lịch sử các bài đã nộp (không kèm chi tiết từng câu) → ExamResultResponse[] */
export async function getStudentResults() {
  const { data } = await api.get('/student/results');
  return data.data;
}

// ── Nhận dạng lỗi ────────────────────────────────────────────────────

/** Lỗi "phiên thi không còn mở nữa": hết giờ và đã bị nộp tự động, hoặc đã nộp từ trước. */
export function isSessionClosedError(error) {
  return error?.status === 409;
}

/** Lỗi "đã dùng hết số lượt làm bài". */
export function isAttemptsExhaustedError(error) {
  return error?.status === 409 && /hết\s.*lượt/i.test(error?.message || '');
}

/** Thí sinh chưa từng bắt đầu đề này (getSession trả 404). */
export function isNoSessionError(error) {
  return error?.status === 404;
}
