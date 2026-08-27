// src/services/examService.js
// Gọi API phòng thi của học sinh.
//
// Hợp đồng thời gian: server là nơi duy nhất có quyền nói còn bao nhiêu giờ.
// Mọi response ở đây đều mang { serverTime, expiresAt, remainingSeconds }, và
// client chỉ đếm ngược từ remainingSeconds — không bao giờ tự tính từ đồng hồ
// máy học sinh (xem hooks/useExamTimer.js).
//
// Mọi endpoint trả ApiResponse<T> = { success, message, data, error } nên giá
// trị thật luôn nằm ở data.data.

import api from './api';

// ── Danh sách đề ─────────────────────────────────────────────────────

/**
 * Đề học sinh được làm, kèm trạng thái từng đề → ExamResponse[]
 * availability: UPCOMING | OPEN | IN_PROGRESS | SUBMITTED | CLOSED | NO_QUESTIONS
 */
export async function getExams() {
  const { data } = await api.get('/student/exams');
  return data.data;
}

// ── Phiên làm bài ────────────────────────────────────────────────────

/**
 * Vào phòng thi. Idempotent — gọi lại là "vào lại phòng thi" chứ không phải
 * "thi lại": server trả về đúng phiên đang dở kèm các đáp án đã lưu, cờ
 * `resumed` cho biết đó là phiên mới hay phiên cũ.
 * Ném lỗi 409 nếu đã nộp bài, đề chưa mở / đã đóng, hoặc phiên đã hết giờ
 * (bài được nộp tự động trước khi báo lỗi).
 * @returns ExamSessionResponse — { remainingSeconds, expiresAt, serverTime, questions, ... }
 */
export async function startExam(examId) {
  const { data } = await api.post(`/student/exams/${examId}/start`);
  return data.data;
}

/**
 * Đọc lại phiên đang dở, không tạo mới. Dùng khi mạng vừa trở lại: lấy về toàn
 * bộ đáp án đã lưu trên server và thời gian còn lại thật.
 * Ném 404 nếu học sinh chưa từng bắt đầu đề này.
 */
export async function getSession(examId) {
  const { data } = await api.get(`/student/exams/${examId}/session`);
  return data.data;
}

/**
 * Autosave một câu. Gọi ngay mỗi lần học sinh bấm chọn, không đợi nộp bài.
 * Upsert theo (submissionId, questionId) nên gửi lại cùng một câu là an toàn.
 * @param answer { questionId, snapshotAnswerId?, essayResponse? }
 *        snapshotAnswerId = null để bỏ chọn; essayResponse rỗng để xoá bài viết.
 * @returns AnswerSavedResponse — có remainingSeconds để đồng bộ lại đồng hồ
 */
export async function saveAnswer(examId, answer) {
  const { data } = await api.put(`/student/exams/${examId}/answers`, answer);
  return data.data;
}

/**
 * Nhịp sống của client, gọi mỗi 15-30 giây. Chỉ để server biết học sinh còn kết
 * nối — KHÔNG gia hạn thêm giờ.
 * @returns HeartbeatResponse — { remainingSeconds, autoSubmitted, recoveredFromAtRisk, ... }
 *          autoSubmitted = true nghĩa là server vừa chốt bài vì hết giờ.
 */
export async function heartbeat(examId) {
  const { data } = await api.post(`/student/exams/${examId}/heartbeat`);
  return data.data;
}

/**
 * Nộp bài. Đáp án đã autosave từ trước nên body thường để rỗng; `answers` chỉ
 * là lưới an toàn cho câu mà lần autosave cuối chưa kịp gửi lên.
 * @param pendingAnswers [{ questionId, snapshotAnswerId?, essayResponse? }]
 * @returns ExamResultResponse
 */
export async function submitExam(examId, pendingAnswers = []) {
  const { data } = await api.post(`/student/exams/${examId}/submit`, {
    answers: pendingAnswers,
  });
  return data.data;
}

// ── Kết quả ──────────────────────────────────────────────────────────

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

/**
 * Lỗi "phiên thi không còn mở nữa": hết giờ và đã bị nộp tự động, hoặc đã nộp
 * từ trước. Server dùng 409 cho mọi trường hợp này (BusinessException).
 *
 * Dùng status chứ không so nội dung message: message là câu tiếng Việt để hiện
 * cho học sinh đọc, sửa lại lúc nào cũng được mà không làm hỏng logic client.
 */
export function isSessionClosedError(error) {
  return error?.status === 409;
}

/** Học sinh chưa từng bắt đầu đề này (getSession trả 404). */
export function isNoSessionError(error) {
  return error?.status === 404;
}
