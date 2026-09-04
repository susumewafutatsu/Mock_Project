import React, { useEffect, useState, useCallback } from 'react';
import {
  LayoutDashboard, BookOpen, ClipboardList, BarChart2, Trophy,
  Bell, LogOut, ChevronRight, ChevronLeft, Clock, Play, CheckCircle,
  AlertCircle, Search, Star, Loader2, School, Users, GraduationCap,
  Compass, ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { getExamBoard, getClassExams, getPracticeExams } from '../../services/examService';
import classService from '../../services/classService';
import './StudentDashboard.css';

// ─── Trạng thái đề thi ─────────────────────────────────────────
// Server đã tính sẵn `availability` cho từng đề (xem ExamResponse.Availability),
// client chỉ tra bảng này chứ không tự so lại startTime/endTime — hai bên so giờ
// riêng là cách chắc chắn nhất để lệch nhau.
const AVAILABILITY = {
  OPEN:         { label: 'Đang mở',      cls: 'open',     action: 'Làm bài',      enter: true },
  IN_PROGRESS:  { label: 'Đang làm dở',  cls: 'open',     action: 'Tiếp tục',     enter: true },
  UPCOMING:     { label: 'Sắp diễn ra',  cls: 'upcoming', action: 'Chưa mở',      enter: false },
  SUBMITTED:    { label: 'Đã làm',       cls: 'done',     action: 'Đã nộp',       enter: false },
  CLOSED:       { label: 'Đã hết hạn',   cls: 'missed',   action: 'Đã đóng',      enter: false },
  NO_QUESTIONS: { label: 'Chưa có câu hỏi', cls: 'missed', action: 'Chưa có câu', enter: false },
};

const SUBJECT_ICON = {
  'Toán học': { icon: '📐', bg: 'rgba(167,139,250,0.15)' },
  'Tiếng Nhật': { icon: '🇯🇵', bg: 'rgba(251,191,36,0.15)' },
  'Tiếng Anh': { icon: '📖', bg: 'rgba(96,165,250,0.15)' },
};
const DEFAULT_ICON = { icon: '📝', bg: 'rgba(52,211,153,0.15)' };

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

const NAV_ITEMS = [
  { id: 'home',     label: 'Tổng quan',       icon: LayoutDashboard },
  { id: 'exams',    label: 'Đề thi của tôi',  icon: ClipboardList },
  { id: 'practice', label: 'Đề tự do',        icon: Compass },
  { id: 'classes',  label: 'Lớp học của tôi', icon: School },
  { id: 'history',  label: 'Lịch sử điểm',    icon: BarChart2 },
  { id: 'ranking',  label: 'Bảng xếp hạng',   icon: Trophy },
];

const GRADE_COLOR = {
  'A':  { bg: 'rgba(52,211,153,0.12)',   fg: '#34d399' },
  'B+': { bg: 'rgba(96,165,250,0.12)',   fg: '#60a5fa' },
  'B':  { bg: 'rgba(167,139,250,0.12)',  fg: '#a78bfa' },
  'C':  { bg: 'rgba(251,191,36,0.12)',   fg: '#fbbf24' },
  'F':  { bg: 'rgba(239,68,68,0.1)',     fg: '#f87171' },
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
          <span style={{ color: '#475569' }}>{exam.totalQuestions} câu</span>
          {exam.levelName && <span style={{ color: '#475569' }}>{exam.levelName}</span>}
          {exam.teacherName && <span style={{ color: '#475569' }}>GV: {exam.teacherName}</span>}
          {/* Chỉ hiện tên lớp khi đề đến từ lớp. Đề tự do không thuộc lớp nào,
              và server nói thẳng điều đó qua `source` thay vì để client đoán. */}
          {exam.source === 'CLASS' && exam.className && (
            <span style={{ color: '#475569' }}>{exam.className}</span>
          )}
        </div>
        <div style={{ marginTop: 8 }}>
          <StatusBadge availability={exam.availability} />
          {exam.source === 'CLASS' ? (
            <span style={{ fontSize: 11.5, color: '#475569', marginLeft: 10 }}>
              Hạn: {formatDeadline(exam.endTime)}
            </span>
          ) : (
            <span style={{ fontSize: 11.5, color: '#475569', marginLeft: 10 }}>
              Luyện tập tự do
            </span>
          )}
          {exam.availability === 'SUBMITTED' && exam.totalScore != null && (
            <span style={{ fontSize: 11.5, color: '#34d399', marginLeft: 10, fontWeight: 700 }}>
              <Star size={10} style={{ verticalAlign: -1 }} /> {exam.totalScore} điểm
            </span>
          )}
        </div>
      </div>
      <div className="sd-exam-action">
        {av.enter ? (
          <button className="sd-btn-primary" onClick={() => onEnter(exam.examId)}>
            <Play size={13} /> {av.action}
          </button>
        ) : (
          <button className="sd-btn-ghost" disabled>
            <Clock size={13} /> {av.action}
          </button>
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
  // null      = học sinh chủ động bấm "Tất cả trình độ".
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
          <span style={{ fontSize: 12, color: '#64748b' }}>
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
              <span style={{ fontSize: 12.5, color: '#475569' }}>
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

// ─── Đề của một lớp (mở ra khi bấm vào thẻ lớp) ────────────────
function ClassExams({ classInfo, onBack, onEnter }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    getClassExams(classInfo.classId)
      .then((data) => { if (alive) setExams(data || []); })
      .catch((err) => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [classInfo.classId]);

  return (
    <div>
      <button className="sd-back-btn" onClick={onBack}>
        <ArrowLeft size={14} /> Tất cả lớp học
      </button>

      <div className="sd-class-hero">
        <div className="sd-class-hero-icon">
          <School size={22} color="#34d399" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="sd-class-hero-name">{classInfo.className}</h2>
          <div className="sd-class-hero-tags">
            {classInfo.subjectName && <span className="sd-tag subject">{classInfo.subjectName}</span>}
            {classInfo.levelName && <span className="sd-tag level">{classInfo.levelName}</span>}
            {classInfo.teacherName && (
              <span style={{ fontSize: 12.5, color: '#6b7280' }}>GV: {classInfo.teacherName}</span>
            )}
          </div>
        </div>
      </div>

      <div className="sd-card">
        <div className="sd-card-header">
          <h2>📋 Đề thi của lớp</h2>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {loading ? 'đang tải…' : `${exams.length} đề thi`}
          </span>
        </div>
        <div className="sd-exam-list">
          <ListState
            loading={loading}
            error={error}
            empty={exams.length === 0}
            emptyText="Lớp này chưa có đề thi nào."
          />
          {!loading && !error && exams.map((exam) => (
            <ExamRow key={exam.examId} exam={exam} onEnter={onEnter} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Lớp học của tôi ───────────────────────────────────────────
function StudentClasses({ onEnterExam }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openClass, setOpenClass] = useState(null);

  const loadClasses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await classService.getMyEnrolledClasses();
      setClasses(data);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách lớp học');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadClasses(); }, [loadClasses]);

  if (openClass) {
    return (
      <ClassExams
        classInfo={openClass}
        onBack={() => setOpenClass(null)}
        onEnter={onEnterExam}
      />
    );
  }

  if (loading) return (
    <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>
      <Loader2 size={28} style={{ animation: 'sd-spin 1s linear infinite', marginBottom: 12 }} />
      <p style={{ margin: 0, fontSize: 13.5 }}>Đang tải lớp học...</p>
    </div>
  );

  if (error) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#f87171' }}>
      <AlertCircle size={28} style={{ marginBottom: 10 }} />
      <p style={{ margin: 0, fontSize: 13.5 }}>{error}</p>
    </div>
  );

  if (classes.length === 0) return (
    <div style={{ padding: 60, textAlign: 'center', color: '#475569' }}>
      <School size={48} style={{ opacity: 0.3, marginBottom: 14 }} />
      <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: '#64748b' }}>Bạn chưa được đăng ký vào lớp nào</p>
      <p style={{ margin: '6px 0 0', fontSize: 13, color: '#374151' }}>Hãy liên hệ giáo viên để được thêm vào lớp</p>
    </div>
  );

  return (
    <div>
      {/* Header stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { icon: <School size={20} color="#34d399" />, label: 'Số lớp học', value: classes.length, bg: 'rgba(52,211,153,0.12)' },
          { icon: <Users size={20} color="#60a5fa" />, label: 'Tổng bạn cùng lớp', value: classes.reduce((s, c) => s + (c.studentCount || 0), 0), bg: 'rgba(96,165,250,0.12)' },
          { icon: <GraduationCap size={20} color="#a78bfa" />, label: 'Số môn học', value: [...new Set(classes.map(c => c.subjectName).filter(Boolean))].length, bg: 'rgba(167,139,250,0.12)' },
        ].map((s, i) => (
          <div key={i} className="sd-stat-card">
            <span style={{ display: 'inline-flex', width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', background: s.bg, marginBottom: 10 }}>
              {s.icon}
            </span>
            <p className="sd-stat-label">{s.label}</p>
            <p className="sd-stat-value">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Class cards — cả thẻ là nút mở tới đề của lớp */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px,1fr))', gap: 16 }}>
        {classes.map(cls => (
          <button
            key={cls.classId}
            type="button"
            className="sd-card sd-class-card"
            onClick={() => setOpenClass(cls)}
          >
            {/* Icon + Name */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: 'rgba(52,211,153,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <School size={20} color="#34d399" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14.5, color: '#f1f5f9', lineHeight: 1.3 }}>
                  {cls.className}
                </p>
                {cls.courseCode && (
                  <p style={{ margin: '3px 0 0', fontSize: 11.5, color: '#475569', fontFamily: 'monospace' }}>
                    {cls.courseCode}
                  </p>
                )}
              </div>
            </div>

            {/* Tags: subject + level */}
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {cls.subjectName && <span className="sd-tag subject">{cls.subjectName}</span>}
              {cls.levelName && <span className="sd-tag level">{cls.levelName}</span>}
            </div>

            {/* Teacher */}
            {cls.teacherName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.04)' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#a78bfa,#60a5fa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                  {cls.teacherName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: '#d1d5db' }}>{cls.teacherName}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#475569' }}>Giáo viên</p>
                </div>
              </div>
            )}

            <div className="sd-class-card-foot">
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#6b7280' }}>
                <Users size={13} color="#6b7280" />
                <strong style={{ color: '#d1d5db' }}>{cls.studentCount}</strong> học sinh
              </span>
              <span className="sd-class-card-cta">
                Xem đề thi <ChevronRight size={13} />
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Đề thi của tôi: nhóm theo lớp ─────────────────────────────
function ExamBoard({ board, loading, error, onEnter, onGoPractice }) {
  const groups = board?.classes || [];
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
              <School size={15} /> Bạn chưa vào lớp nào, nên chưa có đề nào được giao.
            </div>
          </div>
        </div>
      )}

      {!loading && !error && groups.map((group) => (
        <div key={group.classId} className="sd-card" style={{ marginBottom: 20 }}>
          <div className="sd-card-header">
            <h2>
              {group.className}
              {group.pendingCount > 0 && (
                <span className="sd-count-pill">{group.pendingCount} cần làm</span>
              )}
            </h2>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {[group.subjectName, group.levelName].filter(Boolean).join(' · ') || '—'}
            </span>
          </div>
          <div className="sd-exam-list">
            {group.exams.length === 0 ? (
              <div className="sd-list-state">
                <CheckCircle size={15} /> Lớp này chưa có đề thi nào.
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

  useEffect(() => {
    let alive = true;
    getExamBoard()
      .then((data) => { if (alive) setBoard(data); })
      .catch((err) => { if (alive) setBoardError(err.message); })
      .finally(() => { if (alive) setBoardLoading(false); });
    return () => { alive = false; };
  }, []);

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  /** Vào phòng thi. Server lo phần "vào mới" hay "vào lại phiên đang dở". */
  const enterExam = (examId) => navigate(`/student/exams/${examId}/room`);

  const userName = currentUser?.fullName || currentUser?.email || 'Học sinh';
  const initials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  // Server đã đếm sẵn số đề còn phải làm trên tất cả các lớp.
  const pendingCount = board?.pendingCount ?? 0;
  const avgScore = Math.round(MOCK_RESULTS.reduce((a, b) => a + b.score, 0) / MOCK_RESULTS.length);

  const stats = [
    { icon: '📝', label: 'Đề thi cần làm',   value: pendingCount, sub: 'Trên tất cả các lớp', color: 'rgba(52,211,153,0.12)' },
    { icon: '✅', label: 'Đã hoàn thành',      value: MOCK_RESULTS.length, sub: 'Tổng số bài làm', color: 'rgba(96,165,250,0.12)' },
    { icon: '⭐', label: 'Điểm trung bình',    value: avgScore, sub: 'Toàn bộ môn học', color: 'rgba(251,191,36,0.12)' },
    { icon: '🏆', label: 'Xếp hạng lớp',      value: '#3', sub: 'Trong 32 học sinh', color: 'rgba(167,139,250,0.12)' },
  ];

  const showDashboardChrome = activeNav === 'home' || activeNav === 'exams';

  return (
    <div className="sd-root">
      {/* ── SIDEBAR ── */}
      <aside className="sd-sidebar">
        <div className="sd-logo">
          <h2>🎓 EduPlatform</h2>
          <p>Cổng học sinh</p>
        </div>

        <nav className="sd-nav">
          <div className="sd-nav-label">Menu học tập</div>
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            // Huy hiệu lấy từ số thật server đếm, không phải số cứng.
            const badge = item.id === 'exams' && pendingCount > 0 ? pendingCount : null;
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
        </nav>

        <div className="sd-footer">
          <div className="sd-user-card" onClick={handleLogout} title="Đăng xuất">
            <div className="sd-avatar">{initials}</div>
            <div className="sd-user-info">
              <p className="sd-user-name">{userName}</p>
              <p className="sd-user-role">Học sinh · Đăng xuất</p>
            </div>
            <LogOut size={14} style={{ color: '#475569', flexShrink: 0 }} />
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
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10, padding: '8px 14px', fontSize: 13, color: '#64748b',
            }}>
              <Search size={14} /> Tìm đề thi...
            </div>
            <button className="sd-icon-btn" title="Thông báo">
              <Bell size={16} />
            </button>
          </div>
        </header>

        <div className="sd-content">
          {activeNav === 'classes' && <StudentClasses onEnterExam={enterExam} />}

          {activeNav === 'practice' && <PracticeExams onEnter={enterExam} />}

          {showDashboardChrome && (
          <>
          {/* Welcome Banner */}
          <div className="sd-welcome-banner">
            <div>
              <p className="sd-welcome-title">
                Chào mừng trở lại, <span>{userName.split(' ').slice(-1)[0]}</span>! 🎉
              </p>
              <p className="sd-welcome-sub">
                Bạn có <strong style={{ color: '#f1f5f9' }}>{pendingCount} đề thi cần làm</strong>. Đừng bỏ lỡ nhé!
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
                    { label: 'Tiếng Nhật N4', progress: 72, color: '#fbbf24' },
                    { label: 'Toán học',       progress: 55, color: '#a78bfa' },
                    { label: 'Tiếng Anh IELTS', progress: 80, color: '#60a5fa' },
                  ].map((item, i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: '#d1d5db' }}>{item.label}</span>
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
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#64748b' }}>{r.subject} · {r.date}</p>
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
                      background: item.isMe ? 'rgba(52,211,153,0.05)' : 'none',
                      borderLeft: item.isMe ? '2px solid #34d399' : '2px solid transparent',
                    }}>
                      <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>
                        {item.medal || <span style={{ fontSize: 12, color: '#475569', fontWeight: 700 }}>#{item.rank}</span>}
                      </span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: item.isMe ? 700 : 500, color: item.isMe ? '#34d399' : '#d1d5db' }}>
                        {item.name} {item.isMe && '(Bạn)'}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>{item.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          </>
          )}

          {(activeNav === 'history' || activeNav === 'ranking') && (
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
