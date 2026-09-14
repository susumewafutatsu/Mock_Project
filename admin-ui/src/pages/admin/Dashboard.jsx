// src/pages/admin/Dashboard.jsx
// Khung trang quản trị: thanh bên + thanh trên, và ba tab theo URL.

import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle, CheckCircle2, ChevronRight, GraduationCap, LayoutDashboard, LogOut, Users, X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import courseService from '../../services/courseService';
import Overview from './Overview';
import UserManagement from './UserManagement';
import CourseReviewQueue from './CourseReviewQueue';
import { initialsOf } from './adminFormat';
import '../teacher/TeacherDashboard.css';
import './AdminDashboard.css';

const TABS = [
  {
    id: 'dashboard', label: 'Tổng quan ôn luyện', icon: LayoutDashboard,
    title: 'Tổng quan ôn luyện', subtitle: 'Hoạt động luyện đề, học viên và học liệu ôn thi.',
  },
  {
    id: 'users', label: 'Người dùng', icon: Users,
    title: 'Người dùng', subtitle: 'Đổi vai trò, khoá tài khoản vi phạm. Không xoá — khoá thì dữ liệu còn nguyên.',
  },
  {
    id: 'courses', label: 'Duyệt lộ trình', icon: GraduationCap,
    title: 'Duyệt lộ trình ôn tập', subtitle: 'Lộ trình do người ra đề soạn phải qua đây mới tới được thí sinh.',
  },
];

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, type === 'error' ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [onClose, type]);

  const color = type === 'success' ? 'var(--jade)' : 'var(--cinnabar)';
  const Icon = type === 'success' ? CheckCircle2 : AlertCircle;

  return (
    <div className="ad-toast" role="status" style={{ borderColor: `${color}40` }}>
      <Icon size={18} color={color} style={{ flexShrink: 0 }} />
      <p>{message}</p>
      <button onClick={onClose} aria-label="Đóng"><X size={14} /></button>
    </div>
  );
}

export default function AdminDashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const segment = location.pathname.replace(/^\/admin\/?/, '').split('/')[0];
  const active = TABS.find((t) => t.id === segment) ?? TABS[0];
  const lockedFilter = new URLSearchParams(location.search).get('locked') === '1';

  const goTo = useCallback((tabId, query = {}) => {
    const qs = query.locked ? '?locked=1' : '';
    navigate(`/admin/${tabId}${qs}`);
  }, [navigate]);

  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);

  // Huy hiệu số khoá chờ duyệt trên thanh bên — thấy được từ mọi tab.
  const [pendingCourses, setPendingCourses] = useState(null);
  useEffect(() => {
    courseService.getPendingCourses()
      .then((list) => setPendingCourses(list.length))
      .catch(() => { /* mất huy hiệu thì thôi, không chặn trang */ });
  }, []);

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  const userName = currentUser?.fullName || currentUser?.email || 'Quản trị viên';
  const initials = initialsOf(userName);

  return (
    <div className="td-root ad-root">
      <aside className="td-sidebar">
        <div className="td-sidebar-logo">
          <h2>⛩️ Tàng Thư Các</h2>
          <p>Cổng quản trị</p>
        </div>

        <nav className="td-sidebar-nav">
          <div className="td-nav-section-label">Quản trị</div>
          {TABS.map((t) => {
            const Icon = t.icon;
            const badge = t.id === 'courses' && pendingCourses > 0 ? pendingCourses : null;
            return (
              <button
                key={t.id}
                className={`td-nav-item ${active.id === t.id ? 'active' : ''}`}
                onClick={() => goTo(t.id)}
                aria-current={active.id === t.id ? 'page' : undefined}
              >
                <Icon size={17} />
                {t.label}
                {badge && <span className="td-nav-badge">{badge}</span>}
                {active.id === t.id && !badge && <ChevronRight size={14} style={{ marginLeft: 'auto' }} />}
              </button>
            );
          })}
        </nav>

        <div className="td-sidebar-footer">
          <div className="td-user-card" onClick={handleLogout} title="Đăng xuất">
            <div className="td-avatar">{initials}</div>
            <div className="td-user-info">
              <p className="td-user-name">{userName}</p>
              <p className="td-user-role">Quản trị viên · Đăng xuất</p>
            </div>
            <LogOut size={15} style={{ color: 'var(--ink-mute)', flexShrink: 0 }} />
          </div>
        </div>
      </aside>

      <main className="td-main">
        <header className="td-topbar">
          <div className="td-topbar-left">
            <h1>{active.title}</h1>
            <p>{active.subtitle}</p>
          </div>
        </header>

        <div className="td-content">
          {active.id === 'dashboard' && <Overview goTo={goTo} />}
          {active.id === 'users' && (
            <UserManagement showToast={showToast} initialLocked={lockedFilter} />
          )}
          {active.id === 'courses' && (
            <CourseReviewQueue showToast={showToast} onCountChange={setPendingCourses} />
          )}
        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
