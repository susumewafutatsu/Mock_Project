// src/services/questionService.js
// Gọi API ngân hàng câu hỏi + câu hỏi của giáo viên.
//
// Đường dẫn lồng theo ngân hàng (/question-banks/{bankId}/questions) chứ không
// phải ?bankId=... — backend dùng bankId trong path để kiểm tra quyền sở hữu
// ngân hàng trước khi cho thao tác với câu hỏi bên trong.
//
// Mọi endpoint trả về ApiResponse<T> = { success, message, data, error } nên
// giá trị thật luôn nằm ở data.data.

import api from './api';

// ── Ngân hàng câu hỏi ────────────────────────────────────────────────

/** Danh sách ngân hàng của giáo viên đang đăng nhập → QuestionBankResponse[] */
export async function getMyBanks() {
  const { data } = await api.get('/teacher/question-banks');
  return data.data;
}

/** Tạo ngân hàng mới → { title, levelId?, sourceDocumentUrl? } */
export async function createBank(payload) {
  const { data } = await api.post('/teacher/question-banks', payload);
  return data.data;
}

// ── Câu hỏi trong ngân hàng ──────────────────────────────────────────

/**
 * Danh sách câu hỏi trong một ngân hàng (phân trang phía server).
 * @returns Page<QuestionResponse> — { content, totalElements, totalPages, number, size }
 */
export async function getQuestions(bankId, { page = 0, size = 20, sort } = {}) {
  const params = { page, size };
  if (sort) params.sort = sort;
  const { data } = await api.get(`/teacher/question-banks/${bankId}/questions`, { params });
  return data.data;
}

export async function getQuestion(bankId, questionId) {
  const { data } = await api.get(`/teacher/question-banks/${bankId}/questions/${questionId}`);
  return data.data;
}

/**
 * Tạo câu hỏi.
 * @param payload { content, questionType, difficultyLevel, explanation,
 *                  answers: [{ answerContent, correct }] }
 */
export async function createQuestion(bankId, payload) {
  const { data } = await api.post(`/teacher/question-banks/${bankId}/questions`, payload);
  return data.data;
}

/**
 * Sửa câu hỏi. Không bị chặn dù câu hỏi đã nằm trong đề đã phát hành: mỗi đề
 * giữ snapshot riêng, nên điểm đã chấm không thay đổi.
 * Đáp án có answerId sẽ được cập nhật, không có answerId là thêm mới,
 * đáp án bị bỏ khỏi danh sách sẽ bị xoá.
 */
export async function updateQuestion(bankId, questionId, payload) {
  const { data } = await api.put(
    `/teacher/question-banks/${bankId}/questions/${questionId}`,
    payload
  );
  return data.data;
}

/** Xoá câu hỏi. Câu đã dùng trong đề thi chỉ bị xoá mềm ở backend. */
export async function deleteQuestion(bankId, questionId) {
  await api.delete(`/teacher/question-banks/${bankId}/questions/${questionId}`);
}

// ── Câu hỏi trong đề thi (snapshot) ──────────────────────────────────

/**
 * Gắn câu hỏi vào đề thi. Backend chụp snapshot nội dung + đáp án ngay lúc này.
 * @param selections [{ questionId, points?, questionOrder? }]
 * @returns { added } — số câu thực sự được thêm (câu đã có trong đề bị bỏ qua)
 */
export async function attachQuestionsToExam(examId, selections) {
  const { data } = await api.post(`/teacher/exams/${examId}/questions`, selections);
  return data.data;
}

/**
 * Cập nhật snapshot của một câu hỏi trong đề theo bản mới nhất trong ngân hàng.
 * Trả lỗi 409 nếu đề đã có học sinh làm bài.
 */
export async function refreshExamQuestionSnapshot(examId, questionId) {
  await api.post(`/teacher/exams/${examId}/questions/${questionId}/refresh-snapshot`);
}

export async function detachQuestionFromExam(examId, questionId) {
  await api.delete(`/teacher/exams/${examId}/questions/${questionId}`);
}
