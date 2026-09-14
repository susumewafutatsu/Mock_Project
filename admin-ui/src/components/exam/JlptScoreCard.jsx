// src/components/exam/JlptScoreCard.jsx
// Bảng điểm kiểu JLPT: điểm từng nhóm, tổng 0–180, kết luận Đỗ / Trượt.

import React from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import './JlptScoreCard.css';

/**
 * @param jlpt  đối tượng từ ExamResultResponse.jlpt; null = đề chấm điểm thô,
 *              component tự ẩn đi
 * @param compact  bản gọn cho danh sách lịch sử: chỉ tổng và kết luận
 */
export default function JlptScoreCard({ jlpt, compact = false }) {
  if (!jlpt) return null;

  const { level, groups = [], totalScore, totalMax, passTotal, passed, verdict, disclaimer } = jlpt;

  if (compact) {
    return (
      <span className={`jlpt-pill ${passed ? 'passed' : 'failed'}`}>
        {passed ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
        {level} · {totalScore}/{totalMax} · {passed ? 'Đỗ' : 'Trượt'}
      </span>
    );
  }

  return (
    <div className={`jlpt-card ${passed ? 'passed' : 'failed'}`}>
      <div className="jlpt-head">
        <div className="jlpt-verdict">
          {passed
            ? <CheckCircle2 size={20} className="jlpt-icon-pass" />
            : <XCircle size={20} className="jlpt-icon-fail" />}
          <div>
            <h3>{passed ? `Đỗ ${level}` : `Chưa đạt ${level}`}</h3>
            <p>{verdict}</p>
          </div>
        </div>
        <div className="jlpt-total">
          <span className="jlpt-total-value">{totalScore}</span>
          <span className="jlpt-total-max">/ {totalMax}</span>
          <span className="jlpt-total-need">cần {passTotal}</span>
        </div>
      </div>

      <div className="jlpt-groups">
        {groups.map((g) => (
          <div key={g.code} className={`jlpt-group ${g.aboveMinimum ? '' : 'below'}`}>
            <div className="jlpt-group-head">
              <span className="jlpt-group-name">
                {g.japaneseName}
                <small>{g.vietnameseName}</small>
              </span>
              <span className="jlpt-group-score">
                {g.score}<small>/{g.maxScore}</small>
              </span>
            </div>

            <div className="jlpt-bar">
              <div className="jlpt-bar-fill" style={{ width: `${(g.score / g.maxScore) * 100}%` }} />
              {/* Vạch điểm liệt vẽ đè lên thanh. */}
              <div className="jlpt-bar-min" style={{ left: `${(g.minScore / g.maxScore) * 100}%` }} />
            </div>

            <div className="jlpt-group-foot">
              <span>{g.correctQuestions}/{g.totalQuestions} câu đúng</span>
              {g.aboveMinimum
                ? <span className="jlpt-ok">qua điểm liệt {g.minScore}</span>
                : <span className="jlpt-warn"><AlertTriangle size={12} /> dưới điểm liệt {g.minScore}</span>}
            </div>
          </div>
        ))}
      </div>

      {disclaimer && (
        <p className="jlpt-disclaimer">
          <Info size={13} /> {disclaimer}
        </p>
      )}
    </div>
  );
}
