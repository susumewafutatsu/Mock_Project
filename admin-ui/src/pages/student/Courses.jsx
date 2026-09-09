// src/pages/student/Courses.jsx
// Khoá học của thí sinh — nơi đọc NGỮ PHÁP và CHỮ HÁN.
//
// Ba màn hình trong một file vì chúng là ba bước của cùng một việc:
//   danh sách khoá → danh sách bài → đọc một bài.
//
// Ba quy ước:
//
// 1. Server tính phần trăm, client chỉ hiển thị. Hai bên chia riêng là hai chỗ
//    có thể chia cho 0 và hai cách làm tròn khác nhau.
//
// 2. Nội dung bài là VĂN BẢN THUẦN, render bằng CSS `white-space: pre-wrap`
//    chứ KHÔNG dựng HTML từ chuỗi. Nội dung do người ra đề nhập; đổ nó vào
//    dangerouslySetInnerHTML là mở đường cho XSS lên mọi thí sinh đọc bài đó.
//
// 3. Bấm "Đã học xong" là đủ để tính tiến độ — không kiểm tra người học có
//    thật sự đọc hết hay không. Đây là công cụ tự theo dõi, không phải bài thi.

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, BookOpen, Check, CheckCircle2, ChevronLeft, ChevronRight,
  Clock, GraduationCap, Layers, Loader2, PlayCircle,
} from 'lucide-react';
import courseService from '../../services/courseService';
import { LESSON_TYPE } from '../../utils/constants';
import './Study.css';

/** Thanh tiến độ + số phần trăm. Dùng ở cả danh sách lẫn trang chi tiết. */
function ProgressBar({ percent, done, total }) {
  return (
    <div className="st-progress-row">
      <div className="st-progress"
           role="img"
           aria-label={`Đã học ${done} trên ${total} bài`}>
        <div className="st-progress-mature" style={{ width: `${percent}%` }} />
      </div>
      <span>{percent}%</span>
    </div>
  );
}

// ─── Đọc một bài ─────────────────────────────────────────────────

function LessonReader({ courseId, lessonId, onBack, onOpenLesson, onProgress }) {
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    courseService.getLesson(courseId, lessonId)
      .then((data) => { if (alive) setLesson(data); })
      .catch((err) => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [courseId, lessonId]);

  const complete = async () => {
    setSaving(true);
    try {
      const course = await courseService.completeLesson(courseId, lessonId);
      setLesson((prev) => prev && { ...prev, completed: true });
      onProgress?.(course);
      // Đọc xong thì đi tiếp luôn. Bắt quay lại danh sách rồi bấm bài kế tiếp
      // là thêm hai cú bấm cho việc mà ai cũng làm sau khi học xong một bài.
      if (lesson?.nextLessonId) {
        onOpenLesson(lesson.nextLessonId);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="st-empty">
        <Loader2 size={22} className="st-spin" />
        <p>Đang mở bài học…</p>
      </div>
    );
  }
  if (error && !lesson) return <div className="st-error">{error}</div>;
  if (!lesson) return null;

  const type = LESSON_TYPE[lesson.lessonType] ?? LESSON_TYPE.GRAMMAR;

  return (
    <div className="st-wrap">
      <button className="st-btn" style={{ alignSelf: 'flex-start' }} onClick={onBack}>
        <ArrowLeft size={14} /> {lesson.courseTitle}
      </button>

      <div className="st-lesson">
        <div className="st-lesson-head">
          <div className="st-lesson-meta">
            <span className={`st-lesson-type ${type.cls}`}>{type.label}</span>
            <span>Bài {lesson.orderNo}</span>
            {lesson.estimatedMinutes && (
              <><span>·</span><Clock size={12} /> <span>{lesson.estimatedMinutes} phút</span></>
            )}
            {lesson.completed && (
              <span style={{ marginLeft: 'auto', color: 'var(--jade)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={13} /> Đã học xong
              </span>
            )}
          </div>
          {/* lang="ja" trên tiêu đề vì tên bài ngữ pháp gần như luôn có kana */}
          <h2 className="jp" lang="ja">{lesson.title}</h2>
        </div>

        {/* Văn bản thuần, xuống dòng giữ bằng CSS. Xem chú thích số 2 ở đầu file
            về lý do không dùng dangerouslySetInnerHTML. */}
        <div className="st-lesson-body jp" lang="ja">{lesson.content}</div>

        {(lesson.deckId || lesson.examId) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {lesson.deckId && (
              <span className="st-tag streak">
                <Layers size={11} style={{ verticalAlign: -1 }} /> Có bộ thẻ ôn: {lesson.deckName}
              </span>
            )}
            {lesson.examId && (
              <span className="st-tag type">Có bài kiểm tra: {lesson.examTitle}</span>
            )}
          </div>
        )}

        {error && <div className="st-error">{error}</div>}

        <div className="st-lesson-nav">
          <button
            className="st-btn"
            disabled={!lesson.previousLessonId}
            onClick={() => onOpenLesson(lesson.previousLessonId)}
          >
            <ChevronLeft size={14} /> Bài trước
          </button>

          {lesson.completed ? (
            <button
              className="st-btn primary"
              disabled={!lesson.nextLessonId}
              onClick={() => onOpenLesson(lesson.nextLessonId)}
            >
              {lesson.nextLessonId ? <>Bài tiếp <ChevronRight size={14} /></> : 'Đã hết bài'}
            </button>
          ) : (
            <button className="st-btn primary" disabled={saving} onClick={complete}>
              {saving ? <><Loader2 size={14} className="st-spin" /> Đang lưu…</>
                      : <><Check size={14} /> Đã học xong</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Danh sách bài của một khoá ──────────────────────────────────

function CourseDetail({ courseId, onBack, onProgress }) {
  const [detail, setDetail] = useState(null);
  const [openLesson, setOpenLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    courseService.getCourse(courseId)
      .then(setDetail)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  const enroll = async () => {
    try {
      await courseService.enroll(courseId);
      load();
      onProgress?.();
    } catch (err) {
      setError(err.message);
    }
  };

  if (openLesson) {
    return (
      <LessonReader
        courseId={courseId}
        lessonId={openLesson}
        onBack={() => { setOpenLesson(null); load(); onProgress?.(); }}
        onOpenLesson={setOpenLesson}
        onProgress={onProgress}
      />
    );
  }

  if (loading && !detail) {
    return (
      <div className="st-empty">
        <Loader2 size={22} className="st-spin" />
        <p>Đang tải khoá học…</p>
      </div>
    );
  }
  if (error && !detail) return <div className="st-error">{error}</div>;
  if (!detail) return null;

  const { course, lessons } = detail;

  return (
    <div className="st-wrap">
      <button className="st-btn" style={{ alignSelf: 'flex-start' }} onClick={onBack}>
        <ArrowLeft size={14} /> Tất cả khoá học
      </button>

      <div className="st-head">
        <div>
          <h2>{course.title}</h2>
          <p>{course.description}</p>
        </div>
        <div className="st-stats">
          <div className="st-stat done">
            <b>{course.progressPercent}%</b><span>Hoàn thành</span>
          </div>
          <div className="st-stat">
            <b>{course.totalLessons}</b><span>Bài học</span>
          </div>
        </div>
      </div>

      <ProgressBar percent={course.progressPercent}
                   done={course.completedLessons}
                   total={course.totalLessons} />

      {!course.enrolled && (
        <button className="st-btn primary" style={{ alignSelf: 'flex-start' }} onClick={enroll}>
          <PlayCircle size={14} /> Bắt đầu học khoá này
        </button>
      )}

      {error && <div className="st-error">{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {lessons.map((l) => {
          const type = LESSON_TYPE[l.lessonType] ?? LESSON_TYPE.GRAMMAR;
          return (
            <button
              key={l.lessonId}
              className={`st-lesson-row ${l.completed ? 'done' : ''}`}
              onClick={() => setOpenLesson(l.lessonId)}
            >
              <span className="st-lesson-no">
                {l.completed ? <Check size={13} /> : l.orderNo}
              </span>
              <span className="jp" lang="ja" style={{ flex: 1, minWidth: 0 }}>{l.title}</span>
              <span className={`st-lesson-type ${type.cls}`}>{type.label}</span>
              {l.estimatedMinutes && (
                <span style={{ fontSize: 11.5, color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>
                  {l.estimatedMinutes}′
                </span>
              )}
              <ChevronRight size={14} style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Trang chính ─────────────────────────────────────────────────

export default function Courses() {
  const [published, setPublished] = useState([]);
  const [enrolled, setEnrolled] = useState([]);
  const [openCourse, setOpenCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([courseService.browse(), courseService.getEnrolled()])
      .then(([all, mine]) => { setPublished(all); setEnrolled(mine); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (openCourse) {
    return (
      <CourseDetail
        courseId={openCourse}
        onBack={() => { setOpenCourse(null); load(); }}
        onProgress={load}
      />
    );
  }

  if (loading && published.length === 0 && enrolled.length === 0) {
    return (
      <div className="st-empty">
        <Loader2 size={22} className="st-spin" />
        <p>Đang tải khoá học…</p>
      </div>
    );
  }

  const enrolledIds = new Set(enrolled.map((c) => c.courseId));
  const notStarted = published.filter((c) => !enrolledIds.has(c.courseId));

  const card = (course) => (
    <div className="st-deck" key={course.courseId}>
      <h3>{course.title}</h3>
      <p className="st-deck-desc">{course.description}</p>

      {course.enrolled && (
        <ProgressBar percent={course.progressPercent}
                     done={course.completedLessons}
                     total={course.totalLessons} />
      )}

      <div className="st-deck-meta">
        <BookOpen size={12} />
        <span>{course.totalLessons} bài</span>
        {course.enrolled && (
          <><span>·</span><span style={{ color: 'var(--jade)' }}>
            đã học {course.completedLessons}
          </span></>
        )}
        {course.levelName && (
          <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{course.levelName}</span>
        )}
      </div>

      <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ink-faint)' }}>
        <GraduationCap size={11} style={{ verticalAlign: -1 }} /> {course.authorName}
      </p>

      <button
        className={`st-btn ${course.enrolled ? '' : 'primary'}`}
        onClick={() => setOpenCourse(course.courseId)}
      >
        {course.progressPercent === 100 ? <><CheckCircle2 size={14} /> Xem lại</>
          : course.enrolled ? <><PlayCircle size={14} /> Học tiếp</>
          : <><PlayCircle size={14} /> Vào học</>}
      </button>
    </div>
  );

  return (
    <div className="st-wrap">
      <div className="st-head">
        <div>
          <h2>Khoá học</h2>
          <p>
            Ngữ pháp và chữ Hán học bằng cách đọc lý thuyết rồi đánh dấu hoàn thành —
            không phải thứ nhét vừa một tấm thẻ lật. Bộ thẻ vẫn ở đó, nhưng để ÔN LẠI
            từ vựng sau khi đã hiểu bài.
          </p>
        </div>
        <div className="st-stats">
          <div className="st-stat">
            <b>{enrolled.length}</b><span>Đang học</span>
          </div>
          <div className="st-stat done">
            <b>{enrolled.filter((c) => c.progressPercent === 100).length}</b>
            <span>Đã xong</span>
          </div>
        </div>
      </div>

      {error && <div className="st-error">{error}</div>}

      {enrolled.length > 0 && (
        <>
          <div className="st-head" style={{ marginBottom: -4 }}>
            <h2 style={{ fontSize: 15 }}>Đang học</h2>
          </div>
          <div className="st-decks">{enrolled.map(card)}</div>
        </>
      )}

      <div className="st-head" style={{ marginTop: enrolled.length > 0 ? 8 : 0, marginBottom: -4 }}>
        <h2 style={{ fontSize: 15 }}>
          {enrolled.length > 0 ? 'Khoá học khác' : 'Tất cả khoá học'}
        </h2>
      </div>

      {notStarted.length === 0 ? (
        <div className="st-empty">
          <span className="st-empty-icon">📚</span>
          <h3>
            {enrolled.length > 0 ? 'Bạn đã vào hết các khoá hiện có' : 'Chưa có khoá học nào'}
          </h3>
          <p>
            {enrolled.length > 0
              ? 'Người ra đề sẽ soạn thêm khoá mới, quay lại sau nhé.'
              : 'Khoá học do người ra đề soạn và quản trị viên duyệt. Chưa có khoá nào được xuất bản.'}
          </p>
        </div>
      ) : (
        <div className="st-decks">{notStarted.map(card)}</div>
      )}
    </div>
  );
}
