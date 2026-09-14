// src/components/common/NotificationBell.jsx
// Ô chuông trên thanh trên.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { notificationApi } from '../../services/engagementService';
import './NotificationBell.css';

const POLL_MS = 60_000;

function timeAgo(value) {
  if (!value) return '';
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  if (Number.isNaN(diff)) return '';
  if (diff < 60) return 'vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}

/** @param buttonClass class của nút theo giao diện đang dùng (sd-icon-btn / td-icon-btn) */
export default function NotificationBell({ buttonClass = 'sd-icon-btn' }) {
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const boxRef = useRef(null);

  const refreshCount = useCallback(() => {
    notificationApi.unreadCount().then(setUnread).catch(() => {});
  }, []);

  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, POLL_MS);
    return () => clearInterval(id);
  }, [refreshCount]);

  // Bấm ra ngoài thì đóng.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setItems(null);
      notificationApi.list().then(setItems).catch(() => setItems([]));
    }
  };

  const openItem = async (n) => {
    if (!n.read) {
      notificationApi.markRead(n.notificationId).catch(() => {});
      setItems((prev) => prev?.map((x) => (x.notificationId === n.notificationId ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
    }
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };

  const readAll = async () => {
    await notificationApi.markAllRead().catch(() => {});
    setItems((prev) => prev?.map((x) => ({ ...x, read: true })));
    setUnread(0);
  };

  return (
    <div className="nb-wrap" ref={boxRef}>
      <button className={`${buttonClass} nb-button`} title="Thông báo" onClick={toggle}>
        <Bell size={16} />
        {unread > 0 && <span className="nb-dot">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="nb-panel">
          <div className="nb-head">
            <strong>Thông báo</strong>
            {unread > 0 && (
              <button className="nb-link" onClick={readAll}>
                <CheckCheck size={13} /> Đã đọc hết
              </button>
            )}
          </div>

          {items == null ? (
            <p className="nb-empty">Đang tải…</p>
          ) : items.length === 0 ? (
            <p className="nb-empty">Chưa có thông báo nào. Khi phòng thi bắt đầu hay có thẻ tới hạn ôn, bạn sẽ thấy ở đây.</p>
          ) : (
            <ul className="nb-list">
              {items.map((n) => (
                <li key={n.notificationId}>
                  <button className={`nb-item ${n.read ? '' : 'unread'}`} onClick={() => openItem(n)}>
                    <span className="nb-subject">{n.subject}</span>
                    {n.message && <span className="nb-message">{n.message}</span>}
                    <span className="nb-time">{timeAgo(n.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
