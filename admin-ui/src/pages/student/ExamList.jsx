import React, { useState } from 'react';
import {
  LayoutDashboard, BookOpen, ClipboardList, BarChart2, Trophy,
  Bell, LogOut, ChevronRight, Clock, Play, CheckCircle,
  AlertCircle, Search, Star,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import './StudentDashboard.css';

// ─── Mock Data ─────────────────────────────────────────────────
const MOCK_EXAMS = [
  {
    id: 1,
    name: 'Kiểm tra giữa kỳ – Toán Đại số Chương 3',
    subject: 'Toán học',
    teacher: 'Thầy Huy',
    questions: 30,
    duration: 45,
    deadline: '2026-08-28 07:30',
    status: 'upcoming',
    icon: '📐',
    iconBg: 'rgba(167,139,250,0.15)',
  },
  {
    id: 2,
    name: 'Ôn tập Ngữ pháp N4 – Thì hiện tại tiến diễn',
    subject: 'Tiếng Nhật',
    teacher: 'Cô Lan',
    questions: 20,
    duration: 25,
    deadline: '2026-08-25 23:59',
    status: 'open',
    icon: '🇯🇵',
    iconBg: 'rgba(251,191,36,0.15)',
  },
  {
    id: 3,
    name: 'Luyện đọc IELTS – Reading Band 6.0',
    subject: 'Tiếng Anh',
    teacher: 'Cô Mai',
    questions: 40,
    duration: 60,
    deadline: '2026-08-20 09:00',
    status: 'open',
    icon: '📖',
    iconBg: 'rgba(96,165,250,0.15)',
  },
];

const MOCK_RESULTS = [
  { id: 1, name: 'Từ vựng N4 – Tuần 8',        subject: 'Tiếng Nhật', score: 90, total: 100, date: '22/08', grade: 'A' },
  { id: 2, name: 'Toán – Bất phương trình bậc 2', subject: 'Toán học',   score: 76, total: 100, date: '18/08', grade: 'B' },
  { id: 3, name: 'Reading – Practice Test 3',    subject: 'Tiếng Anh', score: 82, total: 100, date: '14/08', grade: 'B+' },
  { id: 4, name: 'Hán tự N4 – Bộ 1',            subject: 'Tiếng Nhật', score: 95, total: 100, date: '10/08', grade: 'A' },
];

const NAV_ITEMS = [
  { id: 'home',    label: 'Tổng quan',       icon: LayoutDashboard },
  { id: 'exams',   label: 'Đề thi của tôi',  icon: ClipboardList, badge: 2 },
  { id: 'history', label: 'Lịch sử điểm',    icon: BarChart2 },
  { id: 'ranking', label: 'Bảng xếp hạng',   icon: Trophy },
];

const GRADE_COLOR = {
  'A':  { bg: 'rgba(52,211,153,0.12)',   fg: '#34d399' },
  'B+': { bg: 'rgba(96,165,250,0.12)',   fg: '#60a5fa' },
  'B':  { bg: 'rgba(167,139,250,0.12)',  fg: '#a78bfa' },
  'C':  { bg: 'rgba(251,191,36,0.12)',   fg: '#fbbf24' },
  'F':  { bg: 'rgba(239,68,68,0.1)',     fg: '#f87171' },
};

function StatusBadge({ status }) {
  const MAP = {
    open:     { cls: 'open',     label: 'Đang mở' },
    upcoming: { cls: 'upcoming', label: 'Sắp diễn ra' },
    done:     { cls: 'done',     label: 'Đã làm' },
    missed:   { cls: 'missed',   label: 'Đã hết hạn' },
  };
  const s = MAP[status] || MAP.done;
  return <span className={`sd-badge ${s.cls}`}>{s.label}</span>;
}

// ─── Main Component ────────────────────────────────────────────
export default function StudentDashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('exams');

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  const userName = currentUser?.fullName || currentUser?.email || 'Học sinh';
  const initials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const openExams = MOCK_EXAMS.filter(e => e.status === 'open').length;
  const avgScore  = Math.round(MOCK_RESULTS.reduce((a, b) => a + b.score, 0) / MOCK_RESULTS.length);

  const stats = [
    { icon: '📝', label: 'Đề thi đang mở',   value: openExams, sub: 'Cần hoàn thành sớm', color: 'rgba(52,211,153,0.12)' },
    { icon: '✅', label: 'Đã hoàn thành',      value: MOCK_RESULTS.length, sub: 'Tổng số bài làm', color: 'rgba(96,165,250,0.12)' },
    { icon: '⭐', label: 'Điểm trung bình',    value: avgScore, sub: 'Toàn bộ môn học', color: 'rgba(251,191,36,0.12)' },
    { icon: '🏆', label: 'Xếp hạng lớp',      value: '#3', sub: 'Trong 32 học sinh', color: 'rgba(167,139,250,0.12)' },
  ];

  return (
    <div className="sd-root">
      {/* ── SIDEBAR ── */}
      <aside className="sd-sidebar">
        <div className="sd-logo">
          <h2>🎓 EduPlatform</h2>
          <p>Cổng học sinh</p>
        </div>

        <nav className="sd-nav">
          <div className="sd-nav-label">Menu học tập</div>
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`sd-nav-item ${activeNav === item.id ? 'active' : ''}`}
                onClick={() => setActiveNav(item.id)}
              >
                <Icon size={16} />
                {item.label}
                {item.badge && <span className="sd-nav-badge">{item.badge}</span>}
                {activeNav === item.id && <ChevronRight size={13} style={{ marginLeft: 'auto' }} />}
              </button>
            );
          })}
        </nav>

        <div className="sd-footer">
          <div className="sd-user-card" onClick={handleLogout} title="Đăng xuất">
            <div className="sd-avatar">{initials}</div>
            <div className="sd-user-info">
              <p className="sd-user-name">{userName}</p>
              <p className="sd-user-role">Học sinh · Đăng xuất</p>
            </div>
            <LogOut size={14} style={{ color: '#475569', flexShrink: 0 }} />
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="sd-main">
        {/* Topbar */}
        <header className="sd-topbar">
          <div className="sd-topbar-left">
            <h1>Trang học của tôi</h1>
            <p>Xin chào, {userName.split(' ').slice(-1)[0]}! Hãy cố gắng lên nhé 💪</p>
          </div>
          <div className="sd-topbar-right">
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10, padding: '8px 14px', fontSize: 13, color: '#64748b',
            }}>
              <Search size={14} /> Tìm đề thi...
            </div>
            <button className="sd-icon-btn" title="Thông báo">
              <Bell size={16} />
            </button>
          </div>
        </header>

        <div className="sd-content">
          {/* Welcome Banner */}
          <div className="sd-welcome-banner">
            <div>
              <p className="sd-welcome-title">
                Chào mừng trở lại, <span>{userName.split(' ').slice(-1)[0]}</span>! 🎉
              </p>
              <p className="sd-welcome-sub">
                Bạn có <strong style={{ color: '#f1f5f9' }}>{openExams} đề thi đang mở</strong>. Đừng bỏ lỡ nhé!
              </p>
            </div>
            <div className="sd-streak-pill">
              🔥 Chuỗi học 7 ngày
            </div>
          </div>

          {/* Stats */}
          <div className="sd-stats-row">
            {stats.map((s, i) => (
              <div key={i} className="sd-stat-card">
                <span className="sd-stat-icon"
                  style={{ display: 'inline-flex', width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', background: s.color, fontSize: 20, marginBottom: 10 }}>
                  {s.icon}
                </span>
                <p className="sd-stat-label">{s.label}</p>
                <p className="sd-stat-value">{s.value}</p>
                <p className="sd-stat-sub">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Main Grid */}
          <div className="sd-main-grid">
            {/* Exam List */}
            <div>
              <div className="sd-card" style={{ marginBottom: 20 }}>
                <div className="sd-card-header">
                  <h2>📋 Đề thi cần làm</h2>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{MOCK_EXAMS.length} đề thi</span>
                </div>
                <div className="sd-exam-list">
                  {MOCK_EXAMS.map(exam => (
                    <div key={exam.id} className="sd-exam-card">
                      <div className="sd-exam-icon-wrap" style={{ background: exam.iconBg }}>
                        {exam.icon}
                      </div>
                      <div className="sd-exam-body">
                        <p className="sd-exam-name">{exam.name}</p>
                        <div className="sd-exam-meta">
                          <span><BookOpen size={11} />{exam.subject}</span>
                          <span><Clock size={11} />{exam.duration} phút</span>
                          <span style={{ color: '#475569' }}>{exam.questions} câu</span>
                          <span style={{ color: '#475569' }}>GV: {exam.teacher}</span>
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <StatusBadge status={exam.status} />
                          <span style={{ fontSize: 11.5, color: '#475569', marginLeft: 10 }}>Hạn: {exam.deadline}</span>
                        </div>
                      </div>
                      <div className="sd-exam-action">
                        {exam.status === 'open' ? (
                          <button className="sd-btn-primary">
                            <Play size={13} /> Làm bài
                          </button>
                        ) : (
                          <button className="sd-btn-ghost">
                            <Clock size={13} /> Xem trước
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tiến độ học tập */}
              <div className="sd-card">
                <div className="sd-card-header">
                  <h2>📈 Tiến độ học tập</h2>
                </div>
                <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {[
                    { label: 'Tiếng Nhật N4', progress: 72, color: '#fbbf24' },
                    { label: 'Toán học',       progress: 55, color: '#a78bfa' },
                    { label: 'Tiếng Anh IELTS', progress: 80, color: '#60a5fa' },
                  ].map((item, i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: '#d1d5db' }}>{item.label}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: item.color }}>{item.progress}%</span>
                      </div>
                      <div className="sd-progress-bar-track">
                        <div
                          className="sd-progress-bar-fill"
                          style={{ width: `${item.progress}%`, background: `linear-gradient(90deg, ${item.color}, ${item.color}88)` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Kết quả gần đây */}
              <div className="sd-card">
                <div className="sd-card-header">
                  <h2>🏅 Điểm gần đây</h2>
                  <button className="sd-btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }}>
                    Xem tất cả
                  </button>
                </div>
                <div>
                  {MOCK_RESULTS.map((r, i) => {
                    const gc = GRADE_COLOR[r.grade] || GRADE_COLOR['B'];
                    return (
                      <div key={r.id} className="sd-score-row">
                        <div className="sd-score-circle" style={{ background: gc.bg, color: gc.fg }}>
                          {r.grade}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#64748b' }}>{r.subject} · {r.date}</p>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 800, color: gc.fg, flexShrink: 0 }}>{r.score}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bảng xếp hạng mini */}
              <div className="sd-card">
                <div className="sd-card-header">
                  <h2>🏆 Top lớp N4</h2>
                </div>
                <div style={{ padding: '12px 0' }}>
                  {[
                    { rank: 1, name: 'Nguyễn Thị Lan',   score: 96, medal: '🥇' },
                    { rank: 2, name: 'Trần Văn Bình',     score: 94, medal: '🥈' },
                    { rank: 3, name: userName,            score: avgScore, medal: '🥉', isMe: true },
                    { rank: 4, name: 'Phạm Thị Hoa',      score: 88, medal: '' },
                    { rank: 5, name: 'Lê Văn Đức',        score: 85, medal: '' },
                  ].map((item) => (
                    <div key={item.rank} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 22px',
                      background: item.isMe ? 'rgba(52,211,153,0.05)' : 'none',
                      borderLeft: item.isMe ? '2px solid #34d399' : '2px solid transparent',
                    }}>
                      <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>
                        {item.medal || <span style={{ fontSize: 12, color: '#475569', fontWeight: 700 }}>#{item.rank}</span>}
                      </span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: item.isMe ? 700 : 500, color: item.isMe ? '#34d399' : '#d1d5db' }}>
                        {item.name} {item.isMe && '(Bạn)'}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>{item.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
