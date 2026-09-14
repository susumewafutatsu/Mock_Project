// src/services/studyService.js
// Gọi API góc học tập của thí sinh — sổ tay câu sai và thẻ ghi nhớ.

import api from './api';

// ── Sổ tay câu sai ───────────────────────────────────────────────────

/** Một trang sổ tay: những câu đã làm sai và chưa sửa được. */
export async function getMistakeBook({ page = 0, size = 10 } = {}) {
  const { data } = await api.get('/student/mistakes', { params: { page, size } });
  return data.data;
}

/** Làm lại một câu trong sổ tay. */
export async function attemptMistake(questionId, { selectedAnswerId, selfCorrect } = {}) {
  const { data } = await api.post(`/student/mistakes/${questionId}/attempt`, {
    selectedAnswerId: selectedAnswerId ?? null,
    selfCorrect: selfCorrect ?? null,
  });
  return data.data;
}

// ── Bộ thẻ ───────────────────────────────────────────────────────────

/** Bộ của tôi và bộ có sẵn, kèm tiến độ. */
export async function getDecks() {
  const { data } = await api.get('/student/decks');
  return data.data;
}

export async function getDeck(deckId) {
  const { data } = await api.get(`/student/decks/${deckId}`);
  return data.data;
}

export async function createDeck(deck) {
  const { data } = await api.post('/student/decks', deck);
  return data.data;
}

export async function updateDeck(deckId, deck) {
  const { data } = await api.put(`/student/decks/${deckId}`, deck);
  return data.data;
}

export async function deleteDeck(deckId) {
  await api.delete(`/student/decks/${deckId}`);
}

/** Thêm thẻ tự soạn. */
export async function addCustomCard(deckId, card) {
  const { data } = await api.post(`/student/decks/${deckId}/cards`, card);
  return data.data;
}

export async function updateCustomCard(deckId, cardId, card) {
  const { data } = await api.put(`/student/decks/${deckId}/cards/${cardId}`, card);
  return data.data;
}

/** Thêm từ vựng / chữ Hán có sẵn vào bộ. */
export async function addDeckItem(deckId, itemType, itemId) {
  const { data } = await api.post(`/student/decks/${deckId}/items`, { itemType, itemId });
  return data.data;
}

export async function removeDeckItem(deckId, itemType, itemId) {
  await api.delete(`/student/decks/${deckId}/items/${itemType}/${itemId}`);
}

/** Tìm từ vựng / chữ Hán có sẵn. */
export async function searchContent({ q, type, deckId } = {}) {
  const { data } = await api.get('/student/study/search', {
    params: { q, ...(type ? { type } : {}), ...(deckId ? { deckId } : {}) },
  });
  return data.data;
}

// ── Lịch học ─────────────────────────────────────────────────────────

/** Thêm bộ vào lịch học. */
export async function enrollDeck(deckId) {
  const { data } = await api.post(`/student/decks/${deckId}/enroll`);
  return data.data;
}

/** Bỏ bộ khỏi lịch học. */
export async function unenrollDeck(deckId) {
  const { data } = await api.delete(`/student/decks/${deckId}/enroll`);
  return data.data;
}

/** Hàng đợi hôm nay; deckId để học riêng một bộ, extraNew để học thêm thẻ mới. */
export async function getDueCards({ deckId, extraNew } = {}) {
  const params = {};
  if (deckId) params.deckId = deckId;
  if (extraNew) params.extraNew = extraNew;
  const { data } = await api.get('/student/reviews/due', { params });
  return data.data;
}

/** Gửi mức độ nhớ sau khi lật thẻ. */
export async function reviewCard(itemType, itemId, grade) {
  const { data } = await api.post(`/student/reviews/${itemType}/${itemId}`, { grade });
  return data.data;
}

// ── Tổng quan ────────────────────────────────────────────────────────

/** Số liệu cho bảng "học hôm nay". */
export async function getStudyStats() {
  const { data } = await api.get('/student/study/stats');
  return data.data;
}

export default {
  getMistakeBook,
  attemptMistake,
  getDecks,
  getDeck,
  createDeck,
  updateDeck,
  deleteDeck,
  addCustomCard,
  updateCustomCard,
  addDeckItem,
  removeDeckItem,
  searchContent,
  enrollDeck,
  unenrollDeck,
  getDueCards,
  reviewCard,
  getStudyStats,
};
