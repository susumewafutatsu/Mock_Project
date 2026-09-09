// src/pages/student/Flashcards.jsx
// Thẻ ghi nhớ từ vựng và chữ Hán, học theo lịch lặp lại ngắt quãng.
//
// Màn hình có hai chế độ trong cùng một trang:
//   - Danh sách bộ thẻ: chọn bộ để bắt đầu học, xem tiến độ từng bộ.
//   - Phiên ôn: lật từng thẻ đến hạn, tự đánh giá mình nhớ tới đâu.
//
// Bốn quy ước:
//
// 1. Lịch ôn do server tính, client không tự đoán. Mỗi lần đánh giá, server
//    trả về khoảng cách mới và client chỉ hiển thị lại — thuật toán SM-2 nằm
//    ở backend và không được nhân bản sang đây.
//
// 2. Thẻ trả lời "Quên" quay lại cuối hàng đợi ngay trong phiên này. Đó là
//    điểm mấu chốt của phương pháp: thứ vừa quên phải được gặp lại khi vẫn
//    còn nhớ mặt chữ, không phải sang hôm sau.
//
// 3. Chữ Nhật luôn đi kèm class .jp và lang="ja". Thiếu nó thì trên Windows
//    chữ Hán rơi xuống font Trung và người học thuộc nhầm tự dạng.
//
// 4. Bàn phím là đường chính, không phải phụ trợ: Space để lật, 1-4 để đánh
//    giá. Ôn 100 thẻ mà phải rê chuột từng cái là không ai ôn hết.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, BookOpen, Check, Layers, Loader2, Play, Volume2,
} from 'lucide-react';
import {
  enrollDeck, getDecks, getDueCards, reviewCard,
} from '../../services/studyService';
import './Study.css';

/**
 * Bốn mức đánh giá, khớp enum ReviewGrade ở backend.
 *
 * Thứ tự cố ý đi từ "quên" tới "nhớ rõ" để phím số 1-4 trùng với thứ tự nút
 * trên màn hình — người học không phải nhớ ánh xạ nào cả.
 */
const GRADES = [
  { key: 'AGAIN', label: 'Quên',       cls: 'again', hint: 'Gặp lại ngay' },
  { key: 'HARD',  label: 'Khó',        cls: 'hard',  hint: 'Giãn chậm' },
  { key: 'GOOD',  label: 'Bình thường', cls: 'good',  hint: 'Giãn đều' },
  { key: 'EASY',  label: 'Dễ',         cls: 'easy',  hint: 'Giãn nhanh' },
];

/** "6 ngày", "hôm nay" — mô tả khoảng cách tới lần gặp lại. */
function describeInterval(days) {
  if (days == null) return '';
  if (days <= 0) return 'ngay trong hôm nay';
  if (days === 1) return 'ngày mai';
  return `sau ${days} ngày`;
}

// ── Danh sách bộ thẻ ─────────────────────────────────────────────────

function DeckList({ decks, onEnroll, enrolling }) {
  return (
    <div className="st-decks">
      {decks.map((deck) => {
        const total = deck.totalCards || 1;
        const maturePct = (deck.masteredCards / total) * 100;
        const learningPct = ((deck.enrolledCards - deck.masteredCards) / total) * 100;
        const allEnrolled = deck.enrolledCards >= deck.totalCards;

        return (
          <div className="st-deck" key={deck.deckId}>
            <h3>{deck.name}</h3>
            <p className="st-deck-desc">{deck.description}</p>

            <div className="st-progress" role="img"
                 aria-label={`Đã thuộc ${deck.masteredCards} trên ${deck.totalCards} thẻ`}>
              <div className="st-progress-mature" style={{ width: `${maturePct}%` }} />
              <div className="st-progress-learning" style={{ width: `${learningPct}%` }} />
            </div>

            <div className="st-deck-meta">
              <Layers size={12} />
              <span>{deck.totalCards} thẻ</span>
              {deck.enrolled && (
                <>
                  <span>·</span>
                  <span>đang học {deck.enrolledCards}</span>
                  <span>·</span>
                  <span style={{ color: 'var(--jade)' }}>thuộc {deck.masteredCards}</span>
                </>
              )}
              {deck.levelName && (
                <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{deck.levelName}</span>
              )}
            </div>

            <button
              className={`st-btn ${allEnrolled ? '' : 'primary'}`}
              disabled={enrolling === deck.deckId || allEnrolled}
              onClick={() => onEnroll(deck.deckId)}
            >
              {enrolling === deck.deckId ? (
                <><Loader2 size={14} className="st-spin" /> Đang thêm…</>
              ) : allEnrolled ? (
                <><Check size={14} /> Đã thêm hết vào lịch</>
              ) : deck.enrolled ? (
                <><Play size={14} /> Thêm {deck.totalCards - deck.enrolledCards} thẻ còn lại</>
              ) : (
                <><Play size={14} /> Bắt đầu học bộ này</>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Một thẻ đang được ôn ─────────────────────────────────────────────

function CardFace({ card, revealed }) {
  const isKanji = card.itemType === 'KANJI';

  return (
    <div className="st-card">
      <p className={`st-card-prompt jp ${isKanji ? 'kanji' : ''}`} lang="ja">
        {card.prompt}
      </p>

      {!revealed ? (
        <p className="st-card-sub">
          {card.isNew ? 'Thẻ mới' : `Đã ôn ${card.repetitions} lần`}
          {' · '}
          {isKanji ? 'Chữ Hán' : 'Từ vựng'}
        </p>
      ) : (
        <>
          <div className="st-card-divider" />

          {isKanji ? (
            <>
              <p className="st-card-meaning">{card.meaning}</p>
              <div className="st-readings">
                {card.onyomi && (
                  <div className="st-reading-row">
                    <span>ÂM ON</span>
                    <b className="jp" lang="ja">{card.onyomi}</b>
                  </div>
                )}
                {card.kunyomi && (
                  <div className="st-reading-row">
                    <span>ÂM KUN</span>
                    <b className="jp" lang="ja">{card.kunyomi}</b>
                  </div>
                )}
              </div>
              <p className="st-card-sub">
                {card.strokeCount} nét
                {card.radical && <> · bộ <span className="jp" lang="ja">{card.radical}</span></>}
              </p>
              {card.mnemonic && <p className="st-mnemonic">{card.mnemonic}</p>}
            </>
          ) : (
            <>
              <p className="st-card-reading jp" lang="ja">{card.reading}</p>
              <p className="st-card-meaning">{card.meaning}</p>
              {card.partOfSpeech && <p className="st-card-sub">{card.partOfSpeech}</p>}
              {card.exampleSentence && (
                <>
                  <div className="st-card-divider" />
                  <p className="st-card-example jp" lang="ja">{card.exampleSentence}</p>
                  <p className="st-card-example-vi">{card.exampleMeaning}</p>
                </>
              )}
              {card.audioUrl && (
                <button
                  className="st-btn"
                  onClick={() => new Audio(card.audioUrl).play().catch(() => {})}
                >
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

// ── Phiên ôn ─────────────────────────────────────────────────────────

function ReviewSession({ queue, onExit, onFinished }) {
  // Hàng đợi tại chỗ: thẻ trả lời "Quên" được đẩy xuống cuối để gặp lại ngay
  // trong phiên này (xem quy ước số 2 ở đầu file).
  const [cards, setCards] = useState(queue.cards);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [done, setDone] = useState(0);
  const [error, setError] = useState(null);

  const card = cards[index];

  const grade = useCallback(async (gradeKey) => {
    if (!card || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await reviewCard(card.itemType, card.itemId, gradeKey);
      setLastResult({ ...res, grade: gradeKey, prompt: card.prompt });
      setDone((d) => d + 1);

      setCards((prev) => {
        const rest = prev.filter((_, i) => i !== index);
        // Quên thì thẻ quay lại cuối hàng đợi của phiên này.
        return gradeKey === 'AGAIN' ? [...rest, card] : rest;
      });
      // Không tăng index: bỏ một phần tử khỏi mảng thì phần tử kế tiếp đã trượt
      // vào đúng vị trí này. Tăng thêm là nhảy cóc mất một thẻ.
      setIndex((i) => (i >= cards.length - 1 ? 0 : i));
      setRevealed(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }, [card, cards.length, index, sending]);

  // Bàn phím: Space lật thẻ, 1-4 đánh giá. Giữ trong ref để listener không
  // phải gắn lại mỗi lần state đổi.
  const gradeRef = useRef(grade);
  gradeRef.current = grade;
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;

  useEffect(() => {
    const onKey = (e) => {
      // Không cướp phím khi người dùng đang gõ ở ô nhập nào đó
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
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

  // Hết thẻ: báo cho trang cha để nó tải lại danh sách bộ thẻ.
  useEffect(() => {
    if (cards.length === 0) onFinished?.(done);
  }, [cards.length, done, onFinished]);

  if (cards.length === 0) {
    return (
      <div className="st-empty">
        <span className="st-empty-icon">🎉</span>
        <h3>Xong hàng đợi hôm nay</h3>
        <p>
          Bạn đã ôn {done} thẻ. Thẻ sẽ quay lại đúng lúc bạn sắp quên —
          quay lại vào ngày mai nhé.
        </p>
        <button className="st-btn" onClick={onExit}>
          <ArrowLeft size={14} /> Về danh sách bộ thẻ
        </button>
      </div>
    );
  }

  const totalThisSession = done + cards.length;
  const progressPct = (done / totalThisSession) * 100;

  return (
    <div className="st-session">
      <div className="st-session-bar">
        <button className="st-btn" onClick={onExit}>
          <ArrowLeft size={14} /> Thoát
        </button>
        <div className="st-progress">
          <div className="st-progress-mature" style={{ width: `${progressPct}%` }} />
        </div>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {done}/{totalThisSession}
        </span>
      </div>

      {error && <div className="st-error">{error}</div>}

      <CardFace card={card} revealed={revealed} />

      {!revealed ? (
        <button className="st-btn primary" onClick={() => setRevealed(true)}>
          Xem đáp án <span style={{ opacity: 0.7, fontWeight: 400 }}>(Space)</span>
        </button>
      ) : (
        <div className="st-grades">
          {GRADES.map((g, i) => (
            <button
              key={g.key}
              className={`st-grade ${g.cls}`}
              disabled={sending}
              onClick={() => grade(g.key)}
            >
              {g.label}
              <small>{i + 1} · {g.hint}</small>
            </button>
          ))}
        </div>
      )}

      {lastResult && (
        <p className="st-card-sub">
          Thẻ <span className="jp" lang="ja">{lastResult.prompt}</span> sẽ gặp lại{' '}
          {describeInterval(lastResult.intervalDays)}
          {lastResult.mature && ' · đã thuộc'}
        </p>
      )}
    </div>
  );
}

// ── Trang chính ──────────────────────────────────────────────────────

export default function Flashcards() {
  const [decks, setDecks] = useState([]);
  const [queue, setQueue] = useState(null);
  const [mode, setMode] = useState('decks');
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([getDecks(), getDueCards()])
      .then(([deckList, dueQueue]) => {
        setDecks(deckList);
        setQueue(dueQueue);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleEnroll = async (deckId) => {
    setEnrolling(deckId);
    setError(null);
    try {
      const added = await enrollDeck(deckId);
      setNotice(added === 0
        ? 'Bạn đã học hết thẻ của bộ này rồi.'
        : `Đã thêm ${added} thẻ vào lịch học. Ôn ngay được luôn.`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnrolling(null);
    }
  };

  const startSession = async () => {
    setError(null);
    try {
      const fresh = await getDueCards();
      setQueue(fresh);
      setMode('session');
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading && !queue) {
    return (
      <div className="st-empty">
        <Loader2 size={22} className="st-spin" />
        <p>Đang tải bộ thẻ…</p>
      </div>
    );
  }

  if (mode === 'session' && queue) {
    return (
      <ReviewSession
        queue={queue}
        onExit={() => { setMode('decks'); load(); }}
        onFinished={() => { /* danh sách sẽ được tải lại khi thoát */ }}
      />
    );
  }

  const dueCount = queue?.dueCount ?? 0;

  return (
    <div className="st-wrap">
      <div className="st-head">
        <div>
          <h2>Thẻ ghi nhớ</h2>
          <p>
            Từ vựng và chữ Hán ôn theo lịch giãn dần: thẻ nhớ tốt lâu lâu mới
            gặp lại, thẻ hay quên quay lại thường xuyên. Nhờ vậy mỗi ngày chỉ
            phải ôn vài chục thẻ thay vì đọc lại cả nghìn thẻ.
          </p>
        </div>
        <div className="st-stats">
          <div className="st-stat due">
            <b>{dueCount}</b><span>Đến hạn</span>
          </div>
          <div className="st-stat">
            <b>{queue?.totalCards ?? 0}</b><span>Đang học</span>
          </div>
          <div className="st-stat done">
            <b>{queue?.matureCards ?? 0}</b><span>Đã thuộc</span>
          </div>
        </div>
      </div>

      {error && <div className="st-error">{error}</div>}
      {notice && (
        <div className="st-verdict ok" style={{ fontSize: 13 }}>
          <b>{notice}</b>
        </div>
      )}

      {dueCount > 0 ? (
        <div className="st-deck" style={{ borderColor: 'var(--gold)' }}>
          <h3>Hôm nay có {dueCount} thẻ đến hạn</h3>
          <p className="st-deck-desc">
            {dueCount > queue.dailyLimit
              ? `Phiên này sẽ lấy ${queue.dailyLimit} thẻ — số còn lại để dành hôm sau, ôn dồn một lúc quá nhiều chỉ khiến bạn bỏ cuộc.`
              : `Khoảng ${Math.max(1, Math.round(dueCount / 6))} phút. Trong đó có ${queue.newCount} thẻ mới.`}
          </p>
          <button className="st-btn primary" onClick={startSession}>
            <BookOpen size={14} /> Bắt đầu ôn
          </button>
        </div>
      ) : queue?.totalCards > 0 ? (
        <div className="st-empty">
          <span className="st-empty-icon">✅</span>
          <h3>Hôm nay không còn thẻ nào đến hạn</h3>
          <p>
            Bạn đang học {queue.totalCards} thẻ, đã thuộc {queue.matureCards}.
            Muốn học thêm thì thêm một bộ thẻ mới bên dưới.
          </p>
        </div>
      ) : null}

      <div className="st-head" style={{ marginTop: 4 }}>
        <div>
          <h2 style={{ fontSize: 15 }}>Bộ thẻ</h2>
          <p>Chọn một bộ để thêm thẻ vào lịch học của bạn.</p>
        </div>
      </div>

      {decks.length === 0 ? (
        <div className="st-empty">
          <span className="st-empty-icon">🗂️</span>
          <h3>Chưa có bộ thẻ nào</h3>
          <p>Hệ thống chưa nạp nội dung học cho trình độ của bạn.</p>
        </div>
      ) : (
        <DeckList decks={decks} onEnroll={handleEnroll} enrolling={enrolling} />
      )}
    </div>
  );
}
