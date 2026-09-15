// src/components/question/ImportQuestionsModal.jsx
// Import PDF/Word → trích văn bản → Gemini sinh câu hỏi nháp → giáo viên duyệt → lưu.

import { useState } from 'react';
import { X, UploadCloud, Sparkles, Trash2, AlertCircle, Save } from 'lucide-react';
import * as questionService from '../../services/questionService';
import { DIFFICULTY_LABELS, JLPT_SKILL_LABELS } from '../../utils/constants';

const emptyDraft = () => ({
  content: '',
  questionType: 'MULTIPLE_CHOICE',
  difficultyLevel: null,
  skill: null,
  explanation: '',
  aiGenerated: true,
  answers: [
    { answerContent: '', correct: true },
    { answerContent: '', correct: false },
  ],
});

export default function ImportQuestionsModal({ bankId, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [difficultyLevel, setDifficultyLevel] = useState('');
  const [skill, setSkill] = useState('');
  const [drafts, setDrafts] = useState(null);

  const [extracting, setExtracting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleExtract = async () => {
    if (!file) {
      setError('Chọn file PDF hoặc Word trước.');
      return;
    }
    setError('');
    setExtracting(true);
    try {
      const extracted = await questionService.extractDocumentText(bankId, file);
      setText(extracted);
    } catch (err) {
      setError(err.message);
    } finally {
      setExtracting(false);
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      setError('Chưa có nội dung văn bản để sinh câu hỏi.');
      return;
    }
    setError('');
    setGenerating(true);
    try {
      const generated = await questionService.generateQuestionsFromText(bankId, {
        text,
        questionCount: Number(questionCount) || 5,
        difficultyLevel: difficultyLevel ? Number(difficultyLevel) : null,
        skill: skill || null,
      });
      setDrafts(generated);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const updateDraft = (index, patch) => {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  const updateAnswer = (dIndex, aIndex, patch) => {
    setDrafts((prev) => prev.map((d, i) => {
      if (i !== dIndex) return d;
      const answers = d.answers.map((a, j) => (j === aIndex ? { ...a, ...patch } : a));
      return { ...d, answers };
    }));
  };

  const setCorrectAnswer = (dIndex, aIndex) => {
    setDrafts((prev) => prev.map((d, i) => {
      if (i !== dIndex) return d;
      return { ...d, answers: d.answers.map((a, j) => ({ ...a, correct: j === aIndex })) };
    }));
  };

  const removeDraft = (index) => {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!drafts || drafts.length === 0) return;
    setError('');
    setSaving(true);
    try {
      await questionService.createQuestionsBulk(bankId, drafts);
      onImported();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="td-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="td-modal" style={{ maxWidth: 720, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="td-modal-header">
          <div>
            <h2>📄 Import câu hỏi từ file</h2>
            <p>Tải PDF/Word lên, để Gemini sinh câu hỏi nháp — bạn xem lại trước khi lưu.</p>
          </div>
          <button className="td-close-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="td-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(185, 58, 43,0.1)', color: 'var(--cinnabar)',
              border: '1px solid rgba(185, 58, 43,0.25)', borderRadius: 10,
              padding: '10px 12px', fontSize: 13.5,
            }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} /> {error}
            </div>
          )}

          {/* Bước 1: chọn file + trích văn bản */}
          <div className="td-form-group full">
            <label className="td-form-label"><UploadCloud size={14} /> File PDF hoặc Word (.pdf, .docx)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="file"
                accept=".pdf,.docx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="td-form-input"
                style={{ flex: 1 }}
              />
              <button className="td-btn-secondary" onClick={handleExtract} disabled={extracting || !file}>
                {extracting ? 'Đang đọc...' : 'Trích văn bản'}
              </button>
            </div>
          </div>

          {text && (
            <>
              <div className="td-form-group full">
                <label className="td-form-label">Nội dung đã trích (có thể sửa trước khi sinh câu hỏi)</label>
                <textarea
                  className="td-form-input"
                  style={{ minHeight: 140, resize: 'vertical' }}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </div>

              {/* Bước 2: cấu hình + sinh câu hỏi */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="td-form-group">
                  <label className="td-form-label">Số câu hỏi</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    className="td-form-input"
                    value={questionCount}
                    onChange={(e) => setQuestionCount(e.target.value)}
                    style={{ width: 90 }}
                  />
                </div>
                <div className="td-form-group">
                  <label className="td-form-label">Độ khó (tuỳ chọn)</label>
                  <select
                    className="td-form-select"
                    value={difficultyLevel}
                    onChange={(e) => setDifficultyLevel(e.target.value)}
                  >
                    <option value="">Để Gemini tự chọn</option>
                    {Object.entries(DIFFICULTY_LABELS).map(([level, label]) => (
                      <option key={level} value={level}>{level} — {label}</option>
                    ))}
                  </select>
                </div>
                <div className="td-form-group">
                  <label className="td-form-label">Kỹ năng JLPT (tuỳ chọn)</label>
                  <select className="td-form-select" value={skill} onChange={(e) => setSkill(e.target.value)}>
                    <option value="">Để Gemini tự chọn</option>
                    {Object.entries(JLPT_SKILL_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <button className="td-btn-primary" onClick={handleGenerate} disabled={generating}>
                  <Sparkles size={15} /> {generating ? 'Đang sinh câu hỏi...' : 'Sinh câu hỏi bằng AI'}
                </button>
              </div>
            </>
          )}

          {/* Bước 3: xem lại & sửa câu hỏi nháp */}
          {drafts && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>
                {drafts.length} câu hỏi nháp — kiểm tra lại trước khi lưu
              </h3>
              {drafts.map((draft, di) => (
                <div
                  key={di}
                  style={{
                    border: '1px solid rgba(43,38,32,0.15)', borderRadius: 10, padding: 14,
                    display: 'flex', flexDirection: 'column', gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ fontSize: 13 }}>Câu {di + 1}</strong>
                    <button
                      className="td-btn-ghost"
                      style={{ color: 'var(--cinnabar)' }}
                      onClick={() => removeDraft(di)}
                      title="Bỏ câu này"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <textarea
                    className="td-form-input"
                    style={{ minHeight: 60, resize: 'vertical' }}
                    value={draft.content}
                    onChange={(e) => updateDraft(di, { content: e.target.value })}
                  />
                  {draft.answers.map((a, ai) => (
                    <div key={ai} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="radio"
                        name={`correct-${di}`}
                        checked={a.correct}
                        onChange={() => setCorrectAnswer(di, ai)}
                        title="Đáp án đúng"
                      />
                      <input
                        className="td-form-input"
                        style={{ flex: 1 }}
                        value={a.answerContent}
                        onChange={(e) => updateAnswer(di, ai, { answerContent: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="td-modal-footer">
          <button type="button" className="td-btn-secondary" onClick={onClose}>Hủy</button>
          {drafts && (
            <button className="td-btn-primary" onClick={handleSave} disabled={saving || drafts.length === 0}>
              <Save size={15} /> {saving ? 'Đang lưu...' : `Lưu ${drafts.length} câu vào ngân hàng`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
