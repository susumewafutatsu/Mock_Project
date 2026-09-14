// src/hooks/useAnswerSync.js
// Hàng đợi đáp án của phòng thi: ghi localStorage trước, gửi server theo lô.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isSessionClosedError,
  saveAnswers,
  saveAnswersKeepalive,
} from '../services/examService';
import {
  ackAnswers,
  clearDraft,
  dropAnswers,
  readPending,
  stageAnswer,
  toPayload,
} from '../utils/examDraft';

const FLUSH_DELAY_MS = 10000;
const URGENT_FLUSH_DELAY_MS = 1000;
const FLUSH_BATCH_SIZE = 10;
const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 30000;

const revsOf = (pending) =>
  Object.fromEntries(Object.entries(pending).map(([qid, entry]) => [qid, entry.rev]));

const idSetOf = (pending) => new Set(Object.keys(pending).map(Number));

/** 4xx không phải lỗi tạm thời: gửi lại y nguyên cũng bị từ chối y nguyên. */
const isPermanentRejection = (err) =>
  err?.status >= 400 && err.status < 500 && ![401, 408, 429].includes(err.status);

/**
 * @param examId
 * @param submissionId lượt làm đang mở; null = chưa vào phòng
 * @param enabled false khi đang nộp / đã đóng phiên — hook thôi gửi và bỏ qua kết quả về muộn
 * @param urgent true ở phút cuối
 * @param serverOffsetRef ref chứa (giờ server − giờ máy), để đóng dấu thời điểm sửa
 * @param onSaved(res) server xác nhận một lô — dùng để chỉnh đồng hồ
 * @param onClosed(message) server báo phiên đã đóng (409)
 * @param onRejected(questionIds, message) server từ chối vĩnh viễn vài câu
 */
export function useAnswerSync({
  examId,
  submissionId,
  enabled,
  urgent = false,
  serverOffsetRef,
  onSaved,
  onClosed,
  onRejected,
}) {
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const [failing, setFailing] = useState(false);

  const timerRef = useRef(null);
  const inFlightRef = useRef(false);
  const retryCountRef = useRef(0);
  const lastExitKeyRef = useRef(null);

  // Mọi thứ đổi theo render đi qua ref, để các listener gắn một lần vẫn đọc
  // được giá trị mới nhất.
  const live = useRef({});
  live.current = { examId, submissionId, enabled, urgent, onSaved, onClosed, onRejected };

  const cancelTimer = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const flushRef = useRef(null);

  /** Hẹn một lần gửi. Đã có hẹn sớm hơn thì giữ hẹn cũ. */
  const schedule = useCallback((delay) => {
    if (timerRef.current) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      flushRef.current?.();
    }, delay);
  }, []);

  const scheduleRetry = useCallback(() => {
    retryCountRef.current += 1;
    setFailing(true);
    schedule(Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (retryCountRef.current - 1)));
  }, [schedule]);

  const handleSaved = useCallback(
    (res, sentRevs) => {
      const { submissionId: sid, enabled: on, urgent: hurry } = live.current;
      const remaining = ackAnswers(sid, sentRevs);
      setPendingIds(idSetOf(remaining));
      retryCountRef.current = 0;
      setFailing(false);
      if (!on) return;
      live.current.onSaved?.(res);
      // Câu bị sửa tiếp trong lúc lô đang bay: hẹn lô sau cho chúng.
      if (Object.keys(remaining).length) {
        schedule(hurry ? URGENT_FLUSH_DELAY_MS : FLUSH_DELAY_MS);
      }
    },
    [schedule]
  );

  /** Lô bị từ chối vĩnh viễn (4xx): không biết câu nào hỏng, nên gửi lẻ từng câu để tách ra. */
  const isolateRejected = useCallback(
    async (pending) => {
      const { examId: eid, submissionId: sid } = live.current;
      const rejected = [];
      let lastMessage = '';
      for (const [qid, entry] of Object.entries(pending)) {
        const single = { [qid]: entry };
        try {
          const res = await saveAnswers(eid, sid, toPayload(single));
          handleSaved(res, revsOf(single));
        } catch (err) {
          if (isSessionClosedError(err)) {
            live.current.onClosed?.(err.message);
            return;
          }
          if (!isPermanentRejection(err)) {
            scheduleRetry();
            break;
          }
          rejected.push(Number(qid));
          lastMessage = err.message;
        }
      }
      if (rejected.length) {
        dropAnswers(sid, rejected);
        setPendingIds(idSetOf(readPending(sid)));
        live.current.onRejected?.(rejected, lastMessage);
      }
    },
    [handleSaved, scheduleRetry]
  );

  /** Gửi mọi câu đang chờ bằng request thường. */
  const flush = useCallback(async () => {
    const { examId: eid, submissionId: sid, enabled: on } = live.current;
    if (!on || sid == null || inFlightRef.current) return;
    cancelTimer();

    const pending = readPending(sid);
    if (!Object.keys(pending).length) return;
    // Mất mạng thì khỏi thử — sự kiện 'online' sẽ gọi lại.
    if (!navigator.onLine) return;

    inFlightRef.current = true;
    setSaving(true);
    try {
      const res = await saveAnswers(eid, sid, toPayload(pending));
      handleSaved(res, revsOf(pending));
    } catch (err) {
      if (!live.current.enabled) return;
      if (isSessionClosedError(err)) {
        live.current.onClosed?.(err.message);
      } else if (isPermanentRejection(err)) {
        await isolateRejected(pending);
      } else {
        scheduleRetry();
      }
    } finally {
      inFlightRef.current = false;
      setSaving(false);
    }
  }, [cancelTimer, handleSaved, isolateRejected, scheduleRetry]);
  flushRef.current = flush;

  /** Gửi lúc tab bị ẩn / trang sắp đóng. */
  const flushOnExit = useCallback(() => {
    const { examId: eid, submissionId: sid, enabled: on } = live.current;
    if (!on || sid == null) return;
    const pending = readPending(sid);
    if (!Object.keys(pending).length) return;

    // Đóng tab bắn cả visibilitychange lẫn pagehide liền nhau: đúng lô đó
    // đang bay rồi thì khỏi gửi lần hai.
    const sentRevs = revsOf(pending);
    const exitKey = JSON.stringify(sentRevs);
    if (lastExitKeyRef.current === exitKey) return;

    const request = saveAnswersKeepalive(eid, sid, toPayload(pending));
    if (!request) return; // lô quá 64KB: để nguyên trong nháp, lần sau gửi thường
    cancelTimer();
    lastExitKeyRef.current = exitKey;
    request
      .then((res) => handleSaved(res, sentRevs))
      .catch((err) => {
        if (!live.current.enabled) return;
        if (isSessionClosedError(err)) {
          live.current.onClosed?.(err.message);
        } else {
          scheduleRetry();
        }
      })
      .finally(() => {
        if (lastExitKeyRef.current === exitKey) lastExitKeyRef.current = null;
      });
  }, [cancelTimer, handleSaved, scheduleRetry]);

  /** Thí sinh vừa sửa một câu: ghi nháp ngay, hẹn gửi theo quy tắc. */
  const stage = useCallback(
    (questionId, answer) => {
      const { submissionId: sid, enabled: on, urgent: hurry } = live.current;
      if (!on || sid == null) return;
      stageAnswer(sid, questionId, answer, serverOffsetRef?.current ?? 0);
      const pending = readPending(sid);
      setPendingIds(idSetOf(pending));
      if (Object.keys(pending).length >= FLUSH_BATCH_SIZE) {
        flush();
      } else {
        schedule(hurry ? URGENT_FLUSH_DELAY_MS : FLUSH_DELAY_MS);
      }
    },
    [flush, schedule, serverOffsetRef]
  );

  /** Các câu chưa gửi, để nộp kèm trong request nộp bài. */
  const takePayload = useCallback(() => {
    const { submissionId: sid } = live.current;
    return sid == null ? [] : toPayload(readPending(sid));
  }, []);

  /** Nộp xong / phiên đóng: dừng hẹn giờ và xoá nháp. */
  const clear = useCallback(() => {
    cancelTimer();
    const { submissionId: sid } = live.current;
    if (sid != null) clearDraft(sid);
    setPendingIds(new Set());
    setFailing(false);
  }, [cancelTimer]);

  /** Đọc lại nháp (sau khi phía gọi vừa gộp nháp với dữ liệu server). */
  const reload = useCallback(() => {
    const { submissionId: sid } = live.current;
    setPendingIds(sid == null ? new Set() : idSetOf(readPending(sid)));
  }, []);

  // Vào phút cuối thì kéo hẹn gửi đang có về sớm.
  useEffect(() => {
    if (urgent && timerRef.current) {
      cancelTimer();
      schedule(URGENT_FLUSH_DELAY_MS);
    }
  }, [urgent, cancelTimer, schedule]);

  // Ẩn tab / đóng trang / có mạng lại.
  useEffect(() => {
    if (!enabled) return undefined;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // Gửi NGAY lúc bị ẩn chứ không đợi hẹn.
        flushOnExit();
      } else {
        flushRef.current?.();
      }
    };
    const onPageHide = () => flushOnExit();
    const onOnline = () => flushRef.current?.();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('online', onOnline);
    };
  }, [enabled, flushOnExit]);

  // Rời phòng thi trong SPA (nút Back): đẩy nốt, rồi dọn hẹn giờ.
  useEffect(
    () => () => {
      flushOnExit();
      cancelTimer();
    },
    [flushOnExit, cancelTimer]
  );

  return {
    stage,
    flush,
    takePayload,
    clear,
    reload,
    pendingIds,
    pendingCount: pendingIds.size,
    saving,
    failing,
  };
}
