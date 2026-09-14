// src/pages/admin/CourseReviewQueue.jsx
// Hàng đợi duyệt LỘ TRÌNH ÔN TẬP — tab "Duyệt lộ trình" của trang quản trị.

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Check, Clock, FileText, Loader2, X } from 'lucide-react';
import courseService from '../../services/courseService';
import { LESSON_TYPE } from '../../utils/constants';
import { formatWhen } from './adminFormat';
import '../student/Study.css';

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

  // Admin phải ĐỌC ĐƯỢC nội dung trước khi duyệt, không chỉ thấy tên bài.
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
        showToast('Đã duyệt và xuất bản lộ trình');
      } else {
        await courseService.reject(course.courseId, note.trim());
        showToast('Đã trả lại lộ trình cho tác giả');
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
          <div className="st-stat"><b>{course.totalLessons}</b><span>Chặng</span></div>
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
            <ArrowLeft size={14} /> Các chặng
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
                  <span>Chặng {lessonBody.orderNo}</span>
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
          placeholder="Lý do trả lại — bắt buộc khi từ chối. Ghi rõ chặng nào, thiếu gì."
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

// ─── Hàng đợi ────────────────────────────────────────────────────

/**
 * @param showToast(message, type) toast dùng chung của trang quản trị
 * @param onCountChange(n) báo số khoá đang chờ, để thanh bên cập nhật huy hiệu
 */
export default function CourseReviewQueue({ showToast, onCountChange }) {
  const [pending, setPending] = useState([]);
  const [reviewing, setReviewing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    courseService.getPendingCourses()
      .then((list) => {
        setPending(list);
        onCountChange?.(list.length);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [onCountChange]);

  useEffect(() => { load(); }, [load]);

  if (reviewing) {
    return (
      <CourseReview
        course={reviewing}
        onBack={() => setReviewing(null)}
        onDecided={() => { setReviewing(null); load(); }}
        showToast={showToast}
      />
    );
  }

  return (
    <div className="st-wrap">
      <div className="st-head">
        <div>
          <h2>Lộ trình chờ duyệt</h2>
          <p>
            Đọc nội dung trước khi duyệt — duyệt mà không đọc thì cửa kiểm này không có tác
            dụng gì. Lộ trình chờ lâu nhất xếp lên đầu.
          </p>
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
          <h3>Không có lộ trình nào chờ duyệt</h3>
          <p>Người ra đề gửi lộ trình lên thì nó sẽ hiện ở đây.</p>
        </div>
      ) : (
        <div className="st-decks">
          {pending.map((c) => (
            <div className="st-deck" key={c.courseId}>
              <h3>{c.title}</h3>
              <p className="st-deck-desc">{c.description}</p>
              <div className="st-deck-meta">
                <FileText size={12} />
                <span>{c.totalLessons} chặng</span>
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
  );
}
