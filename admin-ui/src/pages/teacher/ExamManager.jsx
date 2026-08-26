import React, { useState } from 'react';
import {
  LayoutDashboard, FileText, BookOpen, Users, BarChart2,
  Plus, Search, Bell, LogOut, ChevronRight, Clock,
  CheckCircle2, X, Calendar, AlignLeft, Hash, Timer,
  GraduationCap, Sparkles, ClipboardList, Edit3, Trash2, Eye,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import QuestionBank from './QuestionBank';
import './TeacherDashboard.css';

// ─── Mock data ────────────────────────────────────────────────
const MOCK_EXAMS = [
  {
    id: 1,
    name: 'Kiểm tra giữa kỳ – Toán Đại số Chương 3',
    subject: 'Toán học',
    class: 'Lớp 9A',
    questions: 30,
    duration: 45,
    startTime: '2026-08-28 07:30',
    status: 'upcoming',
    submissions: 0,
    totalStudents: 38,
  },
  {
    id: 2,
    name: 'Ôn tập Ngữ pháp N4 – Thì hiện tại tiến diễn',
    subject: 'Tiếng Nhật',
    class: 'N4 – Tối T3/T5',
    questions: 20,
    duration: 25,
    startTime: '2026-08-25 19:00',
    status: 'open',
    submissions: 21,
    totalStudents: 32,
  },
  {
    id: 3,
    name: 'Luyện đọc IELTS – Reading Band 6.0',
    subject: 'Tiếng Anh',
    class: 'IELTS Foundation B1',
    questions: 40,
    duration: 60,
    startTime: '2026-08-20 09:00',
    status: 'closed',
    submissions: 27,
    totalStudents: 27,
  },
  {
    id: 4,
    name: 'Kiểm tra từ vựng Chương 2',
    subject: 'Tiếng Nhật',
    class: 'N4 – Tối T3/T5',
    questions: 15,
    duration: 20,
    startTime: '2026-08-15 18:00',
    status: 'closed',
    submissions: 30,
    totalStudents: 32,
  },
];

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'exams',     label: 'Quản lý đề thi', icon: FileText, badge: 2 },
  { id: 'questions', label: 'Ngân hàng câu hỏi', icon: BookOpen },
  { id: 'students',  label: 'Học sinh', icon: Users },
  { id: 'results',   label: 'Kết quả & Phân tích', icon: BarChart2 },
];

const SUBJECTS = ['Toán học', 'Tiếng Anh', 'Tiếng Nhật', 'Vật lý', 'Hóa học', 'Sinh học'];
const CLASSES  = ['Lớp 9A', 'Lớp 9B', 'N4 – Tối T3/T5', 'IELTS Foundation B1'];

// ─── Status badge ─────────────────────────────────────────────
function StatusBadge({ status }) {
  const MAP = {
    draft:    { cls: 'draft',    label: 'Nháp' },
    upcoming: { cls: 'upcoming', label: 'Sắp diễn ra' },
    open:     { cls: 'open',     label: 'Đang mở' },
    closed:   { cls: 'closed',   label: 'Đã kết thúc' },
  };
  const s = MAP[status] || MAP.draft;
  return <span className={`td-badge ${s.cls}`}>{s.label}</span>;
}

// ─── Create Exam Modal ────────────────────────────────────────
function CreateExamModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    name: '', subject: '', class: '', questions: '',
    duration: '', startDate: '', startTime: '',
    description: '', status: 'draft',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const newExam = {
      id: Date.now(),
      name: form.name,
      subject: form.subject,
      class: form.class,
      questions: Number(form.questions) || 0,
      duration: Number(form.duration) || 0,
      startTime: `${form.startDate} ${form.startTime}`,
      status: form.status,
      submissions: 0,
      totalStudents: 30,
    };
    onCreate(newExam);
    onClose();
  };

  return (
    <div className="td-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="td-modal">
        <div className="td-modal-header">
          <div>
            <h2>✨ Tạo kỳ thi mới</h2>
            <p>Điền thông tin để tạo đề thi cho học sinh</p>
          </div>
          <button className="td-close-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="td-modal-body">
            {/* Tên đề thi */}
            <div className="td-form-group full">
              <label className="td-form-label">
                <FileText size={14} /> Tên đề thi <span className="required">*</span>
              </label>
              <input
                className="td-form-input"
                placeholder="VD: Kiểm tra giữa kỳ – Toán Chương 3"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                required
              />
            </div>

            <div className="td-form-row">
              {/* Môn học */}
              <div className="td-form-group">
                <label className="td-form-label">
                  <BookOpen size={14} /> Môn học <span className="required">*</span>
                </label>
                <select
                  className="td-form-select"
                  value={form.subject}
                  onChange={(e) => set('subject', e.target.value)}
                  required
                >
                  <option value="">-- Chọn môn --</option>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Lớp học */}
              <div className="td-form-group">
                <label className="td-form-label">
                  <Users size={14} /> Lớp áp dụng <span className="required">*</span>
                </label>
                <select
                  className="td-form-select"
                  value={form.class}
                  onChange={(e) => set('class', e.target.value)}
                  required
                >
                  <option value="">-- Chọn lớp --</option>
                  {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="td-form-row">
              {/* Số câu hỏi */}
              <div className="td-form-group">
                <label className="td-form-label">
                  <Hash size={14} /> Số câu hỏi <span className="required">*</span>
                </label>
                <input
                  className="td-form-input" type="number" min="1" max="200"
                  placeholder="VD: 30"
                  value={form.questions}
                  onChange={(e) => set('questions', e.target.value)}
                  required
                />
              </div>

              {/* Thời gian làm bài */}
              <div className="td-form-group">
                <label className="td-form-label">
                  <Timer size={14} /> Thời gian làm bài (phút) <span className="required">*</span>
                </label>
                <input
                  className="td-form-input" type="number" min="5" max="300"
                  placeholder="VD: 45"
                  value={form.duration}
                  onChange={(e) => set('duration', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="td-form-row">
              {/* Ngày thi */}
              <div className="td-form-group">
                <label className="td-form-label">
                  <Calendar size={14} /> Ngày thi
                </label>
                <input
                  className="td-form-input" type="date"
                  value={form.startDate}
                  onChange={(e) => set('startDate', e.target.value)}
                />
              </div>

              {/* Giờ thi */}
              <div className="td-form-group">
                <label className="td-form-label">
                  <Clock size={14} /> Giờ bắt đầu
                </label>
                <input
                  className="td-form-input" type="time"
                  value={form.startTime}
                  onChange={(e) => set('startTime', e.target.value)}
                />
              </div>
            </div>

            {/* Trạng thái */}
            <div className="td-form-group">
              <label className="td-form-label">
                <CheckCircle2 size={14} /> Trạng thái ban đầu
              </label>
              <select
                className="td-form-select"
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
              >
                <option value="draft">Lưu nháp</option>
                <option value="upcoming">Lên lịch (sắp diễn ra)</option>
                <option value="open">Mở ngay</option>
              </select>
            </div>

            {/* Mô tả */}
            <div className="td-form-group full">
              <label className="td-form-label">
                <AlignLeft size={14} /> Mô tả / Hướng dẫn
              </label>
              <textarea
                className="td-form-textarea"
                placeholder="Nhập hướng dẫn làm bài, phạm vi kiến thức..."
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </div>
          </div>

          <div className="td-modal-footer">
            <button type="button" className="td-btn-secondary" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="td-btn-primary">
              <Plus size={16} /> Tạo kỳ thi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function TeacherDashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('exams');
  const [exams, setExams] = useState(MOCK_EXAMS);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  const handleCreate = (newExam) => setExams(prev => [newExam, ...prev]);

  const filteredExams = filterStatus === 'all'
    ? exams
    : exams.filter(e => e.status === filterStatus);

  const stats = [
    {
      label: 'Tổng đề thi', value: exams.length, sub: '+1 tuần này',
      icon: '📋', color: 'rgba(167,139,250,0.15)',
    },
    {
      label: 'Đang mở', value: exams.filter(e => e.status === 'open').length, sub: 'Học sinh đang làm',
      icon: '🟢', color: 'rgba(52,211,153,0.15)',
    },
    {
      label: 'Sắp diễn ra', value: exams.filter(e => e.status === 'upcoming').length, sub: 'Trong 7 ngày tới',
      icon: '⏰', color: 'rgba(251,191,36,0.15)',
    },
    {
      label: 'Tổng học sinh', value: 97, sub: '3 lớp đang dạy',
      icon: '👥', color: 'rgba(96,165,250,0.15)',
    },
  ];

  const isQuestionTab = activeNav === 'questions';

  const userName  = currentUser?.fullName || currentUser?.email || 'Giáo viên';
  const initials  = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="td-root">
      {/* ── SIDEBAR ── */}
      <aside className="td-sidebar">
        <div className="td-sidebar-logo">
          <h2>📚 EduPlatform</h2>
          <p>Cổng giáo viên</p>
        </div>

        <nav className="td-sidebar-nav">
          <div className="td-nav-section-label">Menu chính</div>
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`td-nav-item ${activeNav === item.id ? 'active' : ''}`}
                onClick={() => setActiveNav(item.id)}
              >
                <Icon size={17} />
                {item.label}
                {item.badge && <span className="td-nav-badge">{item.badge}</span>}
                {activeNav === item.id && <ChevronRight size={14} style={{ marginLeft: 'auto' }} />}
              </button>
            );
          })}
        </nav>

        <div className="td-sidebar-footer">
          <div className="td-user-card" onClick={handleLogout} title="Đăng xuất">
            <div className="td-avatar">{initials}</div>
            <div className="td-user-info">
              <p className="td-user-name">{userName}</p>
              <p className="td-user-role">Giáo viên · Đăng xuất</p>
            </div>
            <LogOut size={15} style={{ color: '#475569', flexShrink: 0 }} />
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="td-main">
        {/* Topbar */}
        <header className="td-topbar">
          <div className="td-topbar-left">
            <h1>{isQuestionTab ? 'Ngân hàng câu hỏi' : 'Quản lý đề thi & Giao bài'}</h1>
            <p>Xin chào, {userName.split(' ').slice(-1)[0]}! Hôm nay là thứ {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}.</p>
          </div>
          <div className="td-topbar-right">
            <div className="td-search-box">
              <Search size={15} />
              <span>Tìm đề thi...</span>
            </div>
            <button className="td-icon-btn" title="Thông báo"><Bell size={17} /></button>
            {!isQuestionTab && (
              <button className="td-btn-primary" onClick={() => setShowCreateModal(true)}>
                <Plus size={16} /> Tạo kỳ thi
              </button>
            )}
          </div>
        </header>

        {isQuestionTab ? (
          <QuestionBank />
        ) : (
        <div className="td-content">
          {/* Stats */}
          <div className="td-stats-row">
            {stats.map((s, i) => (
              <div key={i} className="td-stat-card">
                <div className="td-stat-icon" style={{ background: s.color }}>{s.icon}</div>
                <div className="td-stat-body">
                  <p className="td-stat-label">{s.label}</p>
                  <p className="td-stat-value">{s.value}</p>
                  <p className="td-stat-sub">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Main Grid */}
          <div className="td-main-grid">
            {/* Exam Table */}
            <div className="td-section-card">
              <div className="td-section-header">
                <h2>Danh sách đề thi</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['all','open','upcoming','closed','draft'].map(s => (
                    <button
                      key={s}
                      className="td-btn-ghost"
                      style={{ fontWeight: filterStatus === s ? 700 : 400, color: filterStatus === s ? '#a78bfa' : undefined }}
                      onClick={() => setFilterStatus(s)}
                    >
                      {s === 'all' ? 'Tất cả' : s === 'open' ? 'Đang mở' : s === 'upcoming' ? 'Sắp thi' : s === 'closed' ? 'Kết thúc' : 'Nháp'}
                    </button>
                  ))}
                </div>
              </div>

              {filteredExams.length === 0 ? (
                <div className="td-empty">
                  <ClipboardList size={56} />
                  <h3>Chưa có đề thi nào</h3>
                  <p>Nhấn <strong>Tạo kỳ thi</strong> để bắt đầu.</p>
                </div>
              ) : (
                <table className="td-exam-table">
                  <thead>
                    <tr>
                      <th>Đề thi</th>
                      <th>Lớp</th>
                      <th>Câu hỏi</th>
                      <th>Thời gian</th>
                      <th>Nộp bài</th>
                      <th>Trạng thái</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExams.map(exam => (
                      <tr key={exam.id}>
                        <td>
                          <div className="td-exam-name">{exam.name}</div>
                          <div className="td-exam-subject">{exam.subject} · {exam.startTime}</div>
                        </td>
                        <td style={{ color: '#94a3b8', fontSize: 13 }}>{exam.class}</td>
                        <td style={{ fontWeight: 600, color: '#a78bfa' }}>{exam.questions}</td>
                        <td>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#94a3b8', fontSize: 13 }}>
                            <Clock size={13} />{exam.duration} phút
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>
                            {exam.submissions}
                            <span style={{ color: '#475569', fontWeight: 400 }}>/{exam.totalStudents}</span>
                          </span>
                        </td>
                        <td><StatusBadge status={exam.status} /></td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="td-btn-ghost" title="Xem chi tiết"><Eye size={14} /></button>
                            <button className="td-btn-ghost" title="Chỉnh sửa"><Edit3 size={14} /></button>
                            <button className="td-btn-ghost" title="Xóa" style={{ color: '#f87171' }}
                              onClick={() => setExams(prev => prev.filter(e => e.id !== exam.id))}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Quick Panel */}
            <div>
              <div className="td-section-card" style={{ marginBottom: 20 }}>
                <div className="td-section-header"><h2>Thao tác nhanh</h2></div>
                <div className="td-quick-panel">
                  <button className="td-quick-btn" onClick={() => setShowCreateModal(true)}>
                    <div className="td-quick-btn-icon" style={{ background: 'rgba(167,139,250,0.15)' }}>✨</div>
                    <div className="td-quick-btn-body">
                      <p className="td-quick-btn-title">Tạo kỳ thi mới</p>
                      <p className="td-quick-btn-desc">Thiết lập đề thi cho lớp học</p>
                    </div>
                    <ChevronRight size={16} style={{ color: '#475569' }} />
                  </button>

                  <button className="td-quick-btn">
                    <div className="td-quick-btn-icon" style={{ background: 'rgba(96,165,250,0.15)' }}>📝</div>
                    <div className="td-quick-btn-body">
                      <p className="td-quick-btn-title">Thêm câu hỏi</p>
                      <p className="td-quick-btn-desc">Mở rộng ngân hàng câu hỏi</p>
                    </div>
                    <ChevronRight size={16} style={{ color: '#475569' }} />
                  </button>

                  <button className="td-quick-btn">
                    <div className="td-quick-btn-icon" style={{ background: 'rgba(251,191,36,0.15)' }}>🤖</div>
                    <div className="td-quick-btn-body">
                      <p className="td-quick-btn-title">AI tạo đề thi</p>
                      <p className="td-quick-btn-desc">Tự động sinh câu hỏi bằng AI</p>
                    </div>
                    <ChevronRight size={16} style={{ color: '#475569' }} />
                  </button>

                  <button className="td-quick-btn">
                    <div className="td-quick-btn-icon" style={{ background: 'rgba(52,211,153,0.15)' }}>📊</div>
                    <div className="td-quick-btn-body">
                      <p className="td-quick-btn-title">Xem kết quả</p>
                      <p className="td-quick-btn-desc">Phân tích điểm số học sinh</p>
                    </div>
                    <ChevronRight size={16} style={{ color: '#475569' }} />
                  </button>
                </div>
              </div>

              {/* Activity */}
              <div className="td-section-card">
                <div className="td-section-header"><h2>Hoạt động gần đây</h2></div>
                <div style={{ padding: '12px 20px' }}>
                  {[
                    { icon: '✅', text: '21 học sinh đã nộp bài kỳ thi N4', time: '2 giờ trước', color: '#34d399' },
                    { icon: '🆕', text: 'Bạn vừa tạo đề thi IELTS Reading', time: '1 ngày trước', color: '#a78bfa' },
                    { icon: '⚠️', text: '6 học sinh chưa nộp bài kỳ thi N4', time: '1 ngày trước', color: '#fbbf24' },
                  ].map((a, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0',
                      borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    }}>
                      <span style={{ fontSize: 18, lineHeight: 1 }}>{a.icon}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 13, color: '#e2e8f0', lineHeight: 1.4 }}>{a.text}</p>
                        <p style={{ margin: '3px 0 0', fontSize: 11.5, color: '#475569' }}>{a.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        )}
      </main>

      {/* ── CREATE EXAM MODAL ── */}
      {showCreateModal && (
        <CreateExamModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
