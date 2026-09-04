// src/pages/teacher/QuestionBank.jsx
// Trang quản lý ngân hàng câu hỏi của giáo viên.
// Render bên trong khung TeacherDashboard nên chỉ trả về phần nội dung,
// dùng lại lớp CSS td-* thay vì tự định nghĩa style mới.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, Edit3, Trash2, BookOpen, AlertCircle, Lock,
  ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import QuestionForm from '../../components/question/QuestionForm';
import * as questionService from '../../services/questionService';
import classService from '../../services/classService';
import {
  DIFFICULTY_LABELS,
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
} from '../../utils/constants';
import { truncate } from '../../utils/helpers';

const PAGE_SIZE = 20;

/**
 * Form tạo ngân hàng mới. Bắt buộc chọn trình độ: ngân hàng không có trình độ
 * thì lúc tạo đề thi không thể tự chọn đúng ngân hàng theo trình độ của đề,
 * giáo viên phải mò tay giữa các ngân hàng.
 * Danh sách trình độ lấy từ GET /api/teacher/levels (dữ liệu seed dùng chung).
 */
function NewBankModal({ onClose, onCreate, creating }) {
  const [title, setTitle] = useState('');
  const [levelId, setLevelId] = useState('');
  const [levels, setLevels] = useState([]);
  const [loadingLevels, setLoadingLevels] = useState(true);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    classService
      .getLevels()
      .then((list) => {
        if (cancelled) return;
        setLevels(list);
        setLevelId((current) => current || String(list[0]?.levelId ?? ''));
      })
      .catch((err) => !cancelled && setFormError(err.message))
      .finally(() => !cancelled && setLoadingLevels(false));
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Nhập tên ngân hàng câu hỏi.');
      return;
    }
    if (!levelId) {
      setFormError('Chọn trình độ cho ngân hàng.');
      return;
    }
    setFormError(null);
    onCreate({ title: title.trim(), levelId: Number(levelId) });
  };

  return (
    <div className="td-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="td-modal" style={{ maxWidth: 520 }}>
        <div className="td-modal-header">
          <div>
            <h2>📚 Ngân hàng câu hỏi mới</h2>
            <p>Gom câu hỏi theo trình độ để lúc tạo đề chọn nhanh hơn</p>
          </div>
          <button className="td-close-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="td-modal-body">
            <div className="td-form-group full">
              <label className="td-form-label">
                <BookOpen size={14} /> Tên ngân hàng <span className="required">*</span>
              </label>
              <input
                className="td-form-input"
                placeholder="VD: N4 – Ngữ pháp cơ bản"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                autoFocus
              />
            </div>

            <div className="td-form-group full">
              <label className="td-form-label">
                <BookOpen size={14} /> Trình độ <span className="required">*</span>
              </label>
              <select
                className="td-form-select"
                value={levelId}
                onChange={(e) => setLevelId(e.target.value)}
                disabled={loadingLevels || levels.length === 0}
              >
                {loadingLevels && <option value="">Đang tải...</option>}
                {!loadingLevels && levels.length === 0 && (
                  <option value="">Chưa có trình độ nào</option>
                )}
                {levels.map((lv) => (
                  <option key={lv.levelId} value={lv.levelId}>
                    {lv.subjectName ? `${lv.subjectName} – ` : ''}{lv.levelName}
                  </option>
                ))}
              </select>
            </div>

            {formError && (
              <div
                className="td-form-group full"
                style={{ color: '#f87171', fontSize: 13, display: 'flex', gap: 6 }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} /> {formError}
              </div>
            )}
          </div>

          <div className="td-modal-footer">
            <button type="button" className="td-btn-secondary" onClick={onClose}>Hủy</button>
            <button type="submit" className="td-btn-primary" disabled={creating}>
              {creating ? 'Đang tạo...' : 'Tạo ngân hàng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const QuestionBank = () => {
  const [banks, setBanks] = useState([]);
  const [bankId, setBankId] = useState(null);
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState({ content: [], totalElements: 0, totalPages: 0 });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editing, setEditing] = useState(null);   // { ...question } | 'new' | null
  const [showNewBank, setShowNewBank] = useState(false);
  const [creatingBank, setCreatingBank] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterDifficulty, setFilterDifficulty] = useState('all');

  // ── Nạp danh sách ngân hàng một lần khi mount ──────────────────────
  useEffect(() => {
    let cancelled = false;
    questionService
      .getMyBanks()
      .then((list) => {
        if (cancelled) return;
        setBanks(list);
        setBankId((current) => current ?? list[0]?.bankId ?? null);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  // ── Nạp câu hỏi mỗi khi đổi ngân hàng hoặc đổi trang ───────────────
  const loadQuestions = useCallback(async () => {
    if (!bankId) {
      setPageData({ content: [], totalElements: 0, totalPages: 0 });
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await questionService.getQuestions(bankId, { page, size: PAGE_SIZE });
      setPageData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [bankId, page]);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  // ── Lọc phía client trong trang hiện tại ───────────────────────────
  const visibleQuestions = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return (pageData.content ?? []).filter((q) => {
      if (filterType !== 'all' && q.questionType !== filterType) return false;
      if (filterDifficulty !== 'all' && String(q.difficultyLevel) !== filterDifficulty) return false;
      if (needle && !q.content?.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [pageData.content, keyword, filterType, filterDifficulty]);

  // ── CRUD ───────────────────────────────────────────────────────────

  /** Cập nhật lại số câu hỏi hiển thị trên ô chọn ngân hàng. */
  const refreshBankCounts = async () => {
    try {
      setBanks(await questionService.getMyBanks());
    } catch {
      // Không quan trọng: chỉ là con số hiển thị, bỏ qua nếu lỗi
    }
  };

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    try {
      if (editing === 'new') {
        await questionService.createQuestion(bankId, payload);
      } else {
        await questionService.updateQuestion(bankId, editing.questionId, payload);
      }
      setEditing(null);
      await loadQuestions();
      await refreshBankCounts();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (question) => {
    const warning = question.usedInExam
      ? 'Câu hỏi này đã được dùng trong đề thi nên sẽ được ẩn khỏi ngân hàng thay vì xoá hẳn, '
        + 'để kết quả các bài đã nộp vẫn tra được. Tiếp tục?'
      : 'Xoá vĩnh viễn câu hỏi này khỏi ngân hàng?';
    if (!window.confirm(warning)) return;

    try {
      await questionService.deleteQuestion(bankId, question.questionId);
      await loadQuestions();
      await refreshBankCounts();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateBank = async ({ title, levelId }) => {
    setCreatingBank(true);
    try {
      const created = await questionService.createBank({ title, levelId });
      setBanks((prev) => [...prev, created]);
      setBankId(created.bankId);
      setPage(0);
      setShowNewBank(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingBank(false);
    }
  };

  const selectedBank = banks.find((b) => b.bankId === bankId);

  return (
    <div className="td-content">
      {error && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
            background: 'rgba(239,68,68,0.1)', color: '#f87171',
            border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10,
            padding: '12px 14px', fontSize: 13.5,
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
        </div>
      )}

      <div className="td-section-card">
        <div className="td-section-header">
          <h2>Ngân hàng câu hỏi</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <select
              className="td-form-select"
              style={{ padding: '8px 12px', minWidth: 220 }}
              value={bankId ?? ''}
              onChange={(e) => { setBankId(Number(e.target.value)); setPage(0); }}
            >
              {banks.length === 0 && <option value="">-- Chưa có ngân hàng --</option>}
              {banks.map((b) => (
                <option key={b.bankId} value={b.bankId}>
                  {b.title} ({b.totalQuestions} câu){b.levelName ? ` · ${b.levelName}` : ''}
                </option>
              ))}
            </select>
            <button className="td-btn-secondary" onClick={() => setShowNewBank(true)}>
              <Plus size={15} /> Ngân hàng mới
            </button>
            <button
              className="td-btn-primary"
              onClick={() => setEditing('new')}
              disabled={!bankId}
            >
              <Plus size={16} /> Thêm câu hỏi
            </button>
          </div>
        </div>

        {/* Bộ lọc */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="td-search-box" style={{ flex: 1, minWidth: 220 }}>
            <Search size={15} />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm trong nội dung câu hỏi..."
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: '#e2e8f0', fontSize: 13.5, width: '100%',
              }}
            />
          </div>

          <select
            className="td-form-select"
            style={{ padding: '8px 12px', width: 'auto' }}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">Mọi loại câu hỏi</option>
            {Object.values(QUESTION_TYPES).map((t) => (
              <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>
            ))}
          </select>

          <select
            className="td-form-select"
            style={{ padding: '8px 12px', width: 'auto' }}
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value)}
          >
            <option value="all">Mọi độ khó</option>
            {Object.entries(DIFFICULTY_LABELS).map(([level, label]) => (
              <option key={level} value={level}>{level} — {label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="td-empty">
            <BookOpen size={56} />
            <h3>Đang tải...</h3>
          </div>
        ) : !bankId ? (
          <div className="td-empty">
            <BookOpen size={56} />
            <h3>Chưa có ngân hàng câu hỏi</h3>
            <p>Nhấn <strong>Ngân hàng mới</strong> để tạo ngân hàng đầu tiên.</p>
          </div>
        ) : visibleQuestions.length === 0 ? (
          <div className="td-empty">
            <BookOpen size={56} />
            <h3>Không có câu hỏi nào</h3>
            <p>
              {pageData.totalElements > 0
                ? 'Không có câu hỏi khớp bộ lọc hiện tại.'
                : <>Ngân hàng <strong>{selectedBank?.title}</strong> đang trống. Nhấn <strong>Thêm câu hỏi</strong> để bắt đầu.</>}
            </p>
          </div>
        ) : (
          <>
            <table className="td-exam-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  <th>Nội dung câu hỏi</th>
                  <th style={{ width: 130 }}>Loại</th>
                  <th style={{ width: 120 }}>Độ khó</th>
                  <th style={{ width: 90 }}>Đáp án</th>
                  <th style={{ width: 150 }}>Trạng thái</th>
                  <th style={{ width: 90 }}></th>
                </tr>
              </thead>
              <tbody>
                {visibleQuestions.map((q, index) => (
                  <tr key={q.questionId}>
                    <td style={{ color: '#475569', fontSize: 12.5 }}>
                      {page * PAGE_SIZE + index + 1}
                    </td>
                    <td>
                      <div className="td-exam-name">{truncate(q.content, 120)}</div>
                      {q.explanation && (
                        <div className="td-exam-subject">Giải thích: {truncate(q.explanation, 80)}</div>
                      )}
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: 13 }}>
                      {QUESTION_TYPE_LABELS[q.questionType] ?? q.questionType}
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: 13 }}>
                      {q.difficultyLevel} — {DIFFICULTY_LABELS[q.difficultyLevel] ?? '—'}
                    </td>
                    <td style={{ fontWeight: 600, color: '#a78bfa' }}>
                      {q.answers?.length ?? 0}
                    </td>
                    <td>
                      {q.usedInExam ? (
                        <span
                          className="td-badge upcoming"
                          title="Đã có đề thi dùng câu hỏi này. Đề đó giữ bản đã chụp, nên sửa ở đây không làm đổi điểm đã chấm."
                        >
                          <Lock size={11} /> Đã dùng trong đề thi
                        </span>
                      ) : (
                        <span className="td-badge draft">Chưa dùng</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="td-btn-ghost" title="Sửa" onClick={() => setEditing(q)}>
                          <Edit3 size={14} />
                        </button>
                        <button
                          className="td-btn-ghost"
                          style={{ color: '#f87171' }}
                          title={q.usedInExam ? 'Ẩn khỏi ngân hàng' : 'Xoá'}
                          onClick={() => handleDelete(q)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.06)',
                fontSize: 13, color: '#64748b',
              }}
            >
              <span>
                Trang {page + 1}/{Math.max(pageData.totalPages, 1)} · {pageData.totalElements} câu hỏi
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="td-btn-secondary"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(p - 1, 0))}
                >
                  <ChevronLeft size={15} /> Trước
                </button>
                <button
                  className="td-btn-secondary"
                  disabled={page + 1 >= pageData.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Sau <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {showNewBank && (
        <NewBankModal
          onClose={() => setShowNewBank(false)}
          onCreate={handleCreateBank}
          creating={creatingBank}
        />
      )}

      {editing && (
        <QuestionForm
          initialData={editing === 'new' ? null : editing}
          onSubmit={handleSubmit}
          onCancel={() => setEditing(null)}
          submitting={submitting}
        />
      )}
    </div>
  );
};

export default QuestionBank;
