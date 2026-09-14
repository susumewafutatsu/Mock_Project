// src/pages/teacher/StudentsView.jsx
// Tab "Thí sinh".

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Download, Loader2, Search, Users } from 'lucide-react';
import analyticsService, { downloadCsv } from '../../services/analyticsService';

function fmt(value) {
  if (!value) return 'chưa nộp bài nào';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function initialsOf(name) {
  return (name ?? '?')
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w))
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function scoreColor(percent) {
  if (percent == null) return 'var(--ink-faint)';
  if (percent >= 80) return 'var(--jade)';
  if (percent >= 50) return 'var(--gold)';
  return 'var(--cinnabar)';
}

export default function StudentsView() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    let alive = true;
    analyticsService.getStudents()
      .then((list) => { if (alive) setRows(list); })
      .catch((e) => { if (alive) setError(e.message || 'Không tải được danh sách'); });
    return () => { alive = false; };
  }, []);

  const shown = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw || !rows) return rows ?? [];
    return rows.filter((r) =>
      (r.fullName ?? '').toLowerCase().includes(kw)
      || (r.email ?? '').toLowerCase().includes(kw)
      || (r.roomNames ?? []).some((n) => n.toLowerCase().includes(kw)));
  }, [rows, keyword]);

  const summary = useMemo(() => {
    if (!rows?.length) return null;
    return {
      total: rows.length,
      // "Chưa làm gì" là nhóm cần nhắc trước tiên, nên nó được đếm riêng.
      idle: rows.filter((r) => r.submittedExams === 0).length,
      done: rows.filter((r) => r.assignedExams > 0 && r.submittedExams >= r.assignedExams).length,
    };
  }, [rows]);

  const exportCsv = () => {
    downloadCsv('thi-sinh', [
      { key: 'fullName', label: 'Họ tên' },
      { key: 'email', label: 'Email' },
      { key: 'rooms', label: 'Phòng thi' },
      { key: 'submittedExams', label: 'Đề đã nộp' },
      { key: 'assignedExams', label: 'Đề được giao' },
      { key: 'averagePercent', label: 'Điểm trung bình (%)' },
      { key: 'lastSubmittedAt', label: 'Nộp gần nhất' },
    ], (rows ?? []).map((r) => ({ ...r, rooms: (r.roomNames ?? []).join(' / ') })));
  };

  if (error) {
    return (
      <div className="td-empty">
        <AlertCircle size={52} style={{ color: 'var(--cinnabar)' }} />
        <h3>Không tải được danh sách thí sinh</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (rows == null) {
    return (
      <div className="td-empty">
        <Loader2 size={48} style={{ animation: 'spin 1s linear infinite' }} />
        <h3>Đang tải danh sách thí sinh…</h3>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="td-empty">
        <Users size={56} />
        <h3>Chưa có thí sinh nào trong phòng của bạn</h3>
        <p>Tạo một phòng thi rồi gửi mã phòng cho học viên — họ vào phòng là xuất hiện ở đây.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {summary && (
        <div className="td-stats-row">
          <div className="td-stat-card">
            <div className="td-stat-icon" style={{ background: 'rgba(61,126,166,0.12)' }}>👥</div>
            <div className="td-stat-body">
              <p className="td-stat-label">Thí sinh</p>
              <p className="td-stat-value">{summary.total}</p>
              <p className="td-stat-sub">Trong các phòng của bạn</p>
            </div>
          </div>
          <div className="td-stat-card">
            <div className="td-stat-icon" style={{ background: 'rgba(185,58,43,0.10)' }}>💤</div>
            <div className="td-stat-body">
              <p className="td-stat-label">Chưa làm bài nào</p>
              <p className="td-stat-value">{summary.idle}</p>
              <p className="td-stat-sub">Cần nhắc trước tiên</p>
            </div>
          </div>
          <div className="td-stat-card">
            <div className="td-stat-icon" style={{ background: 'rgba(47,143,111,0.12)' }}>✅</div>
            <div className="td-stat-body">
              <p className="td-stat-label">Đã làm đủ</p>
              <p className="td-stat-value">{summary.done}</p>
              <p className="td-stat-sub">Nộp hết đề được giao</p>
            </div>
          </div>
        </div>
      )}

      <div className="td-section-card">
        <div className="td-section-header">
          <h2>Thí sinh trong phòng của bạn</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="td-form-group" style={{ margin: 0, position: 'relative' }}>
              <input
                className="td-form-input"
                style={{ paddingLeft: 30, minWidth: 200 }}
                placeholder="Tìm tên, email, phòng…"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <Search size={14} style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--ink-faint)', pointerEvents: 'none',
              }} />
            </div>
            <button className="td-btn-secondary" onClick={exportCsv}>
              <Download size={15} /> Xuất CSV
            </button>
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="td-empty">
            <Search size={48} />
            <h3>Không có ai khớp "{keyword}"</h3>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="td-exam-table">
              <thead>
                <tr>
                  <th>Thí sinh</th><th>Phòng</th><th>Tiến độ</th>
                  <th>Điểm trung bình</th><th>Nộp gần nhất</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const ratio = r.assignedExams === 0 ? null
                    : Math.round((r.submittedExams / r.assignedExams) * 100);
                  return (
                    <tr key={r.userId}>
                      <td>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <div className="td-avatar" style={{ flexShrink: 0 }}>
                            {r.avatarUrl
                              ? <img src={r.avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} />
                              : initialsOf(r.fullName)}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p className="td-exam-name">{r.fullName}</p>
                            <p className="td-exam-subject">{r.email}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
                        {(r.roomNames ?? []).join(', ') || '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{
                            fontSize: 12.5, fontWeight: 700, minWidth: 34,
                            color: r.submittedExams === 0 ? 'var(--cinnabar)' : 'var(--ink-body)',
                          }}>
                            {r.submittedExams}/{r.assignedExams}
                          </span>
                          <div style={{
                            height: 6, borderRadius: 99, minWidth: 70, flex: 1,
                            background: 'rgba(43,38,32,0.08)', overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${ratio ?? 0}%`, height: '100%',
                              background: ratio === 100 ? 'var(--jade)' : 'var(--azure)',
                            }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ fontWeight: 700, color: scoreColor(r.averagePercent) }}>
                        {r.averagePercent == null ? '—' : `${r.averagePercent}%`}
                      </td>
                      <td style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
                        {fmt(r.lastSubmittedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
