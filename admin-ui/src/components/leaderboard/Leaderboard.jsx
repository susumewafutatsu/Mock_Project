// src/components/leaderboard/Leaderboard.jsx
// Bảng xếp hạng + kết quả từng thí sinh.

import { Clock, Eye, Medal, Timer, Trophy, Users } from 'lucide-react';
import './Leaderboard.css';

const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

const STATUS = {
  GRADED:      { label: 'Đã chấm', cls: 'done' },
  SUBMITTED:   { label: 'Chờ chấm tự luận', cls: 'pending' },
  IN_PROGRESS: { label: 'Đang làm', cls: 'live' },
  NOT_STARTED: { label: 'Chưa làm', cls: 'none' },
};

/** 754 → "12′34″" · 3905 → "1 giờ 05′05″" */
export function formatDuration(seconds) {
  if (seconds == null) return '—';
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h} giờ ${String(m).padStart(2, '0')}′${ss}″` : `${m}′${ss}″`;
}

function RankCell({ rank }) {
  if (rank == null) return <span className="lb-rank none">—</span>;
  if (rank <= 3) {
    return (
      <span className={`lb-rank top top-${rank}`} aria-label={`Hạng ${rank}`}>
        <Medal size={14} /> {rank}
      </span>
    );
  }
  return <span className="lb-rank">{rank}</span>;
}

function Row({ row, maxScore, totalQuestions, showSeat, onOpenSubmission }) {
  const st = STATUS[row.status] ?? STATUS.NOT_STARTED;
  const hasResult = row.rank != null;
  return (
    <tr className={`${row.me ? 'lb-me' : ''} ${hasResult ? '' : 'lb-muted'}`}>
      <td><RankCell rank={row.rank} /></td>
      <td>
        <div className="lb-name">
          {row.fullName}
          {row.me && <span className="lb-me-tag">Bạn</span>}
        </div>
        {showSeat && row.seatNo != null && <div className="lb-sub">Ghế {row.seatNo}</div>}
      </td>
      <td className="lb-num">
        {hasResult ? (
          <>
            <strong>{nf.format(row.score)}</strong>
            <span className="lb-sub-inline">/{nf.format(maxScore)}</span>
          </>
        ) : '—'}
      </td>
      <td className="lb-num lb-hide-sm">
        {hasResult ? `${row.correctAnswers}/${totalQuestions}` : '—'}
      </td>
      <td className="lb-num lb-hide-sm">{hasResult ? formatDuration(row.durationSeconds) : '—'}</td>
      <td>
        <span className={`lb-status ${st.cls}`}>{st.label}</span>
        {row.autoSubmitted && <span className="lb-status auto">Tự nộp khi hết giờ</span>}
      </td>
      <td className="lb-action">
        {row.submissionId != null && onOpenSubmission && (
          <button type="button" className="lb-link" onClick={() => onOpenSubmission(row.submissionId)}>
            <Eye size={13} /> Xem bài
          </button>
        )}
      </td>
    </tr>
  );
}

function Board({ board, showSeat, onOpenSubmission, scope }) {
  const myOutside = board.myRow && !board.rows.some((r) => r.me);
  return (
    <section className="lb-board">
      <header className="lb-board-head">
        <h3>{board.examTitle}</h3>
        <div className="lb-facts">
          <span><Users size={13} /> {board.submittedCount}/{board.participants} {scope === 'EXAM' ? 'người đã làm' : 'đã nộp'}</span>
          <span><Trophy size={13} /> Cao nhất {board.highestScore != null ? nf.format(board.highestScore) : '—'}/{nf.format(board.maxScore)}</span>
          <span>Trung bình {board.averageScore != null ? nf.format(board.averageScore) : '—'}</span>
          <span><Timer size={13} /> {board.totalQuestions} câu · {board.durationMinutes} phút</span>
        </div>
      </header>

      {board.rows.length === 0 ? (
        <p className="lb-empty">Chưa có ai trong danh sách.</p>
      ) : (
        <div className="lb-table-wrap">
          <table className="lb-table">
            <thead>
              <tr>
                <th>Hạng</th>
                <th>Thí sinh</th>
                <th className="lb-num">Điểm</th>
                <th className="lb-num lb-hide-sm">Câu đúng</th>
                <th className="lb-num lb-hide-sm">Thời gian làm</th>
                <th>Trạng thái</th>
                <th aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {board.rows.map((row, i) => (
                <Row key={`${row.fullName}-${row.seatNo ?? i}`} row={row} maxScore={board.maxScore}
                     totalQuestions={board.totalQuestions} showSeat={showSeat}
                     onOpenSubmission={onOpenSubmission} />
              ))}
              {myOutside && (
                <>
                  <tr className="lb-gap"><td colSpan={7}>⋯</td></tr>
                  <Row row={board.myRow} maxScore={board.maxScore}
                       totalQuestions={board.totalQuestions} showSeat={showSeat}
                       onOpenSubmission={onOpenSubmission} />
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * @param data LeaderboardResponse
 * @param onOpenSubmission(submissionId) nếu có, dòng mang submissionId có nút "Xem bài"
 */
export default function Leaderboard({ data, onOpenSubmission }) {
  if (!data) return null;
  const isRoom = data.scope === 'ROOM';
  return (
    <div className="lb-root">
      {isRoom && !data.finalResults && (
        <p className="lb-live">
          <Clock size={14} /> Phòng đang thi — bảng cập nhật trực tiếp, chỉ bạn (người ra đề)
          thấy lúc này. Thí sinh thấy bảng khi phòng hết giờ.
        </p>
      )}
      {data.boards.length === 0 && <p className="lb-empty">Phòng chưa có đề thi nào.</p>}
      {data.boards.map((b) => (
        <Board key={b.examId} board={b} showSeat={isRoom} scope={data.scope}
               onOpenSubmission={onOpenSubmission} />
      ))}
    </div>
  );
}
