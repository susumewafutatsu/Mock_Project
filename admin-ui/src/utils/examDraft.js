// src/utils/examDraft.js
// Bản nháp đáp án của phòng thi, nằm trong localStorage.

const PREFIX = 'exam:draft:';

/** Sau hạn phiên vẫn giữ thêm một chút, phòng đồng hồ máy lệch với server. */
const EXPIRY_GRACE_MS = 5 * 60 * 1000;

const keyOf = (submissionId) => `${PREFIX}${submissionId}`;

// localStorage có thể ném lỗi (chế độ riêng tư của một số trình duyệt, đầy quota, bị chặn site data).
function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // bỏ qua
  }
}

function allDraftKeys() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    return keys;
  } catch {
    return [];
  }
}

/** Mở (hoặc tạo) bản nháp cho một phiên. */
export function openDraft({ examId, submissionId, remainingSeconds }) {
  const key = keyOf(submissionId);
  const existing = read(key);
  const draft = {
    examId,
    submissionId,
    expiresAtMs: Date.now() + Math.max(0, Number(remainingSeconds) || 0) * 1000,
    pending: existing?.pending ?? {},
  };
  write(key, draft);
  return draft.pending;
}

export function readPending(submissionId) {
  return read(keyOf(submissionId))?.pending ?? {};
}

/** Ghi một thao tác của thí sinh vào nháp. */
export function stageAnswer(submissionId, questionId, answer, serverOffsetMs = 0) {
  const key = keyOf(submissionId);
  const draft = read(key) ?? { submissionId, pending: {} };
  const rev = (draft.pending[questionId]?.rev ?? 0) + 1;
  draft.pending[questionId] = {
    snapshotAnswerId: answer.snapshotAnswerId ?? null,
    essayResponse: answer.essayResponse ?? '',
    rev,
    stagedAt: Date.now() + serverOffsetMs,
  };
  write(key, draft);
  return rev;
}

/** Server đã xác nhận một lô. */
export function ackAnswers(submissionId, sentRevs) {
  const key = keyOf(submissionId);
  const draft = read(key);
  if (!draft) return {};
  for (const [qid, rev] of Object.entries(sentRevs)) {
    if (draft.pending[qid]?.rev === rev) {
      delete draft.pending[qid];
    }
  }
  write(key, draft);
  return draft.pending;
}

/** Bỏ hẳn một số câu khỏi nháp (câu bị server từ chối vĩnh viễn, hoặc thua xung đột). */
export function dropAnswers(submissionId, questionIds) {
  const key = keyOf(submissionId);
  const draft = read(key);
  if (!draft) return;
  for (const qid of questionIds) {
    delete draft.pending[qid];
  }
  write(key, draft);
}

/** Nộp bài xong / phiên đóng: không còn gì để giữ. */
export function clearDraft(submissionId) {
  remove(keyOf(submissionId));
}

/** Server báo đề này không còn lượt nào đang mở: mọi nháp của đề đều vô dụng. */
export function clearDraftsOfExam(examId) {
  for (const key of allDraftKeys()) {
    if (String(read(key)?.examId) === String(examId)) remove(key);
  }
}

/** Đăng xuất: xoá mọi bản nháp, không để bài của người này cho người sau thấy. */
export function clearAllDrafts() {
  allDraftKeys().forEach(remove);
}

/** Dọn nháp của những phiên chắc chắn đã hết giờ — server không nhận nữa. */
export function purgeExpiredDrafts() {
  const now = Date.now();
  for (const key of allDraftKeys()) {
    const draft = read(key);
    if (!draft || !draft.expiresAtMs || draft.expiresAtMs + EXPIRY_GRACE_MS < now) {
      remove(key);
    }
  }
}

/** Bản nháp còn hạn và còn câu chưa gửi — để trang khác đẩy hộ khi thí sinh không vào lại phòng. */
export function listPendingDrafts() {
  purgeExpiredDrafts();
  return allDraftKeys()
    .map(read)
    .filter((draft) => draft && Object.keys(draft.pending ?? {}).length > 0);
}

/** Đổi pending thành body cho API. */
export function toPayload(pending) {
  return Object.entries(pending).map(([qid, entry]) => ({
    questionId: Number(qid),
    snapshotAnswerId: entry.snapshotAnswerId ?? null,
    essayResponse: entry.essayResponse ? entry.essayResponse : null,
  }));
}

/** Chênh lệch giờ server − giờ máy, từ trường serverTime của một response. */
export function serverOffsetOf(serverTime) {
  const parsed = Date.parse(serverTime);
  return Number.isNaN(parsed) ? null : parsed - Date.now();
}

/** Vào lại phòng: câu này có bị sửa trên server SAU lần thí sinh sửa trên máy này không? */
export function serverChangedSince(entry, serverAnsweredAt) {
  if (!serverAnsweredAt || entry.stagedAt == null) return false;
  const server = Date.parse(serverAnsweredAt);
  if (Number.isNaN(server)) return false;
  return server - entry.stagedAt > 2000;
}
