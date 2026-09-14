// src/pages/teacher/TeacherOverview.jsx
// Tab "Tổng quan".

import React, { useEffect, useState } from 'react';
import {
  AlertCircle, ArrowRight, ClipboardList, Loader2, Radio, Users,
} from 'lucide-react';
import analyticsService from '../../services/analyticsService';

function fmt(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function rateColor(percent) {
  if (percent == null) return 'var(--ink-faint)';
  if (percent >= 80) return 'var(--jade)';
  if (percent >= 50) return 'var(--gold)';
  return 'var(--cinnabar)';
}

/** @param onGo chuyển tab; nhận id tab của TeacherDashboard */
export default function TeacherOverview({ onGo }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    analyticsService.getOverview()
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e.message || 'Không tải được số liệu'); });
    return () => { alive = false; };
  }, []);

  if (error) {
    return (
      <div className="td-empty">
        <AlertCircle size={52} style={{ color: 'var(--cinnabar)' }} />
        <h3>Không tải được tổng quan</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="td-empty">
        <Loader2 size={48} style={{ animation: 'spin 1s linear infinite' }} />
        <h3>Đang tải tổng quan…</h3>
      </div>
    );
  }

  const stats = [
    {
      icon: '📄', label: 'Đề luyện thi', value: data.totalExams,
      sub: `${data.publicExams} đề công khai`, color: 'rgba(124,92,191,0.12)',
      go: 'exams',
    },
    {
      icon: '🏫', label: 'Phòng thi', value: data.totalRooms,
      sub: data.roomsInProgress > 0 ? `${data.roomsInProgress} phòng đang thi` : 'Không có phòng nào đang thi',
      color: 'rgba(61,126,166,0.12)', go: 'rooms',
    },
    {
      icon: '👥', label: 'Thí sinh', value: data.totalStudents,
      sub: 'Trong các phòng của bạn', color: 'rgba(47,143,111,0.12)', go: 'students',
    },
    {
      icon: '📥', label: 'Lượt nộp', value: data.submissionsTotal,
      sub: `${data.submissionsLast7Days} lượt trong 7 ngày qua`,
      color: 'rgba(201,146,46,0.12)', go: 'results',
    },
  ];

  // Chỉ hiện những việc THẬT SỰ đang cần làm.
  const todos = [];
  if (data.examsWithoutQuestions > 0) {
    todos.push({
      icon: ClipboardList, tone: 'var(--gold)',
      text: `${data.examsWithoutQuestions} đề chưa gắn câu hỏi nào — thí sinh chưa vào thi được.`,
      action: 'Mở danh sách đề', go: 'exams',
    });
  }
  if (data.roomsInProgress > 0) {
    todos.push({
      icon: Radio, tone: 'var(--jade)',
      text: `${data.roomsInProgress} phòng đang trong giờ làm bài.`,
      action: 'Vào xem phòng', go: 'rooms',
    });
  }
  if (data.sessionsAtRisk > 0) {
    todos.push({
      icon: AlertCircle, tone: 'var(--cinnabar)',
      text: `${data.sessionsAtRisk} thí sinh đang làm bài nhưng đã im lặng lâu — có thể rớt mạng.`,
      action: 'Vào xem phòng', go: 'rooms',
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="td-stats-row">
        {stats.map((s) => (
          <button key={s.label} className="td-stat-card"
                  onClick={() => onGo?.(s.go)}
                  style={{ textAlign: 'left', cursor: 'pointer', border: 'none', font: 'inherit' }}>
            <div className="td-stat-icon" style={{ background: s.color }}>{s.icon}</div>
            <div className="td-stat-body">
              <p className="td-stat-label">{s.label}</p>
              <p className="td-stat-value">{s.value}</p>
              <p className="td-stat-sub">{s.sub}</p>
            </div>
          </button>
        ))}
      </div>

      {todos.length > 0 && (
        <div className="td-section-card">
          <div className="td-section-header"><h2>Đang cần bạn</h2></div>
          <div style={{ padding: '6px 0 10px' }}>
            {todos.map((t, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, alignItems: 'center',
                padding: '12px 22px', borderTop: i === 0 ? 'none' : '1px solid rgba(43,38,32,0.06)',
              }}>
                <t.icon size={18} style={{ color: t.tone, flexShrink: 0 }} />
                <p style={{ margin: 0, flex: 1, fontSize: 13.5, color: 'var(--ink-body)' }}>{t.text}</p>
                <button className="td-btn-ghost" onClick={() => onGo?.(t.go)}>
                  {t.action} <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="td-main-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18 }}>
        <div className="td-section-card">
          <div className="td-section-header">
            <h2>Câu cả lớp hay sai</h2>
            {data.hardestQuestions?.length > 0 && (
              <button className="td-btn-ghost" onClick={() => onGo?.('results')}>
                Xem đầy đủ <ArrowRight size={14} />
              </button>
            )}
          </div>
          {!data.hardestQuestions?.length ? (
            <div className="td-empty" style={{ padding: '28px 20px' }}>
              <AlertCircle size={42} />
              <h3>Chưa đủ dữ liệu</h3>
              <p>Cần ít nhất vài bài đã nộp thì mới biết câu nào là câu khó thật.</p>
            </div>
          ) : (
            <div style={{ padding: '4px 0 12px' }}>
              {data.hardestQuestions.map((q, i) => (
                <div key={`${q.questionId}-${i}`} style={{
                  display: 'flex', gap: 12, alignItems: 'center',
                  padding: '10px 22px', borderTop: i === 0 ? 'none' : '1px solid rgba(43,38,32,0.06)',
                }}>
                  <span style={{
                    fontSize: 15, fontWeight: 800, minWidth: 42, textAlign: 'right',
                    color: rateColor(q.correctPercent),
                  }}>
                    {q.correctPercent}%
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{
                      margin: 0, fontSize: 13, fontWeight: 600,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{q.content}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--ink-faint)' }}>
                      {q.correct}/{q.answered} lượt đúng
                      {q.tags?.length > 0 && ` · ${q.tags.join(', ')}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="td-section-card">
          <div className="td-section-header">
            <h2>Bài nộp gần đây</h2>
          </div>
          {!data.recentSubmissions?.length ? (
            <div className="td-empty" style={{ padding: '28px 20px' }}>
              <Users size={42} />
              <h3>Chưa có ai nộp bài</h3>
            </div>
          ) : (
            <div style={{ padding: '4px 0 12px' }}>
              {data.recentSubmissions.map((r, i) => (
                <div key={r.submissionId} style={{
                  display: 'flex', gap: 12, alignItems: 'center',
                  padding: '10px 22px', borderTop: i === 0 ? 'none' : '1px solid rgba(43,38,32,0.06)',
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{
                      margin: 0, fontSize: 13, fontWeight: 600,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{r.studentName}</p>
                    <p style={{
                      margin: '2px 0 0', fontSize: 11.5, color: 'var(--ink-faint)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {r.examTitle} · {fmt(r.submittedAt)}
                    </p>
                  </div>
                  <span style={{
                    fontSize: 14, fontWeight: 800, flexShrink: 0,
                    color: rateColor(r.percent),
                  }}>
                    {r.percent == null ? '—' : `${r.percent}%`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
