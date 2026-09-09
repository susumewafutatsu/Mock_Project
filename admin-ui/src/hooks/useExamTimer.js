// src/hooks/useExamTimer.js
// Đồng hồ đếm ngược của phòng thi.
//
// Ba điều khiến hook này không chỉ là một setInterval trừ dần:
//
// 1. Nguồn thời gian là server. Hook nhận `remainingSeconds` lấy từ response
//    (start / session / autosave / heartbeat) và mỗi lần nhận là một lần chỉnh
//    lại đồng hồ bằng `sync()`. Đồng hồ máy thí sinh không tham gia vào việc
//    tính còn bao nhiêu giờ, nên đổi giờ hệ thống cũng không xin thêm được phút.
//
// 2. Đếm bằng mốc neo, không trừ dần. Mỗi tick tính lại
//    remaining = neo - (thời gian đã trôi kể từ lúc neo). Tab bị trình duyệt
//    tiết chế (chạy nền) làm interval trượt nhịp cũng không cộng dồn sai số;
//    quay lại tab là số hiện đúng ngay.
//
// 3. Dùng performance.now() chứ không Date.now(): đồng hồ đơn điệu, không nhảy
//    khi hệ thống đổi giờ hay đồng bộ NTP giữa lúc đang thi.
//
// onExpire chỉ được gọi đúng một lần cho mỗi mốc neo, và chỉ là tín hiệu để
// client dừng bài + gọi submit. Quyền quyết định hết giờ vẫn ở server: nó tự
// nộp bài ở request kế tiếp hoặc bởi job quét.

import { useCallback, useEffect, useRef, useState } from 'react';

const now = () =>
  typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();

/** "01:05:09" khi còn trên một giờ, "05:09" khi ít hơn. */
export function formatRemaining(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * @param initialRemainingSeconds số giây còn lại theo server tại lúc gọi.
 *        null/undefined = chưa biết (chưa vào phiên) → đồng hồ chưa chạy.
 * @param onExpire gọi một lần khi đồng hồ về 0.
 * @param options.criticalSeconds ngưỡng đổi màu cảnh báo, mặc định 300 giây.
 * @returns { timeLeft, formattedTime, isExpired, isCritical, isRunning, sync, pause, resume }
 */
export function useExamTimer(initialRemainingSeconds, onExpire, options = {}) {
  const { criticalSeconds = 300 } = options;

  // Mốc neo: còn `seconds` giây vào thời điểm `at` của đồng hồ đơn điệu.
  const anchorRef = useRef(null);
  const pausedRef = useRef(false);
  const expiredFiredRef = useRef(false);
  // Giữ callback trong ref để không phải dựng lại interval mỗi lần re-render.
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const [timeLeft, setTimeLeft] = useState(
    initialRemainingSeconds == null ? null : Math.max(0, Math.floor(initialRemainingSeconds))
  );

  /**
   * Chỉnh lại đồng hồ theo số giây server vừa báo. Gọi sau mỗi autosave /
   * heartbeat / khôi phục phiên.
   */
  const sync = useCallback((remainingSeconds) => {
    if (remainingSeconds == null || Number.isNaN(Number(remainingSeconds))) {
      return;
    }
    const seconds = Math.max(0, Math.floor(Number(remainingSeconds)));
    anchorRef.current = { seconds, at: now() };
    // Server nói còn giờ thì cho phép báo hết giờ lần nữa về sau. Không reset
    // cờ này thì một lần sync sau khi vừa hết giờ sẽ không bao giờ gọi lại
    // onExpire được.
    if (seconds > 0) {
      expiredFiredRef.current = false;
    }
    setTimeLeft(seconds);
  }, []);

  const pause = useCallback(() => {
    pausedRef.current = true;
  }, []);

  /** Chạy tiếp từ số giây đang hiện, neo lại vào thời điểm hiện tại. */
  const resume = useCallback(() => {
    if (anchorRef.current) {
      anchorRef.current = { seconds: anchorRef.current.seconds, at: now() };
    }
    pausedRef.current = false;
  }, []);

  // Neo lần đầu khi biết được số giây còn lại (thường là sau khi start xong).
  useEffect(() => {
    if (initialRemainingSeconds == null) {
      return;
    }
    sync(initialRemainingSeconds);
    // Chỉ neo theo giá trị khởi tạo; các lần chỉnh sau đi qua sync().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRemainingSeconds]);

  useEffect(() => {
    const tick = () => {
      const anchor = anchorRef.current;
      if (!anchor || pausedRef.current) {
        return;
      }
      const elapsed = Math.floor((now() - anchor.at) / 1000);
      const remaining = Math.max(0, anchor.seconds - elapsed);
      setTimeLeft(remaining);

      if (remaining === 0 && !expiredFiredRef.current) {
        expiredFiredRef.current = true;
        onExpireRef.current?.();
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Tab quay lại từ chế độ nền: tính lại ngay, không đợi tick kế tiếp.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || pausedRef.current) {
        return;
      }
      const anchor = anchorRef.current;
      if (!anchor) {
        return;
      }
      const elapsed = Math.floor((now() - anchor.at) / 1000);
      const remaining = Math.max(0, anchor.seconds - elapsed);
      setTimeLeft(remaining);
      if (remaining === 0 && !expiredFiredRef.current) {
        expiredFiredRef.current = true;
        onExpireRef.current?.();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  return {
    timeLeft,
    formattedTime: timeLeft == null ? '--:--' : formatRemaining(timeLeft),
    isExpired: timeLeft === 0,
    isCritical: timeLeft != null && timeLeft > 0 && timeLeft <= criticalSeconds,
    isRunning: timeLeft != null && timeLeft > 0 && !pausedRef.current,
    sync,
    pause,
    resume,
  };
}
