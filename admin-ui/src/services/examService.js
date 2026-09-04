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

// ── Tìm đề ───────────────────────────────────────────────────────────
//
// Ba lối vào cho ba màn hình, không phải một danh sách dùng chung. Học sinh gặp
// đề thi theo hai đường khác hẳn nhau — bài giáo viên giao trong lớp, và đề tự
// do em tự chọn để ôn — nên back-end trả về hai thứ riêng biệt, mỗi thứ có
// trường `source` nói rõ nó là loại nào.
//
// Mọi ExamResponse đều mang sẵn `availability` do server tính; client không bao
// giờ tự so startTime/endTime với đồng hồ máy học sinh.

/**
 * Trang chủ: đề đã nhóm sẵn theo lớp, cộng vài đề luyện tập gợi ý.
 * @returns StudentExamBoardResponse
 *   { classes: ClassExamGroup[], practice: ExamResponse[], pendingCount,
 *     practiceTruncated, serverTime }
 *   ClassExamGroup = { classId, className, subjectName, levelName, teacherName,
 *                      pendingCount, exams: ExamResponse[] }
 */
export async function getExamBoard() {
  const { data } = await api.get('/student/exams');
  return data.data;
}

/**
 * Toàn bộ đề của MỘT lớp — không phân trang vì một lớp hiếm khi có nhiều đề.
 * Ném 404 nếu học sinh không học lớp đó.
 * @returns ExamResponse[]
 */
export async function getClassExams(classId) {
  const { data } = await api.get(`/student/classes/${classId}/exams`);
  return data.data;
}

/**
 * Một trang đề luyện tập tự do, kèm bộ lọc trình độ.
 *
 * Không truyền levelId/subjectId thì server tự chọn một trình độ theo lớp học
 * sinh đang học và bật `filteredByEnrolledLevels` — client phải hiện lối thoát
 * "xem tất cả trình độ", nếu không học sinh sẽ tưởng đây là toàn bộ đề.
 *
 * @param params { levelId?, subjectId?, page = 0, size = 12 } — page đếm từ 0
 * @returns PracticeExamsResponse
 *   { levels: PracticeLevelOption[], appliedLevelId, appliedSubjectId,
 *     filteredByEnrolledLevels, exams, page, size, totalElements, totalPages }
 *   PracticeLevelOption = { levelId, levelName, subjectName, examCount, enrolled }
 */
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
  // Phải nói rõ "tôi muốn xem tất cả", vì không gửi bộ lọc mang nghĩa khác:
  // đó là lúc vừa mở trang và để server chọn hộ một trình độ.
  if (allLevels) params.allLevels = true;

  const { data } = await api.get('/student/practice-exams', { params });
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
