// src/components/common/SearchBox.jsx
// Ô tìm kiếm của học viên: đề công khai + lộ trình đã xuất bản.

import { useEffect, useRef, useState } from 'react';
import { Search, FileText, GraduationCap } from 'lucide-react';
import { search } from '../../services/engagementService';
import './SearchBox.css';

/**
 * @param onOpenExam   (examId) => void
 * @param onOpenCourse (courseId) => void
 */
export default function SearchBox({ onOpenExam, onOpenCourse }) {
  const [q, setQ] = useState('');
  const [result, setResult] = useState(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  // Chờ người dùng ngừng gõ 300ms mới hỏi server.
  useEffect(() => {
    const keyword = q.trim();
    if (keyword.length < 2) { setResult(null); return undefined; }
    let alive = true;
    const id = setTimeout(() => {
      search(keyword).then((r) => { if (alive) setResult(r); }).catch(() => { if (alive) setResult({ exams: [], courses: [] }); });
    }, 300);
    return () => { alive = false; clearTimeout(id); };
  }, [q]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (fn, id) => { setOpen(false); setQ(''); fn?.(id); };
  const empty = result && result.exams.length === 0 && result.courses.length === 0;

  return (
    <div className="sb-wrap" ref={boxRef}>
      <Search size={14} className="sb-icon" />
      <input
        className="sb-input"
        placeholder="Tìm đề, lộ trình…"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
      />

      {open && q.trim().length >= 2 && (
        <div className="sb-panel">
          {result == null ? (
            <p className="sb-empty">Đang tìm…</p>
          ) : empty ? (
            <p className="sb-empty">Không có đề công khai hay lộ trình nào khớp "{q.trim()}".</p>
          ) : (
            <>
              {result.exams.length > 0 && (
                <div className="sb-group">
                  <span className="sb-group-label">Đề công khai</span>
                  {result.exams.map((e) => (
                    <button key={e.examId} className="sb-item" onClick={() => pick(onOpenExam, e.examId)}>
                      <FileText size={14} />
                      <span className="sb-title">{e.title}</span>
                      <span className="sb-meta">{[e.levelName, e.durationMinutes && `${e.durationMinutes} phút`].filter(Boolean).join(' · ')}</span>
                    </button>
                  ))}
                </div>
              )}
              {result.courses.length > 0 && (
                <div className="sb-group">
                  <span className="sb-group-label">Lộ trình ôn tập</span>
                  {result.courses.map((c) => (
                    <button key={c.courseId} className="sb-item" onClick={() => pick(onOpenCourse, c.courseId)}>
                      <GraduationCap size={14} />
                      <span className="sb-title">{c.title}</span>
                      <span className="sb-meta">{c.levelName}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
