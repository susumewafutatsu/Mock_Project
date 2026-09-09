// src/pages/student/MistakeBook.jsx
// Sổ tay câu sai — làm lại những câu đã từng làm sai.
//
// Ba quy ước của màn hình này:
//
// 1. Server chấm, không phải client. Danh sách trả về các lựa chọn nhưng KHÔNG
//    kèm đáp án đúng, nên trước khi người học bấm thì trong trang không tồn tại
//    thông tin nào để lộ. Đáp án đúng và lời giải chỉ tới cùng response của
//    lần trả lời.
//
// 2. Đúng một lần chưa phải là thuộc. Phải đúng hai lần liên tiếp câu mới rời
//    khỏi sổ tay — quy tắc đó nằm ở backend, ở đây chỉ hiển thị lại chuỗi đúng
//    để người học biết mình còn cách bao xa.
//
// 3. Câu đã trả lời vẫn nằm nguyên chỗ cũ cho tới khi tải lại trang. Nếu nó
//    biến mất ngay sau khi trả lời đúng thì các câu bên dưới nhảy lên và người
//    học mất dấu chỗ mình đang đọc.

import { useCallback, useEffect, useState } from 'react';
import {
  Check, ChevronLeft, ChevronRight, Loader2,
  RotateCcw, X,
} from 'lucide-react';
import { attemptMistake, getMistakeBook } from '../../services/studyService';
import './Study.css';

const PAGE_SIZE = 5;
const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/** "12/03 09:30" — LocalDateTime của server về dạng "2026-03-12T09:30:00". */
function formatWhen(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Một câu trong sổ tay, tự quản lý trạng thái trả lời của riêng nó.
 *
 * Tách thành component riêng để trả lời câu này không làm render lại cả trang —
 * và quan trọng hơn, để đáp án vừa hiện của câu này không bị xoá khi người học
 * trả lời câu khác.
 */
function MistakeCard({ entry, onAnswered }) {
  const [picked, setPicked] = useState(null);
  const [result, setResult] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const isEssay = entry.questionType === 'ESSAY';
  const answered = result != null;

  const send = async (payload) => {
    setSending(true);
    setError(null);
    try {
      const res = await attemptMistake(entry.questionId, payload);
      setResult(res);
      onAnswered?.(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const pick = (answerId) => {
    if (answered || sending) return;
    setPicked(answerId);
    send({ selectedAnswerId: answerId });
  };

  const retry = () => {
    setPicked(null);
    setResult(null);
    setError(null);
  };

  /** Màu của một lựa chọn sau khi đã có kết quả từ server. */
  const optionClass = (answerId) => {
    if (!answered) return picked === answerId ? 'picked' : '';
    if (result.correctAnswerId === answerId) return 'correct';
    if (picked === answerId) return 'wrong';
    return '';
  };

  return (
    <div className={`st-mistake ${entry.due && !answered ? 'due' : ''}`}>
      <div className="st-mistake-top">
        <span className="st-tag wrong">Sai {entry.wrongCount} lần</span>
        {entry.correctStreak > 0 && (
          <span className="st-tag streak">Đúng liên tiếp {entry.correctStreak}/2</span>
        )}
        {entry.due && <span className="st-tag due">Đến hạn ôn</span>}
        {isEssay && <span className="st-tag type">Tự luận</span>}
        {entry.lastWrongAt && (
          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--ink-faint)' }}>
            Sai gần nhất {formatWhen(entry.lastWrongAt)}
          </span>
        )}
      </div>

      {/* lang="ja" để trình duyệt chọn đúng glyph chữ Hán Nhật; đề thi tiếng
          Nhật lẫn cả tiếng Việt nên vẫn dùng font mặc định cho phần Việt. */}
      <p className="st-question jp" lang="ja">{entry.content}</p>

      {isEssay ? (
        // Tự luận không có đáp án để máy so — người học tự chấm. Đây là ôn tập
        // cá nhân, không tính điểm, nên tự đánh giá không hại ai ngoài chính mình.
        !answered && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="st-btn" disabled={sending}
                    onClick={() => send({ selfCorrect: false })}>
              <X size={14} /> Chưa nhớ được
            </button>
            <button className="st-btn primary" disabled={sending}
                    onClick={() => send({ selfCorrect: true })}>
              <Check size={14} /> Tôi đã nhớ ra
            </button>
          </div>
        )
      ) : (
        <div className="st-options">
          {entry.options.map((opt, i) => (
            <button
              key={opt.answerId}
              className={`st-option ${optionClass(opt.answerId)}`}
              disabled={answered || sending}
              onClick={() => pick(opt.answerId)}
            >
              <span className="st-option-key">{OPTION_KEYS[i] ?? i + 1}</span>
              <span className="jp" lang="ja">{opt.content}</span>
            </button>
          ))}
        </div>
      )}

      {sending && (
        <p className="st-card-sub">
          <Loader2 size={13} className="st-spin" /> Đang chấm…
        </p>
      )}

      {error && <div className="st-error">{error}</div>}

      {answered && (
        <div className={`st-verdict ${result.correct ? 'ok' : 'no'}`}>
          <b>
            {result.mastered
              ? '🎉 Đã sửa được câu này — câu sẽ rời khỏi sổ tay'
              : result.correct
                ? `Chính xác. Đúng liên tiếp ${result.correctStreak}/2, đúng thêm một lần nữa là xong.`
                : 'Chưa đúng. Câu này quay lại hàng đợi ôn ngay hôm nay.'}
          </b>
          {result.explanation && <p>{result.explanation}</p>}
          {!result.correct && (
            <button className="st-btn" style={{ alignSelf: 'flex-start' }} onClick={retry}>
              <RotateCcw size={14} /> Thử lại
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function MistakeBook() {
  const [book, setBook] = useState(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback((targetPage) => {
    setLoading(true);
    setError(null);
    getMistakeBook({ page: targetPage, size: PAGE_SIZE })
      .then(setBook)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  /**
   * Cập nhật con số tổng ngay sau khi trả lời, không đợi tải lại trang.
   *
   * Chỉ sửa mấy con số ở đầu trang chứ không bỏ câu ra khỏi danh sách: xem
   * chú thích số 3 ở đầu file.
   */
  const handleAnswered = (result) => {
    setBook((prev) => prev && {
      ...prev,
      totalOpen: result.remainingOpen,
      totalMastered: result.mastered ? prev.totalMastered + 1 : prev.totalMastered,
      totalDue: Math.max(0, prev.totalDue - 1),
    });
  };

  if (loading && !book) {
    return (
      <div className="st-empty">
        <Loader2 size={22} className="st-spin" />
        <p>Đang mở sổ tay…</p>
      </div>
    );
  }

  if (error && !book) {
    return <div className="st-error">{error}</div>;
  }

  const items = book?.items ?? [];

  return (
    <div className="st-wrap">
      <div className="st-head">
        <div>
          <h2>Sổ tay câu sai</h2>
          <p>
            Những câu bạn từng làm sai, xếp câu cần ôn gấp nhất lên trước.
            Trả lời đúng hai lần liên tiếp thì câu được coi là đã sửa xong và rời khỏi sổ tay.
          </p>
        </div>
        <div className="st-stats">
          <div className="st-stat wrong">
            <b>{book?.totalOpen ?? 0}</b><span>Chưa sửa</span>
          </div>
          <div className="st-stat due">
            <b>{book?.totalDue ?? 0}</b><span>Đến hạn</span>
          </div>
          <div className="st-stat done">
            <b>{book?.totalMastered ?? 0}</b><span>Đã sửa</span>
          </div>
        </div>
      </div>

      {error && <div className="st-error">{error}</div>}

      {items.length === 0 ? (
        <div className="st-empty">
          <span className="st-empty-icon">
            {book?.totalMastered > 0 ? '🎉' : '📘'}
          </span>
          <h3>
            {book?.totalMastered > 0
              ? 'Sổ tay đang trống'
              : 'Chưa có câu nào trong sổ tay'}
          </h3>
          <p>
            {book?.totalMastered > 0
              ? `Bạn đã sửa xong toàn bộ ${book.totalMastered} câu từng làm sai. Làm thêm đề mới để tiếp tục luyện.`
              : 'Câu nào bạn làm sai trong bài thi sẽ tự động được đưa vào đây để ôn lại.'}
          </p>
        </div>
      ) : (
        <>
          {items.map((entry) => (
            <MistakeCard
              key={entry.questionId}
              entry={entry}
              onAnswered={handleAnswered}
            />
          ))}

          {book.totalPages > 1 && (
            <div className="st-pager">
              <button className="st-btn" disabled={page === 0 || loading}
                      onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={14} /> Trước
              </button>
              <span>Trang {page + 1}/{book.totalPages}</span>
              <button className="st-btn"
                      disabled={page >= book.totalPages - 1 || loading}
                      onClick={() => setPage((p) => p + 1)}>
                Sau <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
