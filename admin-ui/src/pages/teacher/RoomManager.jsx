// src/pages/teacher/RoomManager.jsx
// Quản lý phòng thi — thay cho ClassManager.jsx thời còn lớp học.
//
// Khác biệt về mặt thao tác, không chỉ đổi tên:
//
// 1. KHÔNG còn ô "thêm thí sinh bằng email". Người ra đề mở phòng, đặt sức
//    chứa, đọc mã; thí sinh tự vào. Vì thế màn hình này chỉ XEM danh sách
//    người trong phòng và mời ra khi cần.
//
// 2. Có vòng đời phòng: Nháp → Đang mở → Đang thi → Đã đóng. Phòng nháp chưa
//    ai vào được, và không mở được khi chưa gắn bài thi nào — backend chặn,
//    ở đây chỉ nói trước cho người dùng biết để họ không bấm vào chỗ chết.
//
// 3. Bài thi gắn vào phòng qua một bảng nối, nên gỡ bài khỏi phòng KHÔNG xoá
//    bài thi. Một bài thi gắn được vào nhiều phòng.

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle, CheckCircle2, Copy, DoorOpen, Edit3,
  FileText, Loader2, Lock, Play, Plus, School, Square, Trash2,
  UserMinus, Users, X,
} from 'lucide-react';
import roomService from '../../services/roomService';
import * as teacherExamService from '../../services/teacherExamService';
import './TeacherDashboard.css';

// Nhãn tiếng Việt cho RoomStatus của backend.
const STATUS = {
  DRAFT:   { label: 'Nháp',     cls: 'draft',    hint: 'Chưa ai vào được' },
  OPEN:    { label: 'Đang mở',  cls: 'open',     hint: 'Thí sinh vào được bằng mã' },
  RUNNING: { label: 'Đang thi', cls: 'upcoming', hint: 'Không nhận thêm người, ai đã vào vẫn làm bài được' },
  CLOSED:  { label: 'Đã đóng',  cls: 'closed',   hint: 'Chỉ còn xem lại kết quả' },
};

const JOIN_POLICY_LABEL = {
  OPEN: 'Ai cũng vào được',
  CODE: 'Cần mã phòng',
  APPROVAL: 'Phải duyệt',
};

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

/** Mã phòng + nút chép. Mã này được đọc to cho cả phòng nên phải to và rõ. */
function RoomCode({ code, onCopied }) {
  if (!code) return null;
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(code).then(
          () => onCopied?.('Đã chép mã phòng'),
          () => onCopied?.('Trình duyệt không cho chép tự động', 'error'),
        );
      }}
      title="Chép mã phòng"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700,
        letterSpacing: '0.12em', color: 'var(--violet)',
        background: 'var(--violet-wash)', border: '1px solid transparent',
        borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
      }}
    >
      {code} <Copy size={12} />
    </button>
  );
}

// ─── Modal: tạo / sửa phòng ──────────────────────────────────────

function RoomFormModal({ initial, levels, onClose, onSave, saving }) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    levelId: initial?.levelId ?? '',
    // Chuỗi rỗng = không giới hạn. Giữ dạng chuỗi suốt trong form, chỉ đổi sang
    // số/null lúc gửi đi — input number trả về chuỗi.
    capacity: initial?.capacity == null ? '' : String(initial.capacity),
    joinPolicy: initial?.joinPolicy ?? 'CODE',
  });
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Chưa đặt tên phòng'); return; }
    if (form.capacity !== '' && Number(form.capacity) < 1) {
      setError('Sức chứa phải từ 1 người trở lên'); return;
    }
    setError(null);
    onSave({
      name: form.name.trim(),
      levelId: form.levelId === '' ? null : Number(form.levelId),
      capacity: form.capacity === '' ? null : Number(form.capacity),
      joinPolicy: form.joinPolicy,
    });
  };

  return (
    <div className="td-modal-overlay" onClick={onClose}>
      <div className="td-modal" onClick={(e) => e.stopPropagation()}>
        <div className="td-modal-header">
          <h3>{isEdit ? 'Sửa phòng thi' : 'Mở phòng thi mới'}</h3>
          <button className="td-close-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={submit}>
          <div className="td-modal-body">
            {error && (
              <div style={{
                background: 'var(--cinnabar-wash)', color: 'var(--cinnabar-deep)',
                padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 14,
              }}>{error}</div>
            )}

            <div className="td-form-group full">
              <label className="td-form-label">
                <School size={14} /> Tên phòng <span className="required">*</span>
              </label>
              <input
                className="td-form-input"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="VD: Thi thử JLPT N5 — đợt tháng 3"
                autoFocus
              />
            </div>

            <div className="td-form-row">
              <div className="td-form-group">
                <label className="td-form-label">Trình độ</label>
                <select
                  className="td-form-select"
                  value={form.levelId}
                  onChange={(e) => set('levelId', e.target.value)}
                >
                  <option value="">Không gắn trình độ</option>
                  {levels.map((lv) => (
                    <option key={lv.levelId} value={lv.levelId}>
                      {lv.levelName}{lv.subjectName ? ` · ${lv.subjectName}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="td-form-group">
                <label className="td-form-label">
                  <Users size={14} /> Sức chứa
                </label>
                <input
                  className="td-form-input"
                  type="number"
                  min="1"
                  value={form.capacity}
                  onChange={(e) => set('capacity', e.target.value)}
                  placeholder="Bỏ trống = không giới hạn"
                />
                <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--ink-faint)', lineHeight: 1.5 }}>
                  Có giới hạn thì ai vào trước ngồi trước. Hết chỗ là người sau
                  không vào được nữa.
                </p>
              </div>
            </div>

            <div className="td-form-group full">
              <label className="td-form-label">Cách vào phòng</label>
              <select
                className="td-form-select"
                value={form.joinPolicy}
                onChange={(e) => set('joinPolicy', e.target.value)}
              >
                <option value="CODE">Cần mã phòng — bạn đọc mã cho thí sinh</option>
                <option value="OPEN">Ai cũng vào được — phòng hiện trong danh sách công khai</option>
              </select>
            </div>

            {!isEdit && (
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-mute)', lineHeight: 1.6 }}>
                Phòng mới bắt đầu ở trạng thái <strong>Nháp</strong>. Gắn ít nhất
                một bài thi rồi mới mở được — mở phòng rỗng thì thí sinh vào và
                chẳng có gì để làm.
              </p>
            )}
          </div>

          <div className="td-modal-footer">
            <button type="button" className="td-btn-secondary" onClick={onClose}>Huỷ</button>
            <button type="submit" className="td-btn-primary" disabled={saving}>
              {saving ? <><Loader2 size={14} className="td-spin" /> Đang lưu…</>
                      : isEdit ? 'Lưu thay đổi' : 'Mở phòng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: chi tiết phòng (thành viên + bài thi) ────────────────

function RoomDetailModal({ room, onClose, onChanged, showToast }) {
  const [members, setMembers] = useState([]);
  const [myExams, setMyExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mem, exams] = await Promise.all([
        roomService.getMembers(room.roomId),
        teacherExamService.getMyExams(),
      ]);
      setMembers(mem);
      setMyExams(exams ?? []);
    } catch (err) {
      showToast(err.message || 'Không tải được chi tiết phòng', 'error');
    } finally {
      setLoading(false);
    }
  }, [room.roomId, showToast]);

  useEffect(() => { load(); }, [load]);

  const attach = async (examId) => {
    setBusy(true);
    try {
      await roomService.attachExam(room.roomId, Number(examId));
      showToast('Đã gắn bài thi vào phòng');
      onChanged();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const kick = async (userId, name) => {
    if (!window.confirm(`Mời ${name} ra khỏi phòng?`)) return;
    setBusy(true);
    try {
      await roomService.kickMember(room.roomId, userId);
      showToast('Đã mời ra khỏi phòng');
      await load();
      onChanged();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="td-modal-overlay" onClick={onClose}>
      <div className="td-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="td-modal-header">
          <h3>{room.name}</h3>
          <button className="td-close-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="td-modal-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
            <RoomCode code={room.code} onCopied={showToast} />
            <span className={`td-badge ${STATUS[room.status]?.cls}`}>
              {STATUS[room.status]?.label}
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>
              {room.capacity == null
                ? `${room.memberCount} người · không giới hạn`
                : `${room.memberCount}/${room.capacity} chỗ · còn ${room.seatsLeft}`}
            </span>
          </div>

          {loading ? (
            <div className="td-empty"><Loader2 size={18} className="td-spin" /> Đang tải…</div>
          ) : (
            <>
              <h4 style={{ fontSize: 13, margin: '0 0 10px', color: 'var(--ink)' }}>
                <FileText size={13} style={{ verticalAlign: -2 }} /> Bài thi trong phòng ({room.examCount})
              </h4>
              <select
                className="td-form-select"
                value=""
                disabled={busy}
                onChange={(e) => e.target.value && attach(e.target.value)}
                style={{ marginBottom: 20 }}
              >
                <option value="">+ Gắn thêm một bài thi…</option>
                {myExams.map((ex) => (
                  <option key={ex.examId} value={ex.examId}>
                    {ex.title} ({ex.totalQuestions} câu)
                  </option>
                ))}
              </select>

              <h4 style={{ fontSize: 13, margin: '0 0 10px', color: 'var(--ink)' }}>
                <Users size={13} style={{ verticalAlign: -2 }} /> Thí sinh trong phòng ({members.length})
              </h4>

              {members.length === 0 ? (
                <div className="td-empty" style={{ padding: '24px 12px' }}>
                  Chưa có ai vào phòng. Đọc mã <strong>{room.code}</strong> cho thí sinh
                  để họ tự vào.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {members.map((m) => (
                    <div key={m.userId} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', borderRadius: 9,
                      background: 'var(--paper)', border: '1px solid var(--line)',
                    }}>
                      <span style={{
                        width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                        background: 'var(--violet-wash)', color: 'var(--violet)',
                        display: 'grid', placeItems: 'center',
                        fontSize: 11.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                      }}>{m.seatNo}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
                          {m.fullName}
                        </p>
                        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ink-faint)' }}>{m.email}</p>
                      </div>
                      <button
                        className="td-btn-ghost"
                        title="Mời ra khỏi phòng"
                        disabled={busy}
                        onClick={() => kick(m.userId, m.fullName)}
                      >
                        <UserMinus size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="td-modal-footer">
          <button className="td-btn-secondary" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}

// ─── Trang chính ─────────────────────────────────────────────────

export default function RoomManager() {
  const [rooms, setRooms] = useState([]);
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formModal, setFormModal] = useState(null);
  const [detailRoom, setDetailRoom] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback(
    (message, type = 'success') => setToast({ message, type }), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rs, lvs] = await Promise.all([
        roomService.getMyRooms(),
        roomService.getLevels(),
      ]);
      setRooms(rs);
      setLevels(lvs);
    } catch (err) {
      showToast(err.message || 'Không tải được danh sách phòng', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const save = async (data) => {
    setSaving(true);
    try {
      if (formModal?.roomId) {
        await roomService.updateRoom(formModal.roomId, data);
        showToast('Đã cập nhật phòng');
      } else {
        const created = await roomService.createRoom(data);
        showToast(`Đã mở phòng. Mã tham gia: ${created.code}`);
      }
      setFormModal(null);
      await load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  /** Đổi trạng thái phòng. Backend chặn việc mở phòng chưa có bài thi. */
  const changeStatus = async (room, status) => {
    try {
      await roomService.updateRoom(room.roomId, { status });
      showToast(`Phòng chuyển sang: ${STATUS[status].label}`);
      await load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const remove = async (room) => {
    if (!window.confirm(`Xoá phòng "${room.name}"?`)) return;
    try {
      await roomService.deleteRoom(room.roomId);
      showToast('Đã xoá phòng');
      await load();
    } catch (err) {
      // Phòng đã có người thì backend từ chối và bảo đóng phòng thay vì xoá —
      // hiện nguyên câu đó, nó đã nói rõ phải làm gì.
      showToast(err.message, 'error');
    }
  };

  const totalMembers = rooms.reduce((sum, r) => sum + r.memberCount, 0);
  const openRooms = rooms.filter((r) => r.status === 'OPEN' || r.status === 'RUNNING').length;

  return (
    <>
      <div className="td-stats-row">
        <div className="td-stat-card">
          <div className="td-stat-icon" style={{ background: 'var(--violet-wash)' }}>
            <School size={18} color="var(--violet)" />
          </div>
          <div className="td-stat-body">
            <p className="td-stat-label">Phòng đã mở</p>
            <p className="td-stat-value">{rooms.length}</p>
          </div>
        </div>
        <div className="td-stat-card">
          <div className="td-stat-icon" style={{ background: 'var(--jade-wash)' }}>
            <DoorOpen size={18} color="var(--jade)" />
          </div>
          <div className="td-stat-body">
            <p className="td-stat-label">Đang hoạt động</p>
            <p className="td-stat-value">{openRooms}</p>
          </div>
        </div>
        <div className="td-stat-card">
          <div className="td-stat-icon" style={{ background: 'var(--azure-wash)' }}>
            <Users size={18} color="var(--azure)" />
          </div>
          <div className="td-stat-body">
            <p className="td-stat-label">Tổng thí sinh</p>
            <p className="td-stat-value">{totalMembers}</p>
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        margin: '20px 0 14px', gap: 12, flexWrap: 'wrap',
      }}>
        <div>
          <h2 style={{ fontFamily: 'var(--heading)', fontSize: 17, margin: 0, color: 'var(--ink)' }}>
            Phòng thi
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--ink-faint)', maxWidth: '62ch' }}>
            Mở phòng, đặt sức chứa rồi đọc mã cho thí sinh — họ tự vào, bạn không
            phải thêm từng người. Hết chỗ thì người sau không vào được nữa.
          </p>
        </div>
        <button className="td-btn-primary" onClick={() => setFormModal({})}>
          <Plus size={15} /> Mở phòng mới
        </button>
      </div>

      {loading ? (
        <div className="td-empty"><Loader2 size={20} className="td-spin" /> Đang tải…</div>
      ) : rooms.length === 0 ? (
        <div className="td-empty">
          <School size={26} style={{ opacity: 0.4 }} />
          <p style={{ margin: '10px 0 0' }}>Chưa có phòng thi nào.</p>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ink-faint)' }}>
            Mở một phòng, gắn bài thi vào rồi đọc mã cho thí sinh.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {rooms.map((room) => {
            const st = STATUS[room.status] ?? STATUS.DRAFT;
            const full = room.capacity != null && room.seatsLeft === 0;
            return (
              <div key={room.roomId} style={{
                background: 'var(--paper-raised)', border: '1px solid var(--line)',
                borderRadius: 14, padding: '15px 16px',
                display: 'flex', flexDirection: 'column', gap: 10,
                boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <h3 style={{
                    fontFamily: 'var(--heading)', fontSize: 14.5, fontWeight: 700,
                    margin: 0, color: 'var(--ink)', flex: 1, lineHeight: 1.4,
                  }}>{room.name}</h3>
                  <span className={`td-badge ${st.cls}`}>{st.label}</span>
                </div>

                <RoomCode code={room.code} onCopied={showToast} />

                <div style={{
                  fontSize: 12, color: 'var(--ink-faint)',
                  display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  <Users size={12} />
                  <span style={{ color: full ? 'var(--cinnabar)' : undefined }}>
                    {room.capacity == null
                      ? `${room.memberCount} người`
                      : `${room.memberCount}/${room.capacity} chỗ`}
                  </span>
                  <span>·</span>
                  <FileText size={12} />
                  <span style={{ color: room.examCount === 0 ? 'var(--gold)' : undefined }}>
                    {room.examCount} bài thi
                  </span>
                  {room.levelName && (
                    <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{room.levelName}</span>
                  )}
                </div>

                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ink-faint)' }}>
                  {JOIN_POLICY_LABEL[room.joinPolicy]} · {st.hint}
                </p>

                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 2 }}>
                  <button className="td-btn-ghost" onClick={() => setDetailRoom(room)}>
                    <Users size={13} /> Chi tiết
                  </button>

                  {room.status === 'DRAFT' && (
                    <button
                      className="td-btn-ghost"
                      title={room.examCount === 0
                        ? 'Cần gắn ít nhất một bài thi trước khi mở'
                        : 'Mở phòng cho thí sinh vào'}
                      disabled={room.examCount === 0}
                      onClick={() => changeStatus(room, 'OPEN')}
                    >
                      <Play size={13} /> Mở phòng
                    </button>
                  )}
                  {room.status === 'OPEN' && (
                    <button className="td-btn-ghost" title="Chốt danh sách, không nhận thêm người"
                            onClick={() => changeStatus(room, 'RUNNING')}>
                      <Lock size={13} /> Bắt đầu thi
                    </button>
                  )}
                  {(room.status === 'OPEN' || room.status === 'RUNNING') && (
                    <button className="td-btn-ghost" title="Đóng phòng"
                            onClick={() => changeStatus(room, 'CLOSED')}>
                      <Square size={13} /> Đóng
                    </button>
                  )}

                  <button className="td-btn-ghost" onClick={() => setFormModal(room)}>
                    <Edit3 size={13} />
                  </button>
                  <button className="td-btn-ghost" onClick={() => remove(room)}
                          style={{ color: 'var(--cinnabar)' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formModal && (
        <RoomFormModal
          initial={formModal.roomId ? formModal : null}
          levels={levels}
          saving={saving}
          onClose={() => setFormModal(null)}
          onSave={save}
        />
      )}

      {detailRoom && (
        <RoomDetailModal
          room={rooms.find((r) => r.roomId === detailRoom.roomId) ?? detailRoom}
          onClose={() => setDetailRoom(null)}
          onChanged={load}
          showToast={showToast}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </>
  );
}
