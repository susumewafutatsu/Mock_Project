// src/pages/student/StudentRooms.jsx
// Phòng thi của học viên: vào phòng, sảnh chờ, làm bài và xem kết quả.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, ArrowLeft, CheckCircle, ChevronRight, Clock, DoorOpen, Eye,
  KeyRound, Loader2, LogOut, Play, School, Trophy, Users,
} from 'lucide-react';
import roomService from '../../services/roomService';
import { getRoomExams } from '../../services/examService';
import Leaderboard from '../../components/leaderboard/Leaderboard';

const POLL_MS = 5000;
const PING_MS = 20000;

const PHASE_TAG = {
  DRAFT:       { label: 'Chưa mở',     cls: 'phase-waiting' },
  WAITING:     { label: 'Sảnh chờ',    cls: 'phase-waiting' },
  IN_PROGRESS: { label: 'Đang thi',    cls: 'phase-live' },
  ENDED:       { label: 'Đã kết thúc', cls: 'phase-ended' },
};

/** "19:30 11/09" */
function formatWhen(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/** 3725 → "01:02:05" */
function formatClock(seconds) {
  const s = Math.max(0, seconds);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** Số giây còn lại tới `target`, theo đồng hồ server. */
function useCountdown(target, serverTime) {
  const [now, setNow] = useState(() => Date.now());
  const offset = useMemo(() => (serverTime ? Date.parse(serverTime) - Date.now() : 0), [serverTime]);
  useEffect(() => {
    if (!target) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (!target || !serverTime) return null;
  return Math.max(0, Math.round((Date.parse(target) - (now + offset)) / 1000));
}

// ─── Sảnh phòng ──────────────────────────────────────────────────

function MyResult({ board }) {
  if (!board) return null;
  const me = board.rows.find((r) => r.me) ?? board.myRow;
  if (!me) return null;
  const ranked = board.rows.filter((r) => r.rank != null).length;
  return (
    <div className="sd-card" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <Trophy size={28} color="var(--gold)" />
      {me.rank != null ? (
        <div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-mute)' }}>Kết quả của bạn</p>
          <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>
            Hạng {me.rank}/{Math.max(ranked, board.submittedCount ?? 0)} · {me.score}/{board.maxScore} điểm
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--ink-faint)' }}>
            {me.correctAnswers}/{board.totalQuestions} câu đúng
          </p>
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-mute)' }}>Bạn không nộp bài trong buổi thi này.</p>
      )}
    </div>
  );
}

function RoomLobby({ roomId, onBack, onEnterExam }) {
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [exam, setExam] = useState(null);
  const [error, setError] = useState(null);
  const [board, setBoard] = useState(null);
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, exams] = await Promise.all([roomService.getRoom(roomId), getRoomExams(roomId)]);
      setRoom(r);
      setExam((exams ?? [])[0] ?? null);
      setError(null);
    } catch (err) {
      setError(err.message || 'Không mở được phòng');
    }
  }, [roomId]);

  useEffect(() => { load(); }, [load]);

  const phase = room?.phase;
  useEffect(() => {
    if (phase !== 'WAITING' && phase !== 'IN_PROGRESS' && phase !== 'DRAFT') return undefined;
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [phase, load]);

  // Báo cho người ra đề biết mình đang ở sảnh.
  useEffect(() => {
    if (!phase || phase === 'ENDED') return undefined;
    const ping = () => roomService.ping(roomId).catch(() => {});
    ping();
    const id = setInterval(ping, PING_MS);
    return () => clearInterval(id);
  }, [phase, roomId]);

  useEffect(() => {
    if (phase !== 'ENDED') return;
    roomService.getLeaderboard(roomId).then(setBoard).catch(() => setBoard(null));
  }, [phase, roomId]);

  const target = phase === 'IN_PROGRESS' ? room.endTime : phase === 'WAITING' ? room.startTime : null;
  const left = useCountdown(target, room?.serverTime);

  const leave = async () => {
    if (!window.confirm(`Rời phòng "${room.name}"?`)) return;
    setLeaving(true);
    try {
      await roomService.leaveRoom(roomId);
      onBack();
    } catch (err) {
      setError(err.message);
      setLeaving(false);
    }
  };

  if (error && !room) {
    return (
      <div>
        <button className="sd-back-btn" onClick={onBack}><ArrowLeft size={14} /> Phòng thi của tôi</button>
        <div className="sd-card" style={{ padding: 24, color: 'var(--cinnabar)' }}>
          <AlertCircle size={16} style={{ verticalAlign: -3 }} /> {error}
        </div>
      </div>
    );
  }
  if (!room) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>
        <Loader2 size={26} style={{ animation: 'sd-spin 1s linear infinite' }} />
      </div>
    );
  }

  const av = exam?.availability;
  const canEnter = av === 'OPEN' || av === 'IN_PROGRESS' || av === 'RETAKEABLE';
  const reviewable = exam?.submissionId != null && av !== 'IN_PROGRESS';

  return (
    <div>
      <button className="sd-back-btn" onClick={onBack}><ArrowLeft size={14} /> Phòng thi của tôi</button>

      <div className="sd-class-hero">
        <div className="sd-class-hero-icon"><School size={22} color="var(--jade)" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="sd-class-hero-name">{room.name}</h2>
          <div className="sd-class-hero-tags">
            {room.levelName && <span className="sd-tag level">{room.levelName}</span>}
            <span className={`sd-tag ${PHASE_TAG[phase]?.cls}`}>{PHASE_TAG[phase]?.label}</span>
            {room.mySeatNo != null && <span style={{ fontSize: 12.5, color: 'var(--ink-mute)' }}>Ghế số {room.mySeatNo}</span>}
            {room.ownerName && <span style={{ fontSize: 12.5, color: 'var(--ink-mute)' }}>Người ra đề: {room.ownerName}</span>}
          </div>
        </div>
        {phase !== 'ENDED' && av !== 'IN_PROGRESS' && (
          <button className="sd-btn-ghost" onClick={leave} disabled={leaving}>
            <LogOut size={13} /> Rời phòng
          </button>
        )}
      </div>

      {error && <p style={{ color: 'var(--cinnabar)', fontSize: 13 }}><AlertCircle size={13} /> {error}</p>}

      <div className="sd-card" style={{ padding: 20, marginBottom: 16, textAlign: 'center' }}>
        {room.examTitle && (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-mute)' }}>
            {room.examTitle} · {room.examQuestionCount} câu · {room.durationMinutes} phút
          </p>
        )}

        {phase === 'DRAFT' && (
          <p style={{ margin: '12px 0 0', fontSize: 15, color: 'var(--ink)' }}>Phòng chưa mở. Trang tự cập nhật khi người ra đề mở phòng.</p>
        )}

        {phase === 'WAITING' && (
          <>
            <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--ink-faint)' }}>
              {room.startTime ? `Bắt đầu lúc ${formatWhen(room.startTime)}` : 'Chờ người ra đề bấm bắt đầu'}
            </p>
            {room.startTime && (
              <p style={{ margin: '4px 0 0', fontSize: 38, fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                {formatClock(left ?? 0)}
              </p>
            )}
            <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--ink-faint)' }}>
              Giữ trang này mở — nút làm bài tự bật khi bắt đầu.
            </p>
          </>
        )}

        {phase === 'IN_PROGRESS' && (
          <>
            <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--ink-faint)' }}>Hết giờ lúc {formatWhen(room.endTime)}</p>
            <p style={{ margin: '4px 0 0', fontSize: 38, fontWeight: 800, color: 'var(--jade)', fontVariantNumeric: 'tabular-nums' }}>
              {formatClock(left ?? 0)}
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--ink-faint)' }}>
              Cả phòng nộp bài cùng lúc khi hết giờ, kể cả khi bạn vào muộn.
            </p>
          </>
        )}

        {phase === 'ENDED' && (
          <p style={{ margin: '12px 0 0', fontSize: 15, color: 'var(--ink)' }}>Buổi thi đã kết thúc lúc {formatWhen(room.endTime)}.</p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
          {phase === 'IN_PROGRESS' && canEnter && (
            <button className="sd-btn-primary" style={{ fontSize: 15, padding: '10px 22px' }} onClick={() => onEnterExam(exam.examId)}>
              <Play size={15} /> {av === 'IN_PROGRESS' ? 'Tiếp tục làm bài' : 'Vào làm bài'}
            </button>
          )}
          {phase === 'WAITING' && (
            <button className="sd-btn-ghost" disabled><Clock size={14} /> Chưa đến giờ làm bài</button>
          )}
          {reviewable && (
            <button className="sd-btn-ghost" onClick={() => navigate(`/student/submissions/${exam.submissionId}/review`)}>
              <Eye size={14} /> Xem lại bài
            </button>
          )}
          {phase === 'IN_PROGRESS' && !canEnter && !reviewable && av && (
            <button className="sd-btn-ghost" disabled><Clock size={14} /> Không làm bài được</button>
          )}
        </div>
      </div>

      {room.instructions && (
        <div className="sd-card" style={{ padding: 16, marginBottom: 16 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>Lời dặn của người ra đề</p>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--ink-soft)', whiteSpace: 'pre-wrap' }}>{room.instructions}</p>
        </div>
      )}

      {phase === 'ENDED' && board && (
        <>
          <MyResult board={board.boards?.[0]} />
          <h2 className="sd-section-title"><Trophy size={17} /> Bảng xếp hạng phòng</h2>
          <Leaderboard data={board} onOpenSubmission={(id) => navigate(`/student/submissions/${id}/review`)} />
        </>
      )}
    </div>
  );
}

// ─── Danh sách ───────────────────────────────────────────────────

function RoomTile({ room, onOpen, action }) {
  const tag = PHASE_TAG[room.phase] ?? PHASE_TAG.WAITING;
  const when = room.phase === 'IN_PROGRESS' ? `Hết giờ ${formatWhen(room.endTime)}`
    : room.phase === 'ENDED' ? `Kết thúc ${formatWhen(room.endTime)}`
    : room.startTime ? `Bắt đầu ${formatWhen(room.startTime)}` : 'Chờ người ra đề bắt đầu';
  return (
    <button type="button" className="sd-card sd-class-card" onClick={onOpen}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <p style={{ margin: 0, flex: 1, fontWeight: 700, fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.3 }}>{room.name}</p>
        <span className={`sd-tag ${tag.cls}`}>{tag.label}</span>
      </div>
      {room.examTitle && (
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-mute)' }}>
          {room.examTitle} · {room.durationMinutes} phút
        </p>
      )}
      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-faint)' }}>
        <Clock size={12} style={{ verticalAlign: -2 }} /> {when}
        {room.ownerName && ` · ${room.ownerName}`}
      </p>
      <div className="sd-class-card-foot">
        <span style={{ fontSize: 12.5, color: 'var(--ink-mute)' }}>
          <Users size={13} style={{ verticalAlign: -2 }} />{' '}
          {room.capacity == null ? `${room.memberCount} thí sinh` : `${room.memberCount}/${room.capacity} chỗ`}
          {room.mySeatNo != null && ` · ghế ${room.mySeatNo}`}
        </span>
        <span className="sd-class-card-cta">{action} <ChevronRight size={13} /></span>
      </div>
    </button>
  );
}

function Section({ title, children, count, collapsible }) {
  const [open, setOpen] = useState(!collapsible);
  if (!count) return null;
  return (
    <section style={{ marginBottom: 22 }}>
      <h2
        className="sd-section-title"
        style={{ cursor: collapsible ? 'pointer' : 'default' }}
        onClick={collapsible ? () => setOpen((o) => !o) : undefined}
      >
        {title} ({count}){collapsible && (open ? ' ▾' : ' ▸')}
      </h2>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 14 }}>
          {children}
        </div>
      )}
    </section>
  );
}

export default function StudentRooms({ onEnterExam, inviteCode }) {
  const [rooms, setRooms] = useState([]);
  const [publicRooms, setPublicRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lobbyId, setLobbyId] = useState(null);

  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [mine, open] = await Promise.all([
        roomService.getJoinedRooms(),
        roomService.getOpenRooms().catch(() => []),
      ]);
      setRooms(mine);
      setPublicRooms(open.filter((r) => r.myStatus !== 'ACTIVE'));
      setError(null);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách phòng thi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (lobbyId == null) load(); }, [load, lobbyId]);

  const joinWith = useCallback(async (request) => {
    setJoining(true);
    setJoinError(null);
    try {
      const room = await request();
      setCode('');
      setLobbyId(room.roomId);
    } catch (err) {
      setJoinError(err.message);
    } finally {
      setJoining(false);
    }
  }, []);

  // Link mời: tự vào phòng một lần.
  const usedInvite = useRef(null);
  useEffect(() => {
    if (!inviteCode || usedInvite.current === inviteCode) return;
    usedInvite.current = inviteCode;
    const normalized = inviteCode.trim().toUpperCase();
    setCode(normalized);
    joinWith(() => roomService.joinByCode(normalized));
  }, [inviteCode, joinWith]);

  if (lobbyId != null) {
    return <RoomLobby key={lobbyId} roomId={lobbyId} onBack={() => setLobbyId(null)} onEnterExam={onEnterExam} />;
  }

  const submit = (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    joinWith(() => roomService.joinByCode(code.trim().toUpperCase()));
  };

  const live = rooms.filter((r) => r.phase === 'IN_PROGRESS');
  const upcoming = rooms.filter((r) => r.phase === 'WAITING' || r.phase === 'DRAFT');
  const ended = rooms.filter((r) => r.phase === 'ENDED');

  return (
    <div>
      <form onSubmit={submit} className="sd-card" style={{ marginBottom: 20, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <KeyRound size={16} color="var(--jade)" />
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Vào phòng bằng mã</p>
            <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--ink-faint)' }}>
              Nhập mã người ra đề gửi, hoặc mở link mời.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="VD: 49F7JW"
            maxLength={20}
            autoComplete="off"
            style={{
              flex: '1 1 200px', minWidth: 0, padding: '10px 14px', borderRadius: 10,
              border: '1px solid var(--line-strong)', background: 'var(--paper)',
              fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--ink)',
            }}
          />
          <button type="submit" className="sd-btn-primary" disabled={joining || !code.trim()} style={{ flexShrink: 0 }}>
            {joining ? <><Loader2 size={14} style={{ animation: 'sd-spin 1s linear infinite' }} /> Đang vào…</>
                     : <><DoorOpen size={14} /> Vào phòng</>}
          </button>
        </div>
        {joinError && (
          <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--cinnabar)' }}>
            <AlertCircle size={13} style={{ verticalAlign: -2 }} /> {joinError}
          </p>
        )}
      </form>

      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>
          <Loader2 size={26} style={{ animation: 'sd-spin 1s linear infinite' }} />
        </div>
      )}
      {error && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--cinnabar)' }}>
          <AlertCircle size={20} /> <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          <Section title="Đang thi" count={live.length}>
            {live.map((r) => <RoomTile key={r.roomId} room={r} action="Vào phòng" onOpen={() => setLobbyId(r.roomId)} />)}
          </Section>
          <Section title="Sắp diễn ra" count={upcoming.length}>
            {upcoming.map((r) => <RoomTile key={r.roomId} room={r} action="Vào sảnh chờ" onOpen={() => setLobbyId(r.roomId)} />)}
          </Section>
          <Section title="Phòng công khai" count={publicRooms.length}>
            {publicRooms.map((r) => (
              <RoomTile key={r.roomId} room={r} action={joining ? 'Đang vào…' : 'Tham gia'}
                        onOpen={() => !joining && joinWith(() => roomService.joinOpen(r.roomId))} />
            ))}
          </Section>
          <Section title="Đã kết thúc" count={ended.length} collapsible>
            {ended.map((r) => <RoomTile key={r.roomId} room={r} action="Xem kết quả" onOpen={() => setLobbyId(r.roomId)} />)}
          </Section>

          {rooms.length === 0 && publicRooms.length === 0 && (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-mute)' }}>
              <School size={44} style={{ opacity: 0.3, marginBottom: 14 }} />
              <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: 'var(--ink-faint)' }}>Bạn chưa ở trong phòng thi nào</p>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-soft)' }}>
                <CheckCircle size={12} style={{ verticalAlign: -2 }} /> Nhập mã phòng ở trên để vào.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
