// src/services/studyService.js
// Gọi API góc học tập của thí sinh — sổ tay câu sai và thẻ ghi nhớ.
//
// Đây là nghiệp vụ HỌC, tách hẳn khỏi examService.js vốn lo nghiệp vụ THI.
// Không hàm nào ở đây tạo ra hay đụng tới một phiên làm bài: người học mở app
// mỗi ngày, ôn thẻ đến hạn và làm lại câu từng sai, chuyện đó không liên quan
// tới đề thi nào cả.
//
// Mọi endpoint trả ApiResponse<T> = { success, message, data, error } nên giá
// trị thật luôn nằm ở data.data.

import api from './api';

// ── Sổ tay câu sai ───────────────────────────────────────────────────

/**
 * Một trang sổ tay: những câu đã làm sai và chưa sửa được.
 *
 * Các lựa chọn trả về KHÔNG kèm đáp án đúng — muốn biết đúng sai thì phải gọi
 * attemptMistake. Đừng cố đoán đáp án ở client, server cố tình không gửi.
 *
 * @param params { page = 0, size = 10 } — page đếm từ 0
 * @returns MistakeBookResponse
 *   { items: MistakeEntryResponse[], totalOpen, totalDue, totalMastered,
 *     page, size, totalPages }
 *   MistakeEntryResponse = { questionId, content, questionType, difficultyLevel,
 *     wrongCount, correctStreak, lastWrongAt, nextReviewAt, due,
 *     options: [{ answerId, content }] }
 */
export async function getMistakeBook({ page = 0, size = 10 } = {}) {
  const { data } = await api.get('/student/mistakes', { params: { page, size } });
  return data.data;
}

/**
 * Làm lại một câu trong sổ tay. Server chấm, không phải client.
 *
 * Câu trắc nghiệm thì truyền selectedAnswerId. Câu tự luận không có đáp án để
 * máy so nên người học tự chấm qua selfCorrect — đây là ôn tập cá nhân, không
 * tính điểm, nên tự đánh giá không hại ai ngoài chính mình.
 *
 * @returns MistakeAttemptResponse
 *   { questionId, correct, correctAnswerId, explanation, correctStreak,
 *     mastered, nextReviewAt, remainingOpen }
 */
export async function attemptMistake(questionId, { selectedAnswerId, selfCorrect } = {}) {
  const { data } = await api.post(`/student/mistakes/${questionId}/attempt`, {
    selectedAnswerId: selectedAnswerId ?? null,
    selfCorrect: selfCorrect ?? null,
  });
  return data.data;
}

// ── Thẻ ghi nhớ ──────────────────────────────────────────────────────

/**
 * Các bộ thẻ học được, kèm tiến độ của chính người đang xem.
 *
 * @returns DeckResponse[]
 *   { deckId, name, description, levelId, levelName, systemDeck,
 *     totalCards, enrolledCards, masteredCards, enrolled }
 */
export async function getDecks() {
  const { data } = await api.get('/student/decks');
  return data.data;
}

/**
 * Bắt đầu học một bộ thẻ.
 *
 * Gọi lại không sao: thẻ đã học giữ nguyên tiến độ, chỉ thẻ chưa có mới được
 * thêm vào lịch. Trả về SỐ THẺ MỚI, nên 0 nghĩa là đã học hết bộ này rồi chứ
 * không phải lỗi.
 *
 * @returns number
 */
export async function enrollDeck(deckId) {
  const { data } = await api.post(`/student/decks/${deckId}/enroll`);
  return data.data;
}

/**
 * Hàng đợi ôn của hôm nay.
 *
 * dueCount có thể lớn hơn cards.length: server cắt theo hạn mức ngày để người
 * nghỉ hai tuần quay lại không bị ném 400 thẻ vào mặt.
 *
 * @returns ReviewQueueResponse
 *   { cards: ReviewCardResponse[], dueCount, newCount, totalCards,
 *     matureCards, dailyLimit }
 *   ReviewCardResponse = { itemType: 'VOCAB'|'KANJI', itemId, prompt, reading,
 *     meaning, partOfSpeech, exampleSentence, exampleMeaning, audioUrl,
 *     onyomi, kunyomi, strokeCount, radical, mnemonic,
 *     isNew, repetitions, intervalDays, dueAt }
 */
export async function getDueCards(limit) {
  const { data } = await api.get('/student/reviews/due', {
    params: limit ? { limit } : {},
  });
  return data.data;
}

/**
 * Gửi mức độ nhớ sau khi lật thẻ.
 *
 * @param grade 'AGAIN' | 'HARD' | 'GOOD' | 'EASY'
 * @returns ReviewResultResponse
 *   { itemId, intervalDays, dueAt, easeFactor, repetitions, mature, remainingDue }
 */
export async function reviewCard(itemType, itemId, grade) {
  const { data } = await api.post(`/student/reviews/${itemType}/${itemId}`, { grade });
  return data.data;
}

// ── Tổng quan ────────────────────────────────────────────────────────

/**
 * Số liệu cho bảng "học hôm nay".
 *
 * @returns StudyStatsResponse
 *   { mistakesOpen, mistakesDue, mistakesMastered,
 *     cardsTotal, cardsDue, cardsMature }
 */
export async function getStudyStats() {
  const { data } = await api.get('/student/study/stats');
  return data.data;
}

export default {
  getMistakeBook,
  attemptMistake,
  getDecks,
  enrollDeck,
  getDueCards,
  reviewCard,
  getStudyStats,
};
