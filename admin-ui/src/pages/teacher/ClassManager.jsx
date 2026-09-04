import React, { useState, useEffect, useCallback } from 'react';
import {
  School, Plus, Edit3, Trash2, Users, X, Search,
  UserPlus, UserMinus, BookOpen, ChevronRight, Loader2,
  GraduationCap, AlertCircle, CheckCircle2,
} from 'lucide-react';
import classService from '../../services/classService';
import './TeacherDashboard.css';

// ─── Toast ──────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  const bg = type === 'success'
    ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.12)';
  const color = type === 'success' ? '#34d399' : '#f87171';
  const Icon = type === 'success' ? CheckCircle2 : AlertCircle;

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: '#1a1e2a', border: `1px solid ${color}40`,
      borderRadius: 14, padding: '14px 20px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${color}20`,
      animation: 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)',
      minWidth: 300, maxWidth: 420,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10,
        background: bg, display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={17} color={color} />
      </div>
      <p style={{ margin: 0, fontSize: 13.5, color: '#e2e8f0', flex: 1 }}>{message}</p>
      <button onClick={onClose} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#64748b', padding: 4, borderRadius: 6,
      }}>
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────
function ClassStatCard({ icon, label, value, color }) {
  return (
    <div className="td-stat-card">
      <div className="td-stat-icon" style={{ background: color + '20' }}>
        {icon}
      </div>
      <div className="td-stat-body">
        <p className="td-stat-label">{label}</p>
        <p className="td-stat-value">{value}</p>
      </div>
    </div>
  );
}

// ─── Class Card ─────────────────────────────────────────────────
function ClassCard({ cls, onEdit, onDelete, onViewStudents }) {
  return (
    <div style={{
      background: '#151820',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 16, padding: '22px 24px',
      display: 'flex', flexDirection: 'column', gap: 16,
      transition: 'border-color 0.2s, transform 0.2s',
      cursor: 'default',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(167,139,250,0.3)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 12, flexShrink: 0,
          background: 'rgba(167,139,250,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <School size={21} color="#a78bfa" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#f1f5f9', lineHeight: 1.3 }}>
            {cls.className}
          </p>
          {cls.courseCode && (
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>
              {cls.courseCode}
            </p>
          )}
        </div>
      </div>

      {/* Subject/Level */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {cls.subjectName && (
          <span style={{
            background: 'rgba(96,165,250,0.1)', color: '#60a5fa',
            fontSize: 12, fontWeight: 600, padding: '4px 11px',
            borderRadius: 999,
          }}>
            📘 {cls.subjectName}
          </span>
        )}
        {cls.levelName && (
          <span style={{
            background: 'rgba(52,211,153,0.1)', color: '#34d399',
            fontSize: 12, fontWeight: 600, padding: '4px 11px',
            borderRadius: 999,
          }}>
            {cls.levelName}
          </span>
        )}
      </div>

      {/* Student count */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px', borderRadius: 10,
        background: 'rgba(255,255,255,0.04)',
      }}>
        <Users size={15} color="#94a3b8" />
        <span style={{ fontSize: 13, color: '#94a3b8' }}>
          <strong style={{ color: '#f1f5f9' }}>{cls.studentCount}</strong> học sinh
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
        <button className="td-btn-secondary" style={{ flex: 1, justifyContent: 'center', fontSize: 12.5 }}
          onClick={() => onViewStudents(cls)}>
          <Users size={13} /> Học sinh
        </button>
        <button className="td-btn-secondary" style={{ padding: '9px 12px' }}
          onClick={() => onEdit(cls)} title="Chỉnh sửa">
          <Edit3 size={14} />
        </button>
        <button onClick={() => onDelete(cls)} title="Xóa lớp"
          style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
            borderRadius: 10, padding: '9px 12px', cursor: 'pointer', color: '#f87171',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.18)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Class Form Modal ────────────────────────────────────────────
function ClassFormModal({ initial, levels, levelsLoading, onSave, onClose, saving }) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    className: initial?.className ?? '',
    courseCode: initial?.courseCode ?? '',
    levelId: initial?.levelId ?? (levels[0]?.levelId ?? ''),
  });

  // Trình độ có thể tải xong sau khi modal đã mở → chọn sẵn giá trị đầu tiên.
  useEffect(() => {
    if (!form.levelId && levels.length > 0) {
      setForm(f => ({ ...f, levelId: levels[0].levelId }));
    }
  }, [levels, form.levelId]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.className.trim() || !form.levelId) return;
    onSave({ ...form, levelId: Number(form.levelId) });
  };

  return (
    <div className="td-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="td-modal" style={{ maxWidth: 560 }}>
        <div className="td-modal-header">
          <div>
            <h2 style={{ color: '#f1f5f9' }}>{isEdit ? 'Chỉnh sửa lớp học' : 'Tạo lớp học mới'}</h2>
            <p>{isEdit ? `Đang chỉnh sửa: ${initial.className}` : 'Điền thông tin để tạo lớp mới'}</p>
          </div>
          <button className="td-close-btn" onClick={onClose}><X size={15} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="td-modal-body">
            <div className="td-form-group">
              <label className="td-form-label">
                Tên lớp học <span className="required">*</span>
              </label>
              <input
                className="td-form-input"
                placeholder="Vd: N4 – Tối Thứ 3/5"
                value={form.className}
                onChange={e => set('className', e.target.value)}
                required
                maxLength={100}
              />
            </div>

            <div className="td-form-row">
              <div className="td-form-group">
                <label className="td-form-label">Mã khóa học</label>
                <input
                  className="td-form-input"
                  placeholder="Vd: N4-T35-2026"
                  value={form.courseCode}
                  onChange={e => set('courseCode', e.target.value)}
                  maxLength={20}
                />
              </div>

              <div className="td-form-group">
                <label className="td-form-label">
                  Trình độ <span className="required">*</span>
                </label>
                <select
                  className="td-form-select"
                  value={form.levelId}
                  onChange={e => set('levelId', e.target.value)}
                  required
                  disabled={levelsLoading || levels.length === 0}
                >
                  {levelsLoading && <option value="">Đang tải...</option>}
                  {!levelsLoading && levels.length === 0 && (
                    <option value="">Chưa có trình độ nào</option>
                  )}
                  {levels.map(lv => (
                    <option key={lv.levelId} value={lv.levelId}>
                      {lv.subjectName ? `${lv.subjectName} – ` : ''}{lv.levelName}
                    </option>
                  ))}
                </select>
                {!levelsLoading && levels.length === 0 && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: '#f87171' }}>
                    Chưa có môn học / trình độ nào trong hệ thống. Nhờ Admin thêm
                    môn học và trình độ trước khi tạo lớp.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="td-modal-footer">
            <button type="button" className="td-btn-secondary" onClick={onClose} disabled={saving}>
              Hủy
            </button>
            <button type="submit" className="td-btn-primary"
              disabled={saving || levelsLoading || levels.length === 0}>
              {saving ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : null}
              {isEdit ? 'Lưu thay đổi' : 'Tạo lớp học'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Student Panel Modal ─────────────────────────────────────────
function StudentPanelModal({ cls, onClose }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addEmail, setAddEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  const loadStudents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await classService.getStudents(cls.classId);
      setStudents(data);
    } catch (err) {
      showToast(err.message || 'Không thể tải danh sách học sinh', 'error');
    } finally {
      setLoading(false);
    }
  }, [cls.classId]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addEmail.trim()) return;
    setAdding(true);
    try {
      await classService.addStudent(cls.classId, addEmail.trim());
      setAddEmail('');
      showToast('Thêm học sinh thành công');
      loadStudents();
    } catch (err) {
      showToast(err.message || 'Không thể thêm học sinh', 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (studentId, name) => {
    if (!window.confirm(`Xóa học sinh "${name}" khỏi lớp?`)) return;
    setRemoving(studentId);
    try {
      await classService.removeStudent(cls.classId, studentId);
      showToast('Đã xóa học sinh khỏi lớp');
      loadStudents();
    } catch (err) {
      showToast(err.message || 'Không thể xóa học sinh', 'error');
    } finally {
      setRemoving(null);
    }
  };

  const filtered = students.filter(s =>
    s.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="td-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="td-modal" style={{ maxWidth: 660 }}>
        <div className="td-modal-header">
          <div>
            <h2 style={{ color: '#f1f5f9' }}>Học sinh – {cls.className}</h2>
            <p>{students.length} học sinh đang đăng ký</p>
          </div>
          <button className="td-close-btn" onClick={onClose}><X size={15} /></button>
        </div>

        <div className="td-modal-body">
          {/* Add student form */}
          <form onSubmit={handleAdd}>
            <div className="td-form-group">
              <label className="td-form-label"><UserPlus size={14} /> Thêm học sinh qua email</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  className="td-form-input"
                  placeholder="email@example.com"
                  type="email"
                  value={addEmail}
                  onChange={e => setAddEmail(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="td-btn-primary" disabled={adding || !addEmail.trim()}>
                  {adding
                    ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Plus size={14} />}
                  Thêm
                </button>
              </div>
            </div>
          </form>

          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: '9px 14px',
          }}>
            <Search size={14} color="#64748b" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm kiếm học sinh..."
              style={{
                background: 'none', border: 'none', outline: 'none',
                color: '#e2e8f0', fontSize: 13.5, width: '100%',
              }}
            />
          </div>

          {/* Student list */}
          <div style={{
            background: '#151820', borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.06)',
            overflow: 'hidden', maxHeight: 340, overflowY: 'auto',
          }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#475569' }}>
                <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 10 }} />
                <p style={{ margin: 0, fontSize: 13 }}>Đang tải...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="td-empty">
                <GraduationCap size={36} />
                <h3>{search ? 'Không tìm thấy học sinh' : 'Chưa có học sinh nào'}</h3>
                <p>{search ? 'Thử từ khóa khác' : 'Thêm học sinh bằng email ở trên'}</p>
              </div>
            ) : (
              filtered.map((s, i) => (
                <div key={s.studentId} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '13px 18px',
                  borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  transition: 'background 0.12s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: 'linear-gradient(135deg, #a78bfa, #60a5fa)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 13, color: '#fff',
                  }}>
                    {s.fullName?.charAt(0)?.toUpperCase() ?? '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 13.5, color: '#e2e8f0' }}>
                      {s.fullName}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>{s.email}</p>
                  </div>
                  <button
                    onClick={() => handleRemove(s.studentId, s.fullName)}
                    disabled={removing === s.studentId}
                    title="Xóa khỏi lớp"
                    style={{
                      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
                      borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#f87171',
                      transition: 'all 0.15s', display: 'flex', alignItems: 'center',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.18)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                  >
                    {removing === s.studentId
                      ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      : <UserMinus size={14} />}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="td-modal-footer" style={{ justifyContent: 'flex-start' }}>
          <span style={{ fontSize: 12.5, color: '#475569' }}>
            Tổng: {students.length} học sinh đăng ký
          </span>
          <button className="td-btn-secondary" style={{ marginLeft: 'auto' }} onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
      {toast && (
        <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

// ─── Delete Confirm Modal ────────────────────────────────────────
function DeleteConfirmModal({ cls, onConfirm, onClose, deleting }) {
  return (
    <div className="td-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="td-modal" style={{ maxWidth: 440 }}>
        <div className="td-modal-header">
          <div>
            <h2 style={{ color: '#f87171' }}>Xóa lớp học</h2>
            <p>Hành động này không thể hoàn tác</p>
          </div>
          <button className="td-close-btn" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="td-modal-body">
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 12, padding: '16px 18px',
          }}>
            <p style={{ margin: 0, color: '#fca5a5', fontSize: 14, lineHeight: 1.6 }}>
              Bạn sắp xóa lớp <strong>"{cls.className}"</strong>.
              Tất cả {cls.studentCount} học sinh đang đăng ký sẽ bị xóa khỏi lớp.
            </p>
          </div>
        </div>
        <div className="td-modal-footer">
          <button className="td-btn-secondary" onClick={onClose} disabled={deleting}>
            Hủy
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            style={{
              background: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none',
              borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all 0.2s', fontFamily: 'inherit',
            }}
          >
            {deleting
              ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              : <Trash2 size={14} />}
            Xóa lớp học
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ClassManager ───────────────────────────────────────────
export default function ClassManager() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [formModal, setFormModal] = useState(null);   // null | 'create' | ClassResponse
  const [studentModal, setStudentModal] = useState(null); // null | ClassResponse
  const [deleteModal, setDeleteModal] = useState(null);   // null | ClassResponse

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  // Danh sách trình độ lấy từ API — không hard-code, vì LevelID phải tồn tại
  // thật trong DB, nếu không backend sẽ từ chối khi tạo/sửa lớp.
  const [levels, setLevels] = useState([]);
  const [levelsLoading, setLevelsLoading] = useState(true);

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  const loadClasses = useCallback(async () => {
    try {
      setLoading(true);
      const data = await classService.getMyClasses();
      setClasses(data);
    } catch (err) {
      showToast(err.message || 'Không thể tải danh sách lớp học', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLevels = useCallback(async () => {
    try {
      setLevelsLoading(true);
      const data = await classService.getLevels();
      setLevels(data);
    } catch (err) {
      showToast(err.message || 'Không thể tải danh sách trình độ', 'error');
    } finally {
      setLevelsLoading(false);
    }
  }, []);

  useEffect(() => { loadClasses(); }, [loadClasses]);
  useEffect(() => { loadLevels(); }, [loadLevels]);

  // ── Save (create / update) ───────────────────────────────────
  const handleSave = async (formData) => {
    setSaving(true);
    try {
      if (formModal && typeof formModal === 'object') {
        await classService.updateClass(formModal.classId, formData);
        showToast('Cập nhật lớp học thành công');
      } else {
        await classService.createClass(formData);
        showToast('Tạo lớp học thành công');
      }
      setFormModal(null);
      loadClasses();
    } catch (err) {
      showToast(err.message || 'Thao tác thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteModal) return;
    setDeleting(true);
    try {
      await classService.deleteClass(deleteModal.classId);
      showToast('Đã xóa lớp học thành công');
      setDeleteModal(null);
      loadClasses();
    } catch (err) {
      showToast(err.message || 'Không thể xóa lớp học', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // ── Filter ───────────────────────────────────────────────────
  const filtered = classes.filter(c =>
    c.className?.toLowerCase().includes(search.toLowerCase()) ||
    c.subjectName?.toLowerCase().includes(search.toLowerCase()) ||
    c.levelName?.toLowerCase().includes(search.toLowerCase()) ||
    c.courseCode?.toLowerCase().includes(search.toLowerCase())
  );

  const totalStudents = classes.reduce((s, c) => s + (c.studentCount ?? 0), 0);

  return (
    <div>
      {/* ── Stats ─────────────────────────────────────────────── */}
      <div className="td-stats-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <ClassStatCard
          icon={<School size={21} color="#a78bfa" />}
          label="Tổng số lớp"
          value={classes.length}
          color="#a78bfa"
        />
        <ClassStatCard
          icon={<Users size={21} color="#60a5fa" />}
          label="Tổng học sinh"
          value={totalStudents}
          color="#60a5fa"
        />
        <ClassStatCard
          icon={<BookOpen size={21} color="#34d399" />}
          label="Đang hoạt động"
          value={classes.length}
          color="#34d399"
        />
      </div>

      {/* ── Toolbar ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 9,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, padding: '9px 14px',
        }}>
          <Search size={14} color="#64748b" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm lớp học, môn, trình độ..."
            style={{
              background: 'none', border: 'none', outline: 'none',
              color: '#e2e8f0', fontSize: 13.5, width: '100%',
              fontFamily: 'inherit',
            }}
          />
        </div>
        <button className="td-btn-primary" onClick={() => setFormModal('create')}>
          <Plus size={15} /> Tạo lớp mới
        </button>
      </div>

      {/* ── Grid ──────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ padding: 80, textAlign: 'center', color: '#475569' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: 14 }} />
          <p style={{ margin: 0, fontSize: 14 }}>Đang tải danh sách lớp học...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="td-empty">
          <School size={48} />
          <h3>{search ? 'Không tìm thấy lớp nào' : 'Chưa có lớp học nào'}</h3>
          <p style={{ marginBottom: 20 }}>
            {search ? 'Thử từ khóa khác hoặc xóa bộ lọc' : 'Nhấn "Tạo lớp mới" để bắt đầu'}
          </p>
          {!search && (
            <button className="td-btn-primary" onClick={() => setFormModal('create')}>
              <Plus size={15} /> Tạo lớp học đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 18,
        }}>
          {filtered.map(cls => (
            <ClassCard
              key={cls.classId}
              cls={cls}
              onEdit={setFormModal}
              onDelete={setDeleteModal}
              onViewStudents={setStudentModal}
            />
          ))}
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────── */}
      {formModal && (
        <ClassFormModal
          initial={typeof formModal === 'object' ? formModal : null}
          levels={levels}
          levelsLoading={levelsLoading}
          onSave={handleSave}
          onClose={() => setFormModal(null)}
          saving={saving}
        />
      )}

      {studentModal && (
        <StudentPanelModal
          cls={studentModal}
          onClose={() => setStudentModal(null)}
        />
      )}

      {deleteModal && (
        <DeleteConfirmModal
          cls={deleteModal}
          onConfirm={handleDelete}
          onClose={() => setDeleteModal(null)}
          deleting={deleting}
        />
      )}

      {/* ── Toast ─────────────────────────────────────────────── */}
      {toast && (
        <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* ── CSS for spin animation ─────────────────────────────── */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
