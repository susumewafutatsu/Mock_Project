// src/pages/teacher/ResultView.jsx
// Kết quả & Phân tích — tab từng là khung rỗng trên thanh điều hướng.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowLeft, BarChart2, CheckCircle2, Download, FileText,
  Loader2, Users, XCircle,
} from 'lucide-react';
import analyticsService, { downloadCsv } from '../../services/analyticsService';
import { getMyExams } from '../../services/teacherExamService';
import roomService from '../../services/roomService';

const TABS = [
  { id: 'submissions', label: 'Bài đã nộp', icon: Users },
  { id: 'questions',   label: 'Câu cần chữa', icon: AlertCircle },
  { id: 'tags',        label: 'Theo kỹ năng', icon: BarChart2 },
];

/** "28/08 07:30" — LocalDateTime của server về dạng "2026-08-28T07:30:00". */
function fmt(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Màu theo tỉ lệ đúng. Ngưỡng cố ý thấp hơn thang điểm học sinh quen thuộc. */
function rateColor(percent) {
  if (percent == null) return 'var(--ink-faint)';
  if (percent >= 80) return 'var(--jade)';
  if (percent >= 50) return 'var(--gold)';
  return 'var(--cinnabar)';
}

function Bar({ percent }) {
  const value = percent == null ? 0 : Math.max(0, Math.min(100, percent));
  return (
    <div style={{
      height: 6, borderRadius: 99, background: 'rgba(43,38,32,0.08)',
      overflow: 'hidden', minWidth: 80,
    }}>
      <div style={{ width: `${value}%`, height: '100%', background: rateColor(percent) }} />
    </div>
  );
}

function Empty({ icon: Icon, title, hint }) {
  return (
    <div className="td-empty">
      <Icon size={52} />
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
    </div>
  );
}

// ─── Bài làm của một thí sinh ────────────────────────────────────

export function PaperView({ submissionId, onBack }) {
  const [paper, setPaper] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setPaper(null);
    setError(null);
    analyticsService.getPaper(submissionId)
      .then((p) => { if (alive) setPaper(p); })
      .catch((e) => { if (alive) setError(e.message || 'Không mở được bài làm'); });
    return () => { alive = false; };
  }, [submissionId]);

  if (error) return <Empty icon={AlertCircle} title="Không mở được bài làm" hint={error} />;
  if (!paper) {
    return (
      <div className="td-empty">
        <Loader2 size={44} style={{ animation: 'spin 1s linear infinite' }} />
        <h3>Đang mở bài làm…</h3>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="td-btn-ghost" onClick={onBack}>
          <ArrowLeft size={15} /> Về danh sách
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>{paper.examTitle}</h2>
          <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--ink-faint)' }}>
            Lượt {paper.attemptNumber} · nộp {fmt(paper.submittedAt)}
            {paper.autoSubmitted ? ' · hệ thống tự nộp khi hết giờ' : ''}
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
            {paper.totalScore ?? 0}<span style={{ fontSize: 13, color: 'var(--ink-faint)' }}> / {paper.maxScore ?? 0}</span>
          </p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-faint)' }}>
            {paper.correctAnswers}/{paper.totalQuestions} câu đúng
          </p>
        </div>
      </div>

      {paper.details?.map((d) => (
        <div key={d.questionId} className="td-section-card" style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            {d.correct
              ? <CheckCircle2 size={18} style={{ color: 'var(--jade)', flexShrink: 0, marginTop: 2 }} />
              : <XCircle size={18} style={{ color: 'var(--cinnabar)', flexShrink: 0, marginTop: 2 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>
                Câu {d.questionOrder}. {d.content}
              </p>

              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {d.options?.map((o) => {
                  const chosen = o.snapshotAnswerId === d.selectedSnapshotAnswerId;
                  const right = o.snapshotAnswerId === d.correctSnapshotAnswerId;
                  return (
                    <div key={o.snapshotAnswerId} style={{
                      fontSize: 12.5,
                      padding: '4px 8px',
                      borderRadius: 6,
                      background: right ? 'rgba(47,143,111,0.10)'
                        : chosen ? 'rgba(185,58,43,0.08)' : 'transparent',
                      color: right ? 'var(--jade)' : chosen ? 'var(--cinnabar)' : 'var(--ink-soft)',
                      fontWeight: right || chosen ? 600 : 400,
                    }}>
                      {o.answerContent}
                      {right && ' ✓ đáp án đúng'}
                      {chosen && !right && ' ← thí sinh chọn'}
                    </div>
                  );
                })}
                {/* Câu bỏ trắng không có dòng nào được tô, nên phải nói thẳng. */}
                {d.selectedSnapshotAnswerId == null && !d.essayResponse && (
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic' }}>
                    Thí sinh bỏ trắng câu này.
                  </p>
                )}
              </div>

              {d.explanation && (
                <p style={{
                  margin: '10px 0 0', fontSize: 12.5, color: 'var(--ink-soft)',
                  padding: '8px 10px', borderRadius: 6, background: 'rgba(43,38,32,0.04)',
                }}>
                  <strong>Giải thích: </strong>{d.explanation}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Màn chính ───────────────────────────────────────────────────

export default function ResultView() {
  const [exams, setExams] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [examId, setExamId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [tab, setTab] = useState('submissions');

  const [rows, setRows] = useState(null);
  const [questionStats, setQuestionStats] = useState(null);
  const [tagStats, setTagStats] = useState(null);
  const [error, setError] = useState(null);
  const [openSubmission, setOpenSubmission] = useState(null);

  // Danh sách đề + phòng để chọn phạm vi. Chỉ tải một lần.
  useEffect(() => {
    let alive = true;
    getMyExams()
      .then((list) => {
        if (!alive) return;
        setExams(list);
        // Chọn sẵn đề có người nộp nhiều nhất.
        const best = [...list].sort((a, b) => (b.submissionCount ?? 0) - (a.submissionCount ?? 0))[0];
        if (best) setExamId(String(best.examId));
      })
      .catch((e) => { if (alive) setError(e.message); });
    roomService.getMyRooms()
      .then((list) => { if (alive) setRooms(list ?? []); })
      .catch(() => { /* không có phòng thì bộ lọc phòng ẩn đi, không phải lỗi */ });
    return () => { alive = false; };
  }, []);

  const load = useCallback(() => {
    if (!examId) return;
    const scope = roomId ? Number(roomId) : undefined;
    setRows(null); setQuestionStats(null); setTagStats(null); setError(null);

    const submissions = scope
      ? analyticsService.getRoomSubmissions(scope).then((all) =>
          // Bảng phòng gộp mọi đề của phòng; ở đây người dùng đã chọn một đề cụ thể.
          all.filter((r) => r.examId === Number(examId)))
      : analyticsService.getExamSubmissions(Number(examId));

    submissions.then(setRows).catch((e) => setError(e.message));
    analyticsService.getQuestionStats(Number(examId), scope).then(setQuestionStats).catch(() => setQuestionStats([]));
    analyticsService.getTagStats(Number(examId), scope).then(setTagStats).catch(() => setTagStats([]));
  }, [examId, roomId]);

  useEffect(() => { load(); }, [load]);

  const exam = exams.find((e) => String(e.examId) === examId);

  const summary = useMemo(() => {
    if (!rows?.length) return null;
    const percents = rows.map((r) => r.percent).filter((p) => p != null);
    const avg = percents.length
      ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : null;
    return {
      count: rows.length,
      people: new Set(rows.map((r) => r.studentId)).size,
      avg,
      // "Đạt" ở đây chỉ là mốc 50% để nhìn nhanh.
      pass: percents.filter((p) => p >= 50).length,
      autoSubmitted: rows.filter((r) => r.autoSubmitted).length,
    };
  }, [rows]);

  const exportCsv = () => {
    downloadCsv(
      `ket-qua-${exam?.title ?? examId}`,
      [
        { key: 'studentName', label: 'Thí sinh' },
        { key: 'studentEmail', label: 'Email' },
        { key: 'attemptNumber', label: 'Lượt' },
        { key: 'totalScore', label: 'Điểm' },
        { key: 'maxScore', label: 'Điểm tối đa' },
        { key: 'percent', label: 'Phần trăm' },
        { key: 'correctAnswers', label: 'Câu đúng' },
        { key: 'totalQuestions', label: 'Tổng câu' },
        { key: 'durationMinutes', label: 'Số phút làm' },
        { key: 'submittedAt', label: 'Nộp lúc' },
        { key: 'autoSubmitted', label: 'Hệ thống tự nộp' },
      ],
      rows ?? [],
    );
  };

  if (openSubmission) {
    return <PaperView submissionId={openSubmission} onBack={() => setOpenSubmission(null)} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Chọn phạm vi */}
      <div className="td-section-card" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="td-form-group" style={{ minWidth: 240, flex: 1 }}>
            <label className="td-form-label">Đề thi</label>
            <select className="td-form-select" value={examId} onChange={(e) => setExamId(e.target.value)}>
              <option value="">— Chọn đề —</option>
              {exams.map((e) => (
                <option key={e.examId} value={e.examId}>{e.title}</option>
              ))}
            </select>
          </div>

          {rooms.length > 0 && (
            <div className="td-form-group" style={{ minWidth: 200 }}>
              <label className="td-form-label">Phạm vi</label>
              <select className="td-form-select" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                <option value="">Mọi người đã làm đề này</option>
                {rooms.map((r) => (
                  <option key={r.roomId} value={r.roomId}>Chỉ phòng: {r.name}</option>
                ))}
              </select>
            </div>
          )}

          <button className="td-btn-secondary" onClick={exportCsv} disabled={!rows?.length}>
            <Download size={15} /> Xuất CSV
          </button>
        </div>
      </div>

      {!examId ? (
        <Empty icon={FileText} title="Chọn một đề để xem kết quả"
               hint="Mỗi đề có bảng bài nộp, danh sách câu cả lớp hay sai, và tỉ lệ đúng theo kỹ năng." />
      ) : error ? (
        <Empty icon={AlertCircle} title="Không tải được số liệu" hint={error} />
      ) : (
        <>
          {summary && (
            <div className="td-stats-row">
              <div className="td-stat-card">
                <div className="td-stat-icon" style={{ background: 'rgba(47,143,111,0.12)' }}>📥</div>
                <div className="td-stat-body">
                  <p className="td-stat-label">Lượt nộp</p>
                  <p className="td-stat-value">{summary.count}</p>
                  <p className="td-stat-sub">{summary.people} thí sinh</p>
                </div>
              </div>
              <div className="td-stat-card">
                <div className="td-stat-icon" style={{ background: 'rgba(61,126,166,0.12)' }}>📊</div>
                <div className="td-stat-body">
                  <p className="td-stat-label">Điểm trung bình</p>
                  <p className="td-stat-value">{summary.avg == null ? '—' : `${summary.avg}%`}</p>
                  <p className="td-stat-sub">Trên các lượt đã nộp</p>
                </div>
              </div>
              <div className="td-stat-card">
                <div className="td-stat-icon" style={{ background: 'rgba(201,146,46,0.12)' }}>✅</div>
                <div className="td-stat-body">
                  <p className="td-stat-label">Đạt từ 50%</p>
                  <p className="td-stat-value">{summary.pass}</p>
                  <p className="td-stat-sub">Trên {summary.count} lượt</p>
                </div>
              </div>
              <div className="td-stat-card">
                <div className="td-stat-icon" style={{ background: 'rgba(185,58,43,0.10)' }}>⏰</div>
                <div className="td-stat-body">
                  <p className="td-stat-label">Bị tự nộp</p>
                  <p className="td-stat-value">{summary.autoSubmitted}</p>
                  <p className="td-stat-sub">Hết giờ khi chưa bấm nộp</p>
                </div>
              </div>
            </div>
          )}

          <div className="td-section-card">
            <div className="td-section-header">
              <h2>{exam?.title ?? 'Kết quả'}</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                {TABS.map((t) => (
                  <button key={t.id} className="td-btn-ghost"
                          style={{
                            fontWeight: tab === t.id ? 700 : 400,
                            color: tab === t.id ? 'var(--violet)' : undefined,
                          }}
                          onClick={() => setTab(t.id)}>
                    <t.icon size={14} /> {t.label}
                  </button>
                ))}
              </div>
            </div>

            {tab === 'submissions' && (
              rows == null ? (
                <div className="td-empty">
                  <Loader2 size={44} style={{ animation: 'spin 1s linear infinite' }} />
                  <h3>Đang tải…</h3>
                </div>
              ) : rows.length === 0 ? (
                <Empty icon={Users} title="Chưa có ai nộp bài đề này"
                       hint={roomId ? 'Thử bỏ bộ lọc phòng để xem cả người làm tự do.' : undefined} />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="td-exam-table">
                    <thead>
                      <tr>
                        <th>Thí sinh</th><th>Lượt</th><th>Điểm</th><th>Đúng</th>
                        <th>Thời gian làm</th><th>Nộp lúc</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.submissionId}>
                          <td>
                            <p className="td-exam-name">{r.studentName}</p>
                            <p className="td-exam-subject">{r.studentEmail}</p>
                          </td>
                          <td>{r.attemptNumber}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 700, color: rateColor(r.percent), minWidth: 38 }}>
                                {r.percent == null ? '—' : `${r.percent}%`}
                              </span>
                              <Bar percent={r.percent} />
                            </div>
                          </td>
                          <td>{r.correctAnswers}/{r.totalQuestions}</td>
                          <td>{r.durationMinutes == null ? '—' : `${r.durationMinutes} phút`}</td>
                          <td>
                            {fmt(r.submittedAt)}
                            {r.autoSubmitted && (
                              <span className="td-badge" style={{ marginLeft: 6 }}>tự nộp</span>
                            )}
                          </td>
                          <td>
                            <button className="td-btn-ghost" onClick={() => setOpenSubmission(r.submissionId)}>
                              Xem bài
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {tab === 'questions' && (
              questionStats == null ? (
                <div className="td-empty">
                  <Loader2 size={44} style={{ animation: 'spin 1s linear infinite' }} />
                  <h3>Đang tính…</h3>
                </div>
              ) : questionStats.length === 0 ? (
                <Empty icon={AlertCircle} title="Chưa có dữ liệu"
                       hint="Cần ít nhất một bài đã nộp thì mới tính được tỉ lệ đúng." />
              ) : (
                <div style={{ padding: '6px 0 12px' }}>
                  <p style={{ margin: '0 22px 12px', fontSize: 12.5, color: 'var(--ink-faint)' }}>
                    Sắp theo tỉ lệ đúng tăng dần — những câu đầu bảng là thứ đáng mang lên bảng
                    ở buổi chữa đề.
                  </p>
                  {questionStats.map((q) => (
                    <div key={q.questionId} style={{
                      padding: '10px 22px', borderTop: '1px solid rgba(43,38,32,0.06)',
                      display: 'flex', gap: 14, alignItems: 'center',
                    }}>
                      <span style={{
                        fontSize: 15, fontWeight: 800, color: rateColor(q.correctPercent),
                        minWidth: 46, textAlign: 'right',
                      }}>
                        {q.correctPercent == null ? '—' : `${q.correctPercent}%`}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          margin: 0, fontSize: 13, fontWeight: 600,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          Câu {q.questionOrder}. {q.content}
                        </p>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                          <Bar percent={q.correctPercent} />
                          <span style={{ fontSize: 11.5, color: 'var(--ink-faint)', flexShrink: 0 }}>
                            {q.correct}/{q.answered} lượt đúng
                            {q.tags?.length > 0 && ` · ${q.tags.join(', ')}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === 'tags' && (
              tagStats == null ? (
                <div className="td-empty">
                  <Loader2 size={44} style={{ animation: 'spin 1s linear infinite' }} />
                  <h3>Đang tính…</h3>
                </div>
              ) : tagStats.length === 0 ? (
                <Empty icon={BarChart2} title="Câu hỏi trong đề chưa được gắn tag"
                       hint="Gắn tag cho câu hỏi trong Ngân hàng câu hỏi thì mới gộp được theo kỹ năng." />
              ) : (
                <div style={{ padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {tagStats.map((t) => (
                    <div key={t.tagId}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t.tagName}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: rateColor(t.correctPercent) }}>
                          {t.correctPercent == null ? '—' : `${t.correctPercent}%`}
                          <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>
                            {' '}({t.correct}/{t.answered})
                          </span>
                        </span>
                      </div>
                      <Bar percent={t.correctPercent} />
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
