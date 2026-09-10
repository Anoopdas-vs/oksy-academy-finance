import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../lib/academy.js";

// Topbar bell: unread count + dropdown list. Polls every 60s. Silent no-op
// if the notifications table isn't there yet (v2 migration not run).
export default function NotificationBell({ onNavigate }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const boxRef = useRef(null);

  const load = useCallback(async () => {
    const { rows, error } = await fetchNotifications(30);
    if (error?.suitePending) { setHidden(true); return; }
    setItems(rows);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (hidden) return null;

  const unread = items.filter((n) => !n.read_at).length;

  const openItem = async (n) => {
    if (!n.read_at) {
      await markNotificationRead(n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    }
    if (n.link_tab && onNavigate) onNavigate(n.link_tab);
    setOpen(false);
  };

  const markAll = async () => {
    await markAllNotificationsRead();
    setItems((prev) => prev.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
  };

  return (
    <div className="notif" ref={boxRef} style={{ position: "relative" }}>
      <button
        className="nav-toggle"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        onClick={() => setOpen((o) => !o)}
        style={{ position: "relative" }}
      >
        🔔
        {unread > 0 && (
          <span
            style={{
              position: "absolute", top: 2, right: 2, minWidth: 16, height: 16,
              padding: "0 4px", borderRadius: 8, background: "var(--danger)", color: "#fff",
              fontSize: 10, fontWeight: 700, lineHeight: "16px", textAlign: "center",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute", right: 0, top: "calc(100% + 8px)", width: 320, maxHeight: 420,
            overflowY: "auto", background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 12, boxShadow: "0 12px 32px rgba(20,22,40,0.18)", zIndex: 2000,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
            <strong style={{ fontSize: 13 }}>Notifications</strong>
            {unread > 0 && (
              <button className="button ghost small" onClick={markAll}>Mark all read</button>
            )}
          </div>
          {items.length === 0 && (
            <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              You’re all caught up.
            </div>
          )}
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => openItem(n)}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "10px 12px",
                border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer",
                background: n.read_at ? "transparent" : "var(--purple-pale)",
                color: "inherit",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: n.read_at ? 400 : 600 }}>{n.title}</div>
              {n.body && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{n.body}</div>}
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                {new Date(n.created_at).toLocaleString()}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
