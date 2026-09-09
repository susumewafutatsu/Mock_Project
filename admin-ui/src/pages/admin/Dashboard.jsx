// src/pages/admin/Dashboard.jsx
// Trang của quản trị viên — hiện tại là hàng đợi duyệt khoá học.
//
// Đây là chức năng Admin THẬT đầu tiên của hệ thống (trước đó trang này chỉ là
// một khung rỗng có TODO). Nó tồn tại vì việc soạn nội dung và việc chịu trách
// nhiệm về nội dung thuộc hai người khác nhau: người ra đề biết chuyên môn,
// nhưng lộ trình là thứ hàng nghìn người đi theo từ đầu tới cuối — một bài xếp
// sai chỗ hỏng cả quá trình của người đi theo nó, mà thí sinh mới thì không có
// cách nào tự phát hiện.
//
// Quy tắc quan trọng của màn hình này: TỪ CHỐI BẮT BUỘC KÈM LÝ DO. Backend chặn
// nếu thiếu, và đây là nơi lý do đó được viết ra. Trả lại suông thì tác giả chỉ
// biết là bị trả về, không biết sửa gì, và sẽ gửi lại đúng bản cũ.

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle, ArrowLeft, BookOpen, Check, CheckCircle2, Clock,
  FileText, Loader2, ShieldCheck, X,
} from 'lucide-react';
import courseService from '../../services/courseService';
import { LESSON_TYPE } from '../../utils/constants';
import '../teacher/TeacherDashboard.css';
import '../student/Study.css';

/** "12/03 09:30" */
function formatWhen(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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

// ─── Xem xét một khoá ────────────────────────────────────────────

function CourseReview({ course, onBack, onDecided, showToast }) {
  const [detail, setDetail] = useState(null);
  const [openLesson, setOpenLesson] = useState(null);
  const [lessonBody, setLessonBody] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    courseService.getCourse(course.courseId)
      .then((d) => { if (alive) setDetail(d); })
      .catch((err) => showToast(err.message, 'error'));
    return () => { alive = false; };
  }, [course.courseId, showToast]);

  // Admin phải ĐỌC ĐƯỢC nội dung trước khi duyệt, không chỉ thấy tên bài —
  // duyệt mà không đọc thì cửa kiểm này chẳng có tác dụng gì.
  const openBody = async (lessonId) => {
    setOpenLesson(lessonId);
    setLessonBody(null);
    try {
      setLessonBody(await courseService.getLesson(course.courseId, lessonId));
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const decide = async (approve) => {
    if (!approve && !note.trim()) {
      showToast('Phải ghi lý do để tác giả biết cần sửa gì', 'error');
      return;
    }
    setBusy(true);
    try {
      if (approve) {
        await courseService.approve(course.courseId);
        showToast('Đã duyệt và xuất bản khoá học');
      } else {
        await courseService.reject(course.courseId, note.trim());
        showToast('Đã trả lại khoá học cho tác giả');
      }
      onDecided();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="st-wrap">
      <button className="st-btn" style={{ alignSelf: 'flex-start' }} onClick={onBack}>
        <ArrowLeft size={14} /> Hàng đợi duyệt
      </button>

      <div className="st-head">
        <div>
          <h2>{course.title}</h2>
          <p>{course.description}</p>
        </div>
        <div className="st-stats">
          <div className="st-stat"><b>{course.totalLessons}</b><span>Bài học</span></div>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-faint)' }}>
        Tác giả: <strong style={{ color: 'var(--ink-soft)' }}>{course.authorName}</strong>
        {course.levelName && <> · Trình độ {course.levelName}</>}
      </p>

      {!detail ? (
        <div className="st-empty"><Loader2 size={20} className="st-spin" /> Đang tải nội dung…</div>
      ) : openLesson ? (
        <>
          <button className="st-btn" style={{ alignSelf: 'flex-start' }}
                  onClick={() => setOpenLesson(null)}>
            <ArrowLeft size={14} /> Danh sách bài
          </button>
          {!lessonBody ? (
            <div className="st-empty"><Loader2 size={20} className="st-spin" /> Đang tải bài…</div>
          ) : (
            <div className="st-lesson">
              <div className="st-lesson-head">
                <div className="st-lesson-meta">
                  <span className={`st-lesson-type ${(LESSON_TYPE[lessonBody.lessonType] ?? {}).cls ?? ''}`}>
                    {(LESSON_TYPE[lessonBody.lessonType] ?? {}).label ?? lessonBody.lessonType}
                  </span>
                  <span>Bài {lessonBody.orderNo}</span>
                  {lessonBody.estimatedMinutes && (
                    <><span>·</span><Clock size={12} /> <span>{lessonBody.estimatedMinutes} phút</span></>
                  )}
                </div>
                <h2 className="jp" lang="ja">{lessonBody.title}</h2>
              </div>
              <div className="st-lesson-body jp" lang="ja">{lessonBody.content}</div>
            </div>
          )}
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {detail.lessons.map((l) => {
            const type = LESSON_TYPE[l.lessonType] ?? LESSON_TYPE.GRAMMAR;
            return (
              <button key={l.lessonId} className="st-lesson-row" onClick={() => openBody(l.lessonId)}>
                <span className="st-lesson-no">{l.orderNo}</span>
                <span className="jp" lang="ja" style={{ flex: 1, minWidth: 0 }}>{l.title}</span>
                <span className={`st-lesson-type ${type.cls}`}>{type.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <div style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        padding: 16, borderRadius: 12,
        background: 'var(--paper-raised)', border: '1px solid var(--line)',
      }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>
          Quyết định
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Lý do trả lại — bắt buộc khi từ chối. Ghi rõ bài nào, thiếu gì."
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 9,
            border: '1px solid var(--line-strong)', background: 'var(--paper)',
            fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6,
            color: 'var(--ink-body)', resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="st-btn primary" disabled={busy} onClick={() => decide(true)}>
            <Check size={14} /> Duyệt và xuất bản
          </button>
          <button className="st-btn" disabled={busy} onClick={() => decide(false)}
                  style={{ color: 'var(--cinnabar-deep)' }}>
            <X size={14} /> Trả lại cho tác giả
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Trang chính ─────────────────────────────────────────────────

export default function AdminDashboard() {
  const [pending, setPending] = useState([]);
  const [reviewing, setReviewing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback(
    (message, type = 'success') => setToast({ message, type }), []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    courseService.getPendingCourses()
      .then(setPending)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <ShieldCheck size={22} color="var(--violet)" />
        <h1 style={{
          fontFamily: 'var(--heading)', fontSize: 22, fontWeight: 700,
          color: 'var(--ink)', margin: 0,
        }}>
          Quản trị hệ thống
        </h1>
      </div>
      <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--ink-faint)', maxWidth: '64ch' }}>
        Khoá học do người ra đề soạn, nhưng phải qua đây mới tới được thí sinh.
        Đọc nội dung trước khi duyệt — duyệt mà không đọc thì cửa kiểm này không
        có tác dụng gì.
      </p>

      {reviewing ? (
        <CourseReview
          course={reviewing}
          onBack={() => setReviewing(null)}
          onDecided={() => { setReviewing(null); load(); }}
          showToast={showToast}
        />
      ) : (
        <div className="st-wrap">
          <div className="st-head">
            <div>
              <h2>Khoá học chờ duyệt</h2>
              <p>Khoá chờ lâu nhất xếp lên đầu — người soạn đã đợi rồi thì không nên đợi thêm.</p>
            </div>
            <div className="st-stats">
              <div className="st-stat due"><b>{pending.length}</b><span>Chờ duyệt</span></div>
            </div>
          </div>

          {error && <div className="st-error">{error}</div>}

          {loading ? (
            <div className="st-empty"><Loader2 size={22} className="st-spin" /> Đang tải…</div>
          ) : pending.length === 0 ? (
            <div className="st-empty">
              <span className="st-empty-icon">✅</span>
              <h3>Không có khoá nào chờ duyệt</h3>
              <p>Người ra đề gửi khoá lên thì nó sẽ hiện ở đây.</p>
            </div>
          ) : (
            <div className="st-decks">
              {pending.map((c) => (
                <div className="st-deck" key={c.courseId}>
                  <h3>{c.title}</h3>
                  <p className="st-deck-desc">{c.description}</p>
                  <div className="st-deck-meta">
                    <FileText size={12} />
                    <span>{c.totalLessons} bài</span>
                    {c.levelName && (
                      <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{c.levelName}</span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ink-faint)' }}>
                    {c.authorName} · gửi lúc {formatWhen(c.reviewedAt) ?? '—'}
                  </p>
                  <button className="st-btn primary" onClick={() => setReviewing(c)}>
                    <BookOpen size={14} /> Xem xét
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
