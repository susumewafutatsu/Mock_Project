import React, { useState } from "react";
import {
  LayoutDashboard, BookOpen, Users, Bell, Cloud, ShieldCheck, Radio,
  Upload, Mail, MessageCircle, PlusCircle, ChevronRight, Search,
} from "lucide-react";

/* ============================================================
   TOKENS — "Sổ Điểm Chung": cuốn sổ điểm giấy dùng chung.
   Vai trò Quản trị viên viết bằng mực đen.
   ============================================================ */
const TOKENS = `
@import url('https://fonts.googleapis.com/css2?family=Spectral:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

.gb-root{
  --paper:#EEF0E3;
  --paper-card:#FBFAF3;
  --paper-line:#DDE3D1;
  --border-soft:#DCE1D1;
  --text-soft:#6B7268;
  --text-faint:#98998C;
  --correction:#AF3A2E;
  --correction-soft:#F5DED9;
  --seal:#9A6B22;
  --seal-soft:#F3E7CB;
  --ink:#1E2A3A;
  --ink-soft:#4C5A6B;
  --ink-wash:#E7E9EC;
  --ink-dim:#EFF1F3;
  --font-display:'Spectral',serif;
  --font-body:'Inter',sans-serif;
  --font-mono:'JetBrains Mono',monospace;
  font-family:var(--font-body);
  color:var(--ink);
  background:var(--paper);
}
.gb-root *{box-sizing:border-box;}
.gb-ruled{ background-image:repeating-linear-gradient(to bottom, transparent, transparent 30px, var(--paper-line) 31px); }
.gb-card{
  background:var(--paper-card);
  border:1px solid var(--border-soft);
  border-radius:11px;
  box-shadow:0 1px 2px rgba(30,42,58,0.04), 0 6px 16px rgba(30,42,58,0.05);
  transition:box-shadow .18s ease, transform .18s ease;
}
.gb-card.gb-hover:hover{ box-shadow:0 2px 4px rgba(30,42,58,0.06), 0 10px 22px rgba(30,42,58,0.08); transform:translateY(-2px); }
.gb-stamp{
  font-family:var(--font-mono); font-weight:700; letter-spacing:0.06em;
  border:2px dashed currentColor; border-radius:999px; padding:5px 12px;
  transform:rotate(-5deg); display:inline-flex; align-items:center; gap:6px; font-size:11px; white-space:nowrap;
}
.gb-scrollbar::-webkit-scrollbar{width:8px;}
.gb-scrollbar::-webkit-scrollbar-thumb{background:var(--border-soft);border-radius:4px;}
.gb-nav-item{transition:background .12s ease, color .12s ease; cursor:pointer;}
.gb-nav-item:hover{background:var(--ink-dim);}
.gb-row{transition:background .12s ease;}
.gb-row:hover{background:#F4F2E7;}
.gb-btn{transition:filter .12s ease, transform .1s ease; cursor:pointer;}
.gb-btn:hover{filter:brightness(1.08);}
.gb-btn:active{transform:scale(0.98);}
`;

/* ---------------- Mock data ---------------- */
const SUBJECTS = [
  { id: 1, name: "Toán", levels: ["Lớp 6", "Lớp 7", "Lớp 8", "Lớp 9"], banks: 14 },
  { id: 2, name: "Tiếng Nhật", levels: ["N5", "N4", "N3", "N2", "N1"], banks: 22 },
  { id: 3, name: "Tiếng Anh", levels: ["A1", "A2", "B1", "B2"], banks: 18 },
];

const CLASSES = [
  { id: 1, name: "N4 - Lớp tối Thứ 3/5", subject: "Tiếng Nhật", level: "N4", teacher: "Cô Lan", students: 32, synced: true },
  { id: 2, name: "Toán 9A - Ôn thi vào 10", subject: "Toán", level: "Lớp 9", teacher: "Thầy Huy", students: 41, synced: true },
  { id: 3, name: "IELTS Foundation B1", subject: "Tiếng Anh", level: "B1", teacher: "Cô Mai", students: 27, synced: false },
];

const NOTIFICATIONS = [
  { channel: "EMAIL", subject: "Nhắc lịch thi Giữa kỳ - Toán 9A", status: "Đã gửi", time: "15/08 09:12" },
  { channel: "ZALO", subject: "Kết quả bài kiểm tra Kanji đã có", status: "Đã gửi", time: "15/08 20:45" },
  { channel: "AWS_SNS", subject: "Cảnh báo học sinh nguy cơ yếu - Trần Thị B", status: "Đang xử lý", time: "16/08 07:30" },
  { channel: "EMAIL", subject: "Đồng bộ điểm lên Google Classroom thất bại", status: "Lỗi", time: "16/08 08:02" },
];

const WEEKLY_SIGNUPS = [6, 9, 4, 11, 14, 7, 12];
const DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const NAV = [
  { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
  { id: "academics", label: "Môn học & Trình độ", icon: BookOpen },
  { id: "orgs", label: "Người dùng & Lớp học", icon: Users },
  { id: "logs", label: "Nhật ký thông báo", icon: Bell },
];

/* ---------------- Primitives ---------------- */
function Stamp({ children, color = "var(--seal)", icon: Icon }) {
  return <span className="gb-stamp" style={{ color }}>{Icon && <Icon size={12} />}{children}</span>;
}

function StatCard({ label, value, sub }) {
  return (
    <div className="gb-card gb-hover" style={{ padding: "18px 20px" }}>
      <p style={{ fontSize: 12, color: "var(--text-soft)", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{label}</p>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 32, fontWeight: 700, margin: "8px 0 0", color: "var(--ink)" }}>{value}</p>
      {sub && <p style={{ fontSize: 12.5, color: "var(--text-soft)", margin: "5px 0 0" }}>{sub}</p>}
    </div>
  );
}

function SectionHeading({ eyebrow, title, action }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
      <div>
        {eyebrow && <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink)", margin: "0 0 5px" }}>{eyebrow}</p>}
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 26, margin: 0 }}>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function PenButton({ children, onClick, icon: Icon, variant = "solid" }) {
  const solid = variant === "solid";
  return (
    <button className="gb-btn" onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 13.5,
      padding: "10px 18px", borderRadius: 8,
      background: solid ? "var(--ink)" : "transparent",
      color: solid ? "var(--paper-card)" : "var(--ink)",
      border: "1.5px solid var(--ink)",
    }}>
      {Icon && <Icon size={15} />}{children}
    </button>
  );
}

function ChannelIcon({ channel }) {
  if (channel === "EMAIL") return <Mail size={14} />;
  if (channel === "ZALO") return <MessageCircle size={14} />;
  return <Radio size={14} />;
}

function StatusPill({ status }) {
  const map = {
    "Đã gửi": { bg: "var(--ink-wash)", fg: "var(--ink)" },
    "Đang xử lý": { bg: "var(--seal-soft)", fg: "var(--seal)" },
    "Lỗi": { bg: "var(--correction-soft)", fg: "var(--correction)" },
  };
  const s = map[status] || { bg: "#EEE", fg: "#555" };
  return <span style={{ background: s.bg, color: s.fg, fontSize: 12, fontWeight: 600, padding: "4px 11px", borderRadius: 999, whiteSpace: "nowrap" }}>{status}</span>;
}

/* ---------------- Views ---------------- */
function Overview() {
  const max = Math.max(...WEEKLY_SIGNUPS);
  return (
    <div>
      <SectionHeading eyebrow="Trang 01 · Sổ cái hệ thống" title="Tổng quan hệ thống" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard label="Giáo viên" value="12" sub="+2 tháng này" />
        <StatCard label="Học sinh" value="248" sub="+18 tháng này" />
        <StatCard label="Lớp học" value={CLASSES.length} sub="4 môn học" />
        <StatCard label="Đề thi đang mở" value="1" sub="24 đề đã tạo" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18 }}>
        <div className="gb-card" style={{ padding: "20px 22px" }}>
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17, margin: "0 0 4px" }}>Học sinh đăng ký mới</p>
          <p style={{ fontSize: 12.5, color: "var(--text-soft)", margin: "0 0 20px" }}>7 ngày gần nhất</p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 120 }}>
            {WEEKLY_SIGNUPS.map((v, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ width: "100%", maxWidth: 30, height: `${(v / max) * 90}px`, background: "var(--ink)", borderRadius: "4px 4px 2px 2px", opacity: 0.15 + (v / max) * 0.85 }} />
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-soft)" }}>{DAYS[i]}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border-soft)" }}>
            {[
              { text: "Thầy Huy đã tạo đề \u201cGiữa kỳ - Đại số chương 3\u201d", time: "2 giờ trước" },
              { text: "Cô Mai đồng bộ điểm lớp IELTS Foundation B1 thất bại", time: "5 giờ trước" },
              { text: "AI phát hiện 2 học sinh có nguy cơ học lực yếu ở lớp N4", time: "hôm qua" },
            ].map((a, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0" }}>
                <p style={{ margin: 0, fontSize: 13.5 }}>{a.text}</p>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-faint)", whiteSpace: "nowrap" }}>{a.time}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="gb-card" style={{ padding: "20px 22px" }}>
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17, margin: "0 0 14px" }}>Tích hợp 3rd-party</p>
          {[
            { name: "Google Classroom API", icon: Cloud, ok: true },
            { name: "Google / Microsoft SSO", icon: ShieldCheck, ok: true },
            { name: "AWS SNS + Zalo Notify", icon: Radio, ok: true },
            { name: "Google Drive / OneDrive backup", icon: Upload, ok: false },
          ].map((it, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 0", borderBottom: i < 3 ? "1px solid var(--paper-line)" : "none" }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: it.ok ? "var(--ink-wash)" : "var(--correction-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <it.icon size={15} color={it.ok ? "var(--ink)" : "var(--correction)"} />
              </div>
              <span style={{ fontSize: 13.5, flex: 1 }}>{it.name}</span>
              <Stamp color={it.ok ? "var(--ink)" : "var(--correction)"}>{it.ok ? "ỔN ĐỊNH" : "GIÁN ĐOẠN"}</Stamp>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Academics() {
  return (
    <div>
      <SectionHeading eyebrow="Trang 02 · Danh mục" title="Môn học & trình độ" action={<PenButton icon={PlusCircle}>Thêm môn học</PenButton>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {SUBJECTS.map((s) => (
          <div key={s.id} className="gb-card gb-hover" style={{ padding: "20px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 19, margin: 0 }}>{s.name}</p>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-soft)" }}>{s.banks} ngân hàng</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 14 }}>
              {s.levels.map((l) => (
                <span key={l} style={{ fontSize: 12, fontFamily: "var(--font-mono)", background: "var(--ink-wash)", color: "var(--ink)", borderRadius: 999, padding: "4px 10px" }}>{l}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Orgs() {
  return (
    <div>
      <SectionHeading eyebrow="Trang 03 · Sổ đăng ký" title="Người dùng & lớp học" />
      <div className="gb-card" style={{ overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.2fr 1fr 1fr", padding: "12px 20px", borderBottom: "1px solid var(--border-soft)", fontSize: 12, color: "var(--text-soft)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          <span>Lớp học</span><span>Môn / Trình độ</span><span>Giáo viên</span><span>Sĩ số</span><span>Đồng bộ</span>
        </div>
        {CLASSES.map((c, i) => (
          <div key={c.id} className="gb-row" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.2fr 1fr 1fr", padding: "14px 20px", alignItems: "center", borderBottom: i < CLASSES.length - 1 ? "1px solid var(--border-soft)" : "none", fontSize: 13.5 }}>
            <span style={{ fontWeight: 500 }}>{c.name}</span>
            <span style={{ color: "var(--text-soft)" }}>{c.subject} · {c.level}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--ink-wash)", color: "var(--ink)", fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {c.teacher.split(" ").slice(-1)[0][0]}
              </span>
              {c.teacher}
            </span>
            <span style={{ fontFamily: "var(--font-mono)" }}>{c.students}</span>
            {c.synced ? <Stamp color="var(--ink)" icon={Cloud}>ĐỒNG BỘ</Stamp> : <span style={{ color: "var(--correction)", fontSize: 12, fontWeight: 600 }}>Chưa đồng bộ</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Logs() {
  return (
    <div>
      <SectionHeading eyebrow="Trang 04 · Nhật ký gửi" title="Thông báo (Email · Zalo · AWS SNS)" />
      <div className="gb-card" style={{ overflow: "hidden" }}>
        {NOTIFICATIONS.map((n, i) => (
          <div key={i} className="gb-row" style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: i < NOTIFICATIONS.length - 1 ? "1px solid var(--border-soft)" : "none" }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--ink-wash)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink)", flexShrink: 0 }}>
              <ChannelIcon channel={n.channel} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13.5 }}>{n.subject}</p>
              <p style={{ margin: "3px 0 0", fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}>{n.channel} · {n.time}</p>
            </div>
            <StatusPill status={n.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Shell ---------------- */
export default function AdminApp() {
  const [tab, setTab] = useState("overview");
  const content = { overview: <Overview />, academics: <Academics />, orgs: <Orgs />, logs: <Logs /> }[tab];

  return (
    <div className="gb-root" style={{ borderRadius: 16, overflow: "hidden", border: "1px solid var(--border-soft)", boxShadow: "0 10px 30px rgba(30,42,58,0.08)" }}>
      <style>{TOKENS}</style>

      {/* Header */}
      <div style={{ background: "var(--ink)", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--paper-card)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink)" }}>
            <BookOpen size={19} />
          </div>
          <div>
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, margin: 0, color: "var(--paper-card)" }}>Sổ Điểm Chung</p>
            <p style={{ fontSize: 11, color: "#AEB6C0", margin: 0 }}>Bảng điều khiển Quản trị viên</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 12px" }}>
            <Search size={14} color="#AEB6C0" />
            <span style={{ fontSize: 12.5, color: "#AEB6C0" }}>Tìm lớp, học sinh, đề thi...</span>
          </div>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--seal-soft)", color: "var(--seal)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12.5 }}>AD</div>
        </div>
      </div>

      <div style={{ display: "flex", minHeight: 620 }}>
        {/* Sidebar */}
        <div style={{ width: 236, background: "var(--paper-card)", borderRight: "1px solid var(--border-soft)", padding: "20px 12px", flexShrink: 0, position: "relative" }}>
          <div style={{ position: "absolute", top: -1, left: 20, background: "var(--ink)", color: "var(--paper-card)", fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", padding: "5px 12px", borderRadius: "0 0 7px 7px" }}>
            HỒ SƠ QUẢN TRỊ
          </div>
          <div style={{ height: 22 }} />
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.id === tab;
            return (
              <button key={item.id} className="gb-nav-item" onClick={() => setTab(item.id)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "11px 13px", marginBottom: 4, borderRadius: 8, border: "none",
                textAlign: "left", fontSize: 13.5, fontFamily: "var(--font-body)",
                background: active ? "var(--ink-wash)" : "transparent",
                color: active ? "var(--ink)" : "var(--ink-soft)",
                fontWeight: active ? 600 : 500,
              }}>
                <Icon size={16} />{item.label}
                {active && <ChevronRight size={14} style={{ marginLeft: "auto" }} />}
              </button>
            );
          })}
        </div>

        {/* Main */}
        <div className="gb-scrollbar" style={{ flex: 1, padding: "28px 30px", overflowY: "auto", maxHeight: 760 }}>
          {content}
        </div>
      </div>
    </div>
  );
}
