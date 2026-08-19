import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard, FileText, Award, Clock, CheckCircle2, Trophy, Flame,
  ChevronRight, Search,
} from "lucide-react";

/* ============================================================
   TOKENS — "Sổ Điểm Chung": cuốn sổ điểm giấy dùng chung.
   Vai trò Học sinh viết bằng mực xanh lá.
   ============================================================ */
const TOKENS = `
@import url('https://fonts.googleapis.com/css2?family=Spectral:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

.gb-root{
  --paper:#EEF0E4;
  --paper-card:#FBFAF3;
  --paper-line:#DBE3D2;
  --border-soft:#DCE3D2;
  --text-soft:#6B7268;
  --text-faint:#98998C;
  --correction:#AF3A2E;
  --seal:#9A6B22;
  --seal-soft:#F3E7CB;
  --ink:#33684A;
  --ink-soft:#64977A;
  --ink-wash:#E2EDE5;
  --ink-dim:#EEF4EF;
  --font-display:'Spectral',serif;
  --font-body:'Inter',sans-serif;
  --font-mono:'JetBrains Mono',monospace;
  font-family:var(--font-body);
  color:#1E2A3A;
  background:var(--paper);
}
.gb-root *{box-sizing:border-box;}
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
.gb-opt{transition:background .12s ease, border-color .12s ease; cursor:pointer;}
`;

/* ---------------- Mock data ---------------- */
const UPCOMING = [
  { id: 1, title: "Kiểm tra 15 phút - Kanji bài 6-10", cls: "N4 - Lớp tối Thứ 3/5", start: "19:00 16/08", duration: 15, canStart: true },
  { id: 2, title: "Giữa kỳ - Đại số chương 3", cls: "Toán 9A - Ôn thi vào 10", start: "08:00 20/08", duration: 45, canStart: false },
];

const QUESTIONS = [
  { id: "q1", text: "Chọn cách đọc đúng của Kanji 「先生」", options: ["せんせい", "がくせい", "せんぱい", "きょうし"] },
  { id: "q2", text: "「今日は　＿＿＿　です。」— Điền từ còn thiếu chỉ thời tiết đẹp", options: ["あめ", "はれ", "くもり", "ゆき"] },
  { id: "q3", text: "Chọn trợ từ đúng: 「わたし＿がっこうへ行きます。」", options: ["は", "を", "に", "で"] },
  { id: "q4", text: "Từ nào có nghĩa là 'thư viện'?", options: ["としょかん", "びょういん", "ぎんこう", "こうえん"] },
  { id: "q5", text: "Chọn dạng lịch sự đúng của động từ 「食べる」", options: ["たべます", "たべない", "たべて", "たべた"] },
];

const LEADERBOARD = [
  { rank: 1, name: "Lê Minh C", score: 9.0 },
  { rank: 2, name: "Nguyễn Văn A", score: 8.5 },
  { rank: 3, name: "Phạm Thu D (Bạn)", score: 7.5, self: true },
  { rank: 4, name: "Đỗ Gia F", score: 7.0 },
  { rank: 5, name: "Hoàng Văn E", score: 3.5 },
];

const NAV = [
  { id: "dashboard", label: "Bảng tin", icon: LayoutDashboard },
  { id: "exam", label: "Làm bài thi", icon: FileText },
  { id: "results", label: "Kết quả & Xếp hạng", icon: Award },
];

/* ---------------- Primitives ---------------- */
function Stamp({ children, color = "var(--seal)", icon: Icon }) {
  return <span className="gb-stamp" style={{ color }}>{Icon && <Icon size={12} />}{children}</span>;
}

function StatCard({ label, value }) {
  return (
    <div className="gb-card gb-hover" style={{ padding: "18px 20px" }}>
      <p style={{ fontSize: 12, color: "var(--text-soft)", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{label}</p>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 32, fontWeight: 700, margin: "8px 0 0", color: "var(--ink)" }}>{value}</p>
    </div>
  );
}

function SectionHeading({ eyebrow, title }) {
  return (
    <div style={{ marginBottom: 20 }}>
      {eyebrow && <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink)", margin: "0 0 5px" }}>{eyebrow}</p>}
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 26, margin: 0 }}>{title}</h2>
    </div>
  );
}

function PenButton({ children, onClick, icon: Icon }) {
  return (
    <button className="gb-btn" onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 13.5,
      padding: "10px 18px", borderRadius: 8,
      background: "var(--ink)", color: "var(--paper-card)", border: "1.5px solid var(--ink)",
    }}>
      {Icon && <Icon size={15} />}{children}
    </button>
  );
}

/* ---------------- Views ---------------- */
function Dashboard({ goExam }) {
  return (
    <div>
      <SectionHeading eyebrow="Trang 01 · Lịch của bạn" title="Bảng tin" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard label="Lớp đang học" value="2" />
        <StatCard label="Điểm trung bình" value="7.8" />
        <StatCard label="Bài thi sắp tới" value={UPCOMING.length} />
      </div>
      <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, margin: "0 0 14px" }}>Bài thi sắp tới</p>
      <div style={{ display: "grid", gap: 12 }}>
        {UPCOMING.map((e) => (
          <div key={e.id} className="gb-card gb-hover" style={{ padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{e.title}</p>
              <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--text-soft)" }}>{e.cls} · {e.start} · {e.duration} phút</p>
            </div>
            {e.canStart ? <PenButton icon={FileText} onClick={goExam}>Vào phòng thi</PenButton> : <span style={{ fontSize: 12.5, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>Chưa mở</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function AnswerSheet({ total, current, answered }) {
  return (
    <div className="gb-card" style={{ padding: "18px 20px", position: "sticky", top: 0 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" }}>Phiếu trả lời</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 9 }}>
        {Array.from({ length: total }).map((_, i) => {
          const isAnswered = answered.has(i);
          const isCurrent = i === current;
          return (
            <div key={i} style={{
              width: 32, height: 32, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 700,
              border: `2px solid ${isCurrent || isAnswered ? "var(--ink)" : "var(--border-soft)"}`,
              background: isAnswered ? "var(--ink)" : "transparent",
              color: isAnswered ? "var(--paper-card)" : "var(--ink)",
            }}>{i + 1}</div>
          );
        })}
      </div>
      <p style={{ fontSize: 12, color: "var(--text-soft)", marginTop: 14, marginBottom: 0 }}>{answered.size}/{total} câu đã tô</p>
    </div>
  );
}

function ExamView({ goResults }) {
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [seconds, setSeconds] = useState(15 * 60);
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const low = seconds <= 60;

  const choose = (qIdx, optIdx) => setAnswers((a) => ({ ...a, [qIdx]: optIdx }));
  const answeredSet = new Set(Object.keys(answers).map(Number));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink)", margin: "0 0 5px" }}>N4 · Kiểm tra 15 phút</p>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 26, margin: 0 }}>Kanji bài 6–10</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700, color: low ? "var(--correction)" : "var(--ink)", background: low ? "#F5DED9" : "var(--ink-wash)", padding: "8px 16px", borderRadius: 10 }}>
          <Clock size={19} />{mm}:{ss}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 210px", gap: 18 }}>
        <div style={{ display: "grid", gap: 16 }}>
          {QUESTIONS.map((q, qi) => (
            <div key={q.id} className="gb-card" style={{ padding: "20px 22px", borderColor: qi === current ? "var(--ink)" : "var(--border-soft)" }} onFocus={() => setCurrent(qi)}>
              <p style={{ margin: "0 0 15px", fontSize: 15, fontWeight: 500 }}>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink)", marginRight: 8 }}>Câu {qi + 1}.</span>{q.text}
              </p>
              <div style={{ display: "grid", gap: 9 }}>
                {q.options.map((opt, oi) => {
                  const letter = String.fromCharCode(65 + oi);
                  const selected = answers[qi] === oi;
                  return (
                    <button key={oi} className="gb-opt" onClick={() => { choose(qi, oi); setCurrent(qi); }} style={{
                      display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                      padding: "10px 13px", borderRadius: 8,
                      border: `1.5px solid ${selected ? "var(--ink)" : "var(--border-soft)"}`,
                      background: selected ? "var(--ink-wash)" : "transparent",
                      fontFamily: "var(--font-body)", fontSize: 14,
                    }}>
                      <span style={{
                        width: 27, height: 27, borderRadius: "50%", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12.5,
                        border: "2px solid var(--ink)",
                        background: selected ? "var(--ink)" : "transparent",
                        color: selected ? "var(--paper-card)" : "var(--ink)",
                      }}>{letter}</span>
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <PenButton icon={CheckCircle2} onClick={goResults}>Nộp bài</PenButton>
        </div>

        <AnswerSheet total={QUESTIONS.length} current={current} answered={answeredSet} />
      </div>
    </div>
  );
}

function ResultsView() {
  return (
    <div>
      <SectionHeading eyebrow="Trang 03 · Đã chấm" title="Kết quả & xếp hạng" />
      <div style={{ display: "grid", gridTemplateColumns: "270px 1fr", gap: 18 }}>
        <div className="gb-card" style={{ padding: "24px", textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>Kanji bài 6–10</p>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 48, fontWeight: 700, color: "var(--ink)", margin: 0 }}>7.5</p>
          <p style={{ fontSize: 12.5, color: "var(--text-soft)", margin: "2px 0 18px" }}>/ 10 điểm</p>
          <Stamp color="var(--ink)" icon={CheckCircle2}>ĐÃ CHẤM</Stamp>
        </div>

        <div className="gb-card" style={{ padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Trophy size={17} color="var(--seal)" />
            <p style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17 }}>Bảng xếp hạng lớp</p>
          </div>
          {LEADERBOARD.map((r) => (
            <div key={r.rank} className="gb-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 8px", borderBottom: "1px solid var(--paper-line)", background: r.self ? "var(--ink-wash)" : "transparent", borderRadius: r.self ? 8 : 0 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, width: 22, color: r.rank <= 3 ? "var(--seal)" : "var(--text-soft)" }}>{r.rank}</span>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: r.self ? 600 : 400 }}>{r.name}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{r.score.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="gb-card" style={{ padding: "20px 22px", marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Flame size={17} color="var(--seal)" />
          <p style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17 }}>Nhận xét từ AI</p>
        </div>
        <p style={{ margin: 0, fontSize: 13.5, color: "#3F4A57", lineHeight: 1.6 }}>
          Bạn làm tốt phần Kanji hành động, nhưng còn sai 2/10 câu về Kanji chỉ thời gian.
          Gợi ý ôn lại bài 8 trước khi vào bài kiểm tra tiếp theo.
        </p>
      </div>
    </div>
  );
}

/* ---------------- Shell ---------------- */
export default function StudentApp() {
  const [tab, setTab] = useState("dashboard");
  const content = {
    dashboard: <Dashboard goExam={() => setTab("exam")} />,
    exam: <ExamView goResults={() => setTab("results")} />,
    results: <ResultsView />,
  }[tab];

  return (
    <div className="gb-root" style={{ borderRadius: 16, overflow: "hidden", border: "1px solid var(--border-soft)", boxShadow: "0 10px 30px rgba(30,42,58,0.08)" }}>
      <style>{TOKENS}</style>

      <div style={{ background: "var(--ink)", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--paper-card)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink)" }}>
            <Award size={19} />
          </div>
          <div>
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, margin: 0, color: "var(--paper-card)" }}>Sổ Điểm Chung</p>
            <p style={{ fontSize: 11, color: "#B9D2C2", margin: 0 }}>Bảng điều khiển Học sinh</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px" }}>
            <Search size={14} color="#B9D2C2" />
            <span style={{ fontSize: 12.5, color: "#B9D2C2" }}>Tìm lớp, bài thi...</span>
          </div>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--seal-soft)", color: "var(--seal)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12.5 }}>PD</div>
        </div>
      </div>

      <div style={{ display: "flex", minHeight: 620 }}>
        <div style={{ width: 236, background: "var(--paper-card)", borderRight: "1px solid var(--border-soft)", padding: "20px 12px", flexShrink: 0, position: "relative" }}>
          <div style={{ position: "absolute", top: -1, left: 20, background: "var(--ink)", color: "var(--paper-card)", fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", padding: "5px 12px", borderRadius: "0 0 7px 7px" }}>
            HỒ SƠ HỌC SINH
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
