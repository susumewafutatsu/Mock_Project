// src/pages/admin/Overview.jsx
// Tab "Tổng quan ôn luyện" của trang quản trị.

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { getStats } from '../../services/adminService';
import { formatWhen } from './adminFormat';

const nf = new Intl.NumberFormat('vi-VN');

/** @param onOpen nếu có, thẻ bấm được và dẫn tới danh sách tương ứng */
function Stat({ label, value, sub, onOpen, openLabel }) {
  return (
    <div className="td-stat-card ad-stat">
      <div className="td-stat-body">
        <p className="td-stat-label">{label}</p>
        <p className="td-stat-value">{nf.format(value ?? 0)}</p>
        {sub && <p className="td-stat-sub">{sub}</p>}
        {onOpen && value > 0 && (
          <button className="td-btn-ghost ad-stat-link" onClick={onOpen}>
            {openLabel} <ArrowRight size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * @param goTo(tab, query?) chuyển tab của trang quản trị
 */
export default function Overview({ goTo }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getStats()
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !stats) {
    return (
      <div className="td-empty">
        <Loader2 size={40} className="ad-spin" />
        <h3>Đang tải số liệu…</h3>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="td-empty">
        <AlertTriangle size={48} style={{ color: 'var(--cinnabar)' }} />
        <h3>Không tải được số liệu</h3>
        <p>{error}</p>
        <button className="td-btn-secondary" onClick={load}>Thử lại</button>
      </div>
    );
  }

  const s = stats;

  return (
    <div className="ad-overview">
      <div className="ad-toolbar">
        <span className="ad-muted">
          Số liệu lúc {formatWhen(s.serverTime)} (giờ server)
        </span>
        <button className="td-btn-ghost" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'ad-spin' : undefined} /> Làm mới
        </button>
      </div>

      <h3 className="ad-group-title">Hoạt động luyện đề</h3>
      <div className="td-stats-row ad-stats-3">
        <Stat label="Đang làm bài" value={s.sessionsInProgress} sub="Lượt luyện đề chưa nộp" />
        <Stat label="Mất kết nối giữa giờ" value={s.sessionsAtRisk}
              sub="Im lặng quá 90 giây — hết giờ bài tự nộp" />
        <Stat label="Bài nộp 24 giờ qua" value={s.submittedLast24h} sub="Kể cả bài tự nộp khi hết giờ" />
      </div>

      <h3 className="ad-group-title">Học viên</h3>
      <div className="td-stats-row">
        <Stat label="Tổng tài khoản" value={s.totalUsers}
              sub={`${nf.format(s.newUsersLast7Days)} đăng ký trong 7 ngày`} />
        <Stat label="Thí sinh ôn thi" value={s.students} />
        <Stat label="Người ra đề" value={s.teachers} />
        <Stat label="Tài khoản bị khoá" value={s.lockedUsers}
              sub={`${nf.format(s.admins)} quản trị viên`}
              onOpen={() => goTo('users', { locked: true })} openLabel="Xem danh sách" />
      </div>

      <h3 className="ad-group-title">Học liệu ôn thi</h3>
      <div className="td-stats-row">
        <Stat label="Đề luyện thi" value={s.exams} sub={`${nf.format(s.publicExams)} đề tự do`} />
        <Stat label="Ngân hàng câu hỏi" value={s.questionBanks} />
        <Stat label="Phòng thi" value={s.rooms} />
        <Stat label="Lộ trình chờ duyệt" value={s.pendingCourses}
              onOpen={() => goTo('courses')} openLabel="Duyệt lộ trình" />
      </div>
    </div>
  );
}
