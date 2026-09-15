// src/pages/student/SubmissionReview.jsx
// Xem lại một bài đã nộp: từng câu, mình đã chọn gì, đáp án đúng là gì, và vì sao.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle, ArrowLeft, CheckCircle2, Clock, Eye, EyeOff, Loader2,
  RotateCcw, XCircle, Zap, Bookmark,
} from 'lucide-react';
import { getResult } from '../../services/examService';
import { bookmarkApi } from '../../services/engagementService';
import JlptScoreCard from '../../components/exam/JlptScoreCard';
import './SubmissionReview.css';

const OPTION_KEYS = 'ABCDEFGHIJ';

/** "22/08/2026 14:30" — LocalDateTime của server. */
function formatMoment(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} `
    + `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Bỏ ".00" thừa nhưng giữ ".5". */
function formatScore(value) {
  if (value == null) return '—';
  return String(Number(value));
}

/** Trạng thái của một câu, dùng chung cho màu viền thẻ, nhãn kết quả và ô điều hướng. */
function verdictOf(detail) {
  if (detail.awaitingManualGrading) return 'pending';
  const answered = detail.selectedSnapshotAnswerId != null
    || (detail.essayResponse != null && detail.essayResponse !== '');
  if (!answered) return 'blank';
  return detail.correct ? 'correct' : 'wrong';
}

const VERDICT_LABEL = {
  correct: 'Đúng',
  wrong: 'Sai',
  pending: 'Chờ chấm',
  blank: 'Bỏ trống',
};

const VERDICT_ICON = {
  correct: CheckCircle2,
  wrong: XCircle,
  pending: Clock,
  blank: AlertCircle,
};

/** Một lựa chọn trắc nghiệm, tô màu theo vai trò của nó trong bài làm. */
function Option({ option, index, selectedId, correctId, revealed }) {
  const picked = option.snapshotAnswerId === selectedId;
  const isCorrect = revealed && option.snapshotAnswerId === correctId;

  // Chưa mở đáp án thì lựa chọn của thí sinh chỉ được tô xanh dương — trung tính.
  let cls = '';
  if (isCorrect) cls = 'correct';
  else if (picked) cls = revealed ? 'wrong' : 'picked';

  return (
    <div className={`sr-opt ${cls}`}>
      <span className="sr-opt-key">{OPTION_KEYS[index] || index + 1}</span>
      <span className="sr-opt-text">{option.answerContent}</span>
      {picked && <span className="sr-opt-tag">Bạn chọn</span>}
      {isCorrect && !picked && <span className="sr-opt-tag">Đáp án đúng</span>}
    </div>
  );
}

function QuestionCard({ detail, order, revealed, marked, onToggleMark }) {
  const verdict = verdictOf(detail);
  const Icon = VERDICT_ICON[verdict];
  const isEssay = detail.questionType === 'ESSAY';
  const options = detail.options || [];

  return (
    <div className={`sr-q ${verdict}`} id={`sr-q-${order}`}>
      <div className="sr-q-head">
        <span className="sr-q-no">CÂU {order}</span>
        <span className={`sr-q-verdict ${verdict}`}>
          <Icon size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
          {VERDICT_LABEL[verdict]}
        </span>
        <span className="sr-q-points">
          {formatScore(detail.scoreEarned)} / {formatScore(detail.points)} điểm
        </span>
        {/* Đánh dấu để ôn lại — kể cả câu làm đúng nhưng còn phân vân. */}
        {onToggleMark && (
          <button
            type="button"
            className={`sr-mark ${marked ? 'on' : ''}`}
            onClick={() => onToggleMark(detail.questionId)}
            title={marked ? 'Bỏ đánh dấu' : 'Đánh dấu câu này để ôn lại'}
          >
            <Bookmark size={13} fill={marked ? 'currentColor' : 'none'} />
            {marked ? 'Đã đánh dấu' : 'Đánh dấu'}
          </button>
        )}
      </div>

      <p className="sr-q-content">{detail.content}</p>

      {isEssay ? (
        <div className={`sr-essay ${detail.essayResponse ? '' : 'empty'}`}>
          {detail.essayResponse || 'Bạn không viết gì cho câu này.'}
        </div>
      ) : options.length > 0 ? (
        options.map((option, i) => (
          <Option
            key={option.snapshotAnswerId}
            option={option}
            index={i}
            selectedId={detail.selectedSnapshotAnswerId}
            correctId={detail.correctSnapshotAnswerId}
            revealed={revealed}
          />
        ))
      ) : (
        <div className="sr-essay empty">
          {detail.selectedAnswerContent
            ? `Bạn chọn: ${detail.selectedAnswerContent}`
            : 'Bạn không chọn đáp án nào.'}
          {revealed && detail.correctAnswerContent
            && ` — Đáp án đúng: ${detail.correctAnswerContent}`}
        </div>
      )}

      {revealed && detail.explanation && (
        <div className="sr-explain">
          <b>GIẢI THÍCH</b>
          {detail.explanation}
        </div>
      )}
    </div>
  );
}

export default function SubmissionReview() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await getResult(submissionId));
    } catch (err) {
      setError(err?.message || 'Không tải được bài làm');
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => { load(); }, [load]);

  const details = useMemo(() => result?.details ?? [], [result]);

  // Câu đã đánh dấu. Lỗi tải chỉ làm các nút hiện "Đánh dấu" — không chặn xem bài.
  const [marked, setMarked] = useState(() => new Set());
  useEffect(() => {
    bookmarkApi.list()
      .then((list) => setMarked(new Set(list.map((b) => b.questionId))))
      .catch(() => {});
  }, []);

  const toggleMark = useCallback(async (questionId) => {
    const on = marked.has(questionId);
    // Đổi ngay trên màn hình, gửi sau: chờ server mới đổi thì nút có cảm giác đơ.
    setMarked((prev) => {
      const next = new Set(prev);
      if (on) next.delete(questionId); else next.add(questionId);
      return next;
    });
    try {
      if (on) await bookmarkApi.remove(questionId);
      else await bookmarkApi.save(questionId, null);
    } catch {
      setMarked((prev) => {
        const next = new Set(prev);
        if (on) next.add(questionId); else next.delete(questionId);
        return next;
      });
    }
  }, [marked]);

  if (loading) {
    return (
      <div className="sr-root">
        <div className="sr-state"><Loader2 size={16} className="sr-spin" /> Đang tải bài làm…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="sr-root">
        <div className="sr-wrap">
          <button className="sr-back" onClick={() => navigate('/student/exams')}>
            <ArrowLeft size={14} /> Về trang đề thi
          </button>
          <div className="sr-state error"><AlertCircle size={16} /> {error}</div>
        </div>
      </div>
    );
  }

  const revealed = !!result.reviewAllowed;

  return (
    <div className="sr-root">
      <div className="sr-wrap">
        <button className="sr-back" onClick={() => navigate('/student/exams')}>
          <ArrowLeft size={14} /> Về trang đề thi
        </button>

        <div className="sr-head">
          <h1 className="sr-title">{result.examTitle}</h1>
          <div className="sr-sub">
            <span><RotateCcw size={12} />Lần làm thứ {result.attemptNumber ?? 1}
              {result.maxAttempts != null && ` / ${result.maxAttempts}`}</span>
            <span><Clock size={12} />Nộp lúc {formatMoment(result.submittedAt)}</span>
            {result.autoSubmitted && (
              <span style={{ color: 'var(--gold)' }}><Zap size={12} />Hết giờ, nộp tự động</span>
            )}
            <span>{revealed
              ? <><Eye size={12} />Có đáp án</>
              : <><EyeOff size={12} />Không mở đáp án</>}</span>
          </div>

          <div className="sr-scores">
            <div className="sr-score-tile">
              <b>{formatScore(result.totalScore)}{result.maxScore != null && ` / ${formatScore(result.maxScore)}`}</b>
              <small>Điểm</small>
            </div>
            <div className="sr-score-tile">
              <b>{result.correctAnswers}/{result.totalQuestions}</b>
              <small>Câu đúng</small>
            </div>
            <div className="sr-score-tile">
              <b>{result.answeredQuestions}/{result.totalQuestions}</b>
              <small>Câu đã làm</small>
            </div>
          </div>

          <div className="sr-actions">
            <button className="sr-btn" onClick={() => navigate('/student/exams')}>
              <ArrowLeft size={13} /> Danh sách đề
            </button>
            {/* Còn lượt thì cho làm lại ngay tại đây: vừa xem xong chỗ sai là
                lúc thí sinh muốn thử lại nhất. */}
            {result.canRetake && (
              <button
                className="sr-btn primary"
                onClick={() => navigate(`/student/exams/${result.examId}/room`)}
              >
                <RotateCcw size={13} /> Làm lại đề này
              </button>
            )}
          </div>
        </div>

        {!revealed && (
          <div className="sr-note warn">
            <EyeOff size={14} style={{ flex: '0 0 auto', marginTop: 1 }} />
            <span>
              Người ra đề không mở đáp án cho đề này, nên bạn chỉ thấy bài làm của
              mình và câu nào được điểm. Phần đáp án đúng và lời giải thích được
              ẩn đi.
            </span>
          </div>
        )}
        {result.awaitingManualGrading && (
          <div className="sr-note info">
            <Clock size={14} style={{ flex: '0 0 auto', marginTop: 1 }} />
            <span>
              Bài có câu tự luận đang chờ chấm, nên điểm hiện tại chưa phải điểm
              cuối cùng. Các câu trắc nghiệm đã được chấm xong.
            </span>
          </div>
        )}

        {/* Bảng điểm JLPT — chỉ có với đề chấm theo thang quy đổi. */}
        {result.jlpt && (
          <div style={{ marginBottom: 20 }}>
            <JlptScoreCard jlpt={result.jlpt} />
          </div>
        )}

        {/* Lưới điều hướng: nhìn một cái là thấy mình sai ở đâu, bấm là nhảy tới. */}
        <div className="sr-nav">
          {details.map((detail, i) => (
            <button
              key={detail.questionId}
              className={`sr-nav-cell ${verdictOf(detail)}`}
              onClick={() => document
                .getElementById(`sr-q-${i + 1}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              title={`Câu ${i + 1}: ${VERDICT_LABEL[verdictOf(detail)]}`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {details.map((detail, i) => (
          <QuestionCard
            marked={marked.has(detail.questionId)}
            onToggleMark={toggleMark}
            key={detail.questionId}
            detail={detail}
            order={i + 1}
            revealed={revealed}
          />
        ))}
      </div>
    </div>
  );
}
