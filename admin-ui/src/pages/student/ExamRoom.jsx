// src/pages/student/ExamRoom.jsx
// Phòng thi của thí sinh.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cloud,
  CloudOff,
  HardDrive,
  Info,
  Loader2,
  Send,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { useExamTimer, formatRemaining } from '../../hooks/useExamTimer';
import { useAnswerSync } from '../../hooks/useAnswerSync';
import {
  getExamLeaderboard,
  getSession,
  heartbeat,
  isAttemptsExhaustedError,
  isSessionClosedError,
  startExam,
  submitExam,
} from '../../services/examService';
import { mediaUrl, requestAudioPlay } from '../../services/engagementService';
import {
  clearDraftsOfExam,
  dropAnswers,
  openDraft,
  readPending,
  serverChangedSince,
  serverOffsetOf,
} from '../../utils/examDraft';
import Leaderboard from '../../components/leaderboard/Leaderboard';
import JlptScoreCard from '../../components/exam/JlptScoreCard';
import './ExamRoom.css';

const HEARTBEAT_MS = 20000;
/** Còn chừng này giây thì gửi đáp án gần như ngay — tới server sau deadline là không tính. */
const URGENT_SECONDS = 60;
const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/** Đổi questions[] của server thành map questionId -> đáp án đang có. */
function buildAnswerMap(questions = []) {
  const map = {};
  for (const q of questions) {
    map[q.questionId] = {
      snapshotAnswerId: q.selectedSnapshotAnswerId ?? null,
      essayResponse: q.essayResponse ?? '',
    };
  }
  return map;
}

/** Gộp đáp án server với nháp chưa gửi trên máy này. */
function mergeWithDraft(questions, submissionId, resolveConflicts) {
  const map = buildAnswerMap(questions);
  const byId = new Map(questions.map((q) => [String(q.questionId), q]));
  const stale = [];
  let restored = 0;
  for (const [qid, entry] of Object.entries(readPending(submissionId))) {
    const q = byId.get(qid);
    if (!q || (resolveConflicts && serverChangedSince(entry, q.answeredAt))) {
      stale.push(Number(qid));
      continue;
    }
    map[qid] = {
      snapshotAnswerId: entry.snapshotAnswerId ?? null,
      essayResponse: entry.essayResponse ?? '',
    };
    restored += 1;
  }
  if (stale.length) dropAnswers(submissionId, stale);
  return { map, restored, dropped: stale.length };
}

/** Câu được coi là đã trả lời khi có lựa chọn hoặc có chữ trong bài tự luận. */
function hasAnswer(entry) {
  if (!entry) return false;
  return entry.snapshotAnswerId != null || Boolean(entry.essayResponse?.trim());
}

/** Trạng thái các phần thi tại một thời điểm. */
function sectionStateAt(sections, nowMs) {
  const list = (sections ?? []).map((sec, index) => {
    const start = new Date(sec.startsAt).getTime();
    const end = new Date(sec.endsAt).getTime();
    return {
      ...sec,
      startMs: start,
      endMs: end,
      // Phần đầu không bao giờ "chưa tới lượt"
      upcoming: index > 0 && nowMs < start,
      locked: nowMs >= end,
      remainingSeconds: Math.max(0, Math.round((end - nowMs) / 1000)),
    };
  });
  const current = list.find((sec) => !sec.upcoming && !sec.locked) ?? null;
  return { list, current };
}

/** Nhãn kỹ năng JLPT. Để nguyên tiếng Nhật vì đó chính là chữ in trên đề thi thật. */
const SKILL_LABELS = {
  VOCABULARY: '文字・語彙',
  GRAMMAR: '文法',
  READING: '読解',
  LISTENING: '聴解',
};

/** Số lượt đã nghe theo câu, giữ suốt lúc trang còn mở. */
const playedCache = new Map();

/** Trình phát file nghe (聴解). */
function AudioPlayer({ examId, question, disabled }) {
  const audioRef = useRef(null);
  const max = question.maxAudioPlays ?? 1;
  const [plays, setPlays] = useState(() =>
    Math.max(question.audioPlays ?? 0, playedCache.get(question.questionId) ?? 0));
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(null);
  const remaining = Math.max(0, max - plays);

  const remember = (n) => {
    playedCache.set(question.questionId, n);
    setPlays(n);
  };

  const play = async () => {
    setError(null);
    try {
      const res = await requestAudioPlay(examId, question.questionId);
      remember(res.plays);
      const el = audioRef.current;
      el.currentTime = 0;
      await el.play();
      setPlaying(true);
    } catch (e) {
      setError(e.message);
      if (e.status === 409) remember(max);
    }
  };

  return (
    <div className="er-audio">
      <audio
        ref={audioRef}
        src={mediaUrl(question.audioUrl)}
        preload="auto"
        onEnded={() => setPlaying(false)}
      />
      <button
        type="button"
        className="er-btn er-btn-primary"
        onClick={play}
        disabled={disabled || playing || remaining === 0}
      >
        {playing ? 'Đang phát…' : remaining === 0 ? 'Đã nghe hết lượt' : '▶ Nghe'}
      </button>
      <span className="er-audio-meta">
        Còn {remaining}/{max} lượt nghe · không tua lại được
      </span>
      {error && <span className="er-audio-error">{error}</span>}
    </div>
  );
}

export default function ExamRoom() {
  const { examId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);

  const [phase, setPhase] = useState('loading'); // loading | active | closed | done | error
  const [notice, setNotice] = useState(null); // { title, message, kind }
  const [info, setInfo] = useState(null); // thông báo nhẹ lúc vào lại phòng
  const [result, setResult] = useState(null);

  const [online, setOnline] = useState(navigator.onLine);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Sau khi nộp: bảng xếp hạng của đề tự do (null khi chưa tải / không có), hoặc cờ "đề trong phòng"
  const [ranking, setRanking] = useState(null);
  const [roomExam, setRoomExam] = useState(false);
  // Nhịp một giây để đồng hồ từng phần chạy.
  const [nowMs, setNowMs] = useState(() => Date.now());
  // Phần thí sinh đang mở. Mặc định bám theo phần hiện hành.
  const [viewSectionId, setViewSectionId] = useState(null);

  const startedRef = useRef(false);
  const heartbeatRef = useRef(null);
  const submittingRef = useRef(false);
  // Giờ server − giờ máy, đo lại ở mỗi response.
  const serverOffsetRef = useRef(0);
  // Nộp bài được gọi từ onExpire của đồng hồ, đóng phiên được gọi từ hook đồng bộ.
  const submitRef = useRef(null);
  const closeRef = useRef(null);

  const timer = useExamTimer(session ? session.remainingSeconds : null, () => {
    // Đồng hồ client về 0: chủ động nộp để chốt sớm.
    submitRef.current?.(true);
  });
  const { sync: syncTimer, pause: pauseTimer } = timer;

  const noteServerTime = useCallback((serverTime) => {
    const offset = serverOffsetOf(serverTime);
    if (offset != null) serverOffsetRef.current = offset;
  }, []);

  // ── Đồng bộ đáp án: localStorage → server theo lô ─────────────────
  const {
    stage,
    flush,
    takePayload,
    clear: clearQueue,
    reload: reloadQueue,
    pendingIds,
    pendingCount,
    saving,
    failing,
  } = useAnswerSync({
    examId,
    submissionId: session?.submissionId ?? null,
    enabled: phase === 'active' && !submitting,
    urgent: timer.timeLeft != null && timer.timeLeft <= URGENT_SECONDS,
    serverOffsetRef,
    onSaved: (res) => {
      syncTimer(res.remainingSeconds);
      noteServerTime(res.serverTime);
      setSession((prev) =>
        prev ? { ...prev, answeredQuestions: res.answeredQuestions } : prev
      );
    },
    onClosed: (message) => closeRef.current?.(message),
    onRejected: (questionIds, message) =>
      setNotice({
        title: `${questionIds.length} câu không lưu được`,
        message: message || 'Server từ chối đáp án của câu này.',
      }),
  });

  /** Dừng heartbeat. Hàng đợi đáp án tự dừng khi phase rời 'active'. */
  const stopBackgroundWork = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  /** Phiên không còn mở: hết giờ đã nộp tự động, hoặc đã nộp từ trước. */
  const closeSession = useCallback(
    (message, title) => {
      stopBackgroundWork();
      pauseTimer();
      clearQueue();
      setNotice({
        title: title || 'Phiên thi đã kết thúc',
        message: message || 'Bài của bạn đã được nộp. Xem điểm ở trang kết quả.',
      });
      setPhase('closed');
    },
    [clearQueue, pauseTimer, stopBackgroundWork]
  );
  closeRef.current = closeSession;

  // ── Vào phòng thi ─────────────────────────────────────────────────
  useEffect(() => {
    // StrictMode gọi effect hai lần ở dev.
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;

    // Tab này vừa bị trình duyệt gỡ khỏi bộ nhớ lúc nằm nền (Memory Saver, máy thiếu RAM) rồi tải lại khi thí sinh quay về.
    const wasDiscarded = Boolean(document.wasDiscarded);

    startExam(examId)
      .then((data) => {
        noteServerTime(data.serverTime);
        openDraft({
          examId,
          submissionId: data.submissionId,
          remainingSeconds: data.remainingSeconds,
        });
        const { map, restored, dropped } = mergeWithDraft(
          data.questions,
          data.submissionId,
          true
        );
        setSession(data);
        setAnswers(map);
        setPhase('active');

        const parts = [];
        if (wasDiscarded) {
          parts.push('Trình duyệt đã tải lại trang này để tiết kiệm bộ nhớ khi bạn chuyển tab.');
        }
        if (restored > 0) {
          parts.push(`Đã khôi phục ${restored} câu lần trước chưa kịp gửi lên server.`);
        }
        if (dropped > 0) {
          parts.push(
            `${dropped} câu đã được sửa ở nơi khác sau đó nên giữ theo bản trên server.`
          );
        }
        if (parts.length) {
          setInfo(`${parts.join(' ')} Đồng hồ vẫn tính theo server.`);
        }
      })
      .catch((err) => {
        if (isSessionClosedError(err)) {
          // Không còn lượt nào đang mở của đề này: nháp cũ trên máy vô dụng.
          clearDraftsOfExam(examId);
          // 409 lúc VÀO phòng có hai nghĩa rất khác nhau.
          closeSession(
            err.message,
            isAttemptsExhaustedError(err) ? 'Đã hết lượt làm bài' : undefined
          );
          return;
        }
        setNotice({ title: 'Không vào được phòng thi', message: err.message });
        setPhase('error');
      });
  }, [examId, closeSession, noteServerTime]);

  // Vừa vào phòng: hàng đợi đọc lại nháp đã gộp và đẩy ngay phần còn sót.
  const submissionId = session?.submissionId ?? null;
  useEffect(() => {
    if (phase !== 'active' || submissionId == null) return;
    reloadQueue();
    flush();
  }, [phase, submissionId, reloadQueue, flush]);

  // Nhập đáp án
  const allQuestions = useMemo(() => session?.questions ?? [], [session]);
  const rawSections = useMemo(() => session?.sections ?? [], [session]);
  const sectioned = rawSections.length > 0;

  // Nhịp giây cho đồng hồ phần thi. Chỉ chạy khi đề có chia phần.
  useEffect(() => {
    if (!sectioned || phase !== 'active') return undefined;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sectioned, phase]);

  const { list: sections, current: activeSection } = useMemo(
    () => sectionStateAt(rawSections, nowMs + serverOffsetRef.current * 1000),
    [rawSections, nowMs]
  );

  // Bám theo phần hiện hành, trừ khi thí sinh chủ động mở một phần đã khoá.
  useEffect(() => {
    if (!sectioned) return;
    setViewSectionId(activeSection?.sectionId ?? null);
    setIndex(0);
  }, [sectioned, activeSection?.sectionId]);

  const viewedSection = sections.find((sec) => sec.sectionId === viewSectionId) ?? activeSection;

  const questions = useMemo(() => {
    if (!sectioned) return allQuestions;
    // Phần chưa tới lượt thì không cho thấy câu nào.
    if (!viewedSection || viewedSection.upcoming) return [];
    return allQuestions.filter((q) => q.sectionId === viewedSection.sectionId);
  }, [sectioned, allQuestions, viewedSection]);

  const current = questions[index];

  // Đếm trên TOÀN đề, không phải trên phần đang mở: thanh tiến độ và màn xác
  // nhận nộp bài nói về cả bài làm.
  const answeredCount = useMemo(
    () => allQuestions.filter((q) => hasAnswer(answers[q.questionId])).length,
    [answers, allQuestions]
  );

  // Phần đã khoá thì chỉ xem lại được.
  const sectionOpen = !sectioned || (viewedSection != null && !viewedSection.locked && !viewedSection.upcoming);
  const editable = phase === 'active' && !timer.isExpired && !submitting && sectionOpen;

  const handleSelect = useCallback(
    (questionId, snapshotAnswerId) => {
      if (!editable) return;
      // Bấm lại đúng ô đang chọn nghĩa là bỏ chọn.
      const next =
        answers[questionId]?.snapshotAnswerId === snapshotAnswerId ? null : snapshotAnswerId;
      setAnswers((prev) => ({
        ...prev,
        [questionId]: {
          snapshotAnswerId: next,
          essayResponse: prev[questionId]?.essayResponse ?? '',
        },
      }));
      stage(questionId, { snapshotAnswerId: next });
    },
    [answers, editable, stage]
  );

  /** Tự luận: mỗi phím gõ chỉ ghi localStorage (rẻ, đồng bộ). */
  const handleEssayChange = useCallback(
    (questionId, text) => {
      if (!editable) return;
      setAnswers((prev) => ({
        ...prev,
        [questionId]: {
          snapshotAnswerId: prev[questionId]?.snapshotAnswerId ?? null,
          essayResponse: text,
        },
      }));
      stage(questionId, { essayResponse: text });
    },
    [editable, stage]
  );

  // ── Nộp bài ───────────────────────────────────────────────────────
  const doSubmit = useCallback(
    async (auto = false) => {
      if (submittingRef.current || phase !== 'active') return;
      submittingRef.current = true;
      setSubmitting(true);
      setConfirming(false);
      setNotice(null);

      // Những câu còn nằm trong nháp đi kèm luôn request nộp.
      const pending = takePayload();

      try {
        const res = await submitExam(examId, pending);
        stopBackgroundWork();
        pauseTimer();
        clearQueue();
        setResult(res);
        setNotice(
          auto
            ? { title: 'Đã hết giờ làm bài', message: 'Bài của bạn được nộp tự động.' }
            : null
        );
        setPhase('done');
      } catch (err) {
        if (isSessionClosedError(err)) {
          closeSession(err.message);
          return;
        }
        // Lỗi mạng: vẫn ở trong phòng thi để thí sinh bấm nộp lại được. Nháp
        // còn nguyên nên không mất câu nào.
        setNotice({ title: 'Nộp bài không thành công', message: err.message });
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [clearQueue, closeSession, examId, pauseTimer, phase, stopBackgroundWork, takePayload]
  );
  // Đồng hồ hết giờ gọi qua ref nên luôn dùng bản mới nhất của doSubmit.
  submitRef.current = doSubmit;

  // Heartbeat Chỉ để server biết thí sinh còn kết nối; không gia hạn thêm giờ.
  const beatNow = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const res = await heartbeat(examId);
      syncTimer(res.remainingSeconds);
      noteServerTime(res.serverTime);
      if (res.autoSubmitted) {
        closeSession('Đã hết giờ làm bài. Bài của bạn đã được nộp tự động.');
      }
    } catch (err) {
      if (isSessionClosedError(err)) {
        closeSession(err.message);
      }
      // Lỗi mạng thì bỏ qua, nhịp sau gọi lại.
    }
  }, [closeSession, examId, noteServerTime, syncTimer]);

  useEffect(() => {
    if (phase !== 'active') return undefined;
    // Tab nằm nền thì interval này bị trình duyệt tiết chế.
    heartbeatRef.current = setInterval(beatNow, HEARTBEAT_MS);
    return () => {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    };
  }, [beatNow, phase]);

  // Chuyển tab / gập máy rồi quay lại Đồng hồ trong tab đếm theo mốc neo nên tự tính lại đúng khi tab hiện lại (useExamTimer).
  useEffect(() => {
    if (phase !== 'active') return undefined;
    const onVisible = () => {
      if (document.visibilityState === 'visible') beatNow();
    };
    // Trang được khôi phục từ back/forward cache: JS đứng yên suốt thời gian đó.
    const onPageShow = (e) => {
      if (e.persisted) beatNow();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [beatNow, phase]);

  // Mất mạng / có mạng lại Khi mạng trở lại.
  const restoreFromServer = useCallback(async () => {
    try {
      const data = await getSession(examId);
      syncTimer(data.remainingSeconds);
      noteServerTime(data.serverTime);
      const { map } = mergeWithDraft(data.questions, data.submissionId, false);
      setSession((prev) => ({ ...(prev || {}), ...data }));
      setAnswers(map);
      reloadQueue();
    } catch (err) {
      if (isSessionClosedError(err)) {
        closeSession(err.message);
      }
    }
  }, [closeSession, examId, noteServerTime, reloadQueue, syncTimer]);

  const restoreRef = useRef(restoreFromServer);
  restoreRef.current = restoreFromServer;

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      restoreRef.current?.();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Đóng tab giữa lúc thi thì hỏi lại.
  useEffect(() => {
    if (phase !== 'active') return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [phase]);

  // Dọn khi rời trang.
  useEffect(() => stopBackgroundWork, [stopBackgroundWork]);

  // Vừa nộp xong: đề tự do thì hỏi ngay mình đứng thứ mấy.
  useEffect(() => {
    if (phase !== 'done') return;
    getExamLeaderboard(examId)
      .then(setRanking)
      .catch((err) => { if (err.status === 404) setRoomExam(true); });
  }, [phase, examId]);

  // Bốn trạng thái lưu. "Trên máy" là bình thường — đáp án an toàn, chỉ chưa tới lượt gửi.
  const saveTone = saving ? 'saving' : failing ? 'failed' : pendingCount > 0 ? 'local' : 'saved';
  const saveLabel = {
    saving: 'Đang gửi…',
    failed: `${pendingCount} câu chưa gửi được`,
    local: `Đã lưu trên máy · chờ gửi ${pendingCount} câu`,
    saved: 'Đã lưu',
  }[saveTone];

  const goBackToList = () => navigate('/student/exams');

  // ── Các trạng thái toàn trang ─────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="er-root">
        <div className="er-center">
          <div className="er-center-box">
            <div className="er-center-icon">
              <Loader2 size={26} className="er-spin" />
            </div>
            <h2>Đang vào phòng thi…</h2>
            <p>Đang lấy đề và thời gian còn lại từ server.</p>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'error' && !session) {
    return (
      <div className="er-root">
        <div className="er-center">
          <div className="er-center-box bad">
            <div className="er-center-icon">
              <XCircle size={26} />
            </div>
            <h2>{notice?.title || 'Có lỗi xảy ra'}</h2>
            <p>{notice?.message}</p>
            <div className="er-center-actions">
              <button type="button" className="er-btn er-btn-ghost" onClick={goBackToList}>
                Về danh sách đề
              </button>
              <button
                type="button"
                className="er-btn er-btn-primary"
                onClick={() => window.location.reload()}
              >
                Thử lại
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'closed') {
    return (
      <div className="er-root">
        <div className="er-center">
          <div className="er-center-box bad">
            <div className="er-center-icon">
              <Clock size={26} />
            </div>
            <h2>{notice?.title || 'Phiên thi đã kết thúc'}</h2>
            <p>{notice?.message}</p>
            <div className="er-center-actions">
              <button type="button" className="er-btn er-btn-primary" onClick={goBackToList}>
                Về danh sách đề
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    const awaiting = result?.awaitingManualGrading;
    const myRank = ranking?.boards?.[0]?.myRow;
    const board = ranking?.boards?.[0];
    return (
      <div className="er-root">
        <div className="er-center">
          <div className="er-center-box done" style={ranking ? { maxWidth: 760 } : undefined}>
            <div className="er-center-icon">
              <CheckCircle2 size={26} />
            </div>
            <h2>{notice?.title || 'Đã nộp bài'}</h2>
            <p>
              {notice?.message ? `${notice.message} ` : ''}
              Đã trả lời {result?.answeredQuestions ?? answeredCount}/
              {result?.totalQuestions ?? questions.length} câu
              {result?.totalScore != null && !awaiting
                ? ` — điểm: ${result.totalScore}/${result.maxScore}`
                : ''}
              .
              {awaiting ? ' Còn câu tự luận chờ người ra đề chấm nên điểm chưa phải điểm cuối.' : ''}
            </p>
            {/* Bảng điểm JLPT nếu đề chấm theo thang quy đổi. */}
            {result?.jlpt && (
              <div style={{ margin: "16px 0", textAlign: "left" }}>
                <JlptScoreCard jlpt={result.jlpt} />
              </div>
            )}

            {myRank?.rank != null && board && (
              <p className="er-rank-line">
                🏆 Bạn đứng <strong>hạng {myRank.rank}/{board.submittedCount}</strong> trong số những
                người đã làm đề này (tính lượt tốt nhất của mỗi người).
              </p>
            )}
            {roomExam && (
              <p className="er-rank-line">
                🏆 Bảng xếp hạng của phòng mở khi cả phòng hết giờ — xem ở mục
                <strong> Phòng thi của tôi</strong>.
              </p>
            )}
            {ranking && (
              <div className="er-rank-board">
                <Leaderboard data={ranking} />
              </div>
            )}
            <div className="er-center-actions">
              {/* Xem lại bài ngay là hành động đúng nhất ở màn hình này với một nền tảng ôn thi. */}
              {result?.submissionId != null && (
                <button
                  type="button"
                  className="er-btn er-btn-primary"
                  onClick={() => navigate(`/student/submissions/${result.submissionId}/review`)}
                >
                  Xem lại bài làm
                </button>
              )}
              <button type="button" className="er-btn" onClick={goBackToList}>
                Về danh sách đề
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Phòng thi ─────────────────────────────────────────────────────
  return (
    <div className="er-root">
      <div className="er-topbar">
        <div className="er-topbar-title">
          <h1>{session?.examTitle || 'Phòng thi'}</h1>
          <p>
            Câu {index + 1}/{questions.length} · đã làm {answeredCount}/{questions.length}
            {/* Đề nhiều lượt: nói rõ đang ở lượt nào, để thí sinh biết đây là lần cuối hay còn cơ hội làm lại. */}
            {session?.maxAttempts != null && (
              <> · lượt {session.attemptNumber}/{session.maxAttempts}</>
            )}
          </p>
        </div>

        <span className={`er-status ${saveTone === 'local' ? 'saving' : saveTone}`}>
          {saveTone === 'saving' ? (
            <Loader2 size={14} className="er-spin" />
          ) : saveTone === 'failed' ? (
            <CloudOff size={14} />
          ) : saveTone === 'local' ? (
            <HardDrive size={14} />
          ) : (
            <Cloud size={14} />
          )}
          {saveLabel}
        </span>

        <span
          className={`er-clock ${timer.isExpired ? 'expired' : timer.isCritical ? 'critical' : ''
            }`}
        >
          <Clock size={17} />
          {timer.formattedTime}
        </span>

        <button
          type="button"
          className="er-btn er-btn-primary"
          onClick={() => setConfirming(true)}
          disabled={submitting || timer.isExpired}
        >
          {submitting ? <Loader2 size={15} className="er-spin" /> : <Send size={15} />}
          Nộp bài
        </button>
      </div>

      {!online && (
        <div className="er-banner error">
          <WifiOff size={15} />
          Mất kết nối. Đáp án đang được giữ trên máy và sẽ tự gửi lại khi có mạng — đồng hồ ở
          server vẫn chạy.
        </div>
      )}

      {online && failing && pendingCount > 0 && (
        <div className="er-banner warn">
          <AlertTriangle size={15} />
          {pendingCount} câu chưa gửi được lên server, đang thử lại. Đáp án vẫn nằm an toàn trên
          máy này và sẽ được gửi kèm khi bạn nộp bài.
        </div>
      )}

      {info && (
        <div className="er-banner info">
          <Info size={15} />
          {info}
        </div>
      )}

      {notice?.title && (
        <div className="er-banner error">
          <XCircle size={15} />
          {notice.title}: {notice.message}
        </div>
      )}

      {timer.isExpired && (
        <div className="er-banner error">
          <Clock size={15} />
          Đã hết giờ. Đang chốt bài với server…
        </div>
      )}

      {/* Thanh phần thi. Chỉ hiện với đề chia phần — đề phẳng giữ nguyên giao
          diện cũ, không thêm một dải trống chẳng nói gì. */}
      {sectioned && (
        <div className="er-sections">
          {sections.map((sec) => {
            const isView = sec.sectionId === viewedSection?.sectionId;
            const state = sec.locked ? 'locked' : sec.upcoming ? 'upcoming' : 'live';
            return (
              <button
                key={sec.sectionId}
                type="button"
                className={`er-section ${state} ${isView ? 'viewing' : ''}`}
                // Phần chưa tới lượt thì không mở được: xem trước đề của phần
                // sau là đúng thứ mà kỳ thi thật ngăn bằng cách thu đề.
                disabled={sec.upcoming}
                onClick={() => { setViewSectionId(sec.sectionId); setIndex(0); }}
                title={sec.upcoming ? 'Chưa tới lượt phần này'
                  : sec.locked ? 'Phần này đã hết giờ — chỉ xem lại được' : undefined}
              >
                <span className="er-section-name">{sec.name}</span>
                <span className="er-section-meta">
                  {sec.locked ? 'đã khoá'
                    : sec.upcoming ? `${sec.durationMinutes} phút`
                    : formatRemaining(sec.remainingSeconds)}
                  {' · '}{sec.answeredQuestions ?? 0}/{sec.totalQuestions ?? 0} câu
                </span>
              </button>
            );
          })}
        </div>
      )}

      {sectioned && viewedSection?.locked && (
        <div className="er-banner warn">
          <Clock size={15} />
          Phần "{viewedSection.name}" đã hết giờ. Bạn xem lại được nhưng không sửa đáp án nữa —
          giống như khi giám thị đã thu đề phần đó.
        </div>
      )}

      <div className="er-body">
        <div className="er-card">
          {/* Bài đọc hiện MỘT LẦN phía trên câu hỏi. */}
          {current?.passageContent && (
            <div className="er-passage">
              {current.passageTitle && <h4>{current.passageTitle}</h4>}
              <div className="er-passage-body">{current.passageContent}</div>
            </div>
          )}

          <div className="er-question-head">
            <span className="er-chip">Câu {index + 1}</span>
            <span className="er-chip">
              {current?.questionType === 'ESSAY' ? 'Tự luận'
                : current?.questionType === 'SENTENCE_ORDERING' ? 'Sắp xếp câu'
                : 'Trắc nghiệm'}
            </span>
            {current?.skill && <span className="er-chip">{SKILL_LABELS[current.skill]}</span>}
            {current?.points != null && <span>{current.points} điểm</span>}
          </div>

          <div className="er-question-content">{current?.content}</div>

          {current?.audioUrl && (
            <AudioPlayer key={current.questionId} examId={examId} question={current} disabled={!editable} />
          )}

          {current?.questionType === 'ESSAY' ? (
            <textarea
              className="er-essay"
              placeholder="Nhập câu trả lời của bạn…"
              value={answers[current.questionId]?.essayResponse ?? ''}
              onChange={(e) => handleEssayChange(current.questionId, e.target.value)}
              disabled={!editable}
            />
          ) : (
            <div className="er-options">
              {(current?.options ?? []).map((opt, i) => {
                const selected =
                  answers[current.questionId]?.snapshotAnswerId === opt.snapshotAnswerId;
                return (
                  <button
                    key={opt.snapshotAnswerId}
                    type="button"
                    className={`er-option ${selected ? 'selected' : ''}`}
                    onClick={() => handleSelect(current.questionId, opt.snapshotAnswerId)}
                    disabled={!editable}
                  >
                    <span className="er-option-key">
                      {selected ? <Check size={14} /> : OPTION_KEYS[i] || i + 1}
                    </span>
                    <span>{opt.answerContent}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="er-pager">
            <button
              type="button"
              className="er-btn er-btn-ghost"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
            >
              <ChevronLeft size={15} />
              Câu trước
            </button>
            <button
              type="button"
              className="er-btn er-btn-ghost"
              onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
              disabled={index >= questions.length - 1}
            >
              Câu sau
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        <div className="er-card er-nav-panel">
          <h3>Danh sách câu</h3>
          <p className="er-nav-sub">Bấm số để nhảy tới câu đó.</p>

          <div className="er-nav-grid">
            {questions.map((q, i) => {
              const answered = hasAnswer(answers[q.questionId]);
              // Chỉ tô vàng khi gửi thất bại; chờ tới lượt gửi là bình thường.
              const pending = failing && pendingIds.has(q.questionId);
              return (
                <button
                  key={q.questionId}
                  type="button"
                  className={`er-nav-cell ${pending ? 'pending' : answered ? 'answered' : ''
                    } ${i === index ? 'current' : ''}`}
                  onClick={() => setIndex(i)}
                  title={`Câu ${i + 1}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <div className="er-legend">
            <span>
              <i style={{ background: 'rgba(47, 143, 111, 0.5)' }} />
              Đã trả lời
            </span>
            <span>
              <i style={{ background: 'rgba(201, 146, 46, 0.55)' }} />
              Đã chọn, chưa gửi được lên server
            </span>
            <span>
              <i style={{ background: 'rgba(43, 38, 32, 0.09)' }} />
              Chưa trả lời
            </span>
          </div>

          <div className="er-progress">
            <div className="er-progress-text">
              <span>Tiến độ</span>
              <span>
                {answeredCount}/{questions.length}
              </span>
            </div>
            <div className="er-progress-bar">
              <i
                style={{
                  width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {confirming && (
        <div className="er-modal-backdrop">
          <div className="er-modal">
            <h3>Nộp bài?</h3>
            <p>
              Bạn đã trả lời {answeredCount}/{questions.length} câu. Nộp rồi không vào lại được
              nữa.
            </p>
            {answeredCount < questions.length && (
              <p className="er-modal-warn">
                Còn {questions.length - answeredCount} câu chưa trả lời.
              </p>
            )}
            {pendingCount > 0 && (
              <p className="er-modal-warn">
                {pendingCount} câu chưa gửi lên server sẽ được gửi kèm lần này.
              </p>
            )}
            <div className="er-modal-actions">
              <button
                type="button"
                className="er-btn er-btn-ghost"
                onClick={() => setConfirming(false)}
              >
                Làm tiếp
              </button>
              <button
                type="button"
                className="er-btn er-btn-primary"
                onClick={() => doSubmit(false)}
                disabled={submitting}
              >
                {submitting ? <Loader2 size={15} className="er-spin" /> : <Send size={15} />}
                Nộp bài
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
