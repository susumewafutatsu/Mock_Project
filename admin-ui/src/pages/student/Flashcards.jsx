// src/pages/student/Flashcards.jsx
// Thẻ ghi nhớ: bộ có sẵn, bộ tự tạo và phiên học theo lịch lặp lại ngắt quãng.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, BookOpen, Check, Edit3, Layers, Loader2, Play, Plus, Search,
  Trash2, Volume2, X,
} from 'lucide-react';
import {
  addCustomCard, addDeckItem, createDeck, deleteDeck, enrollDeck, getDeck, getDecks,
  getDueCards, removeDeckItem, reviewCard, searchContent, unenrollDeck,
  updateCustomCard, updateDeck,
} from '../../services/studyService';
import './Study.css';

/** Bốn mức đánh giá, khớp enum ReviewGrade ở backend. */
const GRADES = [
  { key: 'AGAIN', label: 'Quên', cls: 'again' },
  { key: 'HARD',  label: 'Khó',  cls: 'hard' },
  { key: 'GOOD',  label: 'Nhớ',  cls: 'good' },
  { key: 'EASY',  label: 'Dễ',   cls: 'easy' },
];

/** Khoảng cách của thẻ vừa quên, dùng khi thẻ quay lại trong phiên. */
const RELEARN_INTERVALS = { AGAIN: 0, HARD: 1, GOOD: 1, EASY: 4 };

const STATUS = {
  NOT_ENROLLED: { label: 'Chưa vào lịch', cls: '' },
  NEW:          { label: 'Thẻ mới',       cls: 'new' },
  LEARNING:     { label: 'Đang học',      cls: 'learning' },
  MATURE:       { label: 'Đã thuộc',      cls: 'mature' },
};

const TYPE_LABEL = { VOCAB: 'Từ vựng', KANJI: 'Chữ Hán', CUSTOM: 'Tự soạn' };

/** Số thẻ mới mở thêm mỗi lần bấm "Học thêm". */
const EXTRA_NEW = 10;

/** 0 → "ngay", 6 → "6 ngày", 45 → "2 tháng". */
function formatInterval(days) {
  if (days == null) return '';
  if (days <= 0) return 'ngay';
  if (days < 30) return `${days} ngày`;
  if (days < 365) return `${Math.round(days / 30)} tháng`;
  return `${(days / 365).toFixed(1)} năm`;
}

/** "2026-09-20T08:00:00" → "20/09". */
function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Mặt thẻ ──────────────────────────────────────────────────────────

function CardFace({ card, revealed }) {
  const isKanji = card.itemType === 'KANJI';

  return (
    <div className="st-card">
      <p className={`st-card-prompt jp ${isKanji ? 'kanji' : ''}`} lang="ja">{card.prompt}</p>

      {!revealed ? (
        <p className="st-card-sub">
          {card.isNew ? 'Thẻ mới' : `Ôn lại · đã nhớ ${card.repetitions} lần liên tiếp`}
          {' · '}{TYPE_LABEL[card.itemType]}
        </p>
      ) : (
        <>
          <div className="st-card-divider" />
          {isKanji ? (
            <>
              <p className="st-card-meaning">{card.meaning}</p>
              <div className="st-readings">
                {card.onyomi && (
                  <div className="st-reading-row"><span>ÂM ON</span><b className="jp" lang="ja">{card.onyomi}</b></div>
                )}
                {card.kunyomi && (
                  <div className="st-reading-row"><span>ÂM KUN</span><b className="jp" lang="ja">{card.kunyomi}</b></div>
                )}
              </div>
              {card.strokeCount && (
                <p className="st-card-sub">
                  {card.strokeCount} nét
                  {card.radical && <> · bộ <span className="jp" lang="ja">{card.radical}</span></>}
                </p>
              )}
              {card.mnemonic && <p className="st-mnemonic">{card.mnemonic}</p>}
            </>
          ) : (
            <>
              {card.reading && <p className="st-card-reading jp" lang="ja">{card.reading}</p>}
              <p className="st-card-meaning">{card.meaning}</p>
              {card.partOfSpeech && <p className="st-card-sub">{card.partOfSpeech}</p>}
              {card.exampleSentence && (
                <>
                  <div className="st-card-divider" />
                  <p className="st-card-example jp" lang="ja">{card.exampleSentence}</p>
                  {card.exampleMeaning && <p className="st-card-example-vi">{card.exampleMeaning}</p>}
                </>
              )}
              {card.note && <p className="st-mnemonic">{card.note}</p>}
              {card.audioUrl && (
                <button className="st-btn" onClick={() => new Audio(card.audioUrl).play().catch(() => {})}>
                  <Volume2 size={14} /> Nghe
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Phiên học ────────────────────────────────────────────────────────

function ReviewSession({ deckId, extraNew, onExit }) {
  const [queue, setQueue] = useState(null);
  const [cards, setCards] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(0);
  const [lastResult, setLastResult] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  const start = useCallback(async (extra) => {
    setQueue(null);
    setSummary(null);
    setError(null);
    try {
      const q = await getDueCards({ deckId, extraNew: extra });
      setQueue(q);
      setCards(q.cards);
      setRevealed(false);
      setLastResult(null);
    } catch (err) {
      setError(err.message);
    }
  }, [deckId]);

  useEffect(() => { start(extraNew); }, [start, extraNew]);

  // Hết thẻ thì hỏi lại server còn gì để gợi ý bước tiếp.
  useEffect(() => {
    if (!queue || cards.length > 0 || summary) return;
    getDueCards({ deckId }).then(setSummary).catch(() => setSummary({ dueCount: 0, newWaiting: 0 }));
  }, [queue, cards.length, summary, deckId]);

  const card = cards[0];

  const grade = useCallback(async (gradeKey) => {
    if (!card || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await reviewCard(card.itemType, card.itemId, gradeKey);
      setLastResult({ ...res, grade: gradeKey, prompt: card.prompt });
      setDone((d) => d + 1);
      setCards((prev) => {
        const [first, ...rest] = prev;
        // Quên thì thẻ quay lại cuối hàng đợi của phiên này.
        return gradeKey === 'AGAIN'
          ? [...rest, { ...first, isNew: false, repetitions: 0, nextIntervals: RELEARN_INTERVALS }]
          : rest;
      });
      setRevealed(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }, [card, sending]);

  // Phím tắt: Space/Enter lật thẻ, 1–4 đánh giá.
  const gradeRef = useRef(grade);
  gradeRef.current = grade;
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        if (!revealedRef.current) setRevealed(true);
        return;
      }
      const n = Number(e.key);
      if (revealedRef.current && n >= 1 && n <= GRADES.length) {
        e.preventDefault();
        gradeRef.current(GRADES[n - 1].key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const title = queue?.deckName ? `Học bộ "${queue.deckName}"` : 'Học tất cả bộ thẻ';

  if (!queue) {
    return (
      <div className="st-empty">
        {error ? <div className="st-error">{error}</div> : <Loader2 size={22} className="st-spin" />}
        <button className="st-btn" onClick={onExit}><ArrowLeft size={14} /> Quay lại</button>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="st-empty">
        <span className="st-empty-icon">{done > 0 ? '🎉' : '✅'}</span>
        <h3>{done > 0 ? `Xong! Bạn vừa học ${done} lượt thẻ` : 'Không có thẻ nào cần học lúc này'}</h3>
        {!summary ? (
          <Loader2 size={18} className="st-spin" />
        ) : summary.dueCount > 0 ? (
          <>
            <p>Vẫn còn {summary.dueCount} thẻ cần học hôm nay.</p>
            <button className="st-btn primary" onClick={() => start(0)}><Play size={14} /> Học tiếp</button>
          </>
        ) : summary.newWaiting > 0 ? (
          <>
            <p>
              Hôm nay đã mở đủ {summary.newPerDay} thẻ mới. Còn {summary.newWaiting} thẻ mới chờ —
              học dồn nhiều thẻ mới sẽ làm những ngày sau phải ôn rất nặng.
            </p>
            <button className="st-btn" onClick={() => start(EXTRA_NEW)}>
              <Plus size={14} /> Vẫn học thêm {EXTRA_NEW} thẻ mới
            </button>
          </>
        ) : (
          <p>Thẻ sẽ quay lại đúng lúc bạn sắp quên. Hẹn gặp lại vào ngày mai.</p>
        )}
        <button className="st-btn" onClick={onExit}><ArrowLeft size={14} /> Về bộ thẻ</button>
      </div>
    );
  }

  const total = done + cards.length;
  return (
    <div className="st-session">
      <div className="st-session-bar">
        <button className="st-btn" onClick={onExit}><ArrowLeft size={14} /> Thoát</button>
        <div className="st-progress">
          <div className="st-progress-mature" style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{done}/{total}</span>
      </div>
      <p className="st-card-sub" style={{ margin: 0 }}>{title}</p>

      {error && <div className="st-error">{error}</div>}

      <CardFace card={card} revealed={revealed} />

      {!revealed ? (
        <button className="st-btn primary" onClick={() => setRevealed(true)}>
          Xem đáp án <span style={{ opacity: 0.7, fontWeight: 400 }}>(Space)</span>
        </button>
      ) : (
        <div className="st-grades">
          {GRADES.map((g, i) => (
            <button key={g.key} className={`st-grade ${g.cls}`} disabled={sending} onClick={() => grade(g.key)}>
              {g.label}
              <small>
                {i + 1} · {g.key === 'AGAIN' ? 'gặp lại ngay' : formatInterval(card.nextIntervals?.[g.key])}
              </small>
            </button>
          ))}
        </div>
      )}

      {lastResult && (
        <p className="st-card-sub">
          Thẻ <span className="jp" lang="ja">{lastResult.prompt}</span>{' '}
          {lastResult.grade === 'AGAIN'
            ? 'sẽ quay lại trong phiên này'
            : `gặp lại sau ${formatInterval(lastResult.intervalDays)}`}
          {lastResult.mature && ' · đã thuộc'}
        </p>
      )}
    </div>
  );
}

// ── Form bộ thẻ ──────────────────────────────────────────────────────

function DeckFormModal({ initial, onClose, onSave }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Chưa đặt tên bộ thẻ'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), description: description.trim() || null, levelId: initial?.levelId ?? null });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="st-modal-overlay" onClick={onClose}>
      <form className="st-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="st-section-title">
          <h3>{initial ? 'Sửa bộ thẻ' : 'Tạo bộ thẻ mới'}</h3>
          <button type="button" className="st-icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        {error && <div className="st-error">{error}</div>}
        <label className="st-field">
          Tên bộ thẻ
          <input className="st-input" value={name} maxLength={100} autoFocus
                 onChange={(e) => setName(e.target.value)} placeholder="VD: Từ mới trong đề N4 tháng 9" />
        </label>
        <label className="st-field">
          Mô tả (không bắt buộc)
          <input className="st-input" value={description} maxLength={255}
                 onChange={(e) => setDescription(e.target.value)} placeholder="Bộ này dùng để làm gì" />
        </label>
        <div className="st-actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="st-btn" onClick={onClose}>Huỷ</button>
          <button type="submit" className="st-btn primary" disabled={saving}>
            {saving ? <Loader2 size={14} className="st-spin" /> : <Check size={14} />} {initial ? 'Lưu' : 'Tạo bộ'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Soạn thẻ ─────────────────────────────────────────────────────────

const EMPTY_CARD = { front: '', reading: '', back: '', example: '', exampleMeaning: '', note: '' };

function CardForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_CARD, ...(initial ?? {}) }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [more, setMore] = useState(!!(initial?.example || initial?.note));
  const frontRef = useRef(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.front.trim() || !form.back.trim()) { setError('Cần có mặt trước và mặt sau'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
      if (!initial) {
        setForm(EMPTY_CARD);
        frontRef.current?.focus();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="st-panel" onSubmit={submit}>
      <h4>{initial ? 'Sửa thẻ' : 'Soạn thẻ mới'}</h4>
      {error && <div className="st-error">{error}</div>}
      <div className="st-row2">
        <label className="st-field">
          Mặt trước *
          <input ref={frontRef} className="st-input jp" lang="ja" value={form.front} maxLength={200}
                 onChange={(e) => set('front', e.target.value)} placeholder="VD: 締め切り" />
        </label>
        <label className="st-field">
          Cách đọc
          <input className="st-input jp" lang="ja" value={form.reading ?? ''} maxLength={200}
                 onChange={(e) => set('reading', e.target.value)} placeholder="しめきり" />
        </label>
      </div>
      <label className="st-field">
        Mặt sau (nghĩa) *
        <input className="st-input" value={form.back} maxLength={500}
               onChange={(e) => set('back', e.target.value)} placeholder="hạn chót" />
      </label>
      {more ? (
        <>
          <label className="st-field">
            Câu ví dụ
            <input className="st-input jp" lang="ja" value={form.example ?? ''} maxLength={500}
                   onChange={(e) => set('example', e.target.value)} />
          </label>
          <label className="st-field">
            Nghĩa câu ví dụ
            <input className="st-input" value={form.exampleMeaning ?? ''} maxLength={500}
                   onChange={(e) => set('exampleMeaning', e.target.value)} />
          </label>
          <label className="st-field">
            Ghi chú / mẹo nhớ
            <input className="st-input" value={form.note ?? ''} maxLength={500}
                   onChange={(e) => set('note', e.target.value)} />
          </label>
        </>
      ) : (
        <button type="button" className="st-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setMore(true)}>
          <Plus size={13} /> Thêm ví dụ, ghi chú
        </button>
      )}
      <div className="st-actions">
        <button type="submit" className="st-btn primary" disabled={saving}>
          {saving ? <Loader2 size={14} className="st-spin" /> : <Check size={14} />} {initial ? 'Lưu thẻ' : 'Thêm thẻ'}
        </button>
        {onCancel && <button type="button" className="st-btn" onClick={onCancel}>Huỷ</button>}
      </div>
    </form>
  );
}

function ContentSearch({ deckId, onAdded }) {
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [hits, setHits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!q.trim()) { setHits([]); return undefined; }
    setLoading(true);
    const t = setTimeout(() => {
      searchContent({ q: q.trim(), type, deckId })
        .then((list) => { setHits(list); setError(null); })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q, type, deckId]);

  const add = async (hit) => {
    setAdding(`${hit.itemType}:${hit.itemId}`);
    setError(null);
    try {
      await addDeckItem(deckId, hit.itemType, hit.itemId);
      setHits((list) => list.map((h) => (h === hit ? { ...h, inDeck: true } : h)));
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="st-panel">
      <h4>Thêm từ có sẵn</h4>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 12, color: 'var(--ink-faint)' }} />
          <input className="st-input" style={{ paddingLeft: 30 }} value={q}
                 onChange={(e) => setQ(e.target.value)} placeholder="Gõ chữ Nhật, cách đọc hoặc nghĩa" />
        </div>
        <select className="st-input" style={{ width: 'auto' }} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Tất cả</option>
          <option value="VOCAB">Từ vựng</option>
          <option value="KANJI">Chữ Hán</option>
        </select>
      </div>
      {error && <div className="st-error">{error}</div>}
      <div className="st-hits">
        {loading && <p className="st-card-sub"><Loader2 size={13} className="st-spin" /> Đang tìm…</p>}
        {!loading && q.trim() && hits.length === 0 && <p className="st-card-sub">Không tìm thấy từ nào.</p>}
        {!q.trim() && <p className="st-card-sub">Tìm trong kho từ vựng và chữ Hán của hệ thống.</p>}
        {hits.map((h) => (
          <div className="st-hit" key={`${h.itemType}:${h.itemId}`}>
            <div className="st-hit-main">
              <b className="jp" lang="ja">{h.front}</b>
              {h.reading && <span className="st-cardrow-reading jp" lang="ja"> · {h.reading}</span>}
              <div className="st-cardrow-reading">
                {h.meaning} · {TYPE_LABEL[h.itemType]}{h.levelName ? ` · ${h.levelName}` : ''}
              </div>
            </div>
            {h.inDeck ? (
              <span className="st-chip mature"><Check size={12} /> Đã có</span>
            ) : (
              <button className="st-btn" disabled={adding === `${h.itemType}:${h.itemId}`} onClick={() => add(h)}>
                <Plus size={13} /> Thêm
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Chi tiết bộ ──────────────────────────────────────────────────────

function CardRow({ card, onEdit, onRemove }) {
  const st = STATUS[card.status] ?? STATUS.NOT_ENROLLED;
  return (
    <div className="st-cardrow">
      <div>
        <div className="st-cardrow-front jp" lang="ja">{card.front}</div>
        {card.reading && <div className="st-cardrow-reading jp" lang="ja">{card.reading}</div>}
      </div>
      <div className="st-cardrow-back">
        {card.back}
        <div className="st-cardrow-reading">{TYPE_LABEL[card.itemType]}</div>
      </div>
      <div>
        {card.due ? (
          <span className="st-chip due">Cần ôn</span>
        ) : (
          <span className={`st-chip ${st.cls}`}>
            {st.label}{card.status === 'LEARNING' || card.status === 'MATURE' ? ` · ${formatDate(card.dueAt)}` : ''}
          </span>
        )}
      </div>
      <div className="st-cardrow-actions">
        {card.editable && (
          <button className="st-icon-btn" title="Sửa thẻ" onClick={() => onEdit(card)}><Edit3 size={14} /></button>
        )}
        {card.removable && (
          <button className="st-icon-btn" title="Gỡ khỏi bộ" onClick={() => onRemove(card)}><Trash2 size={14} /></button>
        )}
      </div>
    </div>
  );
}

function DeckView({ deckId, onBack, onStudy }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [editingDeck, setEditingDeck] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => getDeck(deckId)
    .then((d) => { setData(d); setError(null); })
    .catch((err) => setError(err.message)), [deckId]);

  useEffect(() => { load(); }, [load]);

  const run = async (fn, okMessage) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (okMessage) setNotice(okMessage);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return (
      <div className="st-wrap">
        <button className="st-btn" style={{ alignSelf: 'flex-start' }} onClick={onBack}><ArrowLeft size={14} /> Tất cả bộ thẻ</button>
        {error ? <div className="st-error">{error}</div> : <div className="st-empty"><Loader2 size={22} className="st-spin" /></div>}
      </div>
    );
  }

  const { deck, cards } = data;
  const mine = deck.mine;
  const studyable = deck.dueCards + deck.newCards > 0;
  const term = filter.trim().toLowerCase();
  const shown = term
    ? cards.filter((c) => [c.front, c.reading, c.back].some((v) => v && v.toLowerCase().includes(term)))
    : cards;

  const remove = (card) => {
    const warn = card.itemType === 'CUSTOM' ? 'Thẻ tự soạn sẽ bị xoá hẳn cùng tiến độ học.' : 'Tiến độ học của thẻ này cũng bị xoá.';
    if (!window.confirm(`Gỡ "${card.front}" khỏi bộ?\n${warn}`)) return;
    run(() => removeDeckItem(deckId, card.itemType, card.itemId), 'Đã gỡ thẻ khỏi bộ');
  };

  return (
    <div className="st-wrap">
      <button className="st-btn" style={{ alignSelf: 'flex-start' }} onClick={onBack}><ArrowLeft size={14} /> Tất cả bộ thẻ</button>

      <div className="st-head">
        <div>
          <h2>{deck.name}</h2>
          <p>
            {mine ? 'Bộ của tôi' : 'Bộ có sẵn'}
            {deck.levelName ? ` · ${deck.levelName}` : ''} · {deck.totalCards} thẻ
            {deck.description ? ` — ${deck.description}` : ''}
          </p>
        </div>
        {deck.enrolled && (
          <div className="st-stats">
            <div className="st-stat due"><b>{deck.dueCards}</b><span>Cần ôn</span></div>
            <div className="st-stat"><b>{deck.newCards}</b><span>Thẻ mới</span></div>
            <div className="st-stat done"><b>{deck.masteredCards}</b><span>Đã thuộc</span></div>
          </div>
        )}
      </div>

      <div className="st-actions">
        {deck.enrolled ? (
          <>
            <button className="st-btn primary" disabled={!studyable || busy} onClick={() => onStudy(0)}>
              <BookOpen size={14} /> Học bộ này
            </button>
            <button className="st-btn" disabled={busy} onClick={() => {
              if (!window.confirm('Bỏ bộ khỏi lịch học?\nTiến độ các thẻ chỉ có trong bộ này sẽ bị xoá.')) return;
              run(() => unenrollDeck(deckId), 'Đã bỏ bộ khỏi lịch học');
            }}>
              Bỏ khỏi lịch học
            </button>
          </>
        ) : (
          <button className="st-btn primary" disabled={busy || deck.totalCards === 0}
                  onClick={() => run(() => enrollDeck(deckId), 'Đã thêm vào lịch học. Thẻ mới mở dần mỗi ngày.')}>
            <Play size={14} /> Thêm vào lịch học
          </button>
        )}
        {mine && (
          <>
            <button className="st-btn" disabled={busy} onClick={() => setEditingDeck(true)}><Edit3 size={14} /> Sửa tên</button>
            <button className="st-btn" disabled={busy} style={{ color: 'var(--cinnabar)' }} onClick={async () => {
              if (!window.confirm(`Xoá bộ "${deck.name}"?\nThẻ tự soạn và tiến độ học của bộ sẽ mất.`)) return;
              setBusy(true);
              try {
                await deleteDeck(deckId);
                onBack();
              } catch (err) {
                setError(err.message);
                setBusy(false);
              }
            }}>
              <Trash2 size={14} /> Xoá bộ
            </button>
          </>
        )}
      </div>

      {error && <div className="st-error">{error}</div>}
      {notice && <div className="st-verdict ok" style={{ fontSize: 13 }}><b>{notice}</b></div>}
      {mine && !deck.enrolled && (
        <div className="st-verdict" style={{ fontSize: 13 }}>
          Bộ đang không có trong lịch học — thẻ mới soạn sẽ không được đưa vào ôn.
        </div>
      )}

      {mine && (
        <div className="st-builder">
          {editingCard ? (
            <CardForm
              key={`edit-${editingCard.itemId}`}
              initial={editingCard}
              onCancel={() => setEditingCard(null)}
              onSave={async (form) => {
                await updateCustomCard(deckId, editingCard.itemId, form);
                setEditingCard(null);
                setNotice('Đã sửa thẻ');
                await load();
              }}
            />
          ) : (
            <CardForm
              key="add"
              onSave={async (form) => {
                const created = await addCustomCard(deckId, form);
                setNotice(`Đã thêm thẻ "${created.front}"`);
                await load();
              }}
            />
          )}
          <ContentSearch deckId={deckId} onAdded={() => { setNotice('Đã thêm vào bộ'); load(); }} />
        </div>
      )}

      <div className="st-section-title">
        <h3>Thẻ trong bộ ({cards.length})</h3>
        {cards.length > 8 && (
          <input className="st-input" style={{ maxWidth: 240 }} value={filter}
                 onChange={(e) => setFilter(e.target.value)} placeholder="Lọc thẻ…" />
        )}
      </div>

      {cards.length === 0 ? (
        <div className="st-empty">
          <span className="st-empty-icon">🗂️</span>
          <p>{mine ? 'Bộ chưa có thẻ nào. Soạn thẻ hoặc thêm từ có sẵn ở trên.' : 'Bộ chưa có thẻ nào.'}</p>
        </div>
      ) : (
        <div className="st-cardlist">
          {shown.map((c) => (
            <CardRow key={`${c.itemType}:${c.itemId}`} card={c}
                     onEdit={(card) => { setEditingCard(card); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                     onRemove={remove} />
          ))}
        </div>
      )}

      {editingDeck && (
        <DeckFormModal
          initial={deck}
          onClose={() => setEditingDeck(false)}
          onSave={async (form) => {
            await updateDeck(deckId, form);
            setEditingDeck(false);
            setNotice('Đã lưu bộ thẻ');
            await load();
          }}
        />
      )}
    </div>
  );
}

// ── Trang bộ thẻ ─────────────────────────────────────────────────────

function DeckTile({ deck, busy, onOpen, onEnroll, onStudy }) {
  const total = deck.totalCards || 1;
  const maturePct = (deck.masteredCards / total) * 100;
  const learningPct = (Math.max(0, deck.enrolledCards - deck.masteredCards - deck.newCards) / total) * 100;

  return (
    <div className="st-deck">
      <h3>{deck.name}</h3>
      {deck.description && <p className="st-deck-desc">{deck.description}</p>}

      <div className="st-progress" role="img" aria-label={`Đã thuộc ${deck.masteredCards} trên ${deck.totalCards} thẻ`}>
        <div className="st-progress-mature" style={{ width: `${maturePct}%` }} />
        <div className="st-progress-learning" style={{ width: `${learningPct}%` }} />
      </div>

      <div className="st-deck-meta">
        <Layers size={12} />
        <span>{deck.totalCards} thẻ</span>
        {deck.enrolled && (
          <>
            {deck.dueCards > 0 && <span className="st-chip due">cần ôn {deck.dueCards}</span>}
            {deck.newCards > 0 && <span className="st-chip new">mới {deck.newCards}</span>}
            <span style={{ color: 'var(--jade)' }}>thuộc {deck.masteredCards}</span>
          </>
        )}
        {deck.levelName && <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{deck.levelName}</span>}
      </div>

      <div className="st-actions">
        {deck.enrolled ? (
          <button className="st-btn primary" disabled={deck.dueCards + deck.newCards === 0} onClick={onStudy}>
            <BookOpen size={14} /> Học
          </button>
        ) : deck.mine ? null : (
          <button className="st-btn primary" disabled={busy || deck.totalCards === 0} onClick={onEnroll}>
            {busy ? <Loader2 size={14} className="st-spin" /> : <Play size={14} />} Thêm vào lịch học
          </button>
        )}
        <button className="st-btn" onClick={onOpen}>
          {deck.mine ? <><Edit3 size={14} /> Soạn thẻ</> : 'Xem thẻ'}
        </button>
      </div>
    </div>
  );
}

function TodayBanner({ queue, onStudy }) {
  if (!queue) return null;
  if (queue.dueCount > 0) {
    return (
      <div className="st-deck" style={{ borderColor: 'var(--gold)' }}>
        <h3>Hôm nay cần học {queue.dueCount} thẻ</h3>
        <p className="st-deck-desc">
          {queue.reviewDue} thẻ ôn lại · {queue.newAvailable} thẻ mới
          {queue.reviewDue > queue.dailyLimit ? ` — mỗi phiên tối đa ${queue.dailyLimit} thẻ ôn` : ''}.
          Thẻ ôn được xếp trước để không quên.
        </p>
        <button className="st-btn primary" style={{ alignSelf: 'flex-start' }} onClick={() => onStudy(null, 0)}>
          <BookOpen size={14} /> Học ngay
        </button>
      </div>
    );
  }
  if (queue.newWaiting > 0) {
    return (
      <div className="st-empty">
        <span className="st-empty-icon">✅</span>
        <h3>Đã học xong phần hôm nay</h3>
        <p>
          Bạn đã mở {queue.newStudiedToday} thẻ mới hôm nay (mức gợi ý {queue.newPerDay}).
          Còn {queue.newWaiting} thẻ mới sẽ mở dần những ngày tới.
        </p>
        <button className="st-btn" onClick={() => onStudy(null, EXTRA_NEW)}>
          <Plus size={14} /> Vẫn học thêm {EXTRA_NEW} thẻ mới
        </button>
      </div>
    );
  }
  if (queue.totalCards > 0) {
    return (
      <div className="st-empty">
        <span className="st-empty-icon">✅</span>
        <h3>Hôm nay không còn thẻ nào cần học</h3>
        <p>Bạn đang học {queue.totalCards} thẻ, đã thuộc {queue.matureCards}. Thêm bộ mới hoặc soạn thẻ để học thêm.</p>
      </div>
    );
  }
  return (
    <div className="st-empty">
      <span className="st-empty-icon">🗂️</span>
      <h3>Chưa có thẻ nào trong lịch học</h3>
      <p>Thêm một bộ có sẵn bên dưới, hoặc tạo bộ thẻ của riêng bạn để ghi lại từ mới gặp khi đọc, khi làm đề.</p>
    </div>
  );
}

function DeckHome({ onOpenDeck, onStudy }) {
  const [decks, setDecks] = useState([]);
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busyDeck, setBusyDeck] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setError(null);
    return Promise.all([getDecks(), getDueCards()])
      .then(([deckList, dueQueue]) => { setDecks(deckList); setQueue(dueQueue); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const enroll = async (deck) => {
    setBusyDeck(deck.deckId);
    setError(null);
    try {
      const added = await enrollDeck(deck.deckId);
      setNotice(`Đã thêm "${deck.name}" vào lịch học (${added} thẻ). Mỗi ngày mở tối đa ${queue?.newPerDay ?? 20} thẻ mới.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyDeck(null);
    }
  };

  if (loading) {
    return <div className="st-empty"><Loader2 size={22} className="st-spin" /><p>Đang tải bộ thẻ…</p></div>;
  }

  const mine = decks.filter((d) => d.mine);
  const system = decks.filter((d) => !d.mine);

  const tile = (deck) => (
    <DeckTile key={deck.deckId} deck={deck} busy={busyDeck === deck.deckId}
              onOpen={() => onOpenDeck(deck.deckId)}
              onEnroll={() => enroll(deck)}
              onStudy={() => onStudy(deck.deckId, 0)} />
  );

  return (
    <div className="st-wrap">
      <div className="st-head">
        <div>
          <h2>Thẻ ghi nhớ</h2>
          <p>
            Thẻ ôn theo lịch giãn dần: nhớ tốt thì lâu mới gặp lại, hay quên thì gặp lại thường xuyên.
            Mỗi ngày mở một ít thẻ mới để lịch ôn không dồn.
          </p>
        </div>
        <div className="st-stats">
          <div className="st-stat due"><b>{queue?.reviewDue ?? 0}</b><span>Cần ôn</span></div>
          <div className="st-stat"><b>{queue?.newAvailable ?? 0}</b><span>Mới hôm nay</span></div>
          <div className="st-stat done"><b>{queue?.matureCards ?? 0}</b><span>Đã thuộc</span></div>
        </div>
      </div>

      {error && <div className="st-error">{error}</div>}
      {notice && <div className="st-verdict ok" style={{ fontSize: 13 }}><b>{notice}</b></div>}

      <TodayBanner queue={queue} onStudy={onStudy} />

      <div className="st-section-title">
        <h3>Bộ thẻ của tôi</h3>
        <button className="st-btn primary" onClick={() => setCreating(true)}><Plus size={14} /> Tạo bộ thẻ</button>
      </div>
      {mine.length === 0 ? (
        <p className="st-card-sub" style={{ margin: 0 }}>
          Bạn chưa có bộ thẻ riêng. Tạo một bộ để lưu từ mới của chính mình.
        </p>
      ) : (
        <div className="st-decks">{mine.map(tile)}</div>
      )}

      <div className="st-section-title"><h3>Bộ thẻ có sẵn</h3></div>
      {system.length === 0 ? (
        <p className="st-card-sub" style={{ margin: 0 }}>Hệ thống chưa có bộ thẻ nào.</p>
      ) : (
        <div className="st-decks">{system.map(tile)}</div>
      )}

      {creating && (
        <DeckFormModal
          onClose={() => setCreating(false)}
          onSave={async (form) => {
            const deck = await createDeck(form);
            setCreating(false);
            onOpenDeck(deck.deckId);
          }}
        />
      )}
    </div>
  );
}

// ── Trang chính ──────────────────────────────────────────────────────

export default function Flashcards({ initialDeckId }) {
  const [view, setView] = useState(() => (initialDeckId
    ? { name: 'deck', deckId: Number(initialDeckId) }
    : { name: 'home' }));

  useEffect(() => {
    if (initialDeckId) setView({ name: 'deck', deckId: Number(initialDeckId) });
  }, [initialDeckId]);

  if (view.name === 'session') {
    return (
      <ReviewSession
        key={`${view.deckId ?? 'all'}-${view.extraNew}`}
        deckId={view.deckId}
        extraNew={view.extraNew}
        onExit={() => setView(view.back ?? { name: 'home' })}
      />
    );
  }

  if (view.name === 'deck') {
    return (
      <DeckView
        key={view.deckId}
        deckId={view.deckId}
        onBack={() => setView({ name: 'home' })}
        onStudy={(extra) => setView({
          name: 'session', deckId: view.deckId, extraNew: extra, back: { name: 'deck', deckId: view.deckId },
        })}
      />
    );
  }

  return (
    <DeckHome
      onOpenDeck={(deckId) => setView({ name: 'deck', deckId })}
      onStudy={(deckId, extra) => setView({ name: 'session', deckId, extraNew: extra })}
    />
  );
}
