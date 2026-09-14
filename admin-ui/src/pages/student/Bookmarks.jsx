// src/pages/student/Bookmarks.jsx
// Câu đã đánh dấu — những câu học viên CHỦ ĐỘNG muốn giữ lại, kèm ghi chú riêng.

import { useEffect, useState } from 'react';
import { Bookmark, Loader2, Trash2 } from 'lucide-react';
import { bookmarkApi } from '../../services/engagementService';
import { JLPT_SKILL_SHORT, QUESTION_TYPE_LABELS } from '../../utils/constants';

function NoteEditor({ item, onSaved }) {
  const [note, setNote] = useState(item.note ?? '');
  const [state, setState] = useState('idle'); // idle | saving | saved | error

  // Lưu khi rời ô ghi chú, và chỉ khi có thay đổi — không có nút "Lưu" để quên bấm.
  const save = async () => {
    if ((item.note ?? '') === note) return;
    setState('saving');
    try {
      const updated = await bookmarkApi.save(item.questionId, note);
      onSaved(updated);
      setState('saved');
    } catch {
      setState('error');
    }
  };

  return (
    <div>
      <textarea
        className="bm-note"
        placeholder="Ghi chú của bạn: vì sao giữ câu này, mẹo nhớ, chỗ hay nhầm…"
        value={note}
        onChange={(e) => { setNote(e.target.value); setState('idle'); }}
        onBlur={save}
        maxLength={2000}
      />
      <span className="bm-note-state">
        {state === 'saving' ? 'Đang lưu…' : state === 'saved' ? 'Đã lưu' : state === 'error' ? 'Chưa lưu được — thử lại' : ''}
      </span>
    </div>
  );
}

export default function Bookmarks() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    bookmarkApi.list().then(setItems).catch((e) => setError(e.message));
  }, []);

  const remove = async (questionId) => {
    await bookmarkApi.remove(questionId).catch(() => {});
    setItems((prev) => prev.filter((x) => x.questionId !== questionId));
  };

  const replace = (updated) =>
    setItems((prev) => prev.map((x) => (x.questionId === updated.questionId ? updated : x)));

  return (
    <div className="sd-card">
      <style>{`
        .bm-item { padding: 16px 22px; border-top: 1px solid rgba(43,38,32,0.06); }
        .bm-item:first-child { border-top: none; }
        .bm-head { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; flex-wrap: wrap; }
        .bm-chip { font-size: 11px; padding: 2px 8px; border-radius: 99px; background: rgba(43,38,32,0.06); color: var(--ink-soft); }
        .bm-content { margin: 0 0 10px; font-size: 14px; line-height: 1.7; color: var(--ink-body); white-space: pre-wrap; }
        .bm-note { width: 100%; min-height: 64px; box-sizing: border-box; padding: 8px 10px; border-radius: 8px;
                   border: 1px solid rgba(43,38,32,0.12); font: inherit; font-size: 13px; resize: vertical; background: rgba(201,146,46,0.05); }
        .bm-note-state { font-size: 11px; color: var(--ink-faint); }
        .bm-remove { margin-left: auto; border: none; background: none; color: var(--ink-faint); cursor: pointer; display: inline-flex; gap: 4px; align-items: center; font: inherit; font-size: 12px; }
        .bm-remove:hover { color: var(--cinnabar); }
      `}</style>
      <div className="sd-card-header">
        <h2>🔖 Câu đã đánh dấu</h2>
      </div>

      {error ? (
        <p style={{ padding: '18px 22px', margin: 0, color: 'var(--cinnabar)' }}>{error}</p>
      ) : items == null ? (
        <p style={{ padding: '18px 22px', margin: 0, color: 'var(--ink-faint)' }}>
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', verticalAlign: -2 }} /> Đang tải…
        </p>
      ) : items.length === 0 ? (
        <div style={{ padding: '26px 22px', textAlign: 'center', color: 'var(--ink-soft)' }}>
          <Bookmark size={36} style={{ color: 'var(--ink-faint)' }} />
          <p style={{ margin: '10px 0 0', fontSize: 13.5, lineHeight: 1.7 }}>
            Chưa có câu nào. Mở lại một bài đã nộp và bấm biểu tượng 🔖 ở câu muốn giữ —
            kể cả câu làm đúng nhưng còn phân vân.
          </p>
        </div>
      ) : (
        <div>
          {items.map((item) => (
            <div key={item.questionId} className="bm-item">
              <div className="bm-head">
                {item.skill && <span className="bm-chip">{JLPT_SKILL_SHORT[item.skill]}</span>}
                <span className="bm-chip">{QUESTION_TYPE_LABELS[item.questionType] ?? item.questionType}</span>
                <button className="bm-remove" onClick={() => remove(item.questionId)}>
                  <Trash2 size={13} /> Bỏ đánh dấu
                </button>
              </div>
              <p className="bm-content">{item.content}</p>
              <NoteEditor item={item} onSaved={replace} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
