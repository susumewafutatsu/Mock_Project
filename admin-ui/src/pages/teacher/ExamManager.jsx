import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, FileText, BookOpen, Users, BarChart2,
  Plus, Search, Bell, LogOut, ChevronRight, Clock,
  CheckCircle2, X, Calendar, Hash, Timer,
  ClipboardList, Edit3, Trash2, School, Loader2, AlertCircle, GraduationCap,
  RotateCcw, Eye, Layers,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import QuestionBank from './QuestionBank';
import RoomManager from './RoomManager';
import CourseManager from './CourseManager';
import TeacherOverview from './TeacherOverview';
import StudentsView from './StudentsView';
import ResultView from './ResultView';
import ExamSectionEditor from './ExamSectionEditor';
import NotificationBell from '../../components/common/NotificationBell';
import roomService from '../../services/roomService';
import * as questionService from '../../services/questionService';
import * as teacherExamService from '../../services/teacherExamService';
import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS } from '../../utils/constants';
import './TeacherDashboard.css';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'exams',     label: 'Đề luyện thi', icon: FileText },
  { id: 'rooms',     label: 'Phòng thi', icon: School },
  { id: 'courses',   label: 'Lộ trình ôn tập', icon: GraduationCap },
  { id: 'questions', label: 'Ngân hàng câu hỏi', icon: BookOpen },
  { id: 'students',  label: 'Thí sinh', icon: Users },
  { id: 'results',   label: 'Kết quả & Phân tích', icon: BarChart2 },
];

// Nhãn tiếng Việt cho TeacherExamResponse.Status của backend
const STATUS_LABELS = {
  NO_QUESTIONS: 'Chưa có câu hỏi',
  UPCOMING: 'Sắp mở',
  OPEN: 'Đang mở',
  CLOSED: 'Đã đóng',
};

const STATUS_CLASSES = {
  NO_QUESTIONS: 'draft',
  UPCOMING: 'upcoming',
  OPEN: 'open',
  CLOSED: 'closed',
};

const FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'OPEN', label: 'Đang mở' },
  { id: 'UPCOMING', label: 'Sắp thi' },
  { id: 'CLOSED', label: 'Kết thúc' },
  { id: 'NO_QUESTIONS', label: 'Chưa có câu hỏi' },
];

/** "2026-08-28T19:30:00" → "28/08/2026 19:30" */
function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** "2026-08-28T19:30:00" → { date: "2026-08-28", time: "19:30" } cho input date/time */
function splitDateTime(value) {
  if (!value) return { date: '', time: '' };
  const [date, time = ''] = value.split('T');
  return { date, time: time.slice(0, 5) };
}

// ─── Status badge ─────────────────────────────────────────────
function StatusBadge({ status }) {
  return (
    <span className={`td-badge ${STATUS_CLASSES[status] || 'draft'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

// ─── Toast ────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  const color = type === 'success' ? 'var(--jade)' : 'var(--cinnabar)';
  const Icon = type === 'success' ? CheckCircle2 : AlertCircle;

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: 'var(--paper-raised)', border: `1px solid ${color}40`,
      borderRadius: 14, padding: '14px 20px',
      display: 'flex', alignItems: 'center', gap: 12,
      minWidth: 300, maxWidth: 420,
      boxShadow: 'var(--shadow-lg)',
    }}>
      <Icon size={18} color={color} style={{ flexShrink: 0 }} />
      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-body)', flex: 1 }}>{message}</p>
      <button onClick={onClose} style={{
        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)',
      }}>
        <X size={14} />
      </button>
    </div>
  );
}

// ─ Question picker Chọn câu hỏi từ ngân hàng.
const ALL_BANKS = 'all';

function QuestionPicker({ selected, onChange, levelId, hint }) {
  const [banks, setBanks] = useState([]);
  const [levelFilter, setLevelFilter] = useState('');
  const [bankId, setBankId] = useState('');
  const [difficulty, setDifficulty] = useState(null); // null = mọi mức độ
  const [typeFilter, setTypeFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Mọi câu đã từng tải, theo id — để tóm tắt các câu đã chọn theo mức độ kể cả
  // khi chúng nằm ở bộ khác bộ đang xem.
  const [known, setKnown] = useState({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const data = (await questionService.getMyBanks()) ?? [];
        if (!alive) return;
        setBanks(data);
        // Mặc định lọc theo trình độ của đề.
        const sameLevel = levelId && data.some(b => String(b.levelId) === String(levelId));
        setLevelFilter(sameLevel ? String(levelId) : '');
        const first = sameLevel ? data.find(b => String(b.levelId) === String(levelId)) : data[0];
        if (first) setBankId(String(first.bankId));
      } catch (err) {
        if (alive) setError(err.message || 'Không tải được ngân hàng câu hỏi');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // levelId chỉ dùng để chọn bộ lọc mặc định lần đầu.
  }, []);

  const levelOptions = useMemo(() => {
    const seen = new Map();
    for (const b of banks) {
      if (b.levelId != null && !seen.has(String(b.levelId))) {
        seen.set(String(b.levelId), b.levelName ?? `Trình độ ${b.levelId}`);
      }
    }
    return [...seen.entries()];
  }, [banks]);

  const banksShown = useMemo(
    () => (levelFilter ? banks.filter(b => String(b.levelId) === levelFilter) : banks),
    [banks, levelFilter],
  );

  const changeLevel = (value) => {
    setLevelFilter(value);
    const pool = value ? banks.filter(b => String(b.levelId) === value) : banks;
    setBankId(pool.length > 1 ? ALL_BANKS : pool[0] ? String(pool[0].bankId) : '');
  };

  useEffect(() => {
    const ids = bankId === ALL_BANKS ? banksShown.map(b => b.bankId) : bankId ? [bankId] : [];
    if (ids.length === 0) { setQuestions([]); return; }
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const pages = await Promise.all(
          ids.map(id => questionService.getQuestions(id, { page: 0, size: 200 })),
        );
        if (!alive) return;
        const list = pages.flatMap(p => p?.content ?? []);
        setQuestions(list);
        setKnown(prev => ({ ...prev, ...Object.fromEntries(list.map(q => [q.questionId, q])) }));
      } catch (err) {
        if (alive) setError(err.message || 'Không tải được câu hỏi');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [bankId, banksShown]);

  // Số câu theo từng mức độ TRƯỚC khi lọc mức độ, để nút lọc nói trước sẽ còn bao nhiêu câu.
  const typeAndKeywordMatched = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return questions.filter(q =>
      // Câu tự luận không vào đề thi được (JLPT không có dạng này, và hệ thống chưa có ai chấm nó — bài sẽ nằm mãi ở "chờ chấm").
      q.questionType !== 'ESSAY'
      && (!typeFilter || q.questionType === typeFilter)
      && (!kw || (q.content ?? '').toLowerCase().includes(kw)));
  }, [questions, typeFilter, keyword]);

  const difficultyCounts = useMemo(() => {
    const counts = {};
    for (const q of typeAndKeywordMatched) {
      counts[q.difficultyLevel] = (counts[q.difficultyLevel] ?? 0) + 1;
    }
    return counts;
  }, [typeAndKeywordMatched]);

  const shown = difficulty == null
    ? typeAndKeywordMatched
    : typeAndKeywordMatched.filter(q => q.difficultyLevel === difficulty);

  const selectedByDifficulty = useMemo(() => {
    const counts = {};
    for (const id of selected) {
      const d = known[id]?.difficultyLevel;
      if (d != null) counts[d] = (counts[d] ?? 0) + 1;
    }
    return counts;
  }, [selected, known]);

  const toggle = (questionId) =>
    onChange(selected.includes(questionId)
      ? selected.filter(id => id !== questionId)
      : [...selected, questionId]);

  const allShownIds = shown.map(q => q.questionId);
  const allShownPicked = allShownIds.length > 0 && allShownIds.every(id => selected.includes(id));

  const toggleAll = () =>
    onChange(allShownPicked
      ? selected.filter(id => !allShownIds.includes(id))
      : [...new Set([...selected, ...allShownIds])]);

  const chip = (active) => ({
    padding: '5px 11px', borderRadius: 999, fontSize: 12.5, cursor: 'pointer',
    fontFamily: 'inherit', whiteSpace: 'nowrap',
    border: `1px solid ${active ? 'var(--violet)' : 'var(--line-strong)'}`,
    background: active ? 'var(--violet-wash)' : 'var(--paper-raised)',
    color: active ? 'var(--violet)' : 'var(--ink-soft)',
    fontWeight: active ? 600 : 400,
  });

  return (
    <>
      <div className="td-form-group full">
        <label className="td-form-label">
          <BookOpen size={14} /> Lấy câu hỏi từ ngân hàng
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10 }}>
          <select
            className="td-form-select"
            value={levelFilter}
            onChange={(e) => changeLevel(e.target.value)}
            disabled={banks.length === 0}
            aria-label="Lọc theo trình độ"
          >
            <option value="">Mọi trình độ</option>
            {levelOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <select
            className="td-form-select"
            value={bankId}
            onChange={(e) => setBankId(e.target.value)}
            disabled={banksShown.length === 0}
            aria-label="Bộ câu hỏi"
          >
            {banksShown.length === 0 && <option value="">Chưa có bộ câu hỏi nào</option>}
            {banksShown.length > 1 && (
              <option value={ALL_BANKS}>
                Tất cả {banksShown.length} bộ ({banksShown.reduce((n, b) => n + (b.totalQuestions ?? 0), 0)} câu)
              </option>
            )}
            {banksShown.map(b => (
              <option key={b.bankId} value={b.bankId}>
                {b.title} ({b.totalQuestions} câu)
                {!levelFilter && b.levelName ? ` · ${b.levelName}` : ''}
              </option>
            ))}
          </select>
        </div>
        {hint && (
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--ink-faint)', lineHeight: 1.5 }}>
            {hint}
          </p>
        )}
      </div>

      <div className="td-form-group full">
        <label className="td-form-label">Mức độ</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="radiogroup" aria-label="Lọc theo mức độ">
          <button type="button" role="radio" aria-checked={difficulty == null}
                  style={chip(difficulty == null)} onClick={() => setDifficulty(null)}>
            Mọi mức độ · {typeAndKeywordMatched.length}
          </button>
          {Object.entries(DIFFICULTY_LABELS).map(([level, label]) => {
            const n = difficultyCounts[level] ?? 0;
            const active = difficulty === Number(level);
            return (
              <button key={level} type="button" role="radio" aria-checked={active}
                      style={{ ...chip(active), opacity: n === 0 && !active ? 0.5 : 1 }}
                      onClick={() => setDifficulty(active ? null : Number(level))}>
                {label} · {n}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10, marginTop: 10 }}>
          <select className="td-form-select" value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)} aria-label="Lọc theo dạng câu">
            <option value="">Mọi dạng câu</option>
            {Object.entries(QUESTION_TYPE_LABELS).map(([t, label]) => (
              <option key={t} value={t}>{label}</option>
            ))}
          </select>
          <input className="td-form-input" type="search" value={keyword}
                 onChange={(e) => setKeyword(e.target.value)}
                 placeholder="Tìm trong nội dung câu hỏi" aria-label="Tìm câu hỏi" />
        </div>
      </div>

      <div className="td-form-group full">
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, marginBottom: 8,
        }}>
          <span style={{ fontSize: 12.5, color: 'var(--ink-mute)' }}>
            Đã chọn <strong style={{ color: 'var(--violet)' }}>{selected.length}</strong> câu
            {Object.keys(selectedByDifficulty).length > 0 && (
              <> — {Object.entries(selectedByDifficulty)
                .sort(([a], [b]) => a - b)
                .map(([d, n]) => `${n} ${(DIFFICULTY_LABELS[d] ?? '').toLowerCase()}`)
                .join(' · ')}</>
            )}
          </span>
          {shown.length > 0 && (
            <button type="button" className="td-btn-ghost" onClick={toggleAll}>
              {allShownPicked ? `Bỏ chọn ${shown.length} câu đang lọc` : `Chọn ${shown.length} câu đang lọc`}
            </button>
          )}
        </div>

        <div style={{ maxHeight: 260, overflowY: 'auto', display: 'grid', gap: 8 }}>
          {loading && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)' }}>Đang tải...</p>
          )}
          {!loading && banks.length === 0 && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--gold)', lineHeight: 1.6 }}>
              Bạn chưa có ngân hàng câu hỏi nào. Sang tab <strong>Ngân hàng câu hỏi</strong>{' '}
              tạo ngân hàng và thêm câu hỏi trước, rồi quay lại đây.
            </p>
          )}
          {!loading && banks.length > 0 && questions.length === 0 && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)' }}>
              Bộ câu hỏi này chưa có câu nào.
            </p>
          )}
          {!loading && questions.length > 0 && shown.length === 0 && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)' }}>
              Không có câu nào khớp bộ lọc. Thử đổi mức độ hoặc dạng câu.
            </p>
          )}
          {!loading && shown.map(q => (
            <label key={q.questionId} style={{
              display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer',
              padding: '10px 12px', borderRadius: 8,
              border: '1px solid rgba(43, 38, 32, 0.07)',
              background: selected.includes(q.questionId)
                ? 'rgba(124, 92, 191,0.12)' : 'transparent',
            }}>
              <input
                type="checkbox"
                checked={selected.includes(q.questionId)}
                onChange={() => toggle(q.questionId)}
                style={{ marginTop: 3 }}
              />
              <span style={{ flex: 1, fontSize: 13, color: 'var(--ink-body)', lineHeight: 1.5 }}>
                {q.content}
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 3 }}>
                  {QUESTION_TYPE_LABELS[q.questionType] ?? q.questionType}
                  {' · '}{DIFFICULTY_LABELS[q.difficultyLevel] ?? 'chưa đặt mức độ'}
                  {q.usedInExam ? ' · đã dùng trong đề khác' : ''}
                </span>
              </span>
            </label>
          ))}
        </div>

        {error && (
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--cinnabar)' }}>{error}</p>
        )}
      </div>
    </>
  );
}

// ─── Create / Edit Exam Modal ─────────────────────────────────
function ExamFormModal({ initial, levels, catalogLoading, onClose, onSave, saving }) {
  const isEdit = !!initial;
  const start = splitDateTime(initial?.startTime);
  const end = splitDateTime(initial?.endTime);

  const [form, setForm] = useState({
    title: initial?.title ?? '',
    isPublic: initial?.isPublic ?? false,
    levelId: initial?.levelId ?? '',
    durationMinutes: initial?.durationMinutes ?? '',
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    adaptive: initial?.adaptive ?? false,
    // Chuỗi rỗng = không giới hạn.
    maxAttempts: initial?.maxAttempts == null ? '' : String(initial.maxAttempts),
    // Đề mới mặc định cho xem đáp án.
    allowReview: initial?.allowReview ?? true,
    isPlacement: initial?.isPlacement ?? false,
    shuffleQuestions: initial?.shuffleQuestions ?? false,
    shuffleOptions: initial?.shuffleOptions ?? false,
  });
  const [error, setError] = useState(null);
  // Câu hỏi tick trong form. Đề được tạo xong sẽ gắn luôn các câu này.
  const [picked, setPicked] = useState([]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Trình độ có thể tải xong sau khi modal đã mở → chọn sẵn giá trị đầu tiên.
  useEffect(() => {
    if (!form.levelId && levels.length > 0) {
      setForm(f => ({ ...f, levelId: levels[0].levelId }));
    }
  }, [levels, form.levelId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const startAt = teacherExamService.toLocalDateTime(form.startDate, form.startTime);
    const endAt = teacherExamService.toLocalDateTime(form.endDate, form.endTime);

    // Khung giờ để trống được. Đề tự do đúng ra KHÔNG nên có ngày đóng.
    if (startAt && endAt && new Date(endAt) <= new Date(startAt)) {
      setError('Thời gian đóng đề phải sau thời gian mở đề.');
      return;
    }
    if (!isEdit && picked.length === 0) {
      setError('Chọn ít nhất một câu hỏi, nếu không thí sinh sẽ không vào thi được.');
      return;
    }
    setError(null);

    onSave({
      title: form.title.trim(),
      // Công khai = mọi thí sinh làm được.
      isPublic: form.isPublic,
      levelId: Number(form.levelId),
      durationMinutes: Number(form.durationMinutes),
      startTime: startAt,
      endTime: endAt,
      adaptive: form.adaptive,
      // Để trống = không giới hạn lượt. Gửi null chứ không phải 0: backend phân
      // biệt "không đặt trần" với một con số cụ thể.
      maxAttempts: form.maxAttempts === '' ? null : Number(form.maxAttempts),
      allowReview: form.allowReview,
      isPlacement: form.isPlacement,
      shuffleQuestions: form.shuffleQuestions,
      shuffleOptions: form.shuffleOptions,
    }, picked);
  };

  return (
    <div className="td-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="td-modal">
        <div className="td-modal-header">
          <div>
            <h2>{isEdit ? '✏️ Sửa đề thi' : '✨ Tạo bài thi mới'}</h2>
            <p>
              {isEdit
                ? `Đang sửa: ${initial.title} · hiện có ${initial.totalQuestions} câu`
                : 'Điền thông tin đề và chọn câu hỏi ngay trong một bước'}
            </p>
          </div>
          <button className="td-close-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="td-modal-body">
            <div className="td-form-group full">
              <label className="td-form-label">
                <FileText size={14} /> Tên đề thi <span className="required">*</span>
              </label>
              <input
                className="td-form-input"
                placeholder="VD: Kiểm tra giữa kỳ – N4 Ngữ pháp"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                required
                maxLength={200}
              />
            </div>

            <div className="td-form-row">
              <div className="td-form-group">
                <label className="td-form-label">
                  <BookOpen size={14} /> Trình độ <span className="required">*</span>
                </label>
                <select
                  className="td-form-select"
                  value={form.levelId}
                  onChange={(e) => set('levelId', e.target.value)}
                  required
                  disabled={catalogLoading || levels.length === 0}
                >
                  {catalogLoading && <option value="">Đang tải...</option>}
                  {!catalogLoading && levels.length === 0 && (
                    <option value="">Chưa có trình độ nào</option>
                  )}
                  {levels.map(lv => (
                    <option key={lv.levelId} value={lv.levelId}>
                      {lv.subjectName ? `${lv.subjectName} – ` : ''}{lv.levelName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Thời còn lớp học, chỗ này là dropdown "Lớp áp dụng" — tạo bài thi và giao bài thi là một thao tác. */}
              <div className="td-form-group">
                <label className="td-form-label">
                  <Users size={14} /> Phạm vi
                </label>
                <select
                  className="td-form-select"
                  value={form.isPublic ? 'public' : 'private'}
                  onChange={(e) => set('isPublic', e.target.value === 'public')}
                >
                  <option value="private">Chỉ trong phòng thi (gắn vào phòng sau)</option>
                  <option value="public">Công khai — mọi thí sinh đều làm được</option>
                </select>
              </div>
            </div>

            <div className="td-form-row">
              <div className="td-form-group">
                <label className="td-form-label">
                  <Timer size={14} /> Thời gian làm bài (phút) <span className="required">*</span>
                </label>
                <input
                  className="td-form-input" type="number" min="1" max="300"
                  placeholder="VD: 45"
                  value={form.durationMinutes}
                  onChange={(e) => set('durationMinutes', e.target.value)}
                  required
                />
              </div>

              <div className="td-form-group">
                <label className="td-form-label">
                  <Hash size={14} /> Chế độ thi
                </label>
                <select
                  className="td-form-select"
                  value={form.adaptive ? 'adaptive' : 'fixed'}
                  onChange={(e) => set('adaptive', e.target.value === 'adaptive')}
                >
                  <option value="fixed">Đề cố định</option>
                  <option value="adaptive">Thích ứng theo năng lực</option>
                </select>
              </div>
            </div>

            <div className="td-form-row">
              <div className="td-form-group">
                <label className="td-form-label">
                  <RotateCcw size={14} /> Số lần được làm
                </label>
                <input
                  className="td-form-input" type="number" min="1" max="20"
                  placeholder="Để trống = không giới hạn"
                  value={form.maxAttempts}
                  onChange={(e) => set('maxAttempts', e.target.value)}
                />
                <p className="td-form-hint">
                  Đề luyện tập nên để trống cho thí sinh làm đi làm lại. Bài kiểm
                  tra thì đặt 1.
                </p>
              </div>

              <div className="td-form-group">
                <label className="td-form-label">
                  <Eye size={14} /> Xem đáp án sau khi nộp
                </label>
                <select
                  className="td-form-select"
                  value={form.allowReview ? 'yes' : 'no'}
                  onChange={(e) => set('allowReview', e.target.value === 'yes')}
                >
                  <option value="yes">Cho xem đáp án và giải thích</option>
                  <option value="no">Chỉ cho xem điểm</option>
                </select>
                <p className="td-form-hint">
                  Tắt khi đề còn đang mở cho phòng khác làm, hoặc khi cho làm nhiều
                  lượt mà không muốn lượt sau thành chép đáp án.
                </p>
              </div>
            </div>

            <div className="td-form-row">
              <div className="td-form-group">
                <label className="td-form-label">
                  <RotateCcw size={14} /> Xáo đề theo từng lượt
                </label>
                <select
                  className="td-form-select"
                  value={form.shuffleQuestions ? (form.shuffleOptions ? 'both' : 'questions') : (form.shuffleOptions ? 'options' : 'none')}
                  onChange={(e) => {
                    const v = e.target.value;
                    set('shuffleQuestions', v === 'both' || v === 'questions');
                    set('shuffleOptions', v === 'both' || v === 'options');
                  }}
                >
                  <option value="none">Không xáo</option>
                  <option value="options">Chỉ xáo đáp án</option>
                  <option value="questions">Chỉ xáo thứ tự câu</option>
                  <option value="both">Xáo cả câu và đáp án</option>
                </select>
                <p className="td-form-hint">
                  Mỗi lượt làm một thứ tự riêng, chống chép kiểu "câu 3 chọn C". Câu cùng bài
                  đọc vẫn đứng liền nhau. Đề hay chữa chung theo số câu thì nên để không xáo.
                </p>
              </div>

              <div className="td-form-group">
                <label className="td-form-label">
                  <GraduationCap size={14} /> Bài xếp trình độ
                </label>
                <select
                  className="td-form-select"
                  value={form.isPlacement ? 'yes' : 'no'}
                  onChange={(e) => set('isPlacement', e.target.value === 'yes')}
                >
                  <option value="no">Không</option>
                  <option value="yes">Dùng làm bài xếp trình độ đầu vào</option>
                </select>
                <p className="td-form-hint">
                  Trộn câu từ nhiều cấp (N5→N1) và để công khai. Học viên làm xong sẽ được gợi ý
                  nên bắt đầu ôn từ cấp nào, dựa trên tỉ lệ đúng theo từng cấp.
                </p>
              </div>
            </div>

            <div className="td-form-row">
              <div className="td-form-group">
                <label className="td-form-label">
                  <Calendar size={14} /> Mở đề lúc
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="td-form-input" type="date"
                    value={form.startDate}
                    onChange={(e) => set('startDate', e.target.value)}
                  />
                  <input
                    className="td-form-input" type="time"
                    value={form.startTime}
                    onChange={(e) => set('startTime', e.target.value)}
                  />
                </div>
                <p className="td-form-hint">
                  Để trống = mở ngay. Đề công khai nên để trống cả hai ô giờ cho thí
                  sinh luyện bất cứ lúc nào.
                </p>
              </div>

              <div className="td-form-group">
                <label className="td-form-label">
                  <Clock size={14} /> Đóng đề lúc
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="td-form-input" type="date"
                    value={form.endDate}
                    onChange={(e) => set('endDate', e.target.value)}
                  />
                  <input
                    className="td-form-input" type="time"
                    value={form.endTime}
                    onChange={(e) => set('endTime', e.target.value)}
                  />
                </div>
                <p className="td-form-hint">
                  Để trống = không tự đóng. Đề gắn vào phòng thi thì giờ kết thúc do
                  phòng quyết định, đặt ở đây chỉ thêm một cái hạn thứ hai.
                </p>
              </div>
            </div>

            <div style={{
              borderTop: '1px solid rgba(43, 38, 32, 0.07)', paddingTop: 16,
              display: 'grid', gap: 12,
            }}>
              <QuestionPicker
                selected={picked}
                onChange={setPicked}
                levelId={form.levelId}
                hint={isEdit
                  ? 'Tick thêm câu để bổ sung vào đề. Câu đã có trong đề sẽ được bỏ qua.'
                  : 'Câu đã tick sẽ được gắn vào đề ngay sau khi tạo. Nội dung + đáp án được '
                    + 'chụp lại tại thời điểm này, sửa ngân hàng sau đó không làm đổi đề.'}
              />
            </div>

            {error && (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--cinnabar)' }}>{error}</p>
            )}
          </div>

          <div className="td-modal-footer">
            <button type="button" className="td-btn-secondary" onClick={onClose} disabled={saving}>
              Hủy
            </button>
            <button type="submit" className="td-btn-primary"
              disabled={saving || catalogLoading || levels.length === 0}>
              {saving
                ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                : <Plus size={16} />}
              {isEdit
                ? 'Lưu thay đổi'
                : `Tạo bài thi${picked.length > 0 ? ` (${picked.length} câu)` : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─ Attach Questions Modal Đề mới tạo ở trạng thái NO_QUESTIONS.
function AttachQuestionsModal({ exam, onClose, onDone }) {
  const [selected, setSelected] = useState([]); // questionId[]
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleAttach = async () => {
    if (selected.length === 0) {
      setError('Chọn ít nhất một câu hỏi.');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await questionService.attachQuestionsToExam(
        exam.examId,
        selected.map((questionId, i) => ({ questionId, questionOrder: i + 1 })),
      );
      onDone(`Đã thêm ${selected.length} câu hỏi vào đề`);
    } catch (err) {
      setError(err.message || 'Không gắn được câu hỏi vào đề');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="td-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="td-modal">
        <div className="td-modal-header">
          <div>
            <h2>📝 Gắn câu hỏi vào đề</h2>
            <p>{exam.title} · hiện có {exam.totalQuestions} câu</p>
          </div>
          <button className="td-close-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="td-modal-body">
          <QuestionPicker
            selected={selected}
            onChange={setSelected}
            levelId={exam.levelId}
            hint="Câu đã có trong đề sẽ được bỏ qua, không bị gắn trùng."
          />

          {error && <p style={{ margin: 0, fontSize: 13, color: 'var(--cinnabar)' }}>{error}</p>}
        </div>

        <div className="td-modal-footer">
          <button type="button" className="td-btn-secondary" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button type="button" className="td-btn-primary" onClick={handleAttach}
            disabled={saving || selected.length === 0}>
            {saving
              ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              : <Plus size={16} />}
            Gắn {selected.length > 0 ? `${selected.length} câu` : 'câu hỏi'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function TeacherDashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Đọc tab từ URL path: /teacher/:tab
  const pathSegment = location.pathname.replace('/teacher/', '').split('/')[0];
  const VALID_TABS = ['dashboard', 'exams', 'rooms', 'courses', 'questions', 'students', 'results'];
  const activeNav = VALID_TABS.includes(pathSegment) ? pathSegment : 'exams';

  // Chuyển tab bằng cách thay đổi URL
  const goTo = (tabId) => navigate(`/teacher/${tabId}`, { replace: false });

  const [exams, setExams] = useState([]);
  const [sectionExam, setSectionExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [levels, setLevels] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [modalExam, setModalExam] = useState(null); // null = đóng, {} = tạo mới, exam = sửa
  const [attachExam, setAttachExam] = useState(null); // đề đang gắn câu hỏi
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  // Ô tìm trên thanh trên lọc ngay bảng đề — trước đây nó là một cái hộp không bấm được.
  const [keyword, setKeyword] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => setToast({ message, type });

  const loadExams = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      setExams(await teacherExamService.getMyExams());
    } catch (err) {
      setLoadError(err.message || 'Không thể tải danh sách đề thi');
    } finally {
      setLoading(false);
    }
  }, []);

  // Lớp + trình độ dùng cho form tạo/sửa đề.
  const loadCatalog = useCallback(async () => {
    try {
      setCatalogLoading(true);
      const [cls, lvs] = await Promise.all([
        roomService.getMyRooms(),
        roomService.getLevels(),
      ]);
      setRooms(cls);
      setLevels(lvs);
    } catch (err) {
      showToast(err.message || 'Không thể tải danh sách phòng / trình độ', 'error');
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => { loadExams(); }, [loadExams]);
  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  // payload = thông tin đề, questionIds = câu hỏi tick trong form.
  const handleSave = async (payload, questionIds = []) => {
    try {
      setSaving(true);
      let examId = modalExam?.examId;
      if (examId) {
        await teacherExamService.updateExam(examId, payload);
      } else {
        const created = await teacherExamService.createExam(payload);
        examId = created?.examId;
      }

      if (questionIds.length > 0 && examId) {
        try {
          await questionService.attachQuestionsToExam(
            examId,
            questionIds.map((questionId, i) => ({ questionId, questionOrder: i + 1 })),
          );
          showToast(`Đã lưu đề thi và gắn ${questionIds.length} câu hỏi`);
        } catch (err) {
          showToast(
            `Đã lưu đề thi nhưng chưa gắn được câu hỏi: ${err.message}. `
            + 'Mở "Sửa đề thi" để gắn lại.',
            'error',
          );
        }
      } else {
        showToast(modalExam?.examId ? 'Đã cập nhật đề thi' : 'Đã tạo đề thi');
      }

      setModalExam(null);
      await loadExams();
    } catch (err) {
      showToast(err.message || 'Không lưu được đề thi', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (exam) => {
    if (!window.confirm(`Xóa đề thi "${exam.title}"?`)) return;
    try {
      await teacherExamService.deleteExam(exam.examId);
      showToast('Đã xóa đề thi');
      await loadExams();
    } catch (err) {
      showToast(err.message || 'Không xóa được đề thi', 'error');
    }
  };

  const filteredExams = exams
    .filter(e => filterStatus === 'all' || e.status === filterStatus)
    .filter(e => !keyword.trim()
      || (e.title ?? '').toLowerCase().includes(keyword.trim().toLowerCase()));

  const stats = [
    {
      label: 'Đề luyện thi', value: exams.length, sub: 'Do bạn soạn',
      icon: '📋', color: 'rgba(124, 92, 191,0.15)',
    },
    {
      label: 'Đang mở luyện', value: exams.filter(e => e.status === 'OPEN').length, sub: 'Thí sinh làm được ngay',
      icon: '🟢', color: 'rgba(47, 143, 111,0.15)',
    },
    {
      label: 'Sắp mở', value: exams.filter(e => e.status === 'UPCOMING').length, sub: 'Chưa tới giờ mở đề',
      icon: '⏰', color: 'rgba(201, 146, 46,0.15)',
    },
    {
      label: 'Đề chưa có câu hỏi',
      value: exams.filter(e => e.status === 'NO_QUESTIONS').length,
      sub: 'Gắn câu hỏi thì thí sinh mới luyện được',
      icon: '📝', color: 'rgba(61, 126, 166,0.15)',
    },
  ];

  const isQuestionTab = activeNav === 'questions';
  const isRoomTab     = activeNav === 'rooms';
  const isCourseTab   = activeNav === 'courses';
  const isOverviewTab = activeNav === 'dashboard';
  const isStudentTab  = activeNav === 'students';
  const isResultTab   = activeNav === 'results';
  // "Đặc biệt" ở đây nghĩa là: màn tự lo phần thân của nó.
  const isSpecialTab  = isQuestionTab || isRoomTab || isCourseTab
                        || isOverviewTab || isStudentTab || isResultTab;

  const TAB_TITLES = {
    questions: "Ngân hàng câu hỏi",
    rooms: "Quản lý phòng thi",
    courses: "Lộ trình ôn tập",
    dashboard: "Tổng quan",
    students: "Thí sinh",
    results: "Kết quả & Phân tích",
  };
  const topbarTitle = TAB_TITLES[activeNav] ?? "Đề luyện thi";

  const userName  = currentUser?.fullName || currentUser?.email || 'Người ra đề';
  const initials  = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="td-root">
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      {/* ── SIDEBAR ── */}
      <aside className="td-sidebar">
        <div className="td-sidebar-logo">
          <h2>⛩️ Tàng Thư Các</h2>
          <p>Cổng người ra đề</p>
        </div>

        <nav className="td-sidebar-nav">
          <div className="td-nav-section-label">Menu chính</div>
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`td-nav-item ${activeNav === item.id ? 'active' : ''}`}
                onClick={() => goTo(item.id)}
              >
                <Icon size={17} />
                {item.label}
                {item.badge && <span className="td-nav-badge">{item.badge}</span>}
                {activeNav === item.id && <ChevronRight size={14} style={{ marginLeft: 'auto' }} />}
              </button>
            );
          })}
        </nav>

        <div className="td-sidebar-footer">
          <div className="td-user-card" onClick={handleLogout} title="Đăng xuất">
            <div className="td-avatar">{initials}</div>
            <div className="td-user-info">
              <p className="td-user-name">{userName}</p>
              <p className="td-user-role">Người ra đề · Đăng xuất</p>
            </div>
            <LogOut size={15} style={{ color: 'var(--ink-mute)', flexShrink: 0 }} />
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="td-main">
        {/* Topbar */}
        <header className="td-topbar">
          <div className="td-topbar-left">
            <h1>{topbarTitle}</h1>
            <p>Xin chào, {userName.split(' ').slice(-1)[0]}! Hôm nay là thứ {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}.</p>
          </div>
          <div className="td-topbar-right">
            {!isSpecialTab && (
              <div className="td-search-box">
                <Search size={15} />
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Tìm đề của bạn…"
                  style={{ border: 'none', background: 'transparent', outline: 'none', font: 'inherit', width: 160 }}
                />
              </div>
            )}
            <NotificationBell buttonClass="td-icon-btn" />
            {!isSpecialTab && (
              <button className="td-btn-primary" onClick={() => setModalExam({})}>
                <Plus size={16} /> Tạo bài thi
              </button>
            )}
          </div>
        </header>

        {isQuestionTab ? (
          <QuestionBank />
        ) : isRoomTab ? (
          <div className="td-content"><RoomManager /></div>
        ) : isCourseTab ? (
          <div className="td-content"><CourseManager /></div>
        ) : isOverviewTab ? (
          <div className="td-content"><TeacherOverview onGo={goTo} /></div>
        ) : isStudentTab ? (
          <div className="td-content"><StudentsView /></div>
        ) : isResultTab ? (
          <div className="td-content"><ResultView /></div>
        ) : (
        <div className="td-content">
          {/* Stats */}
          <div className="td-stats-row">
            {stats.map((s, i) => (
              <div key={i} className="td-stat-card">
                <div className="td-stat-icon" style={{ background: s.color }}>{s.icon}</div>
                <div className="td-stat-body">
                  <p className="td-stat-label">{s.label}</p>
                  <p className="td-stat-value">{s.value}</p>
                  <p className="td-stat-sub">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Bảng đề luyện thi — chiếm trọn chiều ngang */}
            <div className="td-section-card">
              <div className="td-section-header">
                <h2>Đề luyện thi của bạn</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                  {FILTERS.map(f => (
                    <button
                      key={f.id}
                      className="td-btn-ghost"
                      style={{ fontWeight: filterStatus === f.id ? 700 : 400, color: filterStatus === f.id ? 'var(--violet)' : undefined }}
                      onClick={() => setFilterStatus(f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="td-empty">
                  <Loader2 size={48} style={{ animation: 'spin 1s linear infinite' }} />
                  <h3>Đang tải đề thi...</h3>
                </div>
              ) : loadError ? (
                <div className="td-empty">
                  <AlertCircle size={56} style={{ color: 'var(--cinnabar)' }} />
                  <h3>Không tải được danh sách đề thi</h3>
                  <p>{loadError}</p>
                  <button className="td-btn-secondary" onClick={loadExams}>Thử lại</button>
                </div>
              ) : filteredExams.length === 0 ? (
                <div className="td-empty">
                  <ClipboardList size={56} />
                  <h3>{exams.length === 0 ? 'Chưa có đề thi nào' : 'Không có đề thi khớp bộ lọc'}</h3>
                  <p>Nhấn <strong>Tạo bài thi</strong> để bắt đầu.</p>
                </div>
              ) : (
                <table className="td-exam-table">
                  <thead>
                    <tr>
                      <th>Đề thi</th>
                      <th>Phạm vi</th>
                      <th>Câu hỏi</th>
                      <th>Thời gian</th>
                      <th>Nộp bài</th>
                      <th>Trạng thái</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExams.map(exam => (
                      <tr key={exam.examId}>
                        <td>
                          <div className="td-exam-name">{exam.title}</div>
                          <div className="td-exam-subject">
                            {[exam.subjectName, exam.levelName].filter(Boolean).join(' · ')}
                            {' · '}{formatDateTime(exam.startTime)}
                          </div>
                        </td>
                        <td style={{ color: 'var(--ink-mute)', fontSize: 13 }}>
                          {exam.isPublic ? 'Công khai' : exam.roomCount > 0 ? `${exam.roomCount} phòng` : 'Chưa gắn phòng'}
                        </td>
                        <td style={{ fontWeight: 600, color: exam.totalQuestions === 0 ? 'var(--cinnabar)' : 'var(--violet)' }}>
                          {exam.totalQuestions}
                        </td>
                        <td>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink-mute)', fontSize: 13 }}>
                            <Clock size={13} />{exam.durationMinutes} phút
                          </span>
                          {/* Hai thiết lập quyết định đề này là bài kiểm tra hay đề ôn. */}
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink-mute)', fontSize: 11.5, marginTop: 3 }}>
                            <RotateCcw size={11} />
                            {exam.maxAttempts == null ? 'không giới hạn lượt' : `${exam.maxAttempts} lượt`}
                            {!exam.allowReview && (
                              <span style={{ color: 'var(--gold)' }}> · ẩn đáp án</span>
                            )}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>
                            {exam.submissionCount}
                            {!exam.isPublic && exam.roomCount > 0 && (
                              <span style={{ color: 'var(--ink-mute)', fontWeight: 400 }}>/{exam.totalCandidates}</span>
                            )}
                          </span>
                        </td>
                        <td><StatusBadge status={exam.status} /></td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="td-btn-ghost" title="Gắn thêm câu hỏi vào đề"
                              style={{ color: exam.totalQuestions === 0 ? 'var(--gold)' : undefined }}
                              onClick={() => setAttachExam(exam)}>
                              <Plus size={14} /> Câu hỏi
                            </button>
                            <button className="td-btn-ghost" title="Chia phần thi theo chuẩn JLPT"
                              onClick={() => setSectionExam(exam)}>
                              <Layers size={14} />
                            </button>
                            <button className="td-btn-ghost" title="Chỉnh sửa"
                              onClick={() => setModalExam(exam)}>
                              <Edit3 size={14} />
                            </button>
                            <button className="td-btn-ghost" title="Xóa" style={{ color: 'var(--cinnabar)' }}
                              onClick={() => handleDelete(exam)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
        </div>
        )}
      </main>

      {/* ── CREATE / EDIT EXAM MODAL ── */}
      {modalExam && (
        <ExamFormModal
          initial={modalExam.examId ? modalExam : null}
          rooms={rooms}
          levels={levels}
          catalogLoading={catalogLoading}
          saving={saving}
          onClose={() => setModalExam(null)}
          onSave={handleSave}
        />
      )}

      {sectionExam && (
        <ExamSectionEditor
          exam={sectionExam}
          onClose={() => setSectionExam(null)}
          onSaved={loadExams}
        />
      )}

      {attachExam && (
        <AttachQuestionsModal
          exam={attachExam}
          onClose={() => setAttachExam(null)}
          onDone={async (msg) => {
            setAttachExam(null);
            showToast(msg);
            await loadExams();
          }}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
