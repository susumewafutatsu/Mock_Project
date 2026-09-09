// src/pages/teacher/CourseManager.jsx
// Soạn khoá học — nơi người ra đề viết NGỮ PHÁP và CHỮ HÁN.
//
// Quy trình: soạn (Nháp) → gửi duyệt (Chờ duyệt) → Admin duyệt (Xuất bản)
// hoặc trả lại kèm lý do (Bị trả lại → sửa → gửi lại).
//
// Hai điều màn hình này phải nói rõ, vì cả hai đều do backend chặn và người
// dùng sẽ bực nếu chỉ biết khi bấm vào rồi bị từ chối:
//   - Khoá chưa có bài nào thì không gửi duyệt được.
//   - Khoá đang Chờ duyệt thì không sửa được (Admin đang xem bản đó).
//
// Ô soạn nội dung cố ý chỉ là một textarea. Bản kế hoạch trước có trình soạn
// theo khối với sáu loại khối — phần tốn công nhất của cả mảng học tập, đổi
// lại một khoảng giá trị nhỏ.

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle, BookOpen, CheckCircle2, ChevronRight, Clock, Edit3,
  FileText, Loader2, Plus, Send, Trash2, X,
} from 'lucide-react';
import courseService from '../../services/courseService';
import roomService from '../../services/roomService';
import './TeacherDashboard.css';

const STATUS = {
  DRAFT:     { label: 'Nháp',        cls: 'draft',    hint: 'Chỉ mình bạn thấy' },
  PENDING:   { label: 'Chờ duyệt',   cls: 'upcoming', hint: 'Quản trị viên đang xem — không sửa được lúc này' },
  PUBLISHED: { label: 'Đã xuất bản', cls: 'open',     hint: 'Thí sinh đang học được' },
  REJECTED:  { label: 'Bị trả lại',  cls: 'closed',   hint: 'Sửa theo góp ý rồi gửi lại' },
};

const LESSON_TYPES = [
  { value: 'GRAMMAR',   label: 'Ngữ pháp' },
  { value: 'KANJI',     label: 'Chữ Hán' },
  { value: 'VOCAB',     label: 'Từ vựng' },
  { value: 'READING',   label: 'Đọc hiểu' },
  { value: 'LISTENING', label: 'Nghe' },
];

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
      minWidth: 300, maxWidth: 440, boxShadow: 'var(--shadow-lg)',
    }}>
      <Icon size={18} color={color} style={{ flexShrink: 0 }} />
      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-body)', flex: 1 }}>{message}</p>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)' }}>
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Modal: tạo / sửa khoá ───────────────────────────────────────

function CourseFormModal({ initial, levels, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    levelId: initial?.levelId ?? '',
  });
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Chưa đặt tên khoá học'); return; }
    setError(null);
    onSave({
      title: form.title.trim(),
      description: form.description.trim() || null,
      levelId: form.levelId === '' ? null : Number(form.levelId),
    });
  };

  return (
    <div className="td-modal-overlay" onClick={onClose}>
      <div className="td-modal" onClick={(e) => e.stopPropagation()}>
        <div className="td-modal-header">
          <h3>{initial ? 'Sửa khoá học' : 'Tạo khoá học mới'}</h3>
          <button className="td-close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="td-modal-body">
            {error && (
              <div style={{
                background: 'var(--cinnabar-wash)', color: 'var(--cinnabar-deep)',
                padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 14,
              }}>{error}</div>
            )}

            <div className="td-form-group full">
              <label className="td-form-label">
                <BookOpen size={14} /> Tên khoá học <span className="required">*</span>
              </label>
              <input className="td-form-input" value={form.title} autoFocus
                     onChange={(e) => set('title', e.target.value)}
                     placeholder="VD: Ngữ pháp N5 — 6 mẫu câu nền tảng" />
            </div>

            <div className="td-form-group full">
              <label className="td-form-label">Mô tả ngắn</label>
              <textarea className="td-form-input" rows={2} value={form.description}
                        onChange={(e) => set('description', e.target.value)}
                        placeholder="Khoá này dạy gì, cho ai" />
            </div>

            <div className="td-form-group full">
              <label className="td-form-label">Trình độ</label>
              <select className="td-form-select" value={form.levelId}
                      onChange={(e) => set('levelId', e.target.value)}>
                <option value="">Không gắn trình độ</option>
                {levels.map((lv) => (
                  <option key={lv.levelId} value={lv.levelId}>
                    {lv.levelName}{lv.subjectName ? ` · ${lv.subjectName}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {!initial && (
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-mute)', lineHeight: 1.6 }}>
                Khoá mới ở dạng <strong>Nháp</strong>. Thêm bài học rồi gửi duyệt;
                quản trị viên duyệt xong thí sinh mới thấy.
              </p>
            )}
          </div>
          <div className="td-modal-footer">
            <button type="button" className="td-btn-secondary" onClick={onClose}>Huỷ</button>
            <button type="submit" className="td-btn-primary" disabled={saving}>
              {saving ? <><Loader2 size={14} className="td-spin" /> Đang lưu…</> : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: tạo / sửa bài học ────────────────────────────────────

function LessonFormModal({ initial, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    lessonType: initial?.lessonType ?? 'GRAMMAR',
    content: initial?.content ?? '',
    estimatedMinutes: initial?.estimatedMinutes == null ? '' : String(initial.estimatedMinutes),
  });
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Chưa đặt tên bài học'); return; }
    setError(null);
    onSave({
      title: form.title.trim(),
      lessonType: form.lessonType,
      content: form.content,
      estimatedMinutes: form.estimatedMinutes === '' ? null : Number(form.estimatedMinutes),
    });
  };

  return (
    <div className="td-modal-overlay" onClick={onClose}>
      <div className="td-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680 }}>
        <div className="td-modal-header">
          <h3>{initial ? 'Sửa bài học' : 'Thêm bài học'}</h3>
          <button className="td-close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="td-modal-body">
            {error && (
              <div style={{
                background: 'var(--cinnabar-wash)', color: 'var(--cinnabar-deep)',
                padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 14,
              }}>{error}</div>
            )}

            <div className="td-form-row">
              <div className="td-form-group">
                <label className="td-form-label">
                  Tên bài <span className="required">*</span>
                </label>
                <input className="td-form-input" value={form.title} autoFocus
                       onChange={(e) => set('title', e.target.value)}
                       placeholder="VD: 〜てもいいです — Xin phép" />
              </div>
              <div className="td-form-group">
                <label className="td-form-label">Loại nội dung</label>
                <select className="td-form-select" value={form.lessonType}
                        onChange={(e) => set('lessonType', e.target.value)}>
                  {LESSON_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="td-form-group full">
              <label className="td-form-label">
                <Clock size={14} /> Thời gian đọc ước tính (phút)
              </label>
              <input className="td-form-input" type="number" min="1"
                     value={form.estimatedMinutes}
                     onChange={(e) => set('estimatedMinutes', e.target.value)}
                     placeholder="VD: 8" />
            </div>

            <div className="td-form-group full">
              <label className="td-form-label">
                <FileText size={14} /> Nội dung lý thuyết
              </label>
              <textarea
                className="td-form-input"
                rows={14}
                value={form.content}
                onChange={(e) => set('content', e.target.value)}
                style={{ fontFamily: 'var(--mono)', fontSize: 13, lineHeight: 1.7 }}
                placeholder={'CẤU TRÚC\nĐộng từ thể て + もいいです。\n\nVÍ DỤ\nここに座ってもいいですか。\n\nLỖI THƯỜNG GẶP\n…'}
              />
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--ink-faint)', lineHeight: 1.55 }}>
                Văn bản thuần — xuống dòng giữ nguyên khi thí sinh đọc. Đây là chỗ
                giải thích cấu trúc, cách nối và sắc thái: thứ một tấm thẻ lật
                không chứa nổi.
              </p>
            </div>
          </div>
          <div className="td-modal-footer">
            <button type="button" className="td-btn-secondary" onClick={onClose}>Huỷ</button>
            <button type="submit" className="td-btn-primary" disabled={saving}>
              {saving ? <><Loader2 size={14} className="td-spin" /> Đang lưu…</> : 'Lưu bài học'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: danh sách bài của một khoá ───────────────────────────

function CourseLessonsModal({ course, onClose, onChanged, showToast }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lessonModal, setLessonModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const editable = STATUS[course.status] && course.status !== 'PENDING';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDetail(await courseService.getCourse(course.courseId));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [course.courseId, showToast]);

  useEffect(() => { load(); }, [load]);

  const saveLesson = async (data) => {
    setSaving(true);
    try {
      const updated = lessonModal?.lessonId
        ? await courseService.updateLesson(course.courseId, lessonModal.lessonId, data)
        : await courseService.addLesson(course.courseId, data);
      setDetail(updated);
      setLessonModal(null);
      onChanged();
      showToast(lessonModal?.lessonId ? 'Đã cập nhật bài học' : 'Đã thêm bài học');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeLesson = async (lesson) => {
    if (!window.confirm(`Xoá bài "${lesson.title}"?`)) return;
    try {
      setDetail(await courseService.deleteLesson(course.courseId, lesson.lessonId));
      onChanged();
      showToast('Đã xoá bài học');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  /** Mở form sửa cần nội dung đầy đủ, mà danh sách bài cố ý không kèm content. */
  const openEdit = async (lesson) => {
    try {
      const full = await courseService.getLesson(course.courseId, lesson.lessonId);
      setLessonModal(full);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <>
      <div className="td-modal-overlay" onClick={onClose}>
        <div className="td-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
          <div className="td-modal-header">
            <h3>{course.title}</h3>
            <button className="td-close-btn" onClick={onClose}><X size={16} /></button>
          </div>

          <div className="td-modal-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              <span className={`td-badge ${STATUS[course.status]?.cls}`}>
                {STATUS[course.status]?.label}
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>
                {STATUS[course.status]?.hint}
              </span>
            </div>

            {course.status === 'REJECTED' && course.reviewNote && (
              <div className="st-review-note" style={{ marginBottom: 16 }}>
                <b>Quản trị viên trả lại:</b> {course.reviewNote}
              </div>
            )}

            {loading ? (
              <div className="td-empty"><Loader2 size={18} className="td-spin" /> Đang tải…</div>
            ) : (
              <>
                {editable && (
                  <button className="td-btn-primary" style={{ marginBottom: 14 }}
                          onClick={() => setLessonModal({})}>
                    <Plus size={14} /> Thêm bài học
                  </button>
                )}

                {(detail?.lessons ?? []).length === 0 ? (
                  <div className="td-empty" style={{ padding: '28px 12px' }}>
                    Chưa có bài nào. Khoá rỗng thì không gửi duyệt được.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {detail.lessons.map((l) => (
                      <div key={l.lessonId} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 9,
                        background: 'var(--paper)', border: '1px solid var(--line)',
                      }}>
                        <span style={{
                          width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                          background: 'var(--violet-wash)', color: 'var(--violet)',
                          display: 'grid', placeItems: 'center',
                          fontSize: 11, fontWeight: 700,
                        }}>{l.orderNo}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
                            {l.title}
                          </p>
                          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ink-faint)' }}>
                            {LESSON_TYPES.find((t) => t.value === l.lessonType)?.label}
                            {l.estimatedMinutes ? ` · ${l.estimatedMinutes} phút` : ''}
                          </p>
                        </div>
                        {editable && (
                          <>
                            <button className="td-btn-ghost" onClick={() => openEdit(l)}>
                              <Edit3 size={13} />
                            </button>
                            <button className="td-btn-ghost" style={{ color: 'var(--cinnabar)' }}
                                    onClick={() => removeLesson(l)}>
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="td-modal-footer">
            <button className="td-btn-secondary" onClick={onClose}>Đóng</button>
          </div>
        </div>
      </div>

      {lessonModal && (
        <LessonFormModal
          initial={lessonModal.lessonId ? lessonModal : null}
          saving={saving}
          onClose={() => setLessonModal(null)}
          onSave={saveLesson}
        />
      )}
    </>
  );
}

// ─── Trang chính ─────────────────────────────────────────────────

export default function CourseManager() {
  const [courses, setCourses] = useState([]);
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formModal, setFormModal] = useState(null);
  const [lessonsFor, setLessonsFor] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback(
    (message, type = 'success') => setToast({ message, type }), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cs, lvs] = await Promise.all([
        courseService.getMyCourses(),
        roomService.getLevels(),
      ]);
      setCourses(cs);
      setLevels(lvs);
    } catch (err) {
      showToast(err.message || 'Không tải được danh sách khoá học', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const save = async (data) => {
    setSaving(true);
    try {
      if (formModal?.courseId) {
        await courseService.updateCourse(formModal.courseId, data);
        showToast('Đã cập nhật khoá học');
      } else {
        await courseService.createCourse(data);
        showToast('Đã tạo khoá học ở dạng nháp — thêm bài rồi gửi duyệt');
      }
      setFormModal(null);
      await load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const submit = async (course) => {
    try {
      await courseService.submitForReview(course.courseId);
      showToast('Đã gửi duyệt, chờ quản trị viên xem xét');
      await load();
    } catch (err) {
      // Backend chặn khoá rỗng và khoá đang chờ duyệt — hiện nguyên câu của nó,
      // vì câu đó đã nói rõ phải làm gì.
      showToast(err.message, 'error');
    }
  };

  const remove = async (course) => {
    if (!window.confirm(`Xoá khoá "${course.title}"?`)) return;
    try {
      await courseService.deleteCourse(course.courseId);
      showToast('Đã xoá khoá học');
      await load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const published = courses.filter((c) => c.status === 'PUBLISHED').length;
  const pending = courses.filter((c) => c.status === 'PENDING').length;

  return (
    <>
      <div className="td-stats-row">
        <div className="td-stat-card">
          <div className="td-stat-icon" style={{ background: 'var(--violet-wash)' }}>
            <BookOpen size={18} color="var(--violet)" />
          </div>
          <div className="td-stat-body">
            <p className="td-stat-label">Khoá đã soạn</p>
            <p className="td-stat-value">{courses.length}</p>
          </div>
        </div>
        <div className="td-stat-card">
          <div className="td-stat-icon" style={{ background: 'var(--gold-wash)' }}>
            <Send size={18} color="var(--gold)" />
          </div>
          <div className="td-stat-body">
            <p className="td-stat-label">Đang chờ duyệt</p>
            <p className="td-stat-value">{pending}</p>
          </div>
        </div>
        <div className="td-stat-card">
          <div className="td-stat-icon" style={{ background: 'var(--jade-wash)' }}>
            <CheckCircle2 size={18} color="var(--jade)" />
          </div>
          <div className="td-stat-body">
            <p className="td-stat-label">Đã xuất bản</p>
            <p className="td-stat-value">{published}</p>
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        margin: '20px 0 14px', gap: 12, flexWrap: 'wrap',
      }}>
        <div>
          <h2 style={{ fontFamily: 'var(--heading)', fontSize: 17, margin: 0, color: 'var(--ink)' }}>
            Khoá học
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--ink-faint)', maxWidth: '64ch' }}>
            Nơi soạn ngữ pháp và chữ Hán — hai thứ không nhét vừa một tấm thẻ lật.
            Soạn xong gửi duyệt; quản trị viên duyệt rồi thí sinh mới thấy.
          </p>
        </div>
        <button className="td-btn-primary" onClick={() => setFormModal({})}>
          <Plus size={15} /> Tạo khoá học
        </button>
      </div>

      {loading ? (
        <div className="td-empty"><Loader2 size={20} className="td-spin" /> Đang tải…</div>
      ) : courses.length === 0 ? (
        <div className="td-empty">
          <BookOpen size={26} style={{ opacity: 0.4 }} />
          <p style={{ margin: '10px 0 0' }}>Chưa có khoá học nào.</p>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ink-faint)' }}>
            Tạo một khoá, thêm bài lý thuyết rồi gửi duyệt.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {courses.map((course) => {
            const st = STATUS[course.status] ?? STATUS.DRAFT;
            return (
              <div key={course.courseId} style={{
                background: 'var(--paper-raised)', border: '1px solid var(--line)',
                borderRadius: 14, padding: '15px 16px',
                display: 'flex', flexDirection: 'column', gap: 9,
                boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <h3 style={{
                    fontFamily: 'var(--heading)', fontSize: 14.5, fontWeight: 700,
                    margin: 0, color: 'var(--ink)', flex: 1, lineHeight: 1.4,
                  }}>{course.title}</h3>
                  <span className={`td-badge ${st.cls}`}>{st.label}</span>
                </div>

                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-mute)', lineHeight: 1.55, flex: 1 }}>
                  {course.description}
                </p>

                {course.status === 'REJECTED' && course.reviewNote && (
                  <div className="st-review-note">
                    <b>Bị trả lại:</b> {course.reviewNote}
                  </div>
                )}

                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 11.5, color: 'var(--ink-faint)', fontVariantNumeric: 'tabular-nums',
                }}>
                  <FileText size={12} />
                  <span style={{ color: course.totalLessons === 0 ? 'var(--gold)' : undefined }}>
                    {course.totalLessons} bài
                  </span>
                  <span>·</span>
                  <span>{course.enrolledCount} người học</span>
                  {course.levelName && (
                    <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{course.levelName}</span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 2 }}>
                  <button className="td-btn-ghost" onClick={() => setLessonsFor(course)}>
                    <FileText size={13} /> Bài học <ChevronRight size={12} />
                  </button>

                  {(course.status === 'DRAFT' || course.status === 'REJECTED') && (
                    <button
                      className="td-btn-ghost"
                      title={course.totalLessons === 0
                        ? 'Cần ít nhất một bài học trước khi gửi duyệt'
                        : 'Gửi cho quản trị viên duyệt'}
                      disabled={course.totalLessons === 0}
                      onClick={() => submit(course)}
                    >
                      <Send size={13} /> Gửi duyệt
                    </button>
                  )}

                  {course.status !== 'PENDING' && (
                    <button className="td-btn-ghost" onClick={() => setFormModal(course)}>
                      <Edit3 size={13} />
                    </button>
                  )}
                  <button className="td-btn-ghost" style={{ color: 'var(--cinnabar)' }}
                          onClick={() => remove(course)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formModal && (
        <CourseFormModal
          initial={formModal.courseId ? formModal : null}
          levels={levels}
          saving={saving}
          onClose={() => setFormModal(null)}
          onSave={save}
        />
      )}

      {lessonsFor && (
        <CourseLessonsModal
          course={courses.find((c) => c.courseId === lessonsFor.courseId) ?? lessonsFor}
          onClose={() => setLessonsFor(null)}
          onChanged={load}
          showToast={showToast}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </>
  );
}
