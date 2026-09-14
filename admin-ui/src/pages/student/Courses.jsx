// src/pages/student/Courses.jsx
// LỘ TRÌNH ÔN TẬP của thí sinh (tên file giữ nguyên để không phải đổi route).

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Check, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck,
  Clock, GraduationCap, Layers, Loader2, Lock, PlayCircle, Route,
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
           aria-label={`Đã qua ${done} trên ${total} chặng`}>
        <div className="st-progress-mature" style={{ width: `${percent}%` }} />
      </div>
      <span>{percent}%</span>
    </div>
  );
}

/** Ô "bài kiểm tra của chặng": ngưỡng cần đạt, điểm tốt nhất, nút vào làm. */
function StageCheck({ examId, examTitle, minScorePercent, bestScorePercent, passed, compact }) {
  const navigate = useNavigate();
  return (
    <div className={`st-stage-check ${passed ? 'passed' : ''} ${compact ? 'compact' : ''}`}>
      <ClipboardCheck size={16} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>Bài kiểm tra chặng: {examTitle}</strong>
        <p>
          Cần đạt từ <b>{minScorePercent}%</b> để qua chặng ·{' '}
          {bestScorePercent == null
            ? 'bạn chưa làm bài này'
            : <>điểm tốt nhất của bạn: <b>{Math.round(bestScorePercent)}%</b>{passed ? ' — đã đạt' : ''}</>}
        </p>
      </div>
      <button type="button" className={`st-btn ${passed ? '' : 'primary'}`}
              onClick={() => navigate(`/student/exams/${examId}/room`)}>
        <PlayCircle size={14} /> {bestScorePercent == null ? 'Làm bài kiểm tra' : 'Làm lại'}
      </button>
    </div>
  );
}

// ─── Một chặng ───────────────────────────────────────────────────

function StageReader({ courseId, lessonId, onBack, onOpenLesson, onProgress }) {
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
      // Qua chặng thì đi tiếp luôn.
      if (lesson?.nextLessonId) {
        onOpenLesson(lesson.nextLessonId);
      }
    } catch (err) {
      // Chưa đạt bài kiểm tra / chặng trước chưa qua: server nói rõ vì sao.
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="st-empty">
        <Loader2 size={22} className="st-spin" />
        <p>Đang mở chặng…</p>
      </div>
    );
  }
  if (error && !lesson) {
    return (
      <div className="st-wrap">
        <button className="st-btn" style={{ alignSelf: 'flex-start' }} onClick={onBack}>
          <ArrowLeft size={14} /> Các chặng
        </button>
        <div className="st-error"><Lock size={13} style={{ verticalAlign: -2 }} /> {error}</div>
      </div>
    );
  }
  if (!lesson) return null;

  const type = LESSON_TYPE[lesson.lessonType] ?? LESSON_TYPE.GRAMMAR;
  const blockedByExam = lesson.examId != null && !lesson.examPassed;

  return (
    <div className="st-wrap">
      <button className="st-btn" style={{ alignSelf: 'flex-start' }} onClick={onBack}>
        <ArrowLeft size={14} /> {lesson.courseTitle}
      </button>

      <div className="st-lesson">
        <div className="st-lesson-head">
          <div className="st-lesson-meta">
            <span className={`st-lesson-type ${type.cls}`}>{type.label}</span>
            <span>Chặng {lesson.orderNo}</span>
            {lesson.estimatedMinutes && (
              <><span>·</span><Clock size={12} /> <span>{lesson.estimatedMinutes} phút</span></>
            )}
            {lesson.completed && (
              <span style={{ marginLeft: 'auto', color: 'var(--jade)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={13} /> Đã qua chặng
              </span>
            )}
          </div>
          {/* lang="ja" trên tiêu đề vì tên chặng ngữ pháp gần như luôn có kana */}
          <h2 className="jp" lang="ja">{lesson.title}</h2>
        </div>

        {/* Văn bản thuần, xuống dòng giữ bằng CSS. Xem quy ước số 2 ở đầu file. */}
        <div className="st-lesson-body jp" lang="ja">{lesson.content}</div>

        {lesson.deckId && (
          <div>
            <Link className="st-btn" style={{ textDecoration: 'none', display: 'inline-flex' }}
                  to={`/student/exams?tab=flashcards&deck=${lesson.deckId}`}>
              <Layers size={14} /> Mở bộ thẻ của chặng: {lesson.deckName}
            </Link>
          </div>
        )}

        {lesson.examId && (
          <StageCheck examId={lesson.examId} examTitle={lesson.examTitle}
                      minScorePercent={lesson.minScorePercent}
                      bestScorePercent={lesson.bestScorePercent}
                      passed={lesson.examPassed} />
        )}

        {error && <div className="st-error">{error}</div>}

        <div className="st-lesson-nav">
          <button
            className="st-btn"
            disabled={!lesson.previousLessonId}
            onClick={() => onOpenLesson(lesson.previousLessonId)}
          >
            <ChevronLeft size={14} /> Chặng trước
          </button>

          {lesson.completed ? (
            <button
              className="st-btn primary"
              disabled={!lesson.nextLessonId}
              onClick={() => onOpenLesson(lesson.nextLessonId)}
            >
              {lesson.nextLessonId ? <>Chặng tiếp <ChevronRight size={14} /></> : 'Đã đi hết lộ trình 🎉'}
            </button>
          ) : (
            <button className="st-btn primary" disabled={saving || blockedByExam} onClick={complete}
                    title={blockedByExam ? `Đạt từ ${lesson.minScorePercent}% ở bài kiểm tra để qua chặng` : undefined}>
              {saving ? <><Loader2 size={14} className="st-spin" /> Đang lưu…</>
                : blockedByExam ? <><Lock size={14} /> Đạt bài kiểm tra để qua chặng</>
                : <><Check size={14} /> Qua chặng</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Các chặng của một lộ trình ──────────────────────────────────

function PathDetail({ courseId, onBack, onProgress }) {
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
      <StageReader
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
        <p>Đang tải lộ trình…</p>
      </div>
    );
  }
  if (error && !detail) return <div className="st-error">{error}</div>;
  if (!detail) return null;

  const { course, lessons } = detail;
  // Chặng đang ở = chặng đầu tiên chưa qua (và không khoá).
  const currentId = lessons.find((l) => !l.completed && !l.locked)?.lessonId;

  return (
    <div className="st-wrap">
      <button className="st-btn" style={{ alignSelf: 'flex-start' }} onClick={onBack}>
        <ArrowLeft size={14} /> Tất cả lộ trình
      </button>

      <div className="st-head">
        <div>
          <h2>{course.title}</h2>
          <p>{course.description}</p>
        </div>
        <div className="st-stats">
          <div className="st-stat done">
            <b>{course.progressPercent}%</b><span>Chặng đã qua</span>
          </div>
          <div className="st-stat">
            <b>{course.totalLessons}</b><span>Chặng</span>
          </div>
        </div>
      </div>

      <ProgressBar percent={course.progressPercent}
                   done={course.completedLessons}
                   total={course.totalLessons} />

      {!course.enrolled && (
        <button className="st-btn primary" style={{ alignSelf: 'flex-start' }} onClick={enroll}>
          <PlayCircle size={14} /> Bắt đầu lộ trình này
        </button>
      )}

      {error && <div className="st-error">{error}</div>}

      <ol className="st-path">
        {lessons.map((l) => {
          const type = LESSON_TYPE[l.lessonType] ?? LESSON_TYPE.GRAMMAR;
          const state = l.completed ? 'done' : l.locked ? 'locked' : l.lessonId === currentId ? 'current' : 'open';
          return (
            <li key={l.lessonId} className={`st-path-stage ${state}`}>
              <button
                type="button"
                className="st-lesson-row"
                disabled={l.locked}
                title={l.locked ? 'Qua chặng trước để mở chặng này' : undefined}
                onClick={() => setOpenLesson(l.lessonId)}
              >
                <span className="st-lesson-no">
                  {l.completed ? <Check size={13} /> : l.locked ? <Lock size={12} /> : l.orderNo}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="jp" lang="ja" style={{ display: 'block' }}>{l.title}</span>
                  {l.hasExam && (
                    <span className="st-path-check">
                      <ClipboardCheck size={11} /> Kiểm tra: đạt từ {l.minScorePercent}%
                      {l.bestScorePercent != null && ` · tốt nhất ${Math.round(l.bestScorePercent)}%`}
                    </span>
                  )}
                </span>
                {state === 'current' && <span className="st-path-here">Đang ở chặng này</span>}
                <span className={`st-lesson-type ${type.cls}`}>{type.label}</span>
                {l.estimatedMinutes && (
                  <span style={{ fontSize: 11.5, color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>
                    {l.estimatedMinutes}′
                  </span>
                )}
                {!l.locked && <ChevronRight size={14} style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />}
              </button>
            </li>
          );
        })}
      </ol>
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
      <PathDetail
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
        <p>Đang tải lộ trình ôn tập…</p>
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
        <Route size={12} />
        <span>{course.totalLessons} chặng</span>
        {course.enrolled && (
          <><span>·</span><span style={{ color: 'var(--jade)' }}>
            đã qua {course.completedLessons}
          </span></>
        )}
        {course.levelName && (
          <span style={{ marginLeft: 'auto', fontWeight: 700 }}>Hướng tới {course.levelName}</span>
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
          : course.enrolled ? <><PlayCircle size={14} /> Ôn tiếp</>
          : <><PlayCircle size={14} /> Xem lộ trình</>}
      </button>
    </div>
  );

  return (
    <div className="st-wrap">
      <div className="st-head">
        <div>
          <h2>Lộ trình ôn tập</h2>
          <p>
            Mỗi lộ trình là một chuỗi chặng hướng tới một trình độ thi: đọc lý thuyết,
            ôn bộ thẻ, rồi làm bài kiểm tra của chặng. Đạt thì chặng kế tiếp mới mở — đi hết
            là bạn đã sẵn sàng cho phần đó của đề thi.
          </p>
        </div>
        <div className="st-stats">
          <div className="st-stat">
            <b>{enrolled.length}</b><span>Đang theo</span>
          </div>
          <div className="st-stat done">
            <b>{enrolled.filter((c) => c.progressPercent === 100).length}</b>
            <span>Đã đi hết</span>
          </div>
        </div>
      </div>

      {error && <div className="st-error">{error}</div>}

      {enrolled.length > 0 && (
        <>
          <div className="st-head" style={{ marginBottom: -4 }}>
            <h2 style={{ fontSize: 15 }}>Đang theo</h2>
          </div>
          <div className="st-decks">{enrolled.map(card)}</div>
        </>
      )}

      <div className="st-head" style={{ marginTop: enrolled.length > 0 ? 8 : 0, marginBottom: -4 }}>
        <h2 style={{ fontSize: 15 }}>
          {enrolled.length > 0 ? 'Lộ trình khác' : 'Tất cả lộ trình'}
        </h2>
      </div>

      {notStarted.length === 0 ? (
        <div className="st-empty">
          <span className="st-empty-icon">🧭</span>
          <h3>
            {enrolled.length > 0 ? 'Bạn đã theo hết các lộ trình hiện có' : 'Chưa có lộ trình nào'}
          </h3>
          <p>
            {enrolled.length > 0
              ? 'Người ra đề sẽ soạn thêm lộ trình mới, quay lại sau nhé.'
              : 'Lộ trình do người ra đề soạn và quản trị viên duyệt. Chưa có lộ trình nào được xuất bản.'}
          </p>
        </div>
      ) : (
        <div className="st-decks">{notStarted.map(card)}</div>
      )}
    </div>
  );
}
