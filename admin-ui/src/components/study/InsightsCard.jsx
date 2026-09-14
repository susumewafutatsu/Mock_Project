// src/components/study/InsightsCard.jsx
// "Nên ôn gì tiếp?" trên trang tổng quan của học viên.

import { useEffect, useState } from 'react';
import { Compass, Target } from 'lucide-react';
import { getInsights } from '../../services/engagementService';

function colorOf(p) {
  if (p == null) return 'var(--ink-faint)';
  if (p >= 80) return 'var(--jade)';
  if (p >= 50) return 'var(--gold)';
  return 'var(--cinnabar)';
}

function Bar({ percent }) {
  return (
    <div className="sd-progress-bar-track">
      <div className="sd-progress-bar-fill"
           style={{ width: `${percent ?? 0}%`, background: colorOf(percent) }} />
    </div>
  );
}

/** @param onEnterExam (examId) => void */
export default function InsightsCard({ onEnterExam }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    // Lỗi ở đây chỉ làm khối gợi ý biến mất — không được chặn phần còn lại của trang.
    getInsights().then(setData).catch(() => setData({ skills: [], weakTags: [], placement: null }));
  }, []);

  if (!data) return null;
  const { skills = [], weakTags = [], placement } = data;
  if (!placement && skills.length === 0 && weakTags.length === 0) return null;

  return (
    <div className="sd-card" style={{ marginTop: 20 }}>
      <div className="sd-card-header">
        <h2>🧭 Nên ôn gì tiếp</h2>
      </div>
      <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {placement && (
          <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(61,126,166,0.07)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <Compass size={16} style={{ color: 'var(--azure)' }} />
              <strong style={{ fontSize: 13.5 }}>
                {placement.taken
                  ? `Nên bắt đầu ôn từ ${placement.recommendedLevel ?? '—'}`
                  : 'Chưa biết nên bắt đầu từ cấp nào?'}
              </strong>
            </div>
            <p style={{ margin: '0 0 8px', fontSize: 12.5, lineHeight: 1.65, color: 'var(--ink-soft)' }}>
              {placement.advice}
            </p>
            {placement.taken && placement.levels?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                {placement.levels.map((l) => (
                  <div key={l.levelName} style={{ display: 'grid', gridTemplateColumns: '34px 1fr 44px', gap: 8, alignItems: 'center', fontSize: 12 }}>
                    <span style={{ fontWeight: 700 }}>{l.levelName}</span>
                    <Bar percent={l.percent} />
                    <span style={{ textAlign: 'right', color: colorOf(l.percent), fontWeight: 700 }}>
                      {l.percent == null ? '—' : `${l.percent}%`}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <button className="sd-btn-primary" onClick={() => onEnterExam?.(placement.examId)}>
              {placement.taken ? 'Làm lại bài xếp trình độ' : 'Làm bài xếp trình độ'}
            </button>
          </div>
        )}

        {skills.length > 0 && (
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Theo kỹ năng
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {skills.map((s) => (
                <div key={s.skill}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                    <span><strong>{s.japaneseName}</strong> <span style={{ color: 'var(--ink-faint)' }}>{s.vietnameseName}</span></span>
                    <span style={{ color: colorOf(s.percent), fontWeight: 700 }}>
                      {s.percent}% <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>({s.correct}/{s.answered})</span>
                    </span>
                  </div>
                  <Bar percent={s.percent} />
                </div>
              ))}
            </div>
          </div>
        )}

        {weakTags.length > 0 && (
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Chủ điểm cần vá
            </p>
            {weakTags.map((t) => (
              <div key={t.tagId} style={{ padding: '8px 0', borderTop: '1px solid rgba(43,38,32,0.06)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                  <Target size={14} style={{ color: colorOf(t.percent) }} />
                  <strong>{t.tagName}</strong>
                  <span style={{ marginLeft: 'auto', color: colorOf(t.percent), fontWeight: 700 }}>{t.percent}%</span>
                </div>
                {t.exams?.length > 0 ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {t.exams.map((e) => (
                      <button key={e.examId} className="sd-btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
                              onClick={() => onEnterExam?.(e.examId)}>
                        {e.title}{e.levelName ? ` · ${e.levelName}` : ''}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--ink-faint)' }}>
                    Chưa có đề công khai nào nhắm riêng chủ điểm này — ôn lại trong sổ tay câu sai.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
