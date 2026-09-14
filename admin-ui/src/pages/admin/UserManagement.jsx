// src/pages/admin/UserManagement.jsx
// Tab "Người dùng" của trang quản trị: tìm, lọc, đổi vai trò, khoá / mở khoá.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Loader2, Lock, Search, ShieldCheck, Unlock, Users, X,
} from 'lucide-react';
import { changeRole, getUsers, lockUser, unlockUser } from '../../services/adminService';
import { formatDate, formatWhen, initialsOf, ROLE_LABELS } from './adminFormat';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const ROLE_TABS = [
  { id: null, label: 'Tất cả' },
  { id: 'STUDENT', label: ROLE_LABELS.STUDENT },
  { id: 'TEACHER', label: ROLE_LABELS.TEACHER },
  { id: 'ADMIN', label: ROLE_LABELS.ADMIN },
];

// ─── Hộp khoá tài khoản ──────────────────────────────────────────

function LockDialog({ user, busy, onCancel, onConfirm }) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  return (
    <div className="td-modal-overlay" onClick={onCancel}>
      <div className="td-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="td-modal-header">
          <h2>Khoá tài khoản</h2>
          <button className="td-close-btn" onClick={onCancel} aria-label="Đóng"><X size={16} /></button>
        </div>
        <div className="td-modal-body">
          <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--ink-body)', lineHeight: 1.6 }}>
            <strong>{user.fullName}</strong> ({user.email}) sẽ bị đăng xuất ở request kế tiếp và
            không đăng nhập lại được, kể cả bằng Google. Dữ liệu vẫn giữ nguyên; mở khoá được bất
            cứ lúc nào.
          </p>
          {user.role === 'STUDENT' && (
            <p className="td-form-hint" style={{ margin: '0 0 12px' }}>
              Nếu người này đang làm dở một bài thi, bài không bị huỷ — hết giờ server tự nộp
              với những đáp án đã lưu.
            </p>
          )}
          <label className="td-form-label" htmlFor="lock-reason">Lý do khoá (bắt buộc)</label>
          <textarea
            id="lock-reason"
            className="td-form-textarea"
            rows={3}
            maxLength={255}
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ví dụ: chia sẻ đề thi ra ngoài phòng thi ngày 10/09"
          />
          <p className="td-form-hint">
            Người mở khoá sau này — có khi là một quản trị viên khác — cần biết vì sao.
            {' '}{trimmed.length}/255
          </p>
        </div>
        <div className="td-modal-footer">
          <button className="td-btn-secondary" onClick={onCancel} disabled={busy}>Huỷ</button>
          <button
            className="td-btn-primary ad-btn-danger"
            disabled={busy || !trimmed}
            onClick={() => onConfirm(trimmed)}
          >
            {busy ? <Loader2 size={15} className="ad-spin" /> : <Lock size={15} />}
            Khoá tài khoản
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Trang ───────────────────────────────────────────────────────

/**
 * @param showToast(message, type) toast dùng chung của trang quản trị
 * @param initialLocked true khi đi từ "Cần xử lý → tài khoản đang bị khoá"
 */
export default function UserManagement({ showToast, initialLocked = false }) {
  const [role, setRole] = useState(null);
  const [lockedOnly, setLockedOnly] = useState(initialLocked);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(0);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [busyId, setBusyId] = useState(null);
  const [lockTarget, setLockTarget] = useState(null);

  // Bộ lọc đổi thì về trang đầu — trang 5 của bộ lọc cũ thường không tồn tại
  // ở bộ lọc mới.
  useEffect(() => { setLockedOnly(initialLocked); setPage(0); }, [initialLocked]);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQuery(query); setPage(0); }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Chỉ nhận kết quả của lần gọi mới nhất.
  const requestSeq = useRef(0);
  const load = useCallback(() => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    getUsers({
      role,
      locked: lockedOnly ? true : null,
      q: debouncedQuery,
      page,
      size: PAGE_SIZE,
    })
      .then((res) => { if (seq === requestSeq.current) setData(res); })
      .catch((err) => { if (seq === requestSeq.current) setError(err.message); })
      .finally(() => { if (seq === requestSeq.current) setLoading(false); });
  }, [role, lockedOnly, debouncedQuery, page]);

  useEffect(() => { load(); }, [load]);

  /** Thay một dòng bằng bản server vừa trả, rồi tải lại để số đếm trên tab đúng. */
  const applyUpdate = (updated) => {
    setData((prev) => prev && {
      ...prev,
      users: prev.users.map((u) => (u.userId === updated.userId ? updated : u)),
    });
    load();
  };

  const handleRoleChange = async (user, nextRole) => {
    if (nextRole === user.role) return;
    const warning = nextRole === 'TEACHER'
      ? 'Người này sẽ vào được cổng người ra đề và mất quyền vào phòng thi của thí sinh.'
      : 'Người này sẽ mất quyền vào cổng người ra đề.';
    if (!window.confirm(
      `Đổi ${user.fullName} từ "${ROLE_LABELS[user.role]}" thành "${ROLE_LABELS[nextRole]}"?\n\n${warning}`
    )) return;
    setBusyId(user.userId);
    try {
      applyUpdate(await changeRole(user.userId, nextRole));
      showToast(`Đã đổi ${user.fullName} thành ${ROLE_LABELS[nextRole]}`);
    } catch (err) {
      // Câu của server nói rõ vì sao (đang thi dở, còn sở hữu đề…) — hiện nguyên văn.
      showToast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleLock = async (reason) => {
    const user = lockTarget;
    setBusyId(user.userId);
    try {
      applyUpdate(await lockUser(user.userId, reason));
      showToast(`Đã khoá tài khoản ${user.fullName}`);
      setLockTarget(null);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleUnlock = async (user) => {
    if (!window.confirm(
      `Mở khoá ${user.fullName}?\n\nLý do đã khoá: ${user.lockReason || '(không ghi)'}`
    )) return;
    setBusyId(user.userId);
    try {
      applyUpdate(await unlockUser(user.userId));
      showToast(`Đã mở khoá ${user.fullName}`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const counts = data?.roleCounts ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const users = data?.users ?? [];

  return (
    <div className="td-section-card">
      {/* ── Bộ lọc: một hàng phía trên bảng ── */}
      <div className="ad-filters">
        <div className="ad-tabs" role="tablist" aria-label="Lọc theo vai trò">
          {ROLE_TABS.map((t) => (
            <button
              key={t.id ?? 'all'}
              role="tab"
              aria-selected={role === t.id}
              className={`ad-tab ${role === t.id ? 'active' : ''}`}
              onClick={() => { setRole(t.id); setPage(0); }}
            >
              {t.label}
              <span className="ad-tab-count">{t.id ? counts[t.id] ?? 0 : total}</span>
            </button>
          ))}
        </div>

        <label className="ad-check">
          <input
            type="checkbox"
            checked={lockedOnly}
            onChange={(e) => { setLockedOnly(e.target.checked); setPage(0); }}
          />
          Chỉ tài khoản bị khoá
          {data && <span className="ad-tab-count">{data.lockedCount}</span>}
        </label>

        <div className="ad-search">
          <Search size={15} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên hoặc email"
            aria-label="Tìm người dùng"
          />
        </div>
      </div>

      {/* ── Bảng ── */}
      {error ? (
        <div className="td-empty">
          <h3>Không tải được danh sách người dùng</h3>
          <p>{error}</p>
          <button className="td-btn-secondary" onClick={load}>Thử lại</button>
        </div>
      ) : !data && loading ? (
        <div className="td-empty">
          <Loader2 size={40} className="ad-spin" />
          <h3>Đang tải…</h3>
        </div>
      ) : users.length === 0 ? (
        <div className="td-empty">
          <Users size={48} />
          <h3>Không có ai khớp bộ lọc</h3>
          <p>Thử bỏ bớt điều kiện lọc hoặc đổi từ khoá tìm kiếm.</p>
        </div>
      ) : (
        <div className="ad-table-wrap" aria-busy={loading}>
          <table className="td-exam-table ad-user-table">
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Vai trò</th>
                <th>Đăng nhập</th>
                <th>Ngày tạo</th>
                <th>Trạng thái</th>
                <th aria-label="Thao tác"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const busy = busyId === u.userId;
                return (
                  <tr key={u.userId} className={u.locked ? 'ad-row-locked' : undefined}>
                    <td>
                      <div className="ad-user-cell">
                        <span className="td-avatar ad-avatar">{initialsOf(u.fullName)}</span>
                        <div style={{ minWidth: 0 }}>
                          <div className="td-exam-name ad-ellipsis">{u.fullName}</div>
                          <div className="td-exam-subject ad-ellipsis">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {u.editable ? (
                        <select
                          className="td-form-select ad-role-select"
                          value={u.role}
                          disabled={busy}
                          onChange={(e) => handleRoleChange(u, e.target.value)}
                          aria-label={`Vai trò của ${u.fullName}`}
                        >
                          <option value="STUDENT">{ROLE_LABELS.STUDENT}</option>
                          <option value="TEACHER">{ROLE_LABELS.TEACHER}</option>
                        </select>
                      ) : (
                        <span
                          className="ad-role-fixed"
                          title="Tài khoản quản trị (kể cả của bạn) không sửa được qua giao diện"
                        >
                          {u.role === 'ADMIN' && <ShieldCheck size={13} />}
                          {ROLE_LABELS[u.role] ?? u.role}
                        </span>
                      )}
                    </td>
                    <td className="ad-muted">{u.authProvider === 'GOOGLE' ? 'Google' : 'Mật khẩu'}</td>
                    <td className="ad-muted">{formatDate(u.createdAt)}</td>
                    <td>
                      {u.locked ? (
                        <div>
                          <span className="td-badge closed"><Lock size={11} /> Bị khoá</span>
                          <div className="ad-lock-reason" title={u.lockReason}>
                            {formatWhen(u.lockedAt)} · {u.lockReason}
                          </div>
                        </div>
                      ) : (
                        <span className="td-badge open">Hoạt động</span>
                      )}
                    </td>
                    <td>
                      {u.editable && (
                        u.locked ? (
                          <button className="td-btn-ghost" disabled={busy} onClick={() => handleUnlock(u)}>
                            {busy ? <Loader2 size={14} className="ad-spin" /> : <Unlock size={14} />}
                            Mở khoá
                          </button>
                        ) : (
                          <button
                            className="td-btn-ghost ad-ghost-danger"
                            disabled={busy}
                            onClick={() => setLockTarget(u)}
                          >
                            <Lock size={14} /> Khoá
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Phân trang ── */}
      {data && data.totalElements > 0 && (
        <div className="ad-pager">
          <span className="ad-muted">
            {data.page * data.size + 1}–{Math.min((data.page + 1) * data.size, data.totalElements)}
            {' '}trong {data.totalElements} người
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="td-btn-secondary" disabled={page === 0 || loading}
                    onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft size={14} /> Trước
            </button>
            <button className="td-btn-secondary" disabled={page + 1 >= data.totalPages || loading}
                    onClick={() => setPage((p) => p + 1)}>
              Sau <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {lockTarget && (
        <LockDialog
          user={lockTarget}
          busy={busyId === lockTarget.userId}
          onCancel={() => setLockTarget(null)}
          onConfirm={handleLock}
        />
      )}
    </div>
  );
}
