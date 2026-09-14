// src/pages/student/Rankings.jsx
// Mục "Bảng xếp hạng" của thí sinh.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Compass, Loader2, School, Trophy } from 'lucide-react';
import roomService from '../../services/roomService';
import { getExamLeaderboard, getPracticeExams } from '../../services/examService';
import Leaderboard from '../../components/leaderboard/Leaderboard';

/**
 * @param initial { type: 'ROOM' | 'EXAM', id } — mục mở sẵn, nếu có
 */
export default function Rankings({ initial }) {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [exams, setExams] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selected, setSelected] = useState(initial ?? null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      roomService.getJoinedRooms().catch(() => []),
      // Đề tự do mình đã làm: lấy từ danh sách luyện tập — dòng nào có bài đã
      // nộp là dòng có bảng xếp hạng để xem.
      getPracticeExams({ allLevels: true, size: 50 }).then((p) => p?.exams ?? []).catch(() => []),
    ]).then(([rs, es]) => {
      if (!alive) return;
      const ended = rs.filter((r) => r.phase === 'ENDED');
      const done = es.filter((e) => e.submissionId != null && e.availability !== 'IN_PROGRESS');
      setRooms(ended);
      setExams(done);
      // Không mở sẵn mục nào thì chọn phòng kết thúc gần nhất, không có thì đề đầu tiên.
      setSelected((cur) => cur
        ?? (ended[0] ? { type: 'ROOM', id: ended[0].roomId }
          : done[0] ? { type: 'EXAM', id: done[0].examId } : null));
    }).finally(() => { if (alive) setLoadingList(false); });
    return () => { alive = false; };
  }, []);

  const load = useCallback((target) => {
    if (!target) return;
    setLoading(true);
    setError(null);
    (target.type === 'ROOM'
      ? roomService.getLeaderboard(target.id)
      : getExamLeaderboard(target.id))
      .then(setData)
      .catch((err) => { setData(null); setError(err.message); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(selected); }, [selected, load]);

  const isSelected = (type, id) => selected?.type === type && String(selected.id) === String(id);
  const nothing = !loadingList && rooms.length === 0 && exams.length === 0;

  return (
    <div className="sd-rank-layout">
      <aside className="sd-card sd-rank-picker">
        {loadingList ? (
          <div className="sd-list-state"><Loader2 size={15} className="sd-spin" /> Đang tải…</div>
        ) : (
          <>
            <p className="sd-rank-group"><School size={13} /> Phòng thi đã kết thúc</p>
            {rooms.length === 0 && <p className="sd-rank-none">Chưa có phòng nào kết thúc.</p>}
            {rooms.map((r) => (
              <button key={`r${r.roomId}`} type="button"
                      className={`sd-rank-item ${isSelected('ROOM', r.roomId) ? 'active' : ''}`}
                      onClick={() => setSelected({ type: 'ROOM', id: r.roomId })}>
                {r.name}
                <span>{r.examCount} đề · {r.memberCount} thí sinh</span>
              </button>
            ))}

            <p className="sd-rank-group"><Compass size={13} /> Đề tự do đã làm</p>
            {exams.length === 0 && <p className="sd-rank-none">Làm một đề tự do để thấy mình đứng đâu.</p>}
            {exams.map((e) => (
              <button key={`e${e.examId}`} type="button"
                      className={`sd-rank-item ${isSelected('EXAM', e.examId) ? 'active' : ''}`}
                      onClick={() => setSelected({ type: 'EXAM', id: e.examId })}>
                {e.title}
                <span>{[e.levelName, `${e.totalQuestions} câu`].filter(Boolean).join(' · ')}</span>
              </button>
            ))}
          </>
        )}
      </aside>

      <section style={{ minWidth: 0 }}>
        {nothing && (
          <div className="sd-card">
            <div className="sd-list-state">
              <Trophy size={15} /> Chưa có bảng xếp hạng nào. Bảng của phòng thi mở khi phòng hết
              giờ; bảng của đề tự do có ngay khi bạn nộp bài.
            </div>
          </div>
        )}
        {loading && (
          <div className="sd-card"><div className="sd-list-state"><Loader2 size={15} className="sd-spin" /> Đang tải bảng xếp hạng…</div></div>
        )}
        {error && !loading && (
          <div className="sd-card"><div className="sd-list-state error"><AlertCircle size={15} /> {error}</div></div>
        )}
        {!loading && data && (
          <>
            {data.scope === 'ROOM' && (
              <h2 className="sd-section-title"><School size={17} /> {data.roomName}</h2>
            )}
            <Leaderboard data={data}
                         onOpenSubmission={(id) => navigate(`/student/submissions/${id}/review`)} />
          </>
        )}
      </section>
    </div>
  );
}
