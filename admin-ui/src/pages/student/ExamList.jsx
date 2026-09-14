import React, { useEffect, useState, useCallback } from 'react';
import {
  LayoutDashboard, BookOpen, ClipboardList, BarChart2, Trophy,
  Bell, LogOut, ChevronRight, ChevronLeft, Clock, Play, CheckCircle,
  AlertCircle, Search, Star, Loader2, School, Users, GraduationCap,
  Compass, ArrowLeft, Eye, RotateCcw, BookMarked, Layers, KeyRound, DoorOpen,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Bookmarks from './Bookmarks';
import SearchBox from '../../components/common/SearchBox';
import NotificationBell from '../../components/common/NotificationBell';
import InsightsCard from '../../components/study/InsightsCard';
import {
  getExamBoard,
  getRoomExams,
  getPracticeExams,
  pushLeftoverDrafts,
  getStudentResults,
} from '../../services/examService';
import roomService from '../../services/roomService';
import courseService from '../../services/courseService';
import ResultHistory from './ResultHistory';
import MistakeBook from './MistakeBook';
import Flashcards from './Flashcards';
import Courses from './Courses';
import { getStudyStats } from '../../services/studyService';
import Leaderboard from '../../components/leaderboard/Leaderboard';
import Rankings from './Rankings';
import StudentRooms from './StudentRooms';
import './StudentDashboard.css';

// ─ Trạng thái đề thi Server đã tính sẵn `availability` cho từng đề (xem ExamResponse.Availability)
const AVAILABILITY = {
  OPEN:         { label: 'Đang mở',      cls: 'open',     action: 'Làm bài',      enter: true },
  IN_PROGRESS:  { label: 'Đang làm dở',  cls: 'open',     action: 'Tiếp tục',     enter: true },
  UPCOMING:     { label: 'Sắp mở',       cls: 'upcoming', action: 'Chưa mở',      enter: false },
  // Đã nộp nhưng còn lượt: vào phòng thi lần nữa là mở lượt mới, không phải "vào lại"
  RETAKEABLE:   { label: 'Làm lại được', cls: 'open',     action: 'Làm lại',      enter: true },
  SUBMITTED:    { label: 'Đã làm',       cls: 'done',     action: 'Đã nộp',       enter: false },
  CLOSED:       { label: 'Đã đóng',      cls: 'missed',   action: 'Đã đóng',      enter: false },
  NO_QUESTIONS: { label: 'Chưa có câu hỏi', cls: 'missed', action: 'Chưa có câu', enter: false },
  // Đã vào phòng, phòng còn ở sảnh chờ: người ra đề chưa bấm "Bắt đầu làm bài" và chưa tới giờ hẹn.
  WAITING_ROOM: { label: 'Chờ bắt đầu',  cls: 'upcoming', action: 'Chờ bắt đầu',  enter: false },
};

/** Dòng thời gian của một đề trong phòng — nói theo pha của phòng, không theo đề. */
function roomTimeLabel(exam) {
  switch (exam.roomPhase) {
    case 'WAITING':
      return exam.roomStartTime
        ? `Bắt đầu lúc ${formatDeadline(exam.roomStartTime)}`
        : 'Chờ người ra đề bấm bắt đầu';
    case 'IN_PROGRESS':
      return `Hết giờ lúc ${formatDeadline(exam.roomEndTime)}`;
    case 'ENDED':
      return 'Phòng đã kết thúc';
    default:
      return `Hạn: ${formatDeadline(exam.endTime)}`;
  }
}

/** "Lần 2/3", "Đã làm 4 lần" — mô tả tình trạng lượt của thí sinh trên một đề. */
function attemptLabel(exam) {
  const used = exam.attemptsUsed ?? 0;
  if (exam.maxAttempts == null) {
    return used === 0 ? null : `Đã làm ${used} lần`;
  }
  // `used` đã tính cả lượt đang làm dở, nên khi đang thi thì chính nó là số thứ tự của lượt hiện tại.
  if (exam.availability === 'IN_PROGRESS') {
    return `Lượt ${used}/${exam.maxAttempts}`;
  }
  if (used >= exam.maxAttempts) {
    return `Đã dùng hết ${exam.maxAttempts} lượt`;
  }
  return `Đã dùng ${used}/${exam.maxAttempts} lượt`;
}

const SUBJECT_ICON = {
  'Tiếng Nhật': { icon: '🇯🇵', bg: 'rgba(201, 146, 46,0.15)' },
};
const DEFAULT_ICON = { icon: '📝', bg: 'rgba(47, 143, 111,0.15)' };

const PRACTICE_PAGE_SIZE = 12;

/** "28/08 07:30" — LocalDateTime của server về dạng "2026-08-28T07:30:00". */
function formatDeadline(value) {
  if (!value) return 'không giới hạn';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Hạng chữ từ phần trăm điểm. */
function gradeOf(percent) {
  if (percent == null) return '—';
  if (percent >= 90) return 'A';
  if (percent >= 80) return 'B+';
  if (percent >= 65) return 'B';
  if (percent >= 50) return 'C';
  return 'F';
}

/** Phần trăm điểm của một bài đã nộp; null khi đề chưa có thang điểm. */
function percentOf(result) {
  const max = Number(result.maxScore);
  if (!max) return null;
  return Math.round((Number(result.totalScore) / max) * 100);
}

// Hai nhóm chức năng tách biệt: HỌC và THI.
const NAV_GROUPS = [
  {
    label: 'Học mỗi ngày',
    items: [
      { id: 'courses',    label: 'Lộ trình ôn tập', icon: GraduationCap },
      { id: 'flashcards', label: 'Thẻ ghi nhớ',    icon: Layers },
      { id: 'mistakes',   label: 'Sổ tay câu sai', icon: BookMarked },
      { id: 'bookmarks',  label: 'Câu đã đánh dấu', icon: Star },
    ],
  },
  {
    label: 'Thi cử',
    items: [
      { id: 'home',     label: 'Tổng quan',       icon: LayoutDashboard },
      { id: 'exams',    label: 'Bài được giao',   icon: ClipboardList },
      { id: 'practice', label: 'Đề tự do',        icon: Compass },
      { id: 'rooms',    label: 'Phòng thi của tôi', icon: School },
      { id: 'history',  label: 'Lịch sử điểm',    icon: BarChart2 },
      { id: 'ranking',  label: 'Bảng xếp hạng',   icon: Trophy },
    ],
  },
];

// Màu cho thanh tiến độ lộ trình.
const PATH_COLORS = ["var(--gold)", "var(--violet)", "var(--azure)", "var(--jade)"];

const GRADE_COLOR = {
  'A':  { bg: 'rgba(47, 143, 111,0.12)',   fg: 'var(--jade)' },
  'B+': { bg: 'rgba(61, 126, 166,0.12)',   fg: 'var(--azure)' },
  'B':  { bg: 'rgba(124, 92, 191,0.12)',  fg: 'var(--violet)' },
  'C':  { bg: 'rgba(201, 146, 46,0.12)',   fg: 'var(--gold)' },
  'F':  { bg: 'rgba(185, 58, 43,0.1)',     fg: 'var(--cinnabar)' },
};

function StatusBadge({ availability }) {
  const s = AVAILABILITY[availability] || AVAILABILITY.SUBMITTED;
  return <span className={`sd-badge ${s.cls}`}>{s.label}</span>;
}

// ─ Trạng thái chung của một danh sách Ba màn hình đều tải bất đồng bộ và đều có bốn trạng thái giống nhau (đang tải / lỗi / rỗng / có dữ liệu).
function ListState({ loading, error, empty, emptyIcon: EmptyIcon = CheckCircle, emptyText }) {
  if (loading) return (
    <div className="sd-list-state">
      <Loader2 size={15} className="sd-spin" /> Đang tải…
    </div>
  );
  if (error) return (
    <div className="sd-list-state error">
      <AlertCircle size={15} /> {error}
    </div>
  );
  if (empty) return (
    <div className="sd-list-state">
      <EmptyIcon size={15} /> {emptyText}
    </div>
  );
  return null;
}

// ─ Một dòng đề thi Dùng ở cả ba màn hình (trang chủ, đề của lớp, đề tự do) nên phải là một component thật.
function ExamRow({ exam, onEnter, onRanking }) {
  const av = AVAILABILITY[exam.availability] || AVAILABILITY.SUBMITTED;
  const look = SUBJECT_ICON[exam.subjectName] || DEFAULT_ICON;
  const navigate = useNavigate();
  const attempts = attemptLabel(exam);
  // Có bài đã nộp thì luôn xem lại được, kể cả khi đề đã đóng hoặc hết lượt.
  const reviewable = exam.submissionId != null && exam.availability !== 'IN_PROGRESS';

  return (
    <div className="sd-exam-card">
      <div className="sd-exam-icon-wrap" style={{ background: look.bg }}>
        {look.icon}
      </div>
      <div className="sd-exam-body">
        <p className="sd-exam-name">{exam.title}</p>
        <div className="sd-exam-meta">
          <span><BookOpen size={11} />{exam.subjectName || 'Chưa gán môn'}</span>
          <span><Clock size={11} />{exam.durationMinutes} phút</span>
          <span style={{ color: 'var(--ink-mute)' }}>{exam.totalQuestions} câu</span>
          {exam.levelName && <span style={{ color: 'var(--ink-mute)' }}>{exam.levelName}</span>}
          {exam.teacherName && <span style={{ color: 'var(--ink-mute)' }}>Người ra đề: {exam.teacherName}</span>}
        </div>
        <div style={{ marginTop: 8 }}>
          <StatusBadge availability={exam.availability} />
          {/* Server nói thẳng đề đến từ đâu qua `source` thay vì để client đoán. */}
          {exam.source === 'ROOM' ? (
            <span style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginLeft: 10 }}>
              {roomTimeLabel(exam)}
            </span>
          ) : (
            <span style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginLeft: 10 }}>
              Luyện tập tự do
            </span>
          )}
          {/* Điểm của lượt gần nhất — hiện cho cả đề còn làm lại được, vì đó
              chính là con số thí sinh muốn cải thiện. */}
          {exam.totalScore != null && exam.availability !== 'IN_PROGRESS' && (
            <span style={{ fontSize: 11.5, color: 'var(--jade)', marginLeft: 10, fontWeight: 700 }}>
              <Star size={10} style={{ verticalAlign: -1 }} /> {exam.totalScore} điểm
            </span>
          )}
          {attempts && (
            <span style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginLeft: 10 }}>
              <RotateCcw size={10} style={{ verticalAlign: -1 }} /> {attempts}
            </span>
          )}
        </div>
      </div>
      <div className="sd-exam-action">
        {/* Đề tự do đã làm: xem mình đứng đâu so với những người đã làm đề này. */}
        {onRanking && exam.source === 'PRACTICE' && reviewable && (
          <button className="sd-btn-ghost" onClick={() => onRanking(exam)}>
            <Trophy size={13} /> Xếp hạng
          </button>
        )}
        {reviewable && (
          <button
            className="sd-btn-ghost"
            onClick={() => navigate(`/student/submissions/${exam.submissionId}/review`)}
          >
            <Eye size={13} /> Xem lại bài
          </button>
        )}
        {av.enter ? (
          <button className="sd-btn-primary" onClick={() => onEnter(exam.examId)}>
            <Play size={13} /> {av.action}
          </button>
        ) : (
          // Đã có nút "Xem lại bài" thì thôi nút xám vô dụng bên cạnh.
          !reviewable && (
            <button className="sd-btn-ghost" disabled>
              <Clock size={13} /> {av.action}
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ─── Thanh phân trang ──────────────────────────────────────────
function Pager({ page, totalPages, totalElements, onChange }) {
  if (totalPages <= 1) return null;

  // Cửa sổ tối đa 5 số quanh trang hiện tại.
  const windowSize = 5;
  let from = Math.max(0, page - Math.floor(windowSize / 2));
  const to = Math.min(totalPages, from + windowSize);
  from = Math.max(0, to - windowSize);
  const pages = [];
  for (let i = from; i < to; i += 1) pages.push(i);

  return (
    <div className="sd-pager">
      <span className="sd-pager-info">
        Trang {page + 1}/{totalPages} · {totalElements} đề
      </span>
      <div className="sd-pager-controls">
        <button
          className="sd-pager-btn"
          onClick={() => onChange(page - 1)}
          disabled={page === 0}
          aria-label="Trang trước"
        >
          <ChevronLeft size={14} />
        </button>

        {from > 0 && <span className="sd-pager-gap">…</span>}

        {pages.map((p) => (
          <button
            key={p}
            className={`sd-pager-btn ${p === page ? 'active' : ''}`}
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
          >
            {p + 1}
          </button>
        ))}

        {to < totalPages && <span className="sd-pager-gap">…</span>}

        <button
          className="sd-pager-btn"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages - 1}
          aria-label="Trang sau"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Đề tự do: chọn trình độ rồi duyệt theo trang ──────────────
function PracticeExams({ onEnter, onRanking }) {
  // undefined = chưa chọn gì, để server tự chọn trình độ theo lớp đang học.
  const [levelId, setLevelId] = useState(undefined);
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    getPracticeExams({
      levelId: levelId === undefined ? null : levelId,
      allLevels: levelId === null,
      page,
      size: PRACTICE_PAGE_SIZE,
    })
      .then((res) => {
        if (!alive) return;
        setData(res);
        // Lần đầu vào trang, server chọn hộ một trình độ.
        if (levelId === undefined && res.filteredByEnrolledLevels) {
          setLevelId(res.appliedLevelId);
        }
      })
      .catch((err) => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [levelId, page]);

  const selectLevel = (value) => {
    setLevelId(value);
    setPage(0);   // đổi bộ lọc thì phải về trang đầu, nếu không dễ rơi vào trang trống
  };

  const levels = data?.levels || [];
  const exams = data?.exams || [];

  return (
    <div>
      <div className="sd-card" style={{ marginBottom: 20 }}>
        <div className="sd-card-header">
          <h2>🧭 Đề luyện tập tự do</h2>
          <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
            {loading ? 'đang tải…' : `${data?.totalElements ?? 0} đề`}
          </span>
        </div>

        <div className="sd-filter-bar">
          <p className="sd-filter-label">Chọn trình độ bạn muốn ôn</p>
          <div className="sd-chips">
            <button
              className={`sd-chip ${levelId === null ? 'active' : ''}`}
              onClick={() => selectLevel(null)}
            >
              Tất cả trình độ
            </button>
            {levels.map((lv) => (
              <button
                key={lv.levelId}
                className={`sd-chip ${levelId === lv.levelId ? 'active' : ''}`}
                onClick={() => selectLevel(lv.levelId)}
                title={lv.subjectName || ''}
              >
                {lv.enrolled && <span className="sd-chip-dot" title="Trình độ bạn đang học" />}
                {lv.levelName}
                <span className="sd-chip-count">{lv.examCount}</span>
              </button>
            ))}
            {!loading && levels.length === 0 && (
              <span style={{ fontSize: 12.5, color: 'var(--ink-mute)' }}>
                Chưa có đề luyện tập nào trong hệ thống.
              </span>
            )}
          </div>

          {data?.filteredByEnrolledLevels && (
            <p className="sd-filter-note">
              Đang hiển thị theo trình độ bạn đang học.{' '}
              <button className="sd-link-btn" onClick={() => selectLevel(null)}>
                Xem tất cả trình độ
              </button>
            </p>
          )}
        </div>

        <div className="sd-exam-list">
          <ListState
            loading={loading}
            error={error}
            empty={exams.length === 0}
            emptyText="Không có đề luyện tập nào ở trình độ này."
          />
          {!loading && !error && exams.map((exam) => (
            <ExamRow key={exam.examId} exam={exam} onEnter={onEnter} onRanking={onRanking} />
          ))}
        </div>

        {!loading && !error && (
          <Pager
            page={data?.page ?? 0}
            totalPages={data?.totalPages ?? 0}
            totalElements={data?.totalElements ?? 0}
            onChange={setPage}
          />
        )}
      </div>
    </div>
  );
}

// ─── Bài được giao: nhóm theo phòng thi ────────────────────────
function ExamBoard({ board, loading, error, onEnter, onGoPractice }) {
  const groups = board?.rooms || [];
  const practice = board?.practice || [];

  return (
    <>
      {(loading || error) && (
        <div className="sd-card" style={{ marginBottom: 20 }}>
          <div className="sd-exam-list">
            <ListState loading={loading} error={error} empty={false} />
          </div>
        </div>
      )}

      {!loading && !error && groups.length === 0 && (
        <div className="sd-card" style={{ marginBottom: 20 }}>
          <div className="sd-exam-list">
            <div className="sd-list-state">
              <School size={15} /> Bạn chưa vào phòng thi nào, nên chưa có bài thi nào được giao.
            </div>
          </div>
        </div>
      )}

      {!loading && !error && groups.map((group) => (
        <div key={group.roomId} className="sd-card" style={{ marginBottom: 20 }}>
          <div className="sd-card-header">
            <h2>
              {group.roomName}
              {group.pendingCount > 0 && (
                <span className="sd-count-pill">{group.pendingCount} cần làm</span>
              )}
              {group.phase === 'WAITING' && <span className="sd-tag phase-waiting" style={{ marginLeft: 8 }}>Sảnh chờ</span>}
              {group.phase === 'IN_PROGRESS' && <span className="sd-tag phase-live" style={{ marginLeft: 8 }}>Đang thi</span>}
              {group.phase === 'ENDED' && <span className="sd-tag phase-ended" style={{ marginLeft: 8 }}>Đã kết thúc</span>}
            </h2>
            <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
              {[group.subjectName, group.levelName].filter(Boolean).join(' · ') || '—'}
            </span>
          </div>
          <div className="sd-exam-list">
            {group.exams.length === 0 ? (
              <div className="sd-list-state">
                <CheckCircle size={15} /> Phòng này chưa có bài thi nào.
              </div>
            ) : (
              group.exams.map((exam) => (
                <ExamRow key={exam.examId} exam={exam} onEnter={onEnter} />
              ))
            )}
          </div>
        </div>
      ))}

      {!loading && !error && practice.length > 0 && (
        <div className="sd-card">
          <div className="sd-card-header">
            <h2>🧭 Gợi ý luyện tập</h2>
            <button className="sd-link-btn" onClick={onGoPractice}>
              Xem tất cả đề tự do <ChevronRight size={12} style={{ verticalAlign: -2 }} />
            </button>
          </div>
          <div className="sd-exam-list">
            {practice.map((exam) => (
              <ExamRow key={exam.examId} exam={exam} onEnter={onEnter} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main Component ────────────────────────────────────────────
export default function StudentDashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  // Link trong thông báo trỏ tới /student/exams?tab=… (vd "phòng vừa bắt đầu" → tab Phòng thi).
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id));
  const [activeNav, setActiveNav] = useState(() => {
    const tab = searchParams.get('tab');
    return validTabs.includes(tab) ? tab : 'exams';
  });
  // Mã phòng từ link mời.
  const [inviteCode, setInviteCode] = useState(() => searchParams.get('code'));
  // Bộ thẻ mở từ chặng lộ trình.
  const [deckParam, setDeckParam] = useState(() => searchParams.get('deck'));
  useEffect(() => {
    const tab = searchParams.get('tab');
    const code = searchParams.get('code');
    if (code) setInviteCode(code);
    const deck = searchParams.get('deck');
    if (deck) setDeckParam(deck);
    if (tab && validTabs.includes(tab)) {
      setActiveNav(tab);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [board, setBoard] = useState(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const [boardError, setBoardError] = useState(null);
  const [studyStats, setStudyStats] = useState(null);
  // Dữ liệu cho hai khối cuối trang tổng quan: điểm gần đây và tiến độ lộ trình.
  const [recentResults, setRecentResults] = useState(null);
  const [myPaths, setMyPaths] = useState(null);

  // Thí sinh tắt trình duyệt giữa bài rồi mở lại trong giờ, nhưng về đây chứ không vào lại phòng.
  useEffect(() => { pushLeftoverDrafts(); }, []);

  useEffect(() => {
    let alive = true;
    getExamBoard()
      .then((data) => { if (alive) setBoard(data); })
      .catch((err) => { if (alive) setBoardError(err.message); })
      .finally(() => { if (alive) setBoardLoading(false); });
    return () => { alive = false; };
  }, []);

  // Số liệu học tập nuôi huy hiệu trên thanh điều hướng và bảng "học hôm nay".
  useEffect(() => {
    let alive = true;
    getStudyStats()
      .then((data) => { if (alive) setStudyStats(data); })
      .catch(() => { /* không có huy hiệu thì thôi, không làm phiền người dùng */ });
    return () => { alive = false; };
  }, [activeNav]);

  // Điểm gần đây và tiến độ lộ trình.
  useEffect(() => {
    let alive = true;
    getStudentResults()
      .then((list) => { if (alive) setRecentResults(list ?? []); })
      .catch(() => { if (alive) setRecentResults([]); });
    courseService.getEnrolled()
      .then((list) => { if (alive) setMyPaths(list ?? []); })
      .catch(() => { if (alive) setMyPaths([]); });
    return () => { alive = false; };
  }, []);

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  /** Vào phòng thi. Server lo phần "vào mới" hay "vào lại phiên đang dở". */
  const enterExam = (examId) => navigate(`/student/exams/${examId}/room`);

  // Nút "Xếp hạng" trên một đề tự do mở thẳng bảng của đề đó ở mục Bảng xếp hạng.
  const [rankingTarget, setRankingTarget] = useState(null);
  const openRanking = (exam) => {
    setRankingTarget({ type: 'EXAM', id: exam.examId });
    setActiveNav('ranking');
  };

  const userName = currentUser?.fullName || currentUser?.email || 'Học viên';
  const initials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  // Server đã đếm sẵn số đề còn phải làm ở mọi phòng thi của thí sinh.
  const pendingCount = board?.pendingCount ?? 0;


  const stats = [
    { icon: '📝', label: 'Đề thi cần làm',   value: pendingCount, sub: 'Từ các phòng thi của bạn', color: 'rgba(47, 143, 111,0.12)' },
    // Hai ô này lấy số thật từ /study/stats, thay cho điểm trung bình dựng sẵn hồi trước.
    { icon: '🃏', label: 'Thẻ cần ôn',      value: studyStats?.cardsDue ?? 0, sub: 'Đến hạn hôm nay', color: 'rgba(61, 126, 166,0.12)' },
    { icon: '📌', label: 'Câu sai cần sửa', value: studyStats?.mistakesOpen ?? 0, sub: 'Trong sổ tay câu sai', color: 'rgba(201, 146, 46,0.12)' },
    { icon: '🎓', label: 'Từ đã thuộc',     value: studyStats?.cardsMature ?? 0, sub: `Trên ${studyStats?.cardsTotal ?? 0} thẻ đang học`, color: 'rgba(124, 92, 191,0.12)' },
  ];

  const showDashboardChrome = activeNav === 'home' || activeNav === 'exams';

  return (
    <div className="sd-root">
      {/* ── SIDEBAR ── */}
      <aside className="sd-sidebar">
        <div className="sd-logo">
          {/* Tên thương hiệu mang chất tiên hiệp. */}
          <h2>⛩️ Tàng Thư Các</h2>
          <p>Cổng học viên</p>
        </div>

        <nav className="sd-nav">
          {NAV_GROUPS.map(group => (
            <React.Fragment key={group.label}>
              <div className="sd-nav-label">{group.label}</div>
              {group.items.map(item => {
                const Icon = item.icon;
                // Mọi huy hiệu đều lấy từ số thật server đếm, không phải số cứng.
                const badge =
                  item.id === 'exams' && pendingCount > 0 ? pendingCount :
                  item.id === 'mistakes' && studyStats?.mistakesDue > 0 ? studyStats.mistakesDue :
                  item.id === 'flashcards' && studyStats?.cardsDue > 0 ? studyStats.cardsDue :
                  null;
                return (
                  <button
                    key={item.id}
                    className={`sd-nav-item ${activeNav === item.id ? 'active' : ''}`}
                    onClick={() => setActiveNav(item.id)}
                  >
                    <Icon size={16} />
                    {item.label}
                    {badge && <span className="sd-nav-badge">{badge}</span>}
                    {activeNav === item.id && <ChevronRight size={13} style={{ marginLeft: 'auto' }} />}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </nav>

        <div className="sd-footer">
          <div className="sd-user-card" onClick={handleLogout} title="Đăng xuất">
            <div className="sd-avatar">{initials}</div>
            <div className="sd-user-info">
              <p className="sd-user-name">{userName}</p>
              <p className="sd-user-role">Học viên · Đăng xuất</p>
            </div>
            <LogOut size={14} style={{ color: 'var(--ink-mute)', flexShrink: 0 }} />
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="sd-main">
        {/* Topbar */}
        <header className="sd-topbar">
          <div className="sd-topbar-left">
            <h1>Trang học của tôi</h1>
            <p>Xin chào, {userName.split(' ').slice(-1)[0]}! Hãy cố gắng lên nhé 💪</p>
          </div>
          <div className="sd-topbar-right">
            <SearchBox onOpenExam={enterExam} onOpenCourse={() => setActiveNav('courses')} />
            <NotificationBell buttonClass="sd-icon-btn" />
          </div>
        </header>

        <div className="sd-content">
          {activeNav === 'rooms' && <StudentRooms onEnterExam={enterExam} inviteCode={inviteCode} />}

          {activeNav === 'practice' && <PracticeExams onEnter={enterExam} onRanking={openRanking} />}

          {activeNav === 'courses' && <Courses />}

          {activeNav === 'flashcards' && <Flashcards initialDeckId={deckParam} />}

          {activeNav === 'mistakes' && <MistakeBook />}

          {showDashboardChrome && (
          <>
          {/* Welcome Banner */}
          <div className="sd-welcome-banner">
            <div>
              <p className="sd-welcome-title">
                Chào mừng trở lại, <span>{userName.split(' ').slice(-1)[0]}</span>! 🎉
              </p>
              <p className="sd-welcome-sub">
                Bạn có <strong style={{ color: 'var(--ink)' }}>{pendingCount} đề thi cần làm</strong>. Đừng bỏ lỡ nhé!
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="sd-stats-row">
            {stats.map((s, i) => (
              <div key={i} className="sd-stat-card">
                <span className="sd-stat-icon"
                  style={{ display: 'inline-flex', width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', background: s.color, fontSize: 20, marginBottom: 10 }}>
                  {s.icon}
                </span>
                <p className="sd-stat-label">{s.label}</p>
                <p className="sd-stat-value">{s.value}</p>
                <p className="sd-stat-sub">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Main Grid */}
          <div className="sd-main-grid">
            {/* Đề thi, nhóm theo lớp */}
            <div>
              <ExamBoard
                board={board}
                loading={boardLoading}
                error={boardError}
                onEnter={enterExam}
                onGoPractice={() => setActiveNav('practice')}
              />

              {/* Gợi ý ôn theo điểm yếu + bài xếp trình độ. Tự ẩn khi chưa có dữ liệu. */}
              <InsightsCard onEnterExam={enterExam} />

              {/* Tiến độ lộ trình đang theo. */}
              <div className="sd-card" style={{ marginTop: 20 }}>
                <div className="sd-card-header">
                  <h2>📈 Tiến độ lộ trình</h2>
                  {myPaths?.length > 0 && (
                    <button className="sd-btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }}
                            onClick={() => setActiveNav('courses')}>
                      Mở lộ trình
                    </button>
                  )}
                </div>
                <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {myPaths == null && (
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)' }}>Đang tải…</p>
                  )}
                  {myPaths?.length === 0 && (
                    <>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                        Bạn chưa theo lộ trình ôn tập nào. Chọn một lộ trình để học đúng
                        thứ tự và biết mình đã đi được tới đâu.
                      </p>
                      <button className="sd-btn-primary" onClick={() => setActiveNav('courses')}>
                        <GraduationCap size={14} /> Chọn lộ trình
                      </button>
                    </>
                  )}
                  {myPaths?.slice(0, 4).map((path, i) => {
                    const percent = Math.max(0, Math.min(100, Math.round(Number(path.progressPercent) || 0)));
                    const color = PATH_COLORS[i % PATH_COLORS.length];
                    return (
                      <div key={path.courseId}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{path.title}</span>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color, flexShrink: 0 }}>{percent}%</span>
                        </div>
                        <div className="sd-progress-bar-track">
                          <div
                            className="sd-progress-bar-fill"
                            style={{ width: `${percent}%`, background: `linear-gradient(90deg, ${color}, ${color}88)` }}
                          />
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--ink-faint)' }}>
                          {path.completedLessons ?? 0}/{path.totalLessons ?? 0} bài đã xong
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Điểm gần đây — lấy từ chính lịch sử bài đã nộp. */}
              <div className="sd-card">
                <div className="sd-card-header">
                  <h2>🏅 Điểm gần đây</h2>
                  {recentResults?.length > 0 && (
                    <button className="sd-btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }}
                            onClick={() => setActiveNav('history')}>
                      Xem tất cả
                    </button>
                  )}
                </div>
                <div>
                  {recentResults == null && (
                    <p style={{ margin: 0, padding: '16px 22px', fontSize: 13, color: 'var(--ink-faint)' }}>Đang tải…</p>
                  )}
                  {recentResults?.length === 0 && (
                    <p style={{ margin: 0, padding: '16px 22px', fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                      Bạn chưa nộp bài nào. Điểm sẽ hiện ở đây ngay sau bài thi đầu tiên.
                    </p>
                  )}
                  {recentResults?.slice(0, 5).map((r) => {
                    const percent = percentOf(r);
                    const grade = gradeOf(percent);
                    const gc = GRADE_COLOR[grade] || GRADE_COLOR['B'];
                    return (
                      <div key={r.submissionId} className="sd-score-row">
                        <div className="sd-score-circle" style={{ background: gc.bg, color: gc.fg }}>
                          {grade}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.examTitle}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--ink-faint)' }}>
                            {/* Bài còn câu chờ chấm tay thì nói rõ, đừng để thí sinh
                                tưởng con số kia đã là điểm cuối. */}
                            {formatDeadline(r.submittedAt)}
                            {r.awaitingManualGrading ? ' · đang chờ chấm' : ''}
                          </p>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 800, color: gc.fg, flexShrink: 0 }}>
                          {percent == null ? '—' : `${percent}%`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Lối vào bảng xếp hạng thật. */}
              <div className="sd-card">
                <div className="sd-card-header">
                  <h2>🏆 Bảng xếp hạng</h2>
                </div>
                <div style={{ padding: '14px 22px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                    Xem mình đứng đâu trong phòng thi đã kết thúc, hoặc giữa những người
                    đã làm cùng một đề tự do.
                  </p>
                  <button className="sd-btn-primary" onClick={() => setActiveNav('ranking')}>
                    <Trophy size={14} /> Xem bảng xếp hạng
                  </button>
                </div>
              </div>
            </div>
          </div>
          </>
          )}

          {activeNav === 'history' && <ResultHistory />}

          {activeNav === 'bookmarks' && <Bookmarks />}

          {/* key đổi theo mục mở sẵn: bấm "Xếp hạng" ở đề khác thì trang dựng lại
              và mở đúng đề đó, không giữ lựa chọn cũ. */}
          {activeNav === 'ranking' && (
            <Rankings key={rankingTarget ? `${rankingTarget.type}${rankingTarget.id}` : 'default'}
                      initial={rankingTarget} />
          )}
        </div>
      </main>
    </div>
  );
}
