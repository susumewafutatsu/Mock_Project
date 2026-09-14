// src/pages/teacher/ExamSectionEditor.jsx
// Cấu trúc phần thi của một đề.

import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react';
import examStructureService from '../../services/examStructureService';

export default function ExamSectionEditor({ exam, onClose, onSaved }) {
  const [sections, setSections] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    examStructureService.getSections(exam.examId)
      .then((list) => setSections(list.map((s) => ({ ...s }))))
      .catch((e) => setError(e.message));
  }, [exam.examId]);

  useEffect(() => { load(); }, [load]);

  const totalMinutes = (sections ?? []).reduce(
    (sum, s) => sum + (Number(s.durationMinutes) || 0), 0);

  const setField = (i, key, value) =>
    setSections((prev) => prev.map((s, j) => (j === i ? { ...s, [key]: value } : s)));

  const addSection = () =>
    setSections((prev) => [...prev, { name: '', durationMinutes: 30, orderNo: prev.length + 1 }]);

  const removeSection = (i) =>
    setSections((prev) => prev.filter((_, j) => j !== i));

  const applyTemplate = async () => {
    setBusy(true); setError(null);
    try {
      const list = await examStructureService.applyJlptTemplate(exam.examId);
      setSections(list.map((s) => ({ ...s })));
      onSaved?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if ((sections ?? []).some((s) => !s.name?.trim())) {
      setError('Phần thi nào cũng phải có tên.');
      return;
    }
    if ((sections ?? []).some((s) => !(Number(s.durationMinutes) > 0))) {
      setError('Thời lượng mỗi phần phải lớn hơn 0 phút.');
      return;
    }
    setBusy(true); setError(null);
    try {
      await examStructureService.replaceSections(exam.examId, (sections ?? []).map((s, i) => ({
        name: s.name.trim(),
        durationMinutes: Number(s.durationMinutes),
        orderNo: i + 1,
      })));
      onSaved?.();
      onClose?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const removeAll = async () => {
    setBusy(true); setError(null);
    try {
      await examStructureService.deleteSections(exam.examId);
      setSections([]);
      onSaved?.();
      onClose?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="td-modal-overlay" onClick={onClose}>
      <div className="td-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="td-modal-header">
          <div>
            <h2>Cấu trúc phần thi</h2>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ink-faint)' }}>
              {exam.title} · {exam.levelName ?? 'chưa gắn trình độ'}
            </p>
          </div>
          <button className="td-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="td-modal-body">
          {error && (
            <div className="td-form-group full" style={{
              display: 'flex', gap: 8, alignItems: 'flex-start',
              padding: '10px 12px', borderRadius: 8,
              background: 'rgba(185,58,43,0.08)', color: 'var(--cinnabar)', fontSize: 13,
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <div style={{
            padding: '14px 16px', borderRadius: 10, marginBottom: 16,
            background: 'rgba(124,92,191,0.07)',
          }}>
            <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.65 }}>
              <strong>Cách nhanh và đúng nhất:</strong> áp cấu trúc chuẩn của cấp {exam.levelName ?? 'JLPT'}.
              Hệ thống tạo sẵn đúng số phần, đúng thời lượng của kỳ thi thật, và bật chấm
              theo thang điểm quy đổi 0–180 kèm kết luận Đỗ / Trượt.
            </p>
            <button className="td-btn-primary" onClick={applyTemplate} disabled={busy}>
              <Sparkles size={15} /> Áp cấu trúc chuẩn JLPT
            </button>
          </div>

          {sections == null ? (
            <div className="td-empty">
              <Loader2 size={40} style={{ animation: 'spin 1s linear infinite' }} />
              <h3>Đang tải…</h3>
            </div>
          ) : (
            <>
              <div className="td-form-group full">
                <label className="td-form-label">Các phần thi</label>
                {sections.length === 0 && (
                  <p className="td-form-hint" style={{ marginTop: 0 }}>
                    Đề này chưa chia phần — thí sinh làm một mạch với một đồng hồ duy nhất.
                  </p>
                )}
                {sections.map((sec, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <span style={{
                      width: 22, fontSize: 12.5, fontWeight: 700, color: 'var(--ink-faint)',
                    }}>{i + 1}.</span>
                    <input
                      className="td-form-input"
                      style={{ flex: 1 }}
                      placeholder="VD: 言語知識（文字・語彙）"
                      value={sec.name ?? ''}
                      onChange={(e) => setField(i, 'name', e.target.value)}
                    />
                    <input
                      className="td-form-input"
                      style={{ width: 92 }}
                      type="number" min="1" max="300"
                      value={sec.durationMinutes ?? ''}
                      onChange={(e) => setField(i, 'durationMinutes', e.target.value)}
                    />
                    <span style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>phút</span>
                    <button className="td-icon-btn" onClick={() => removeSection(i)} title="Bỏ phần này">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button className="td-btn-ghost" onClick={addSection} style={{ marginTop: 4 }}>
                  <Plus size={14} /> Thêm phần
                </button>
              </div>

              <p className="td-form-hint">
                Tổng <strong>{totalMinutes} phút</strong> — con số này sẽ thay thời lượng
                hiện tại của đề ({exam.durationMinutes} phút). Hai đồng hồ mà lệch nhau thì
                thí sinh sẽ tin cái nào đang hiện to hơn.
              </p>
              <p className="td-form-hint">
                Hết giờ một phần là khoá phần đó, đúng như phòng thi thật. Xếp câu hỏi vào
                từng phần ở màn gắn câu hỏi.
              </p>
            </>
          )}
        </div>

        <div className="td-modal-footer">
          {sections?.length > 0 && (
            <button className="td-btn-ghost" onClick={removeAll} disabled={busy}
                    style={{ marginRight: 'auto', color: 'var(--cinnabar)' }}>
              Bỏ chia phần
            </button>
          )}
          <button className="td-btn-secondary" onClick={onClose} disabled={busy}>Đóng</button>
          <button className="td-btn-primary" onClick={save} disabled={busy || sections == null}>
            {busy ? 'Đang lưu…' : 'Lưu cấu trúc'}
          </button>
        </div>
      </div>
    </div>
  );
}
