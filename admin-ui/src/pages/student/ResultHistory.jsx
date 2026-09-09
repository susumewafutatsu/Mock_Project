// src/pages/student/ResultHistory.jsx
//
// Lịch sử làm bài của thí sinh, nhóm theo ĐỀ chứ không phải theo lượt.
//
// Từ khi một đề có thể làm nhiều lượt, một danh sách phẳng đọc rất khó: bốn
// dòng cùng tên "Từ vựng N4 – Tuần 8" nằm rải giữa các đề khác, không nhìn ra
// được điểm đang lên hay xuống. Nhóm lại thì mỗi đề chỉ chiếm một khối, và câu
// hỏi thật sự của thí sinh — "mình đã khá hơn chưa" — trả lời được ngay bằng
// điểm cao nhất so với điểm lần gần nhất.
//
// Trang này không tự gọi đáp án: nó chỉ liệt kê. Đáp án + giải thích nằm ở
// SubmissionReview, mở bằng nút "Xem lại" của từng lượt.

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, CheckCircle, Clock, Eye, Loader2, Star, TrendingUp, Zap,
} from 'lucide-react';
import { getStudentResults } from '../../services/examService';

/** "22/08 14:30". Server trả LocalDateTime dạng "2026-08-22T14:30:00". */
function formatMoment(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Điểm hiển thị gọn: bỏ ".00" nhưng giữ ".5". */
function formatScore(value) {
  if (value == null) return '—';
  return String(Number(value));
}

/**
 * Gom các lượt làm theo đề, giữ nguyên thứ tự server đã sắp (mới nhất trước).
 *
 * Mỗi nhóm mang sẵn hai con số mà phần render cần: điểm cao nhất từ trước tới
 * giờ, và điểm của lượt gần nhất. Tính ở đây một lần thay vì tính lại trong JSX
 * mỗi lần component vẽ lại.
 */
function groupByExam(results) {
  const groups = new Map();
  for (const row of results) {
    let group = groups.get(row.examId);
    if (!group) {
      group = { examId: row.examId, examTitle: row.examTitle, attempts: [] };
      groups.set(row.examId, group);
    }
    group.attempts.push(row);
  }
  for (const group of groups.values()) {
    const scores = group.attempts
      .map((a) => (a.totalScore == null ? null : Number(a.totalScore)))
      .filter((s) => s != null);
    group.bestScore = scores.length ? Math.max(...scores) : null;
    // attempts[0] là lượt mới nhất vì server sắp giảm dần theo thời gian nộp.
    group.latest = group.attempts[0];
    group.maxScore = group.latest?.maxScore ?? null;
  }
  return [...groups.values()];
}

/** Một lượt làm — một dòng trong khối của đề. */
function AttemptRow({ attempt, isBest, onReview }) {
  const pending = attempt.awaitingManualGrading;
  return (
    <div className="sd-exam-card" style={{ padding: '10px 14px' }}>
      <div
        className="sd-exam-icon-wrap"
        style={{ background: isBest ? 'rgba(47, 143, 111,0.15)' : 'rgba(140, 128, 113,0.12)', fontSize: 13 }}
      >
        {attempt.attemptNumber ?? 1}
      </div>
      <div className="sd-exam-body">
        <p className="sd-exam-name" style={{ fontSize: 13.5 }}>
          Lần {attempt.attemptNumber ?? 1}
          <span style={{ fontWeight: 600, color: 'var(--jade)', marginLeft: 10 }}>
            <Star size={11} style={{ verticalAlign: -1 }} /> {formatScore(attempt.totalScore)}
            {attempt.maxScore != null && ` / ${formatScore(attempt.maxScore)}`}
          </span>
          {isBest && (
            <span className="sd-badge open" style={{ marginLeft: 8 }}>Điểm cao nhất</span>
          )}
        </p>
        <div className="sd-exam-meta">
          <span><CheckCircle size={11} />{attempt.correctAnswers}/{attempt.totalQuestions} câu đúng</span>
          <span><Clock size={11} />Nộp {formatMoment(attempt.submittedAt)}</span>
          {/* Nói rõ bài do server chốt hộ: thí sinh nhớ là mình chưa bấm nộp,
              không nói thì dễ tưởng mất bài. */}
          {attempt.autoSubmitted && (
            <span style={{ color: 'var(--gold)' }}><Zap size={11} />Hết giờ, nộp tự động</span>
          )}
          {pending && (
            <span style={{ color: 'var(--azure)' }}>
              <AlertCircle size={11} />Còn câu tự luận chờ chấm
            </span>
          )}
        </div>
      </div>
      <div className="sd-exam-action">
        <button className="sd-btn-ghost" onClick={() => onReview(attempt.submissionId)}>
          <Eye size={13} /> Xem lại
        </button>
      </div>
    </div>
  );
}

function ExamGroup({ group, onReview }) {
  const improved =
    group.bestScore != null
    && group.latest?.totalScore != null
    && Number(group.latest.totalScore) >= group.bestScore
    && group.attempts.length > 1;

  return (
    <div className="sd-card" style={{ marginBottom: 14 }}>
      <div className="sd-card-header">
        <h2 style={{ fontSize: 14.5 }}>{group.examTitle}</h2>
        <span style={{ fontSize: 11.5, color: 'var(--ink-mute)' }}>
          {group.attempts.length} lượt
          {group.bestScore != null && (
            <> · cao nhất <strong style={{ color: 'var(--jade)' }}>
              {formatScore(group.bestScore)}
              {group.maxScore != null && ` / ${formatScore(group.maxScore)}`}
            </strong></>
          )}
          {improved && (
            <span style={{ color: 'var(--jade)', marginLeft: 8 }}>
              <TrendingUp size={11} style={{ verticalAlign: -1 }} /> lần gần nhất là tốt nhất
            </span>
          )}
          {/* Đề không cho xem đáp án thì nói ngay ở đây, đừng để thí sinh bấm
              "Xem lại" rồi mới phát hiện không có lời giải. */}
          {group.latest && !group.latest.reviewAllowed && (
            <span style={{ color: 'var(--ink-mute)', marginLeft: 8 }}>
              · người ra đề không mở đáp án
            </span>
          )}
        </span>
      </div>
      <div className="sd-exam-list">
        {group.attempts.map((attempt) => (
          <AttemptRow
            key={attempt.submissionId}
            attempt={attempt}
            isBest={
              group.attempts.length > 1
              && attempt.totalScore != null
              && Number(attempt.totalScore) === group.bestScore
            }
            onReview={onReview}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Dùng được ở hai chỗ: làm nội dung tab "Lịch sử điểm" trong trang thí sinh, và
 * làm một trang độc lập. Nên nó không tự vẽ sidebar hay tiêu đề trang.
 */
export default function ResultHistory() {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResults(await getStudentResults());
    } catch (err) {
      setError(err?.message || 'Không tải được lịch sử làm bài');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openReview = useCallback(
    (submissionId) => navigate(`/student/submissions/${submissionId}/review`),
    [navigate],
  );

  if (loading) {
    return (
      <div className="sd-card">
        <div className="sd-list-state"><Loader2 size={15} className="sd-spin" /> Đang tải…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="sd-card">
        <div className="sd-list-state error"><AlertCircle size={15} /> {error}</div>
      </div>
    );
  }
  if (results.length === 0) {
    return (
      <div className="sd-card">
        <div className="sd-list-state">
          <CheckCircle size={15} /> Bạn chưa nộp bài nào. Làm xong một đề là kết quả hiện ở đây.
        </div>
      </div>
    );
  }

  const groups = groupByExam(results);
  return (
    <div>
      {groups.map((group) => (
        <ExamGroup key={group.examId} group={group} onReview={openReview} />
      ))}
    </div>
  );
}
