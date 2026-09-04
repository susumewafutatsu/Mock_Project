import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard, FileText, BookOpen, Users, BarChart2,
  Plus, Search, Bell, LogOut, ChevronRight, Clock,
  CheckCircle2, X, Calendar, Hash, Timer,
  ClipboardList, Edit3, Trash2, School, Loader2, AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import QuestionBank from './QuestionBank';
import ClassManager from './ClassManager';
import classService from '../../services/classService';
import * as questionService from '../../services/questionService';
import * as teacherExamService from '../../services/teacherExamService';
import './TeacherDashboard.css';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'exams',     label: 'Quản lý đề thi', icon: FileText },
  { id: 'classes',   label: 'Lớp học', icon: School },
  { id: 'questions', label: 'Ngân hàng câu hỏi', icon: BookOpen },
  { id: 'students',  label: 'Học sinh', icon: Users },
  { id: 'results',   label: 'Kết quả & Phân tích', icon: BarChart2 },
];

// Nhãn tiếng Việt cho TeacherExamResponse.Status của backend
const STATUS_LABELS = {
  NO_QUESTIONS: 'Chưa có câu hỏi',
  UPCOMING: 'Sắp diễn ra',
  OPEN: 'Đang mở',
  CLOSED: 'Đã kết thúc',
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

  const color = type === 'success' ? '#34d399' : '#f87171';
  const Icon = type === 'success' ? CheckCircle2 : AlertCircle;

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: '#1a1e2a', border: `1px solid ${color}40`,
      borderRadius: 14, padding: '14px 20px',
      display: 'flex', alignItems: 'center', gap: 12,
      minWidth: 300, maxWidth: 420,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <Icon size={18} color={color} style={{ flexShrink: 0 }} />
      <p style={{ margin: 0, fontSize: 13.5, color: '#e2e8f0', flex: 1 }}>{message}</p>
      <button onClick={onClose} style={{
        background: 'none', border: 'none', cursor: 'pointer', color: '#64748b',
      }}>
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Question picker ──────────────────────────────────────────
// Chọn câu hỏi từ ngân hàng. Dùng chung cho form tạo/sửa đề và modal gắn thêm
// câu hỏi vào đề đã có. Tự quản lý việc tải ngân hàng + câu hỏi, chỉ báo ra
// ngoài danh sách questionId đang được tick.
function QuestionPicker({ selected, onChange, levelId, hint }) {
  const [banks, setBanks] = useState([]);
  const [bankId, setBankId] = useState('');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const data = (await questionService.getMyBanks()) ?? [];
        if (!alive) return;
        setBanks(data);
        // Ưu tiên ngân hàng cùng trình độ với đề, không có thì lấy cái đầu tiên.
        const preferred = levelId
          ? data.find(b => String(b.levelId) === String(levelId))
          : null;
        const pick = preferred ?? data[0];
        if (pick) setBankId(String(pick.bankId));
      } catch (err) {
        if (alive) setError(err.message || 'Không tải được ngân hàng câu hỏi');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // levelId chỉ dùng để đoán ngân hàng mặc định lần đầu, đổi trình độ giữa
    // form không nên nhảy ngân hàng và mất các câu đã tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!bankId) { setQuestions([]); return; }
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const page = await questionService.getQuestions(bankId, { page: 0, size: 200 });
        if (alive) setQuestions(page?.content ?? []);
      } catch (err) {
        if (alive) setError(err.message || 'Không tải được câu hỏi');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [bankId]);

  const toggle = (questionId) =>
    onChange(selected.includes(questionId)
      ? selected.filter(id => id !== questionId)
      : [...selected, questionId]);

  const allShownIds = questions.map(q => q.questionId);
  const allShownPicked = allShownIds.length > 0 && allShownIds.every(id => selected.includes(id));

  const toggleAll = () =>
    onChange(allShownPicked
      ? selected.filter(id => !allShownIds.includes(id))
      : [...new Set([...selected, ...allShownIds])]);

  return (
    <>
      <div className="td-form-group full">
        <label className="td-form-label">
          <BookOpen size={14} /> Lấy câu hỏi từ ngân hàng
        </label>
        <select
          className="td-form-select"
          value={bankId}
          onChange={(e) => setBankId(e.target.value)}
          disabled={banks.length === 0}
        >
          {banks.length === 0 && <option value="">Chưa có ngân hàng nào</option>}
          {banks.map(b => (
            <option key={b.bankId} value={b.bankId}>
              {b.title} ({b.totalQuestions} câu)
              {b.levelName ? ` · ${b.levelName}` : ''}
            </option>
          ))}
        </select>
        {hint && (
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
            {hint}
          </p>
        )}
      </div>

      <div className="td-form-group full">
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 8,
        }}>
          <span style={{ fontSize: 12.5, color: '#94a3b8' }}>
            Đã chọn <strong style={{ color: '#a78bfa' }}>{selected.length}</strong> câu
          </span>
          {questions.length > 0 && (
            <button type="button" className="td-btn-ghost" onClick={toggleAll}>
              {allShownPicked ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
          )}
        </div>

        <div style={{ maxHeight: 260, overflowY: 'auto', display: 'grid', gap: 8 }}>
          {loading && (
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Đang tải...</p>
          )}
          {!loading && banks.length === 0 && (
            <p style={{ margin: 0, fontSize: 13, color: '#fbbf24', lineHeight: 1.6 }}>
              Bạn chưa có ngân hàng câu hỏi nào. Sang tab <strong>Ngân hàng câu hỏi</strong>{' '}
              tạo ngân hàng và thêm câu hỏi trước, rồi quay lại đây.
            </p>
          )}
          {!loading && banks.length > 0 && questions.length === 0 && (
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              Ngân hàng này chưa có câu hỏi nào.
            </p>
          )}
          {!loading && questions.map(q => (
            <label key={q.questionId} style={{
              display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer',
              padding: '10px 12px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.07)',
              background: selected.includes(q.questionId)
                ? 'rgba(167,139,250,0.12)' : 'transparent',
            }}>
              <input
                type="checkbox"
                checked={selected.includes(q.questionId)}
                onChange={() => toggle(q.questionId)}
                style={{ marginTop: 3 }}
              />
              <span style={{ flex: 1, fontSize: 13, color: '#e2e8f0', lineHeight: 1.5 }}>
                {q.content}
                <span style={{ display: 'block', fontSize: 11.5, color: '#475569', marginTop: 3 }}>
                  {q.questionType} · độ khó {q.difficultyLevel ?? '—'}
                  {q.usedInExam ? ' · đã dùng trong đề khác' : ''}
                </span>
              </span>
            </label>
          ))}
        </div>

        {error && (
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#f87171' }}>{error}</p>
        )}
      </div>
    </>
  );
}

// ─── Create / Edit Exam Modal ─────────────────────────────────
function ExamFormModal({ initial, classes, levels, catalogLoading, onClose, onSave, saving }) {
  const isEdit = !!initial;
  const start = splitDateTime(initial?.startTime);
  const end = splitDateTime(initial?.endTime);

  const [form, setForm] = useState({
    title: initial?.title ?? '',
    classId: initial?.classId ?? '',
    levelId: initial?.levelId ?? '',
    durationMinutes: initial?.durationMinutes ?? '',
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    adaptive: initial?.adaptive ?? false,
  });
  const [error, setError] = useState(null);
  // Câu hỏi tick trong form. Đề được tạo xong sẽ gắn luôn các câu này, để không
  // rơi vào trạng thái NO_QUESTIONS (học sinh không vào thi được).
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

    if (!startAt || !endAt) {
      setError('Cần nhập cả thời gian mở đề và đóng đề.');
      return;
    }
    if (new Date(endAt) <= new Date(startAt)) {
      setError('Thời gian đóng đề phải sau thời gian mở đề.');
      return;
    }
    if (!isEdit && picked.length === 0) {
      setError('Chọn ít nhất một câu hỏi, nếu không học sinh sẽ không vào thi được.');
      return;
    }
    setError(null);

    onSave({
      title: form.title.trim(),
      // Để trống = đề luyện tập tự do (backend nhận classId null)
      classId: form.classId === '' ? null : Number(form.classId),
      levelId: Number(form.levelId),
      durationMinutes: Number(form.durationMinutes),
      startTime: startAt,
      endTime: endAt,
      adaptive: form.adaptive,
    }, picked);
  };

  return (
    <div className="td-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="td-modal">
        <div className="td-modal-header">
          <div>
            <h2>{isEdit ? '✏️ Sửa đề thi' : '✨ Tạo kỳ thi mới'}</h2>
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

              <div className="td-form-group">
                <label className="td-form-label">
                  <Users size={14} /> Lớp áp dụng
                </label>
                <select
                  className="td-form-select"
                  value={form.classId}
                  onChange={(e) => set('classId', e.target.value)}
                  disabled={catalogLoading}
                >
                  <option value="">Đề tự luyện (mọi học sinh đều thấy)</option>
                  {classes.map(c => (
                    <option key={c.classId} value={c.classId}>{c.className}</option>
                  ))}
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
                  <Calendar size={14} /> Mở đề lúc <span className="required">*</span>
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="td-form-input" type="date" required
                    value={form.startDate}
                    onChange={(e) => set('startDate', e.target.value)}
                  />
                  <input
                    className="td-form-input" type="time" required
                    value={form.startTime}
                    onChange={(e) => set('startTime', e.target.value)}
                  />
                </div>
              </div>

              <div className="td-form-group">
                <label className="td-form-label">
                  <Clock size={14} /> Đóng đề lúc <span className="required">*</span>
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="td-form-input" type="date" required
                    value={form.endDate}
                    onChange={(e) => set('endDate', e.target.value)}
                  />
                  <input
                    className="td-form-input" type="time" required
                    value={form.endTime}
                    onChange={(e) => set('endTime', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 16,
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
              <p style={{ margin: 0, fontSize: 13, color: '#f87171' }}>{error}</p>
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
                : `Tạo kỳ thi${picked.length > 0 ? ` (${picked.length} câu)` : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Attach Questions Modal ───────────────────────────────────
// Đề mới tạo ở trạng thái NO_QUESTIONS, học sinh chưa vào thi được cho tới khi
// có ít nhất một câu hỏi. Modal này chọn câu từ ngân hàng rồi POST snapshot.
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

          {error && <p style={{ margin: 0, fontSize: 13, color: '#f87171' }}>{error}</p>}
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
  const VALID_TABS = ['dashboard', 'exams', 'classes', 'questions', 'students', 'results'];
  const activeNav = VALID_TABS.includes(pathSegment) ? pathSegment : 'exams';

  // Chuyển tab bằng cách thay đổi URL
  const goTo = (tabId) => navigate(`/teacher/${tabId}`, { replace: false });

  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [classes, setClasses] = useState([]);
  const [levels, setLevels] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [modalExam, setModalExam] = useState(null); // null = đóng, {} = tạo mới, exam = sửa
  const [attachExam, setAttachExam] = useState(null); // đề đang gắn câu hỏi
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
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

  // Lớp + trình độ dùng cho form tạo/sửa đề. Trình độ phải lấy từ API vì
  // LevelID phải tồn tại thật trong DB, backend sẽ từ chối nếu không.
  const loadCatalog = useCallback(async () => {
    try {
      setCatalogLoading(true);
      const [cls, lvs] = await Promise.all([
        classService.getMyClasses(),
        classService.getLevels(),
      ]);
      setClasses(cls);
      setLevels(lvs);
    } catch (err) {
      showToast(err.message || 'Không thể tải danh sách lớp / trình độ', 'error');
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => { loadExams(); }, [loadExams]);
  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  // payload = thông tin đề, questionIds = câu hỏi tick trong form. Đề và câu hỏi
  // là 2 endpoint riêng (Exams không có cột BankID, câu hỏi vào đề qua snapshot
  // ExamQuestions) nên phải gọi 2 lượt; nếu bước gắn câu lỗi thì đề vẫn đã tạo,
  // phải nói rõ để giáo viên vào sửa đề gắn lại chứ không tạo đề mới.
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

  const filteredExams = filterStatus === 'all'
    ? exams
    : exams.filter(e => e.status === filterStatus);

  const stats = [
    {
      label: 'Tổng đề thi', value: exams.length, sub: 'Do bạn tạo',
      icon: '📋', color: 'rgba(167,139,250,0.15)',
    },
    {
      label: 'Đang mở', value: exams.filter(e => e.status === 'OPEN').length, sub: 'Học sinh đang làm',
      icon: '🟢', color: 'rgba(52,211,153,0.15)',
    },
    {
      label: 'Sắp diễn ra', value: exams.filter(e => e.status === 'UPCOMING').length, sub: 'Chưa tới giờ mở',
      icon: '⏰', color: 'rgba(251,191,36,0.15)',
    },
    {
      label: 'Chưa có câu hỏi',
      value: exams.filter(e => e.status === 'NO_QUESTIONS').length,
      sub: 'Cần gắn câu hỏi',
      icon: '⚠️', color: 'rgba(96,165,250,0.15)',
    },
  ];

  const isQuestionTab = activeNav === 'questions';
  const isClassTab    = activeNav === 'classes';
  const isSpecialTab  = isQuestionTab || isClassTab;

  const topbarTitle = isQuestionTab
    ? 'Ngân hàng câu hỏi'
    : isClassTab
      ? 'Quản lý lớp học'
      : 'Quản lý đề thi & Giao bài';

  const userName  = currentUser?.fullName || currentUser?.email || 'Giáo viên';
  const initials  = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="td-root">
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      {/* ── SIDEBAR ── */}
      <aside className="td-sidebar">
        <div className="td-sidebar-logo">
          <h2>📚 EduPlatform</h2>
          <p>Cổng giáo viên</p>
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
              <p className="td-user-role">Giáo viên · Đăng xuất</p>
            </div>
            <LogOut size={15} style={{ color: '#475569', flexShrink: 0 }} />
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
            <div className="td-search-box">
              <Search size={15} />
              <span>Tìm đề thi...</span>
            </div>
            <button className="td-icon-btn" title="Thông báo"><Bell size={17} /></button>
            {!isSpecialTab && (
              <button className="td-btn-primary" onClick={() => setModalExam({})}>
                <Plus size={16} /> Tạo kỳ thi
              </button>
            )}
          </div>
        </header>

        {isQuestionTab ? (
          <QuestionBank />
        ) : isClassTab ? (
          <div className="td-content"><ClassManager /></div>
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

          {/* Main Grid */}
          <div className="td-main-grid">
            {/* Exam Table */}
            <div className="td-section-card">
              <div className="td-section-header">
                <h2>Danh sách đề thi</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                  {FILTERS.map(f => (
                    <button
                      key={f.id}
                      className="td-btn-ghost"
                      style={{ fontWeight: filterStatus === f.id ? 700 : 400, color: filterStatus === f.id ? '#a78bfa' : undefined }}
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
                  <AlertCircle size={56} style={{ color: '#f87171' }} />
                  <h3>Không tải được danh sách đề thi</h3>
                  <p>{loadError}</p>
                  <button className="td-btn-secondary" onClick={loadExams}>Thử lại</button>
                </div>
              ) : filteredExams.length === 0 ? (
                <div className="td-empty">
                  <ClipboardList size={56} />
                  <h3>{exams.length === 0 ? 'Chưa có đề thi nào' : 'Không có đề thi khớp bộ lọc'}</h3>
                  <p>Nhấn <strong>Tạo kỳ thi</strong> để bắt đầu.</p>
                </div>
              ) : (
                <table className="td-exam-table">
                  <thead>
                    <tr>
                      <th>Đề thi</th>
                      <th>Lớp</th>
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
                        <td style={{ color: '#94a3b8', fontSize: 13 }}>
                          {exam.className || 'Đề tự luyện'}
                        </td>
                        <td style={{ fontWeight: 600, color: exam.totalQuestions === 0 ? '#f87171' : '#a78bfa' }}>
                          {exam.totalQuestions}
                        </td>
                        <td>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#94a3b8', fontSize: 13 }}>
                            <Clock size={13} />{exam.durationMinutes} phút
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>
                            {exam.submissionCount}
                            {exam.classId != null && (
                              <span style={{ color: '#475569', fontWeight: 400 }}>/{exam.totalStudents}</span>
                            )}
                          </span>
                        </td>
                        <td><StatusBadge status={exam.status} /></td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="td-btn-ghost" title="Gắn thêm câu hỏi vào đề"
                              style={{ color: exam.totalQuestions === 0 ? '#fbbf24' : undefined }}
                              onClick={() => setAttachExam(exam)}>
                              <Plus size={14} /> Câu hỏi
                            </button>
                            <button className="td-btn-ghost" title="Chỉnh sửa"
                              onClick={() => setModalExam(exam)}>
                              <Edit3 size={14} />
                            </button>
                            <button className="td-btn-ghost" title="Xóa" style={{ color: '#f87171' }}
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

            {/* Quick Panel */}
            <div>
              <div className="td-section-card" style={{ marginBottom: 20 }}>
                <div className="td-section-header"><h2>Thao tác nhanh</h2></div>
                <div className="td-quick-panel">
                  <button className="td-quick-btn" onClick={() => setModalExam({})}>
                    <div className="td-quick-btn-icon" style={{ background: 'rgba(167,139,250,0.15)' }}>✨</div>
                    <div className="td-quick-btn-body">
                      <p className="td-quick-btn-title">Tạo kỳ thi mới</p>
                      <p className="td-quick-btn-desc">Thiết lập đề thi cho lớp học</p>
                    </div>
                    <ChevronRight size={16} style={{ color: '#475569' }} />
                  </button>

                  <button className="td-quick-btn" onClick={() => goTo('questions')}>
                    <div className="td-quick-btn-icon" style={{ background: 'rgba(96,165,250,0.15)' }}>📝</div>
                    <div className="td-quick-btn-body">
                      <p className="td-quick-btn-title">Ngân hàng câu hỏi</p>
                      <p className="td-quick-btn-desc">Thêm câu hỏi & gắn vào đề</p>
                    </div>
                    <ChevronRight size={16} style={{ color: '#475569' }} />
                  </button>

                  <button className="td-quick-btn" onClick={() => goTo('classes')}>
                    <div className="td-quick-btn-icon" style={{ background: 'rgba(251,191,36,0.15)' }}>🏫</div>
                    <div className="td-quick-btn-body">
                      <p className="td-quick-btn-title">Quản lý lớp học</p>
                      <p className="td-quick-btn-desc">Thêm lớp, thêm học sinh vào lớp</p>
                    </div>
                    <ChevronRight size={16} style={{ color: '#475569' }} />
                  </button>

                  <button className="td-quick-btn" onClick={() => goTo('results')}>
                    <div className="td-quick-btn-icon" style={{ background: 'rgba(52,211,153,0.15)' }}>📊</div>
                    <div className="td-quick-btn-body">
                      <p className="td-quick-btn-title">Xem kết quả</p>
                      <p className="td-quick-btn-desc">Phân tích điểm số học sinh</p>
                    </div>
                    <ChevronRight size={16} style={{ color: '#475569' }} />
                  </button>
                </div>
              </div>

              {/* Đề cần gắn câu hỏi */}
              <div className="td-section-card">
                <div className="td-section-header"><h2>Cần xử lý</h2></div>
                <div style={{ padding: '12px 20px' }}>
                  {(() => {
                    const pending = exams.filter(e => e.status === 'NO_QUESTIONS');
                    if (loading) {
                      return <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Đang tải...</p>;
                    }
                    if (pending.length === 0) {
                      return (
                        <p style={{ margin: 0, fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <CheckCircle2 size={15} style={{ color: '#34d399' }} />
                          Mọi đề thi đều đã có câu hỏi.
                        </p>
                      );
                    }
                    return pending.map((e, i) => (
                      <div key={e.examId} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0',
                        borderBottom: i < pending.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      }}>
                        <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 13, color: '#e2e8f0', lineHeight: 1.4 }}>{e.title}</p>
                          <p style={{ margin: '3px 0 0', fontSize: 11.5, color: '#475569' }}>
                            Chưa có câu hỏi — học sinh chưa vào thi được
                          </p>
                        </div>
                        <button className="td-btn-ghost" title="Gắn câu hỏi"
                          style={{ color: '#fbbf24' }}
                          onClick={() => setAttachExam(e)}>
                          <Plus size={14} /> Gắn câu
                        </button>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
        )}
      </main>

      {/* ── CREATE / EDIT EXAM MODAL ── */}
      {modalExam && (
        <ExamFormModal
          initial={modalExam.examId ? modalExam : null}
          classes={classes}
          levels={levels}
          catalogLoading={catalogLoading}
          saving={saving}
          onClose={() => setModalExam(null)}
          onSave={handleSave}
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
