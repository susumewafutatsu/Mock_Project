import React, { useEffect, useState, useCallback } from 'react';
import {
  LayoutDashboard, BookOpen, ClipboardList, BarChart2, Trophy,
  Bell, LogOut, ChevronRight, ChevronLeft, Clock, Play, CheckCircle,
  AlertCircle, Search, Star, Loader2, School, Users, GraduationCap,
  Compass, ArrowLeft, Eye, RotateCcw, BookMarked, Layers, KeyRound, DoorOpen,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { getExamBoard, getRoomExams, getPracticeExams } from '../../services/examService';
import roomService from '../../services/roomService';
import ResultHistory from './ResultHistory';
import MistakeBook from './MistakeBook';
import Flashcards from './Flashcards';
import Courses from './Courses';
import { getStudyStats } from '../../services/studyService';
import './StudentDashboard.css';

// ─── Trạng thái đề thi ─────────────────────────────────────────
// Server đã tính sẵn `availability` cho từng đề (xem ExamResponse.Availability),
// client chỉ tra bảng này chứ không tự so lại startTime/endTime — hai bên so giờ
// riêng là cách chắc chắn nhất để lệch nhau.
const AVAILABILITY = {
  OPEN:         { label: 'Đang mở',      cls: 'open',     action: 'Làm bài',      enter: true },
  IN_PROGRESS:  { label: 'Đang làm dở',  cls: 'open',     action: 'Tiếp tục',     enter: true },
  UPCOMING:     { label: 'Sắp diễn ra',  cls: 'upcoming', action: 'Chưa mở',      enter: false },
  // Đã nộp nhưng còn lượt: vào phòng thi lần nữa là mở lượt mới, không phải
  // "vào lại" — server tự quyết định điều đó, client vẫn gọi đúng /start.
  RETAKEABLE:   { label: 'Làm lại được', cls: 'open',     action: 'Làm lại',      enter: true },
  SUBMITTED:    { label: 'Đã làm',       cls: 'done',     action: 'Đã nộp',       enter: false },
  CLOSED:       { label: 'Đã hết hạn',   cls: 'missed',   action: 'Đã đóng',      enter: false },
  NO_QUESTIONS: { label: 'Chưa có câu hỏi', cls: 'missed', action: 'Chưa có câu', enter: false },
};

/**
 * "Lần 2/3", "Đã làm 4 lần" — mô tả tình trạng lượt của thí sinh trên một đề.
 *
 * Trả về null khi chưa làm lần nào VÀ đề không giới hạn: lúc đó không có gì
 * đáng nói, thêm chữ chỉ làm rối thẻ đề.
 */
function attemptLabel(exam) {
  const used = exam.attemptsUsed ?? 0;
  if (exam.maxAttempts == null) {
    return used === 0 ? null : `Đã làm ${used} lần`;
  }
  // `used` đã tính cả lượt đang làm dở, nên khi đang thi thì chính nó là số thứ
  // tự của lượt hiện tại — "Lượt 2/3" chứ không phải "đã dùng 2/3".
  if (exam.availability === 'IN_PROGRESS') {
    return `Lượt ${used}/${exam.maxAttempts}`;
  }
  if (used >= exam.maxAttempts) {
    return `Đã dùng hết ${exam.maxAttempts} lượt`;
  }
  return `Đã dùng ${used}/${exam.maxAttempts} lượt`;
}

const SUBJECT_ICON = {
  'Toán học': { icon: '📐', bg: 'rgba(124, 92, 191,0.15)' },
  'Tiếng Nhật': { icon: '🇯🇵', bg: 'rgba(201, 146, 46,0.15)' },
  'Tiếng Anh': { icon: '📖', bg: 'rgba(61, 126, 166,0.15)' },
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

// Đề thi lấy thật từ API. Các panel điểm / xếp hạng bên dưới vẫn là mock vì
// endpoint tương ứng chưa có.
const MOCK_RESULTS = [
  { id: 1, name: 'Từ vựng N4 – Tuần 8',        subject: 'Tiếng Nhật', score: 90, total: 100, date: '22/08', grade: 'A' },
  { id: 2, name: 'Toán – Bất phương trình bậc 2', subject: 'Toán học',   score: 76, total: 100, date: '18/08', grade: 'B' },
  { id: 3, name: 'Reading – Practice Test 3',    subject: 'Tiếng Anh', score: 82, total: 100, date: '14/08', grade: 'B+' },
  { id: 4, name: 'Hán tự N4 – Bộ 1',            subject: 'Tiếng Nhật', score: 95, total: 100, date: '10/08', grade: 'A' },
];

// Hai nhóm chức năng tách biệt: HỌC và THI.
//
// Xếp phần học lên trên phần thi là có chủ đích. Người dùng mở app này gần như
// mỗi ngày để ôn, còn thi thì thỉnh thoảng mới có — đặt thứ dùng hằng ngày
// xuống dưới cùng là bắt họ lướt qua những thứ hôm nay không dùng tới.
const NAV_GROUPS = [
  {
    label: 'Học mỗi ngày',
    items: [
      { id: 'courses',    label: 'Khoá học',      icon: GraduationCap },
      { id: 'flashcards', label: 'Thẻ ghi nhớ',    icon: Layers },
      { id: 'mistakes',   label: 'Sổ tay câu sai', icon: BookMarked },
    ],
  },
  {
    label: 'Thi cử',
    items: [
      { id: 'home',     label: 'Tổng quan',       icon: LayoutDashboard },
      { id: 'exams',    label: 'Đề thi của tôi',  icon: ClipboardList },
      { id: 'practice', label: 'Đề tự do',        icon: Compass },
      { id: 'rooms',    label: 'Phòng thi của tôi', icon: School },
      { id: 'history',  label: 'Lịch sử điểm',    icon: BarChart2 },
      { id: 'ranking',  label: 'Bảng xếp hạng',   icon: Trophy },
    ],
  },
];

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

// ─── Trạng thái chung của một danh sách ────────────────────────
// Ba màn hình đều tải bất đồng bộ và đều có bốn trạng thái giống nhau
// (đang tải / lỗi / rỗng / có dữ liệu). Gom vào một chỗ để chúng không
// trôi dần thành ba cách hiển thị khác nhau.
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

// ─── Một dòng đề thi ───────────────────────────────────────────
// Dùng ở cả ba màn hình (trang chủ, đề của lớp, đề tự do) nên phải là một
// component thật, không phải JSX chép lại ba lần.
function ExamRow({ exam, onEnter }) {
  const av = AVAILABILITY[exam.availability] || AVAILABILITY.SUBMITTED;
  const look = SUBJECT_ICON[exam.subjectName] || DEFAULT_ICON;
  const navigate = useNavigate();
  const attempts = attemptLabel(exam);
  // Có bài đã nộp thì luôn xem lại được, kể cả khi đề đã đóng hoặc hết lượt.
  // Xem lại bài của chính mình không phụ thuộc vào việc còn được thi hay không.
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
          {exam.teacherName && <span style={{ color: 'var(--ink-mute)' }}>GV: {exam.teacherName}</span>}
          {/* Chỉ hiện tên lớp khi đề đến từ lớp. Đề tự do không thuộc lớp nào,
              và server nói thẳng điều đó qua `source` thay vì để client đoán. */}
          {exam.source === 'CLASS' && exam.className && (
            <span style={{ color: 'var(--ink-mute)' }}>{exam.className}</span>
          )}
        </div>
        <div style={{ marginTop: 8 }}>
          <StatusBadge availability={exam.availability} />
          {exam.source === 'CLASS' ? (
            <span style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginLeft: 10 }}>
              Hạn: {formatDeadline(exam.endTime)}
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
          // Đã có nút "Xem lại bài" thì thôi nút xám vô dụng bên cạnh: nó chỉ
          // lặp lại thông tin mà tấm badge trạng thái ở trên đã nói.
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

  // Cửa sổ tối đa 5 số quanh trang hiện tại — danh sách đề có thể lên tới hàng
  // chục trang, in hết số ra thì thanh phân trang dài hơn cả nội dung.
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
function PracticeExams({ onEnter }) {
  // undefined = chưa chọn gì, để server tự chọn trình độ theo lớp đang học.
  // null      = thí sinh chủ động bấm "Tất cả trình độ".
  // số        = một trình độ cụ thể.
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
        // Lần đầu vào trang, server chọn hộ một trình độ. Ghi lại lựa chọn đó
        // để thanh chip sáng đúng ô, và để lần bấm chuyển trang sau không bị
        // server chọn lại từ đầu.
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
            <ExamRow key={exam.examId} exam={exam} onEnter={onEnter} />
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

// ─── Bài thi của một phòng (mở ra khi bấm vào thẻ phòng) ───────
function RoomExams({ roomInfo, onBack, onEnter }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    getRoomExams(roomInfo.roomId)
      .then((data) => { if (alive) setExams(data || []); })
      .catch((err) => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [roomInfo.roomId]);

  return (
    <div>
      <button className="sd-back-btn" onClick={onBack}>
        <ArrowLeft size={14} /> Tất cả phòng thi
      </button>

      <div className="sd-class-hero">
        <div className="sd-class-hero-icon">
          <School size={22} color="var(--jade)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="sd-class-hero-name">{roomInfo.name}</h2>
          <div className="sd-class-hero-tags">
            {roomInfo.subjectName && <span className="sd-tag subject">{roomInfo.subjectName}</span>}
            {roomInfo.levelName && <span className="sd-tag level">{roomInfo.levelName}</span>}
            {roomInfo.mySeatNo != null && (
              <span style={{ fontSize: 12.5, color: 'var(--ink-mute)' }}>
                Ghế số {roomInfo.mySeatNo}
              </span>
            )}
            {roomInfo.ownerName && (
              <span style={{ fontSize: 12.5, color: 'var(--ink-mute)' }}>
                Chủ phòng: {roomInfo.ownerName}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="sd-card">
        <div className="sd-card-header">
          <h2>📋 Bài thi trong phòng</h2>
          <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
            {loading ? 'đang tải…' : `${exams.length} bài thi`}
          </span>
        </div>
        <div className="sd-exam-list">
          <ListState
            loading={loading}
            error={error}
            empty={exams.length === 0}
            emptyText="Phòng này chưa có bài thi nào."
          />
          {!loading && !error && exams.map((exam) => (
            <ExamRow key={exam.examId} exam={exam} onEnter={onEnter} />
          ))}
        </div>
      </div>
    </div>
  );
}
// ─── Phòng thi của tôi ─────────────────────────────────────────
//
// Thay cho panel "Lớp học của tôi". Khác biệt lớn nhất về thao tác: thí sinh
// TỰ vào phòng bằng mã, không chờ ai thêm mình vào. Vì thế ô nhập mã nằm ngay
// trên đầu chứ không giấu sau một nút phụ — với người chưa vào phòng nào thì
// đó là việc duy nhất họ cần làm ở màn hình này.
function StudentRooms({ onEnterExam }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openRoom, setOpenRoom] = useState(null);

  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [joinOk, setJoinOk] = useState(null);

  const loadRooms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setRooms(await roomService.getJoinedRooms());
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách phòng thi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  const join = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setJoining(true);
    setJoinError(null);
    setJoinOk(null);
    try {
      const room = await roomService.joinByCode(code.trim().toUpperCase());
      setJoinOk(`Đã vào phòng "${room.name}" — ghế số ${room.mySeatNo}`);
      setCode('');
      await loadRooms();
    } catch (err) {
      // Phòng hết chỗ trả về 409 kèm câu thông báo của server. Đó không phải
      // lỗi hệ thống mà là câu trả lời đúng cho "ai nhanh thì vào", nên hiện
      // nguyên văn thay vì thay bằng một câu chung chung.
      setJoinError(err.message);
    } finally {
      setJoining(false);
    }
  };

  if (openRoom) {
    return (
      <RoomExams
        roomInfo={openRoom}
        onBack={() => { setOpenRoom(null); loadRooms(); }}
        onEnter={onEnterExam}
      />
    );
  }

  const joinBox = (
    <form onSubmit={join} className="sd-card" style={{ marginBottom: 20, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <KeyRound size={16} color="var(--jade)" />
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
            Vào phòng bằng mã
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--ink-faint)' }}>
            Người ra đề sẽ đọc mã phòng cho bạn. Phòng có giới hạn chỗ thì ai vào trước ngồi trước.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="VD: 49F7JW"
          maxLength={20}
          autoComplete="off"
          style={{
            flex: '1 1 200px', minWidth: 0,
            padding: '10px 14px', borderRadius: 10,
            border: '1px solid var(--line-strong)', background: 'var(--paper)',
            fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700,
            letterSpacing: '0.14em', color: 'var(--ink)',
          }}
        />
        <button
          type="submit"
          className="sd-primary-btn"
          disabled={joining || !code.trim()}
          style={{ flexShrink: 0 }}
        >
          {joining ? <><Loader2 size={14} style={{ animation: 'sd-spin 1s linear infinite' }} /> Đang vào…</>
                   : <><DoorOpen size={14} /> Vào phòng</>}
        </button>
      </div>

      {joinError && (
        <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--cinnabar)' }}>
          <AlertCircle size={13} style={{ verticalAlign: -2 }} /> {joinError}
        </p>
      )}
      {joinOk && (
        <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--jade)' }}>
          <CheckCircle size={13} style={{ verticalAlign: -2 }} /> {joinOk}
        </p>
      )}
    </form>
  );

  if (loading) return (
    <div>
      {joinBox}
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>
        <Loader2 size={28} style={{ animation: 'sd-spin 1s linear infinite', marginBottom: 12 }} />
        <p style={{ margin: 0, fontSize: 13.5 }}>Đang tải phòng thi…</p>
      </div>
    </div>
  );

  return (
    <div>
      {joinBox}

      {error && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--cinnabar)' }}>
          <AlertCircle size={24} style={{ marginBottom: 8 }} />
          <p style={{ margin: 0, fontSize: 13.5 }}>{error}</p>
        </div>
      )}

      {!error && rooms.length === 0 && (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-mute)' }}>
          <School size={44} style={{ opacity: 0.3, marginBottom: 14 }} />
          <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: 'var(--ink-faint)' }}>
            Bạn chưa ở trong phòng thi nào
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-soft)' }}>
            Nhập mã phòng ở trên để vào, hoặc sang mục <strong>Đề tự do</strong> để
            tự luyện mà không cần phòng nào cả.
          </p>
        </div>
      )}

      {!error && rooms.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px,1fr))', gap: 16 }}>
          {rooms.map((room) => {
            const full = room.capacity != null && room.seatsLeft === 0;
            return (
              <button
                key={room.roomId}
                type="button"
                className="sd-card sd-class-card"
                onClick={() => setOpenRoom(room)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: 'rgba(47, 143, 111,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <School size={20} color="var(--jade)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.3 }}>
                      {room.name}
                    </p>
                    {room.code && (
                      <p style={{ margin: '3px 0 0', fontSize: 11.5, color: 'var(--ink-mute)', fontFamily: 'var(--mono)', letterSpacing: '0.1em' }}>
                        {room.code}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {room.subjectName && <span className="sd-tag subject">{room.subjectName}</span>}
                  {room.levelName && <span className="sd-tag level">{room.levelName}</span>}
                  {room.status === 'RUNNING' && <span className="sd-tag level">Đang thi</span>}
                  {room.status === 'CLOSED' && <span className="sd-tag">Đã đóng</span>}
                </div>

                {room.ownerName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 9, background: 'rgba(43, 38, 32, 0.05)' }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: 'linear-gradient(135deg,var(--violet),var(--azure))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 800, color: 'var(--on-accent)', flexShrink: 0,
                    }}>
                      {room.ownerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-soft)' }}>
                        {room.ownerName}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-mute)' }}>Người ra đề</p>
                    </div>
                  </div>
                )}

                <div className="sd-class-card-foot">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--ink-mute)' }}>
                    <Users size={13} color="var(--ink-mute)" />
                    <strong style={{ color: full ? 'var(--cinnabar)' : 'var(--ink-soft)' }}>
                      {room.capacity == null
                        ? `${room.memberCount}`
                        : `${room.memberCount}/${room.capacity}`}
                    </strong>
                    {room.capacity == null ? ' thí sinh' : ' chỗ'}
                    {room.mySeatNo != null && (
                      <span style={{ color: 'var(--ink-faint)' }}>· ghế {room.mySeatNo}</span>
                    )}
                  </span>
                  <span className="sd-class-card-cta">
                    Xem bài thi <ChevronRight size={13} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Đề thi của tôi: nhóm theo lớp ─────────────────────────────
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
  const [activeNav, setActiveNav] = useState('exams');

  const [board, setBoard] = useState(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const [boardError, setBoardError] = useState(null);
  const [studyStats, setStudyStats] = useState(null);

  useEffect(() => {
    let alive = true;
    getExamBoard()
      .then((data) => { if (alive) setBoard(data); })
      .catch((err) => { if (alive) setBoardError(err.message); })
      .finally(() => { if (alive) setBoardLoading(false); });
    return () => { alive = false; };
  }, []);

  // Số liệu học tập nuôi huy hiệu trên thanh điều hướng và bảng "học hôm nay".
  // Lỗi ở đây chỉ làm mất huy hiệu chứ không được chặn cả trang: phần thi vẫn
  // phải dùng được kể cả khi phần học trục trặc.
  useEffect(() => {
    let alive = true;
    getStudyStats()
      .then((data) => { if (alive) setStudyStats(data); })
      .catch(() => { /* không có huy hiệu thì thôi, không làm phiền người dùng */ });
    return () => { alive = false; };
  }, [activeNav]);

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  /** Vào phòng thi. Server lo phần "vào mới" hay "vào lại phiên đang dở". */
  const enterExam = (examId) => navigate(`/student/exams/${examId}/room`);

  const userName = currentUser?.fullName || currentUser?.email || 'Thí sinh';
  const initials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  // Server đã đếm sẵn số đề còn phải làm trên tất cả các lớp.
  const pendingCount = board?.pendingCount ?? 0;
  const avgScore = Math.round(MOCK_RESULTS.reduce((a, b) => a + b.score, 0) / MOCK_RESULTS.length);

  const stats = [
    { icon: '📝', label: 'Đề thi cần làm',   value: pendingCount, sub: 'Trên tất cả các lớp', color: 'rgba(47, 143, 111,0.12)' },
    // Hai ô này lấy số thật từ /study/stats. Trước đây chúng hiển thị số đếm
    // trên MOCK_RESULTS — một con số bịa, và là thứ đầu tiên người dùng nhìn
    // thấy khi mở app. Số học tập thay đổi mỗi ngày nên nó cũng có ích hơn hẳn
    // điểm trung bình vốn chỉ đổi khi có bài thi.
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
          {/* Tên thương hiệu mang chất tiên hiệp, nhưng mọi nhãn chức năng bên
              dưới vẫn gọi đúng tên thật ("Đề thi của tôi", "Lịch sử điểm").
              Đặt tên bay bổng cho chức năng thì thí sinh phải đoán mình đang ở
              đâu — chủ đề chỉ nên nằm ở lớp trang trí. */}
          <h2>⛩️ Tàng Thư Các</h2>
          <p>Cổng thí sinh</p>
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
              <p className="sd-user-role">Thí sinh · Đăng xuất</p>
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
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(43, 38, 32, 0.05)', border: '1px solid rgba(43, 38, 32, 0.07)',
              borderRadius: 10, padding: '8px 14px', fontSize: 13, color: 'var(--ink-faint)',
            }}>
              <Search size={14} /> Tìm đề thi...
            </div>
            <button className="sd-icon-btn" title="Thông báo">
              <Bell size={16} />
            </button>
          </div>
        </header>

        <div className="sd-content">
          {activeNav === 'rooms' && <StudentRooms onEnterExam={enterExam} />}

          {activeNav === 'practice' && <PracticeExams onEnter={enterExam} />}

          {activeNav === 'courses' && <Courses />}

          {activeNav === 'flashcards' && <Flashcards />}

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
            <div className="sd-streak-pill">
              🔥 Chuỗi học 7 ngày
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

              {/* Tiến độ học tập */}
              <div className="sd-card" style={{ marginTop: 20 }}>
                <div className="sd-card-header">
                  <h2>📈 Tiến độ học tập</h2>
                </div>
                <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {[
                    { label: 'Tiếng Nhật N4', progress: 72, color: 'var(--gold)' },
                    { label: 'Toán học',       progress: 55, color: 'var(--violet)' },
                    { label: 'Tiếng Anh IELTS', progress: 80, color: 'var(--azure)' },
                  ].map((item, i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-soft)' }}>{item.label}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: item.color }}>{item.progress}%</span>
                      </div>
                      <div className="sd-progress-bar-track">
                        <div
                          className="sd-progress-bar-fill"
                          style={{ width: `${item.progress}%`, background: `linear-gradient(90deg, ${item.color}, ${item.color}88)` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Kết quả gần đây */}
              <div className="sd-card">
                <div className="sd-card-header">
                  <h2>🏅 Điểm gần đây</h2>
                  <button className="sd-btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }}>
                    Xem tất cả
                  </button>
                </div>
                <div>
                  {MOCK_RESULTS.map((r) => {
                    const gc = GRADE_COLOR[r.grade] || GRADE_COLOR['B'];
                    return (
                      <div key={r.id} className="sd-score-row">
                        <div className="sd-score-circle" style={{ background: gc.bg, color: gc.fg }}>
                          {r.grade}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--ink-faint)' }}>{r.subject} · {r.date}</p>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 800, color: gc.fg, flexShrink: 0 }}>{r.score}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bảng xếp hạng mini */}
              <div className="sd-card">
                <div className="sd-card-header">
                  <h2>🏆 Top lớp N4</h2>
                </div>
                <div style={{ padding: '12px 0' }}>
                  {[
                    { rank: 1, name: 'Nguyễn Thị Lan',   score: 96, medal: '🥇' },
                    { rank: 2, name: 'Trần Văn Bình',     score: 94, medal: '🥈' },
                    { rank: 3, name: userName,            score: avgScore, medal: '🥉', isMe: true },
                    { rank: 4, name: 'Phạm Thị Hoa',      score: 88, medal: '' },
                    { rank: 5, name: 'Lê Văn Đức',        score: 85, medal: '' },
                  ].map((item) => (
                    <div key={item.rank} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 22px',
                      background: item.isMe ? 'rgba(47, 143, 111,0.05)' : 'none',
                      borderLeft: item.isMe ? '2px solid var(--jade)' : '2px solid transparent',
                    }}>
                      <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>
                        {item.medal || <span style={{ fontSize: 12, color: 'var(--ink-mute)', fontWeight: 700 }}>#{item.rank}</span>}
                      </span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: item.isMe ? 700 : 500, color: item.isMe ? 'var(--jade)' : 'var(--ink-soft)' }}>
                        {item.name} {item.isMe && '(Bạn)'}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-mute)' }}>{item.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          </>
          )}

          {activeNav === 'history' && <ResultHistory />}

          {activeNav === 'ranking' && (
            <div className="sd-card">
              <div className="sd-exam-list">
                <div className="sd-list-state">
                  <AlertCircle size={15} /> Phần này chưa được xây dựng.
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
