// src/components/question/QuestionForm.jsx
// Form tạo / sửa câu hỏi. Dùng lại lớp CSS td-* của TeacherDashboard.css.
//
// Props:
//   initialData — QuestionResponse khi sửa, null khi tạo mới
//   onSubmit    — async (payload) => void; payload đúng dạng backend cần
//   onCancel    — () => void
//   submitting  — true để khoá nút trong lúc chờ API
//
// Quy tắc validate ở đây khớp với QuestionServiceImpl.validateAnswers():
//   ESSAY            → không có đáp án
//   MULTIPLE_CHOICE  → ít nhất 2 đáp án, đúng 1 đáp án đúng
//   MATCHING         → ít nhất 2 đáp án, ít nhất 1 đáp án đúng

import { useMemo, useState } from 'react';
import { Plus, Trash2, X, Check, AlertCircle } from 'lucide-react';
import {
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  TYPES_WITHOUT_ANSWERS,
  DIFFICULTY_LABELS,
} from '../../utils/constants';

const EMPTY_ANSWER = () => ({ answerId: null, answerContent: '', correct: false });

const QuestionForm = ({ initialData, onSubmit, onCancel, submitting = false }) => {
  const [content, setContent] = useState(initialData?.content ?? '');
  const [questionType, setQuestionType] = useState(
    initialData?.questionType ?? QUESTION_TYPES.MULTIPLE_CHOICE
  );
  const [difficultyLevel, setDifficultyLevel] = useState(initialData?.difficultyLevel ?? 3);
  const [explanation, setExplanation] = useState(initialData?.explanation ?? '');
  const [answers, setAnswers] = useState(() => {
    const existing = initialData?.answers;
    if (existing?.length) {
      return existing.map((a) => ({
        answerId: a.answerId ?? null,
        answerContent: a.answerContent ?? '',
        correct: !!a.correct,
      }));
    }
    return [EMPTY_ANSWER(), EMPTY_ANSWER()];
  });
  const [error, setError] = useState('');

  const isEdit = !!initialData?.questionId;
  const needsAnswers = !TYPES_WITHOUT_ANSWERS.includes(questionType);
  const singleCorrect = questionType === QUESTION_TYPES.MULTIPLE_CHOICE;

  const correctCount = useMemo(
    () => answers.filter((a) => a.correct).length,
    [answers]
  );

  // ── Thao tác trên danh sách đáp án ─────────────────────────────────
  const setAnswerAt = (index, patch) =>
    setAnswers((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));

  const addAnswer = () => setAnswers((prev) => [...prev, EMPTY_ANSWER()]);

  const removeAnswer = (index) =>
    setAnswers((prev) => prev.filter((_, i) => i !== index));

  /** Trắc nghiệm chỉ được một đáp án đúng nên chọn cái mới sẽ bỏ cái cũ. */
  const toggleCorrect = (index) =>
    setAnswers((prev) =>
      prev.map((a, i) => {
        if (singleCorrect) return { ...a, correct: i === index };
        return i === index ? { ...a, correct: !a.correct } : a;
      })
    );

  // ── Validate + submit ──────────────────────────────────────────────
  const validate = () => {
    if (!content.trim()) return 'Nội dung câu hỏi không được để trống';

    if (!needsAnswers) return '';

    const filled = answers.filter((a) => a.answerContent.trim());
    if (filled.length < 2) return 'Cần ít nhất 2 đáp án có nội dung';
    if (filled.length !== answers.length) return 'Có đáp án đang để trống, hãy điền hoặc xoá';

    const correctFilled = filled.filter((a) => a.correct).length;
    if (correctFilled === 0) return 'Phải đánh dấu ít nhất một đáp án đúng';
    if (singleCorrect && correctFilled !== 1)
      return 'Câu trắc nghiệm chỉ được có đúng một đáp án đúng';

    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const message = validate();
    setError(message);
    if (message) return;

    const payload = {
      content: content.trim(),
      questionType,
      difficultyLevel: Number(difficultyLevel),
      explanation: explanation.trim() || null,
      // ESSAY không có đáp án chấm tự động → gửi danh sách rỗng
      answers: needsAnswers
        ? answers.map((a) => ({
            answerId: a.answerId,
            answerContent: a.answerContent.trim(),
            correct: !!a.correct,
          }))
        : [],
    };

    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err.message || 'Không lưu được câu hỏi');
    }
  };

  return (
    <div
      className="td-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onCancel?.()}
    >
      <div className="td-modal">
        <div className="td-modal-header">
          <div>
            <h2>{isEdit ? '✏️ Sửa câu hỏi' : '📝 Thêm câu hỏi'}</h2>
            <p>
              {isEdit && initialData?.usedInExam
                ? 'Câu hỏi này đã có trong đề thi. Sửa ở đây chỉ áp dụng cho đề tạo về sau — đề cũ giữ nguyên bản đã chụp.'
                : 'Điền nội dung và đáp án cho câu hỏi'}
            </p>
          </div>
          <button type="button" className="td-close-btn" onClick={onCancel}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="td-modal-body">
            {error && (
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'rgba(239,68,68,0.1)', color: '#f87171',
                  border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8,
                  padding: '10px 12px', fontSize: 13,
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}

            <div className="td-form-group full">
              <label className="td-form-label">
                Nội dung câu hỏi <span className="required">*</span>
              </label>
              <textarea
                className="td-form-textarea"
                placeholder="VD: Đạo hàm của hàm số y = x² là gì?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>

            <div className="td-form-row">
              <div className="td-form-group">
                <label className="td-form-label">Loại câu hỏi</label>
                <select
                  className="td-form-select"
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value)}
                >
                  {Object.values(QUESTION_TYPES).map((t) => (
                    <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>

              <div className="td-form-group">
                <label className="td-form-label">Độ khó</label>
                <select
                  className="td-form-select"
                  value={difficultyLevel}
                  onChange={(e) => setDifficultyLevel(e.target.value)}
                >
                  {Object.entries(DIFFICULTY_LABELS).map(([level, label]) => (
                    <option key={level} value={level}>{level} — {label}</option>
                  ))}
                </select>
              </div>
            </div>

            {needsAnswers ? (
              <div className="td-form-group full">
                <label className="td-form-label">
                  Đáp án <span className="required">*</span>
                  <span style={{ color: '#64748b', fontWeight: 400, marginLeft: 6 }}>
                    {singleCorrect
                      ? '(chọn đúng 1 đáp án đúng)'
                      : '(chọn một hoặc nhiều đáp án đúng)'}
                    {' · '}đã chọn {correctCount}
                  </span>
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {answers.map((answer, index) => (
                    <div
                      key={answer.answerId ?? `new-${index}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleCorrect(index)}
                        title={answer.correct ? 'Đáp án đúng' : 'Đánh dấu là đáp án đúng'}
                        style={{
                          width: 30, height: 30, flexShrink: 0, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderRadius: singleCorrect ? '50%' : 7,
                          border: `1px solid ${answer.correct ? '#34d399' : 'rgba(255,255,255,0.15)'}`,
                          background: answer.correct ? 'rgba(52,211,153,0.15)' : 'transparent',
                          color: answer.correct ? '#34d399' : '#475569',
                        }}
                      >
                        {answer.correct ? <Check size={15} /> : String.fromCharCode(65 + index)}
                      </button>

                      <input
                        className="td-form-input"
                        style={{ flex: 1 }}
                        placeholder={`Nội dung đáp án ${String.fromCharCode(65 + index)}`}
                        value={answer.answerContent}
                        onChange={(e) => setAnswerAt(index, { answerContent: e.target.value })}
                      />

                      <button
                        type="button"
                        className="td-btn-ghost"
                        style={{ color: '#f87171', visibility: answers.length > 2 ? 'visible' : 'hidden' }}
                        title="Xoá đáp án"
                        onClick={() => removeAnswer(index)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="td-btn-secondary"
                  style={{ alignSelf: 'flex-start', marginTop: 4 }}
                  onClick={addAnswer}
                >
                  <Plus size={15} /> Thêm đáp án
                </button>
              </div>
            ) : (
              <div
                style={{
                  color: '#94a3b8', fontSize: 13, lineHeight: 1.5,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8, padding: '12px 14px',
                }}
              >
                Câu tự luận không có đáp án chấm tự động. Người ra đề hoặc AI sẽ chấm phần trả lời
                của thí sinh sau khi nộp bài.
              </div>
            )}

            <div className="td-form-group full">
              <label className="td-form-label">Giải thích đáp án</label>
              <textarea
                className="td-form-textarea"
                style={{ minHeight: 70 }}
                placeholder="Hiện cho thí sinh sau khi có kết quả (không bắt buộc)"
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
              />
            </div>
          </div>

          <div className="td-modal-footer">
            <button type="button" className="td-btn-secondary" onClick={onCancel}>
              Hủy
            </button>
            <button type="submit" className="td-btn-primary" disabled={submitting}>
              <Check size={16} /> {submitting ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Thêm câu hỏi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuestionForm;
