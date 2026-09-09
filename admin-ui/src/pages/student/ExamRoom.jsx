// src/pages/student/ExamRoom.jsx
// Phòng thi của thí sinh.
//
// Bốn quy ước quan trọng của trang này:
//
// 1. Server là nguồn sự thật duy nhất. Vào phòng bằng POST /start (idempotent —
//    gọi lại là "vào lại phòng", không phải "thi lại"), và mọi response mang
//    remainingSeconds đều được dùng để chỉnh lại đồng hồ (useExamTimer.sync).
//
// 4. 409 nghĩa là phiên không còn mở nữa (hết giờ đã nộp tự động, hoặc đã nộp
//    trước đó). Gặp 409 ở bất kỳ request nào thì dừng đồng hồ, dừng heartbeat,
//    và hiện đúng câu thông báo của server chứ không tự bịa lý do.

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
  Loader2,
  Send,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { useExamTimer } from '../../hooks/useExamTimer';
import {
  getSession,
  heartbeat,
  isAttemptsExhaustedError,
  isSessionClosedError,
  saveAnswer,
  startExam,
  submitExam,
} from '../../services/examService';
import './ExamRoom.css';

const HEARTBEAT_MS = 20000;
const ESSAY_DEBOUNCE_MS = 800;
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

/** Câu được coi là đã trả lời khi có lựa chọn hoặc có chữ trong bài tự luận. */
function hasAnswer(entry) {
  if (!entry) return false;
  return entry.snapshotAnswerId != null || Boolean(entry.essayResponse?.trim());
}

export default function ExamRoom() {
  const { examId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [answers, setAnswers] = useState({});
  // questionId -> 'saving' | 'saved' | 'failed'. 'failed' là câu cần gửi kèm lúc nộp.
  const [saveState, setSaveState] = useState({});
  const [index, setIndex] = useState(0);

  const [phase, setPhase] = useState('loading'); // loading | active | closed | done | error
  const [notice, setNotice] = useState(null); // { title, message, kind }
  const [result, setResult] = useState(null);

  const [online, setOnline] = useState(navigator.onLine);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const startedRef = useRef(false);
  const heartbeatRef = useRef(null);
  const essayTimersRef = useRef({});
  const submittingRef = useRef(false);
  // Nộp bài được gọi từ onExpire của đồng hồ, khai báo sau — đi qua ref để
  // không phải sắp xếp lại thứ tự khai báo trong component.
  const submitRef = useRef(null);

  const timer = useExamTimer(session ? session.remainingSeconds : null, () => {
    // Đồng hồ client về 0: chủ động nộp để chốt sớm. Server vẫn là bên quyết
    // định — nếu nó đã tự nộp thì request này trả 409 và ta xử như bình thường.
    submitRef.current?.(true);
  });
  const { sync: syncTimer, pause: pauseTimer } = timer;

  /** Dừng mọi thứ đang chạy nền: heartbeat và các timer debounce tự luận. */
  const stopBackgroundWork = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    for (const t of Object.values(essayTimersRef.current)) {
      clearTimeout(t);
    }
    essayTimersRef.current = {};
  }, []);

  /**
   * Phiên không còn mở: hết giờ đã nộp tự động, hoặc đã nộp từ trước. Hiện đúng
   * câu thông báo của server thay vì tự suy diễn lý do.
   */
  const closeSession = useCallback(
    (message, title) => {
      stopBackgroundWork();
      pauseTimer();
      setNotice({
        title: title || 'Phiên thi đã kết thúc',
        message: message || 'Bài của bạn đã được nộp. Xem điểm ở trang kết quả.',
      });
      setPhase('closed');
    },
    [pauseTimer, stopBackgroundWork]
  );

  // ── Vào phòng thi ─────────────────────────────────────────────────
  useEffect(() => {
    // StrictMode gọi effect hai lần ở dev. Endpoint idempotent nên gọi hai lần
    // không sinh phiên thừa, nhưng chặn lại cho khỏi tốn một request.
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;

    startExam(examId)
      .then((data) => {
        const map = buildAnswerMap(data.questions);
        setSession(data);
        setAnswers(map);
        setSaveState(
          Object.fromEntries(
            Object.entries(map)
              .filter(([, entry]) => hasAnswer(entry))
              .map(([qid]) => [qid, 'saved'])
          )
        );
        setPhase('active');
      })
      .catch((err) => {
        if (isSessionClosedError(err)) {
          // 409 lúc VÀO phòng có hai nghĩa rất khác nhau: bài đã nộp / đề đã
          // đóng, hoặc thí sinh đã dùng hết số lượt người ra đề cho. Cả hai đều
          // đóng phòng thi lại, nhưng tiêu đề "Phiên thi đã kết thúc" đặt lên
          // trường hợp thứ hai thì sai — em ấy chưa hề bắt đầu phiên nào.
          closeSession(
            err.message,
            isAttemptsExhaustedError(err) ? 'Đã hết lượt làm bài' : undefined
          );
          return;
        }
        setNotice({ title: 'Không vào được phòng thi', message: err.message });
        setPhase('error');
      });
  }, [examId, closeSession]);

  // ── Autosave ──────────────────────────────────────────────────────
  /**
   * Gửi một câu lên server. Không chặn UI: state cục bộ đã đổi trước khi gọi,
   * hàm này chỉ quyết định ô câu hỏi hiện xanh (đã lên server) hay vàng (chưa).
   */
  const persistAnswer = useCallback(
    async (questionId, payload) => {
      setSaveState((prev) => ({ ...prev, [questionId]: 'saving' }));
      try {
        const res = await saveAnswer(examId, { questionId, ...payload });
        syncTimer(res.remainingSeconds);
        setSession((prev) =>
          prev ? { ...prev, answeredQuestions: res.answeredQuestions } : prev
        );
        setSaveState((prev) => ({ ...prev, [questionId]: 'saved' }));
      } catch (err) {
        if (isSessionClosedError(err)) {
          closeSession(err.message);
          return;
        }
        // Để 'failed': ô chuyển vàng, và câu này được gửi kèm trong lúc nộp bài.
        setSaveState((prev) => ({ ...prev, [questionId]: 'failed' }));
      }
    },
    [closeSession, examId, syncTimer]
  );

  const editable = phase === 'active' && !timer.isExpired && !submitting;

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
      persistAnswer(questionId, { snapshotAnswerId: next });
    },
    [answers, editable, persistAnswer]
  );

  /** Tự luận thì gõ liên tục — chờ ngừng gõ mới gửi, khỏi bắn mỗi ký tự một request. */
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
      setSaveState((prev) => ({ ...prev, [questionId]: 'saving' }));
      clearTimeout(essayTimersRef.current[questionId]);
      essayTimersRef.current[questionId] = setTimeout(() => {
        persistAnswer(questionId, { essayResponse: text });
      }, ESSAY_DEBOUNCE_MS);
    },
    [editable, persistAnswer]
  );

  // ── Nộp bài ───────────────────────────────────────────────────────
  const doSubmit = useCallback(
    async (auto = false) => {
      if (submittingRef.current || phase !== 'active') return;
      submittingRef.current = true;
      setSubmitting(true);
      setConfirming(false);
      setNotice(null);

      // Lưới an toàn: gửi kèm đúng những câu autosave chưa chắc đã lên server.
      const pending = Object.entries(answers)
        .filter(([qid]) => saveState[qid] === 'failed' || saveState[qid] === 'saving')
        .map(([qid, entry]) => ({
          questionId: Number(qid),
          snapshotAnswerId: entry.snapshotAnswerId ?? null,
          essayResponse: entry.essayResponse ? entry.essayResponse : null,
        }));

      try {
        const res = await submitExam(examId, pending);
        stopBackgroundWork();
        pauseTimer();
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
        // Lỗi mạng: vẫn ở trong phòng thi để thí sinh bấm nộp lại được.
        setNotice({ title: 'Nộp bài không thành công', message: err.message });
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [answers, closeSession, examId, pauseTimer, phase, saveState, stopBackgroundWork]
  );
  // Đồng hồ hết giờ gọi qua ref nên luôn dùng bản mới nhất của doSubmit.
  submitRef.current = doSubmit;

  // ── Heartbeat ─────────────────────────────────────────────────────
  // Chỉ để server biết thí sinh còn kết nối; không gia hạn thêm giờ. Đây là
  // đường phát hiện auto-submit sớm nhất vì nó trả 200 kèm cờ, không phải 409.
  useEffect(() => {
    if (phase !== 'active') return undefined;

    const beat = async () => {
      if (!navigator.onLine) return;
      try {
        const res = await heartbeat(examId);
        syncTimer(res.remainingSeconds);
        if (res.autoSubmitted) {
          closeSession('Đã hết giờ làm bài. Bài của bạn đã được nộp tự động.');
        }
      } catch (err) {
        if (isSessionClosedError(err)) {
          closeSession(err.message);
        }
        // Lỗi mạng thì bỏ qua, nhịp sau gọi lại.
      }
    };

    heartbeatRef.current = setInterval(beat, HEARTBEAT_MS);
    return () => {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    };
  }, [closeSession, examId, phase, syncTimer]);

  // ── Mất mạng / có mạng lại ────────────────────────────────────────
  // Khi mạng trở lại: đọc phiên từ server để lấy thời gian còn lại thật và đáp
  // án đã lưu, rồi đẩy lại những câu autosave còn dở. Đáp án trên máy được ưu
  // tiên cho các câu đang pending — đó là thao tác mới nhất của thí sinh.
  const restoreFromServer = useCallback(async () => {
    try {
      const data = await getSession(examId);
      syncTimer(data.remainingSeconds);
      const serverMap = buildAnswerMap(data.questions);
      setSession((prev) => ({ ...(prev || {}), ...data }));
      setAnswers((prev) => {
        const merged = { ...serverMap };
        for (const [qid, entry] of Object.entries(prev)) {
          if (saveState[qid] === 'failed' || saveState[qid] === 'saving') {
            merged[qid] = entry;
          }
        }
        return merged;
      });
      for (const [qid, state] of Object.entries(saveState)) {
        if (state !== 'failed') continue;
        const entry = answers[qid];
        if (!entry) continue;
        persistAnswer(Number(qid), {
          snapshotAnswerId: entry.snapshotAnswerId ?? null,
          essayResponse: entry.essayResponse ? entry.essayResponse : null,
        });
      }
    } catch (err) {
      if (isSessionClosedError(err)) {
        closeSession(err.message);
      }
    }
  }, [answers, closeSession, examId, persistAnswer, saveState, syncTimer]);

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

  // Đóng tab giữa lúc thi thì hỏi lại. Đáp án đã autosave nên không mất, nhưng
  // đồng hồ vẫn chạy ở server — nhắc để thí sinh không bỏ bài vì bấm nhầm.
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

  // ── Giá trị dẫn xuất ──────────────────────────────────────────────
  const questions = useMemo(() => session?.questions ?? [], [session]);
  const current = questions[index];

  const answeredCount = useMemo(
    () => questions.filter((q) => hasAnswer(answers[q.questionId])).length,
    [answers, questions]
  );

  const states = Object.values(saveState);
  const savingNow = states.includes('saving');
  const unsavedCount = states.filter((s) => s === 'failed').length;
  const saveTone = savingNow ? 'saving' : unsavedCount > 0 ? 'failed' : 'saved';
  const saveLabel = savingNow
    ? 'Đang lưu…'
    : unsavedCount > 0
      ? `${unsavedCount} câu chưa lưu`
      : 'Đã lưu';

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
    return (
      <div className="er-root">
        <div className="er-center">
          <div className="er-center-box done">
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
            <div className="er-center-actions">
              {/* Xem lại bài ngay là hành động đúng nhất ở màn hình này với một
                  nền tảng ôn thi — vừa làm xong là lúc thí sinh còn nhớ mình đã
                  phân vân ở câu nào. Nên nó là nút chính, không phải nút phụ. */}
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
            {/* Đề nhiều lượt: nói rõ đang ở lượt nào, để thí sinh biết đây là
                lần cuối hay còn cơ hội làm lại. Đề không giới hạn thì im lặng. */}
            {session?.maxAttempts != null && (
              <> · lượt {session.attemptNumber}/{session.maxAttempts}</>
            )}
          </p>
        </div>

        <span className={`er-status ${saveTone}`}>
          {saveTone === 'saving' ? (
            <Loader2 size={14} className="er-spin" />
          ) : saveTone === 'failed' ? (
            <CloudOff size={14} />
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

      {online && unsavedCount > 0 && (
        <div className="er-banner warn">
          <AlertTriangle size={15} />
          {unsavedCount} câu chưa lưu được lên server. Chúng sẽ được gửi kèm khi bạn nộp bài.
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

      <div className="er-body">
        <div className="er-card">
          <div className="er-question-head">
            <span className="er-chip">Câu {index + 1}</span>
            <span className="er-chip">
              {current?.questionType === 'ESSAY' ? 'Tự luận' : 'Trắc nghiệm'}
            </span>
            {current?.points != null && <span>{current.points} điểm</span>}
          </div>

          <div className="er-question-content">{current?.content}</div>

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
              const pending = saveState[q.questionId] === 'failed';
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
              Đã trả lời và đã lưu
            </span>
            <span>
              <i style={{ background: 'rgba(201, 146, 46, 0.55)' }} />
              Đã chọn, chưa lưu được
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
            {unsavedCount > 0 && (
              <p className="er-modal-warn">
                {unsavedCount} câu chưa lưu được sẽ được gửi kèm lần này.
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
