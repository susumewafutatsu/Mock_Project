import React, { useState } from "react";
import {
  GraduationCap, Layers, Sparkles, TrendingUp, Users, Cloud, Upload,
  PlusCircle, Zap, CheckCircle2, AlertTriangle, ChevronRight, Search,
} from "lucide-react";

/* ============================================================
   TOKENS — "Sổ Điểm Chung": cuốn sổ điểm giấy dùng chung.
   Vai trò Giáo viên viết bằng mực xanh.
   ============================================================ */
const TOKENS = `
@import url('https://fonts.googleapis.com/css2?family=Spectral:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

.gb-root{
  --paper:#EDF0E5;
  --paper-card:#FBFAF4;
  --paper-line:#DAE1D5;
  --border-soft:#DBE2D3;
  --text-soft:#6B7268;
  --text-faint:#98998C;
  --correction:#AF3A2E;
  --correction-soft:#F5DED9;
  --seal:#9A6B22;
  --seal-soft:#F3E7CB;
  --ink:#2C4A73;
  --ink-soft:#5A7DA3;
  --ink-wash:#E3EAF3;
  --ink-dim:#EEF2F7;
  --font-display:'Spectral',serif;
  --font-body:'Inter',sans-serif;
  --font-mono:'JetBrains Mono',monospace;
  font-family:var(--font-body);
  color:#1E2A3A;
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
const CLASSES = [
  { id: 1, name: "N4 - Lớp tối Thứ 3/5", subject: "Tiếng Nhật", level: "N4", students: 32, synced: true },
  { id: 2, name: "Toán 9A - Ôn thi vào 10", subject: "Toán", level: "Lớp 9", students: 41, synced: true },
  { id: 3, name: "IELTS Foundation B1", subject: "Tiếng Anh", level: "B1", students: 27, synced: false },
];

const QUESTION_BANKS = [
  { id: 1, title: "Ngữ pháp N4 - Chương 1 đến 5", level: "N4", count: 120, ai: 62, source: "Minna no Nihongo - Ch1-5.pdf" },
  { id: 2, title: "Đại số - Phương trình bậc hai", level: "Lớp 9", count: 85, ai: 20, source: "Nhập tay" },
  { id: 3, title: "Từ vựng chủ đề Môi trường", level: "B1", count: 60, ai: 60, source: "Cambridge B1 Wordlist.docx" },
  { id: 4, title: "Kanji N5 - Bộ 100 chữ đầu", level: "N5", count: 100, ai: 100, source: "Kanji N5 List.xlsx" },
];

const RESULTS = [
  { student: "Nguyễn Văn A", score: 8.5, atRisk: false },
  { student: "Trần Thị B", score: 4.0, atRisk: true },
  { student: "Lê Minh C", score: 9.0, atRisk: false },
  { student: "Phạm Thu D", score: 5.5, atRisk: false },
  { student: "Hoàng Văn E", score: 3.5, atRisk: true },
  { student: "Đỗ Gia F", score: 7.0, atRisk: false },
];

const NAV = [
  { id: "classes", label: "Lớp học của tôi", icon: GraduationCap },
  { id: "bank", label: "Ngân hàng câu hỏi", icon: Layers },
  { id: "create", label: "Tạo đề thi", icon: Sparkles },
  { id: "results", label: "Kết quả học sinh", icon: TrendingUp },
];

/* ---------------- Primitives ---------------- */
function Stamp({ children, color = "var(--seal)", icon: Icon }) {
  return <span className="gb-stamp" style={{ color }}>{Icon && <Icon size={12} />}{children}</span>;
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

function PenButton({ children, onClick, icon: Icon, ink = "var(--ink)" }) {
  return (
    <button className="gb-btn" onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 13.5,
      padding: "10px 18px", borderRadius: 8,
      background: ink, color: "var(--paper-card)", border: `1.5px solid ${ink}`,
    }}>
      {Icon && <Icon size={15} />}{children}
    </button>
  );
}

function ProgressBar({ pct, color = "var(--ink)" }) {
  return (
    <div style={{ height: 6, background: "var(--paper-line)", borderRadius: 999, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999 }} />
    </div>
  );
}

/* ---------------- Views ---------------- */
function ClassesView() {
  return (
    <div>
      <SectionHeading eyebrow="Trang 01 · Lớp phụ trách" title="Lớp học của tôi" action={<PenButton icon={PlusCircle}>Tạo lớp mới</PenButton>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        {CLASSES.map((c) => (
          <div key={c.id} className="gb-card gb-hover" style={{ padding: "20px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <p style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, margin: 0 }}>{c.name}</p>
              {c.synced && <Stamp color="var(--ink)" icon={Cloud}>CLASSROOM</Stamp>}
            </div>
            <p style={{ fontSize: 13, color: "var(--text-soft)", margin: "7px 0 16px" }}>{c.subject} · {c.level}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--ink-wash)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Users size={14} color="var(--ink)" />
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13.5 }}>{c.students} học sinh</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BankView() {
  return (
    <div>
      <SectionHeading eyebrow="Trang 02 · Kho câu hỏi" title="Ngân hàng câu hỏi" action={<PenButton icon={Upload}>Tải tài liệu &amp; sinh AI</PenButton>} />
      <div style={{ display: "grid", gap: 14 }}>
        {QUESTION_BANKS.map((b) => (
          <div key={b.id} className="gb-card gb-hover" style={{ padding: "18px 22px", display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{b.title}</p>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, background: "var(--ink-wash)", color: "var(--ink)", borderRadius: 999, padding: "2px 9px" }}>{b.level}</span>
              </div>
              <p style={{ margin: "5px 0 10px", fontSize: 12.5, color: "var(--text-soft)" }}>{b.source} · {b.count} câu hỏi</p>
              <ProgressBar pct={(b.ai / b.count) * 100} color="var(--seal)" />
              <p style={{ margin: "6px 0 0", fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--seal)" }}>{b.ai}/{b.count} câu do AI sinh</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateView() {
  const [adaptive, setAdaptive] = useState(true);
  return (
    <div>
      <SectionHeading eyebrow="Trang 03 · Soạn đề" title="Tạo đề thi mới" />
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18 }}>
        <div className="gb-card" style={{ padding: "22px 24px" }}>
          <label style={{ fontSize: 12.5, color: "var(--text-soft)", fontWeight: 600 }}>Tên đề thi</label>
          <input defaultValue="Giữa kỳ - Đại số chương 3" style={{ width: "100%", marginTop: 7, marginBottom: 18, padding: "11px 13px", border: "1px solid var(--border-soft)", borderRadius: 8, fontSize: 14, fontFamily: "var(--font-body)", background: "var(--paper)" }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
            <div>
              <label style={{ fontSize: 12.5, color: "var(--text-soft)", fontWeight: 600 }}>Lớp áp dụng</label>
              <select style={{ width: "100%", marginTop: 7, padding: "11px 13px", border: "1px solid var(--border-soft)", borderRadius: 8, fontSize: 14, background: "var(--paper)" }}>
                {CLASSES.map((c) => <option key={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12.5, color: "var(--text-soft)", fontWeight: 600 }}>Thời gian làm bài (phút)</label>
              <input defaultValue="45" style={{ width: "100%", marginTop: 7, padding: "11px 13px", border: "1px solid var(--border-soft)", borderRadius: 8, fontSize: 14, fontFamily: "var(--font-mono)", background: "var(--paper)" }} />
            </div>
          </div>

          <div className="gb-card" style={{ background: "var(--seal-soft)", border: "1px dashed var(--seal)", padding: "16px 18px", marginBottom: 18, boxShadow: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
              <Sparkles size={16} color="var(--seal)" />
              <p style={{ margin: 0, fontWeight: 600, fontSize: 13.5, color: "var(--seal)" }}>Bonus AI</p>
            </div>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#6E4E17" }}>Sinh 25 câu trắc nghiệm tự động từ ngân hàng "Đại số - Phương trình bậc hai".</p>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <PenButton ink="var(--seal)" icon={Zap}>Sinh đề tự động</PenButton>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#6E4E17" }}>
                <input type="checkbox" checked={adaptive} onChange={(e) => setAdaptive(e.target.checked)} />
                Bật Adaptive Testing
              </label>
            </div>
          </div>

          <PenButton icon={CheckCircle2}>Lưu &amp; xuất bản đề thi</PenButton>
        </div>

        <div className="gb-card gb-ruled" style={{ padding: "22px 24px" }}>
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17, margin: "0 0 12px" }}>Xem trước cấu trúc đề</p>
          {[
            { label: "Câu dễ (mức 1-2)", n: 10 },
            { label: "Câu trung bình (mức 3)", n: 10 },
            { label: "Câu khó (mức 4-5)", n: 5 },
          ].map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--paper-line)" }}>
              <span style={{ fontSize: 13.5 }}>{r.label}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{r.n}</span>
            </div>
          ))}
          <p style={{ fontSize: 12, color: "var(--text-soft)", marginTop: 16 }}>
            {adaptive ? "Độ khó sẽ tự điều chỉnh theo năng lực từng học sinh trong lúc làm bài." : "Toàn bộ học sinh nhận cùng một đề cố định."}
          </p>
        </div>
      </div>
    </div>
  );
}

function ResultsView() {
  return (
    <div>
      <SectionHeading eyebrow="Trang 04 · Chấm điểm" title="Kết quả học sinh — Kanji bài 6-10" />
      <div className="gb-card" style={{ overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.3fr", padding: "12px 20px", borderBottom: "1px solid var(--border-soft)", fontSize: 12, color: "var(--text-soft)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          <span>Học sinh</span><span>Điểm</span><span>Cảnh báo AI</span>
        </div>
        {RESULTS.map((r, i) => (
          <div key={i} className="gb-row" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.3fr", padding: "14px 20px", alignItems: "center", borderBottom: i < RESULTS.length - 1 ? "1px solid var(--border-soft)" : "none", fontSize: 13.5 }}>
            <span>{r.student}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: r.score >= 5 ? "var(--ink)" : "var(--correction)" }}>{r.score.toFixed(1)}</span>
              <div style={{ width: 46 }}><ProgressBar pct={r.score * 10} color={r.score >= 5 ? "var(--ink)" : "var(--correction)"} /></div>
            </div>
            {r.atRisk ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--correction)", fontSize: 12.5, fontWeight: 600 }}>
                <AlertTriangle size={14} /> Nguy cơ học lực yếu
              </span>
            ) : <span style={{ color: "var(--text-faint)", fontSize: 12.5 }}>—</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Shell ---------------- */
export default function TeacherApp() {
  const [tab, setTab] = useState("classes");
  const content = { classes: <ClassesView />, bank: <BankView />, create: <CreateView />, results: <ResultsView /> }[tab];

  return (
    <div className="gb-root" style={{ borderRadius: 16, overflow: "hidden", border: "1px solid var(--border-soft)", boxShadow: "0 10px 30px rgba(30,42,58,0.08)" }}>
      <style>{TOKENS}</style>

      <div style={{ background: "var(--ink)", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--paper-card)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink)" }}>
            <GraduationCap size={19} />
          </div>
          <div>
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, margin: 0, color: "var(--paper-card)" }}>Sổ Điểm Chung</p>
            <p style={{ fontSize: 11, color: "#B8C6D8", margin: 0 }}>Bảng điều khiển Giáo viên</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px" }}>
            <Search size={14} color="#B8C6D8" />
            <span style={{ fontSize: 12.5, color: "#B8C6D8" }}>Tìm lớp, câu hỏi, đề thi...</span>
          </div>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--seal-soft)", color: "var(--seal)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12.5 }}>CL</div>
        </div>
      </div>

      <div style={{ display: "flex", minHeight: 620 }}>
        <div style={{ width: 236, background: "var(--paper-card)", borderRight: "1px solid var(--border-soft)", padding: "20px 12px", flexShrink: 0, position: "relative" }}>
          <div style={{ position: "absolute", top: -1, left: 20, background: "var(--ink)", color: "var(--paper-card)", fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", padding: "5px 12px", borderRadius: "0 0 7px 7px" }}>
            HỒ SƠ GIÁO VIÊN
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

        <div className="gb-scrollbar" style={{ flex: 1, padding: "28px 30px", overflowY: "auto", maxHeight: 760 }}>
          {content}
        </div>
      </div>
    </div>
  );
}
