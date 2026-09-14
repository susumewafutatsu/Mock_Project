// src/pages/teacher/RoomManager.jsx
// Quản lý phòng thi: danh sách phòng + trang điều khiển từng phòng.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowLeft, CalendarClock, CheckCircle2, Copy, CopyPlus, DoorOpen,
  Download, Edit3, FileText, Link2, Loader2, Play, Plus, School, Square, Trash2,
  Trophy, UserMinus, Users, Wifi, WifiOff, X,
} from 'lucide-react';
import roomService from '../../services/roomService';
import * as teacherExamService from '../../services/teacherExamService';
import { downloadCsv } from '../../services/analyticsService';
import Leaderboard, { formatDuration } from '../../components/leaderboard/Leaderboard';
import { PaperView } from './ResultView';
import './TeacherDashboard.css';

const PHASE = {
  DRAFT:       { label: 'Nháp',        cls: 'draft' },
  WAITING:     { label: 'Sảnh chờ',    cls: 'upcoming' },
  IN_PROGRESS: { label: 'Đang thi',    cls: 'open' },
  ENDED:       { label: 'Đã kết thúc', cls: 'closed' },
};

const MEMBER_STATUS = {
  NOT_STARTED: { label: 'Chưa vào bài', color: 'var(--ink-faint)' },
  IN_PROGRESS: { label: 'Đang làm',     color: 'var(--azure)' },
  SUBMITTED:   { label: 'Đã nộp',       color: 'var(--jade)' },
};

/** Nhịp làm mới trang điều khiển khi phòng đang hoạt động. */
const LIVE_POLL_MS = 5000;

const isLive = (phase) => phase === 'WAITING' || phase === 'IN_PROGRESS';

/** "2026-09-11T19:30:00" → "19:30 11/09" */
function formatWhen(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/** Giá trị cho <input type="datetime-local">. */
const toInputValue = (value) => (value ? String(value).slice(0, 16) : '');

/** 3725 → "01:02:05" */
function formatClock(seconds) {
  const s = Math.max(0, seconds);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** Số giây còn lại tới `target`, theo đồng hồ server. */
export function useCountdown(target, serverTime) {
  const [now, setNow] = useState(() => Date.now());
  const offset = useMemo(
    () => (serverTime ? Date.parse(serverTime) - Date.now() : 0),
    [serverTime],
  );
  useEffect(() => {
    if (!target) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (!target || !serverTime) return null;
  return Math.max(0, Math.round((Date.parse(target) - (now + offset)) / 1000));
}

const inviteLink = (code) => `${window.location.origin}/student/exams?tab=rooms&code=${code}`;

function copyText(text, showToast, okMessage) {
  if (!navigator.clipboard) { showToast('Trình duyệt không cho chép tự động', 'error'); return; }
  navigator.clipboard.writeText(text).then(
    () => showToast(okMessage),
    () => showToast('Trình duyệt không cho chép tự động', 'error'),
  );
}

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  const color = type === 'success' ? 'var(--jade)' : 'var(--cinnabar)';
  const Icon = type === 'success' ? CheckCircle2 : AlertCircle;
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: 'var(--paper-raised)', border: `1px solid ${color}40`,
      borderRadius: 14, padding: '14px 20px',
      display: 'flex', alignItems: 'center', gap: 12,
      minWidth: 300, maxWidth: 440, boxShadow: 'var(--shadow-lg)',
    }}>
      <Icon size={18} color={color} style={{ flexShrink: 0 }} />
      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-body)', flex: 1 }}>{message}</p>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)' }}>
        <X size={14} />
      </button>
    </div>
  );
}

function ErrorBox({ children }) {
  if (!children) return null;
  return (
    <div style={{
      background: 'var(--cinnabar-wash)', color: 'var(--cinnabar-deep)',
      padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 14,
    }}>{children}</div>
  );
}

const hint = { margin: '6px 0 0', fontSize: 12, color: 'var(--ink-faint)', lineHeight: 1.5 };

// ─── Modal: tạo / sửa phòng ──────────────────────────────────────

function RoomFormModal({ initial, levels, exams, onClose, onSave, saving }) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    examId: initial?.examId == null ? '' : String(initial.examId),
    levelId: initial?.levelId ?? '',
    capacity: initial?.capacity == null ? '' : String(initial.capacity),
    joinPolicy: initial?.joinPolicy ?? 'CODE',
    startAt: toInputValue(initial?.startTime),
    lateJoinMinutes: String(initial?.lateJoinMinutes ?? 15),
    instructions: initial?.instructions ?? '',
    openLobby: true,
  });
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const beforeStart = !isEdit || initial.phase === 'DRAFT' || initial.phase === 'WAITING';
  const usable = exams.filter((e) => e.totalQuestions > 0);
  const chosen = exams.find((e) => String(e.examId) === form.examId);

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Chưa đặt tên phòng'); return; }
    if (!form.examId) { setError('Chọn đề thi cho buổi thi'); return; }
    if (form.capacity !== '' && Number(form.capacity) < 1) { setError('Sức chứa phải từ 1 người trở lên'); return; }
    const late = Number(form.lateJoinMinutes);
    if (!Number.isInteger(late) || late < 0 || late > 180) { setError('Cho vào muộn từ 0 đến 180 phút'); return; }
    if (beforeStart && form.startAt && new Date(form.startAt) <= new Date()) {
      setError('Giờ bắt đầu hẹn trước phải ở tương lai. Muốn thi ngay thì để trống.');
      return;
    }
    setError(null);
    const data = {
      name: form.name.trim(),
      levelId: form.levelId === '' ? null : Number(form.levelId),
      capacity: form.capacity === '' ? null : Number(form.capacity),
      joinPolicy: form.joinPolicy,
      lateJoinMinutes: late,
      instructions: form.instructions,
    };
    if (!isEdit || String(initial.examId ?? '') !== form.examId) data.examId = Number(form.examId);
    if (!isEdit) data.openLobby = form.openLobby;
    if (beforeStart) {
      const before = toInputValue(initial?.startTime);
      if (form.startAt && form.startAt !== before) data.startTime = `${form.startAt}:00`;
      if (!form.startAt && before) data.clearStartTime = true;
    }
    onSave(data);
  };

  return (
    <div className="td-modal-overlay" onClick={onClose}>
      <div className="td-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
        <div className="td-modal-header">
          <h3>{isEdit ? 'Sửa phòng thi' : 'Tạo buổi thi mới'}</h3>
          <button className="td-close-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={submit}>
          <div className="td-modal-body">
            <ErrorBox>{error}</ErrorBox>

            <div className="td-form-group full">
              <label className="td-form-label"><School size={14} /> Tên phòng <span className="required">*</span></label>
              <input className="td-form-input" value={form.name} autoFocus
                     onChange={(e) => set('name', e.target.value)}
                     placeholder="VD: Thi thử JLPT N4 — tối thứ Sáu" />
            </div>

            <div className="td-form-group full">
              <label className="td-form-label"><FileText size={14} /> Đề thi <span className="required">*</span></label>
              <select className="td-form-select" value={form.examId} disabled={!beforeStart}
                      onChange={(e) => set('examId', e.target.value)}>
                <option value="">— Chọn đề —</option>
                {usable.map((ex) => (
                  <option key={ex.examId} value={ex.examId}>
                    {ex.title} · {ex.totalQuestions} câu · {ex.durationMinutes} phút
                  </option>
                ))}
                {chosen && chosen.totalQuestions === 0 && (
                  <option value={chosen.examId}>{chosen.title} (chưa có câu hỏi)</option>
                )}
              </select>
              <p style={hint}>
                {beforeStart
                  ? (chosen ? `Giờ làm bài: ${chosen.durationMinutes} phút cho cả phòng.` : 'Chỉ hiện đề đã có câu hỏi.')
                  : 'Buổi thi đã bắt đầu, không đổi đề được.'}
              </p>
            </div>

            <div className="td-form-row">
              <div className="td-form-group">
                <label className="td-form-label"><CalendarClock size={14} /> Giờ bắt đầu</label>
                <input className="td-form-input" type="datetime-local" value={form.startAt}
                       disabled={!beforeStart} onChange={(e) => set('startAt', e.target.value)} />
                <p style={hint}>Để trống = bạn tự bấm "Bắt đầu làm bài".</p>
              </div>
              <div className="td-form-group">
                <label className="td-form-label">Cho vào muộn (phút)</label>
                <input className="td-form-input" type="number" min="0" max="180" value={form.lateJoinMinutes}
                       onChange={(e) => set('lateJoinMinutes', e.target.value)} />
                <p style={hint}>Sau khi bắt đầu vẫn nhận người trong ngần này phút. 0 = không nhận.</p>
              </div>
            </div>

            <div className="td-form-row">
              <div className="td-form-group">
                <label className="td-form-label"><Users size={14} /> Sức chứa</label>
                <input className="td-form-input" type="number" min="1" value={form.capacity}
                       onChange={(e) => set('capacity', e.target.value)} placeholder="Bỏ trống = không giới hạn" />
              </div>
              <div className="td-form-group">
                <label className="td-form-label">Trình độ</label>
                <select className="td-form-select" value={form.levelId} onChange={(e) => set('levelId', e.target.value)}>
                  <option value="">Theo đề thi</option>
                  {levels.map((lv) => (
                    <option key={lv.levelId} value={lv.levelId}>
                      {lv.levelName}{lv.subjectName ? ` · ${lv.subjectName}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="td-form-group full">
              <label className="td-form-label">Cách vào phòng</label>
              <select className="td-form-select" value={form.joinPolicy} onChange={(e) => set('joinPolicy', e.target.value)}>
                <option value="CODE">Cần mã phòng hoặc link mời</option>
                <option value="OPEN">Công khai — hiện trong danh sách phòng của học viên</option>
              </select>
            </div>

            <div className="td-form-group full">
              <label className="td-form-label">Lời dặn cho thí sinh</label>
              <textarea className="td-form-input" rows={3} maxLength={2000} value={form.instructions}
                        onChange={(e) => set('instructions', e.target.value)}
                        placeholder="VD: Chuẩn bị tai nghe cho phần nghe. Không mở tab khác." />
            </div>

            {!isEdit && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--ink-body)' }}>
                <input type="checkbox" checked={form.openLobby} onChange={(e) => set('openLobby', e.target.checked)} />
                Mở sảnh chờ ngay để thí sinh vào trước
              </label>
            )}
          </div>

          <div className="td-modal-footer">
            <button type="button" className="td-btn-secondary" onClick={onClose}>Huỷ</button>
            <button type="submit" className="td-btn-primary" disabled={saving}>
              {saving ? <><Loader2 size={14} className="td-spin" /> Đang lưu…</> : isEdit ? 'Lưu thay đổi' : 'Tạo phòng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: nhân bản phòng ───────────────────────────────────────

function DuplicateModal({ room, onClose, onDone, showToast }) {
  const [name, setName] = useState(`${room.name} (buổi mới)`.slice(0, 100));
  const [keepMembers, setKeepMembers] = useState(false);
  const [startAt, setStartAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (startAt && new Date(startAt) <= new Date()) { setError('Giờ bắt đầu phải ở tương lai'); return; }
    setBusy(true);
    try {
      const copy = await roomService.duplicateRoom(room.roomId, {
        name: name.trim() || null,
        keepMembers,
        startTime: startAt ? `${startAt}:00` : null,
      });
      showToast(`Đã tạo phòng mới — mã ${copy.code}`);
      onDone(copy);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="td-modal-overlay" onClick={onClose}>
      <div className="td-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="td-modal-header">
          <h3><CopyPlus size={16} style={{ verticalAlign: -2 }} /> Nhân bản phòng</h3>
          <button className="td-close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="td-modal-body">
            <ErrorBox>{error}</ErrorBox>
            <p style={{ ...hint, margin: '0 0 14px' }}>
              Giữ nguyên đề, sức chứa, lời dặn và cách vào phòng. Phòng mới có mã mới và ở trạng thái nháp.
            </p>
            <div className="td-form-group full">
              <label className="td-form-label">Tên phòng mới</label>
              <input className="td-form-input" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="td-form-group full">
              <label className="td-form-label"><CalendarClock size={14} /> Giờ bắt đầu</label>
              <input className="td-form-input" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--ink-body)' }}>
              <input type="checkbox" checked={keepMembers} onChange={(e) => setKeepMembers(e.target.checked)} />
              Giữ danh sách {room.memberCount} thí sinh (họ được báo qua thông báo)
            </label>
          </div>
          <div className="td-modal-footer">
            <button type="button" className="td-btn-secondary" onClick={onClose}>Huỷ</button>
            <button type="submit" className="td-btn-primary" disabled={busy}>
              {busy ? <Loader2 size={14} className="td-spin" /> : <CopyPlus size={14} />} Tạo phòng mới
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tab theo dõi ────────────────────────────────────────────────

function Counter({ label, value, color }) {
  return (
    <div style={{
      flex: '1 1 110px', padding: '10px 12px', borderRadius: 10,
      background: 'var(--paper)', border: '1px solid var(--line)',
    }}>
      <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ink-faint)' }}>{label}</p>
      <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 800, color: color ?? 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
    </div>
  );
}

function MonitorTab({ room, onKick, onOpenPaper }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    roomService.getMonitor(room.roomId)
      .then((d) => { setData(d); setError(null); })
      .catch((err) => setError(err.message));
  }, [room.roomId]);

  useEffect(() => { load(); }, [load, room.phase, room.memberCount]);
  useEffect(() => {
    if (!isLive(room.phase)) return undefined;
    const id = setInterval(load, LIVE_POLL_MS);
    return () => clearInterval(id);
  }, [room.phase, load]);

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <div className="td-empty"><Loader2 size={18} className="td-spin" /> Đang tải…</div>;

  const started = data.phase === 'IN_PROGRESS' || data.phase === 'ENDED';
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <Counter label="Trong phòng" value={data.joined} />
        <Counter label="Đang mở trang" value={data.online} color="var(--jade)" />
        {started && <Counter label="Chưa vào bài" value={data.notStarted} color="var(--ink-faint)" />}
        {started && <Counter label="Đang làm" value={data.inProgress} color="var(--azure)" />}
        {started && <Counter label="Đã nộp" value={data.submitted} color="var(--jade)" />}
        {data.atRisk > 0 && <Counter label="Mất kết nối" value={data.atRisk} color="var(--cinnabar)" />}
      </div>

      {data.members.length === 0 ? (
        <div className="td-empty" style={{ padding: '28px 12px' }}>
          Chưa có ai vào phòng. Gửi mã <strong>{room.code}</strong> hoặc link mời cho thí sinh.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ink-faint)', fontSize: 11.5 }}>
                <th style={{ padding: '6px 8px' }}>Ghế</th>
                <th style={{ padding: '6px 8px' }}>Thí sinh</th>
                <th style={{ padding: '6px 8px' }}>Kết nối</th>
                <th style={{ padding: '6px 8px' }}>Trạng thái</th>
                {started && <th style={{ padding: '6px 8px', textAlign: 'right' }}>Tiến độ</th>}
                {started && <th style={{ padding: '6px 8px', textAlign: 'right' }}>Điểm</th>}
                <th />
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => {
                const st = MEMBER_STATUS[m.status] ?? MEMBER_STATUS.NOT_STARTED;
                return (
                  <tr key={m.userId} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '8px', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{m.seatNo}</td>
                    <td style={{ padding: '8px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{m.fullName}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{m.email}</div>
                    </td>
                    <td style={{ padding: '8px' }}>
                      {m.atRisk ? (
                        <span style={{ color: 'var(--cinnabar)', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                          <WifiOff size={13} /> Mất kết nối
                        </span>
                      ) : m.online ? (
                        <span style={{ color: 'var(--jade)', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                          <Wifi size={13} /> Trực tuyến
                        </span>
                      ) : (
                        <span style={{ color: 'var(--ink-faint)' }}>Không mở trang</span>
                      )}
                    </td>
                    <td style={{ padding: '8px', color: st.color, fontWeight: 600 }}>
                      {st.label}{m.autoSubmitted ? ' (tự nộp)' : ''}
                    </td>
                    {started && (
                      <td style={{ padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {m.status === 'NOT_STARTED' ? '—' : `${m.answered}/${data.totalQuestions} câu`}
                      </td>
                    )}
                    {started && (
                      <td style={{ padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {m.score != null ? `${m.score}/${data.maxScore}` : '—'}
                      </td>
                    )}
                    <td style={{ padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {m.status === 'SUBMITTED' && m.submissionId != null && (
                        <button className="td-btn-ghost" onClick={() => onOpenPaper(m.submissionId)}>Xem bài</button>
                      )}
                      {data.phase !== 'ENDED' && (
                        <button className="td-btn-ghost" title="Mời ra khỏi phòng"
                                onClick={() => onKick(m, data.phase).then(load)}>
                          <UserMinus size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab kết quả ─────────────────────────────────────────────────

function ResultsTab({ room, onOpenPaper }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    roomService.getLeaderboard(room.roomId)
      .then((d) => { setData(d); setError(null); })
      .catch((err) => setError(err.message));
  }, [room.roomId]);

  useEffect(() => { load(); }, [load, room.phase]);
  useEffect(() => {
    if (room.phase !== 'IN_PROGRESS') return undefined;
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [room.phase, load]);

  const exportCsv = () => {
    const board = data?.boards?.[0];
    if (!board) return;
    const rows = [...board.rows].map((r) => ({
      rank: r.rank ?? '',
      seatNo: r.seatNo ?? '',
      fullName: r.fullName,
      score: r.score ?? '',
      correct: r.rank != null ? `${r.correctAnswers}/${board.totalQuestions}` : '',
      duration: r.rank != null ? formatDuration(r.durationSeconds) : '',
      status: r.status,
    }));
    downloadCsv(`ket-qua-${room.code}`, [
      { key: 'rank', label: 'Hạng' },
      { key: 'seatNo', label: 'Ghế' },
      { key: 'fullName', label: 'Họ tên' },
      { key: 'score', label: `Điểm (/${board.maxScore})` },
      { key: 'correct', label: 'Câu đúng' },
      { key: 'duration', label: 'Thời gian làm' },
      { key: 'status', label: 'Trạng thái' },
    ], rows);
  };

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <div className="td-empty"><Loader2 size={18} className="td-spin" /> Đang tải…</div>;
  return (
    <div>
      {data.boards?.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <button className="td-btn-ghost" onClick={exportCsv}><Download size={14} /> Xuất CSV</button>
        </div>
      )}
      <Leaderboard data={data} onOpenSubmission={onOpenPaper} />
    </div>
  );
}

// ─── Trang điều khiển một phòng ──────────────────────────────────

function RoomConsole({ roomId, levels, exams, onBack, onOpenRoom, showToast }) {
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('monitor');
  const [editing, setEditing] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paperId, setPaperId] = useState(null);

  const load = useCallback(() => roomService.getRoom(roomId)
    .then((r) => { setRoom(r); setError(null); })
    .catch((err) => setError(err.message)), [roomId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!room || !isLive(room.phase)) return undefined;
    const id = setInterval(load, LIVE_POLL_MS);
    return () => clearInterval(id);
  }, [room, load]);
  useEffect(() => { if (room?.phase === 'ENDED') setTab((t) => (t === 'monitor' ? 'results' : t)); }, [room?.phase]);

  const target = room?.phase === 'IN_PROGRESS' ? room.endTime
    : room?.phase === 'WAITING' && room.startTime ? room.startTime : null;
  const left = useCountdown(target, room?.serverTime);

  const act = async (fn, okMessage) => {
    try {
      const updated = await fn();
      if (updated) setRoom(updated); else await load();
      showToast(okMessage);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  if (paperId != null) {
    return <PaperView submissionId={paperId} onBack={() => setPaperId(null)} />;
  }
  if (error && !room) {
    return (
      <div>
        <button className="td-btn-ghost" onClick={onBack}><ArrowLeft size={14} /> Tất cả phòng</button>
        <ErrorBox>{error}</ErrorBox>
      </div>
    );
  }
  if (!room) return <div className="td-empty"><Loader2 size={20} className="td-spin" /> Đang tải…</div>;

  const phase = PHASE[room.phase] ?? PHASE.DRAFT;

  const openLobby = () => act(() => roomService.updateRoom(room.roomId, { status: 'OPEN' }),
    'Đã mở sảnh chờ — gửi mã hoặc link cho thí sinh');
  const start = () => {
    if (!window.confirm(`Bắt đầu làm bài ngay?\n\n• ${room.memberCount} thí sinh làm bài trong ${room.durationMinutes} phút.\n`
      + `• ${room.lateJoinMinutes > 0 ? `Vẫn nhận người vào muộn trong ${room.lateJoinMinutes} phút đầu.` : 'Không nhận thêm người.'}`)) return;
    act(() => roomService.startExam(room.roomId), 'Đã bắt đầu làm bài');
  };
  const end = () => {
    const running = room.phase === 'IN_PROGRESS';
    if (!window.confirm(running
      ? 'Kết thúc sớm? Bài đang làm dở của mọi thí sinh sẽ được nộp ngay.'
      : 'Đóng phòng? Buổi thi sẽ không diễn ra và không mở lại được.')) return;
    act(() => roomService.endExam(room.roomId), running ? 'Đã thu bài cả phòng' : 'Đã đóng phòng');
  };
  const remove = async () => {
    if (!window.confirm(`Xoá phòng "${room.name}"?`)) return;
    try {
      await roomService.deleteRoom(room.roomId);
      showToast('Đã xoá phòng');
      onBack();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
  const kick = async (member, currentPhase) => {
    const note = currentPhase === 'IN_PROGRESS' ? '\nBài đang làm của họ sẽ được nộp ngay.' : '';
    if (!window.confirm(`Mời ${member.fullName} ra khỏi phòng?${note}`)) return;
    try {
      await roomService.kickMember(room.roomId, member.userId);
      showToast('Đã mời ra khỏi phòng');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
  const save = async (data) => {
    setSaving(true);
    try {
      setRoom(await roomService.updateRoom(room.roomId, data));
      setEditing(false);
      showToast('Đã cập nhật phòng');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <button className="td-btn-ghost" onClick={onBack} style={{ marginBottom: 12 }}>
        <ArrowLeft size={14} /> Tất cả phòng
      </button>

      <div className="td-section-card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 280px', minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--heading)', fontSize: 19, color: 'var(--ink)' }}>{room.name}</h2>
              <span className={`td-badge ${phase.cls}`}>{phase.label}</span>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-mute)' }}>
              <FileText size={13} style={{ verticalAlign: -2 }} />{' '}
              {room.examTitle
                ? `${room.examTitle} · ${room.examQuestionCount} câu · ${room.durationMinutes} phút`
                : 'Chưa chọn đề'}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-mute)' }}>
              <Users size={13} style={{ verticalAlign: -2 }} />{' '}
              {room.capacity == null ? `${room.memberCount} thí sinh` : `${room.memberCount}/${room.capacity} chỗ`}
              {room.phase !== 'ENDED' && ` · ${room.onlineCount ?? 0} đang mở trang`}
              {room.joinPolicy === 'OPEN' && ' · công khai'}
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--ink-body)' }}>
              {room.phase === 'DRAFT' && (room.startTime
                ? `Hẹn bắt đầu ${formatWhen(room.startTime)}. Mở sảnh chờ để thí sinh vào trước.`
                : 'Nháp — thí sinh chưa vào được.')}
              {room.phase === 'WAITING' && (room.startTime
                ? <>Tự bắt đầu lúc {formatWhen(room.startTime)} — còn <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatClock(left ?? 0)}</strong></>
                : 'Sảnh chờ — bấm "Bắt đầu làm bài" khi đủ người.')}
              {room.phase === 'IN_PROGRESS' && (
                <>Hết giờ lúc {formatWhen(room.endTime)} — còn <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatClock(left ?? 0)}</strong>
                  {room.acceptingMembers && room.lateJoinUntil && ` · nhận người vào muộn tới ${formatWhen(room.lateJoinUntil)}`}</>
              )}
              {room.phase === 'ENDED' && `Đã kết thúc lúc ${formatWhen(room.endTime)}. Thí sinh xem được bảng xếp hạng.`}
            </p>
          </div>

          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ink-faint)' }}>Mã phòng</p>
            <p style={{
              margin: '2px 0 8px', fontFamily: 'var(--mono)', fontSize: 30, fontWeight: 800,
              letterSpacing: '0.18em', color: 'var(--violet)',
            }}>{room.code}</p>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
              <button className="td-btn-ghost" onClick={() => copyText(room.code, showToast, 'Đã chép mã phòng')}>
                <Copy size={13} /> Chép mã
              </button>
              <button className="td-btn-ghost" onClick={() => copyText(inviteLink(room.code), showToast, 'Đã chép link mời')}>
                <Link2 size={13} /> Link mời
              </button>
            </div>
          </div>
        </div>

        {room.instructions && (
          <p style={{
            margin: '14px 0 0', padding: '10px 12px', borderRadius: 8, fontSize: 13,
            background: 'rgba(43,38,32,0.04)', color: 'var(--ink-soft)', whiteSpace: 'pre-wrap',
          }}>
            <strong>Lời dặn: </strong>{room.instructions}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
          {room.phase === 'DRAFT' && (
            <button className="td-btn-primary" disabled={!room.examId} onClick={openLobby}
                    title={room.examId ? undefined : 'Chọn đề trước'}>
              <DoorOpen size={14} /> Mở sảnh chờ
            </button>
          )}
          {room.phase === 'WAITING' && (
            <button className="td-btn-primary" onClick={start}><Play size={14} /> Bắt đầu làm bài</button>
          )}
          {isLive(room.phase) && (
            <button className="td-btn-secondary" onClick={end}>
              <Square size={14} /> {room.phase === 'IN_PROGRESS' ? 'Kết thúc sớm' : 'Đóng phòng'}
            </button>
          )}
          {room.phase !== 'ENDED' && (
            <button className="td-btn-ghost" onClick={() => setEditing(true)}><Edit3 size={14} /> Sửa</button>
          )}
          <button className="td-btn-ghost" onClick={() => setDuplicating(true)}><CopyPlus size={14} /> Nhân bản</button>
          {room.deletable && (
            <button className="td-btn-ghost" onClick={remove} style={{ color: 'var(--cinnabar)' }}>
              <Trash2 size={14} /> Xoá
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[
          { id: 'monitor', label: 'Theo dõi', icon: Users },
          { id: 'results', label: 'Kết quả', icon: Trophy },
        ].map((t) => (
          <button key={t.id} className={tab === t.id ? 'td-btn-primary' : 'td-btn-ghost'} onClick={() => setTab(t.id)}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      <div className="td-section-card" style={{ padding: 16 }}>
        {tab === 'monitor'
          ? <MonitorTab room={room} onKick={kick} onOpenPaper={setPaperId} />
          : <ResultsTab room={room} onOpenPaper={setPaperId} />}
      </div>

      {editing && (
        <RoomFormModal initial={room} levels={levels} exams={exams} saving={saving}
                       onClose={() => setEditing(false)} onSave={save} />
      )}
      {duplicating && (
        <DuplicateModal room={room} showToast={showToast} onClose={() => setDuplicating(false)}
                        onDone={(copy) => { setDuplicating(false); onOpenRoom(copy.roomId); }} />
      )}
    </div>
  );
}

// ─── Danh sách phòng ─────────────────────────────────────────────

function RoomCard({ room, onOpen }) {
  const phase = PHASE[room.phase] ?? PHASE.DRAFT;
  const when = room.phase === 'IN_PROGRESS' ? `Hết giờ ${formatWhen(room.endTime)}`
    : room.phase === 'ENDED' ? `Kết thúc ${formatWhen(room.endTime)}`
    : room.startTime ? `Bắt đầu ${formatWhen(room.startTime)}` : 'Chưa hẹn giờ';
  return (
    <button type="button" onClick={() => onOpen(room.roomId)} style={{
      textAlign: 'left', cursor: 'pointer', font: 'inherit',
      background: 'var(--paper-raised)', border: '1px solid var(--line)',
      borderRadius: 14, padding: '14px 16px', boxShadow: 'var(--shadow-sm)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span style={{ flex: 1, fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 14.5, color: 'var(--ink)' }}>
          {room.name}
        </span>
        <span className={`td-badge ${phase.cls}`}>{phase.label}</span>
      </div>
      <span style={{ fontSize: 12.5, color: room.examTitle ? 'var(--ink-mute)' : 'var(--gold)' }}>
        <FileText size={12} style={{ verticalAlign: -2 }} /> {room.examTitle ?? 'Chưa chọn đề'}
      </span>
      <span style={{ fontSize: 12, color: 'var(--ink-faint)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--violet)', letterSpacing: '0.1em' }}>{room.code}</span>
        <span><Users size={12} style={{ verticalAlign: -2 }} /> {room.capacity == null ? room.memberCount : `${room.memberCount}/${room.capacity}`}</span>
        {room.phase === 'IN_PROGRESS' && <span style={{ color: 'var(--jade)' }}>{room.onlineCount ?? 0} trực tuyến</span>}
        <span>{when}</span>
      </span>
    </button>
  );
}

function RoomGroup({ title, rooms, onOpen, collapsible }) {
  const [open, setOpen] = useState(!collapsible);
  if (rooms.length === 0) return null;
  return (
    <section style={{ marginBottom: 20 }}>
      <h3
        onClick={collapsible ? () => setOpen((o) => !o) : undefined}
        style={{ fontSize: 13, margin: '0 0 10px', color: 'var(--ink-mute)', cursor: collapsible ? 'pointer' : 'default' }}
      >
        {title} ({rooms.length}){collapsible && (open ? ' ▾' : ' ▸')}
      </h3>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {rooms.map((r) => <RoomCard key={r.roomId} room={r} onOpen={onOpen} />)}
        </div>
      )}
    </section>
  );
}

export default function RoomManager() {
  const [rooms, setRooms] = useState([]);
  const [levels, setLevels] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);

  const load = useCallback(async () => {
    try {
      const [rs, lvs, exs] = await Promise.all([
        roomService.getMyRooms(),
        roomService.getLevels(),
        teacherExamService.getMyExams(),
      ]);
      setRooms(rs);
      setLevels(lvs);
      setExams(exs ?? []);
    } catch (err) {
      showToast(err.message || 'Không tải được danh sách phòng', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { if (openId == null) load(); }, [load, openId]);

  const hasLive = rooms.some((r) => isLive(r.phase));
  useEffect(() => {
    if (openId != null || !hasLive) return undefined;
    const id = setInterval(() => roomService.getMyRooms().then(setRooms).catch(() => {}), 30000);
    return () => clearInterval(id);
  }, [hasLive, openId]);

  const create = async (data) => {
    setSaving(true);
    try {
      const room = await roomService.createRoom(data);
      showToast(`Đã tạo phòng — mã ${room.code}`);
      setCreating(false);
      setOpenId(room.roomId);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const groups = {
    live: rooms.filter((r) => r.phase === 'IN_PROGRESS'),
    upcoming: rooms.filter((r) => r.phase === 'WAITING' || r.phase === 'DRAFT'),
    ended: rooms.filter((r) => r.phase === 'ENDED'),
  };

  return (
    <>
      {openId != null ? (
        <RoomConsole
          key={openId}
          roomId={openId}
          levels={levels}
          exams={exams}
          showToast={showToast}
          onBack={() => setOpenId(null)}
          onOpenRoom={setOpenId}
        />
      ) : (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            margin: '4px 0 16px', gap: 12, flexWrap: 'wrap',
          }}>
            <div>
              <h2 style={{ fontFamily: 'var(--heading)', fontSize: 17, margin: 0, color: 'var(--ink)' }}>Phòng thi</h2>
              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--ink-faint)', maxWidth: '66ch' }}>
                Mỗi phòng là một buổi thi cho một đề. Gửi mã hoặc link mời, theo dõi thí sinh làm bài
                và xem kết quả ngay trong phòng.
              </p>
            </div>
            <button className="td-btn-primary" onClick={() => setCreating(true)}>
              <Plus size={15} /> Tạo buổi thi
            </button>
          </div>

          {loading ? (
            <div className="td-empty"><Loader2 size={20} className="td-spin" /> Đang tải…</div>
          ) : rooms.length === 0 ? (
            <div className="td-empty">
              <School size={26} style={{ opacity: 0.4 }} />
              <p style={{ margin: '10px 0 0' }}>Chưa có phòng thi nào.</p>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ink-faint)' }}>
                Tạo buổi thi, chọn đề rồi gửi mã cho thí sinh.
              </p>
            </div>
          ) : (
            <>
              <RoomGroup title="Đang thi" rooms={groups.live} onOpen={setOpenId} />
              <RoomGroup title="Sắp diễn ra & nháp" rooms={groups.upcoming} onOpen={setOpenId} />
              <RoomGroup title="Đã kết thúc" rooms={groups.ended} onOpen={setOpenId} collapsible />
            </>
          )}
        </>
      )}

      {creating && (
        <RoomFormModal levels={levels} exams={exams} saving={saving}
                       onClose={() => setCreating(false)} onSave={create} />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
