import React, { useState } from "react";
import { useAuth } from "../context/useAuth.js";

const DEFAULT_ROOMS = [
  { id: "OksyAcademy-WebDev", title: "Full-Stack Web Dev Lab", batch: "FSW-2026-A", active: true },
  { id: "OksyAcademy-Databases", title: "Database Architecture", batch: "FSW-2026-A", active: false },
  { id: "OksyAcademy-Accounts", title: "Business & Financial Accounting", batch: "BCOM-2026", active: false },
  { id: "OksyAcademy-General", title: "Open Study Room & Doubts", batch: "All Batches", active: true },
];

export default function LiveClassPage({ initialRoom, initialTitle }) {
  const { profile } = useAuth();
  const userName = profile?.full_name || profile?.email?.split("@")[0] || "Student";
  const [selectedRoom, setSelectedRoom] = useState(
    initialRoom ? initialRoom.replace("https://meet.jit.si/", "") : DEFAULT_ROOMS[0].id
  );
  const [inCall, setInCall] = useState(false);
  const [notes, setNotes] = useState("");

  const jitsiUrl = `https://meet.jit.si/${selectedRoom}#userInfo.displayName="${encodeURIComponent(userName)}"&config.prejoinPageEnabled=false`;

  return (
    <section className="page">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2>Online Classroom {initialTitle ? `— ${initialTitle}` : ""}</h2>
          <p>Zero-cost, secure WebRTC live classes with screen share, multi-user audio/video, and interactive chat.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {!inCall ? (
            <button className="button primary" onClick={() => setInCall(true)}>
              ▶ Launch Classroom
            </button>
          ) : (
            <button className="button secondary" onClick={() => setInCall(false)} style={{ color: "var(--danger, #ef4444)" }}>
              ✕ Leave Classroom
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: inCall ? "1fr 320px" : "1fr", gap: "1.5rem" }}>
        <div className="table-card" style={{ padding: "1.5rem", minHeight: inCall ? "650px" : "auto" }}>
          {!inCall ? (
            <div style={{ padding: "2rem 1rem", textAlign: "center" }}>
              <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>🎥</div>
              <h3 style={{ fontSize: "1.4rem", marginBottom: "0.5rem" }}>Ready to join the live session?</h3>
              <p style={{ color: "var(--text-muted, #64748b)", maxWidth: "500px", margin: "0 auto 1.5rem auto" }}>
                Select your classroom room below and click Launch. You will join as <strong>{userName}</strong>.
              </p>

              <div style={{ maxWidth: "400px", margin: "0 auto 1.5rem auto", textAlign: "left" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", marginBottom: "0.4rem" }}>
                  Select Classroom Room:
                </label>
                <select
                  className="input"
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                >
                  {DEFAULT_ROOMS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} ({r.batch})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: "1rem" }}>
                <button className="button primary" onClick={() => setInCall(true)} style={{ padding: "0.75rem 2rem", fontSize: "1rem" }}>
                  Join Meeting Now
                </button>
                <a
                  href={`https://meet.jit.si/${selectedRoom}`}
                  target="_blank"
                  rel="noreferrer"
                  className="button secondary"
                  style={{ padding: "0.75rem 1.5rem", textDecoration: "none" }}
                >
                  Open in New Window ↗
                </a>
              </div>
            </div>
          ) : (
            <div style={{ height: "650px", width: "100%", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border, #e2e8f0)" }}>
              <iframe
                title="Live Jitsi Classroom"
                src={jitsiUrl}
                style={{ width: "100%", height: "100%", border: "none" }}
                allow="camera; microphone; fullscreen; display-capture; autoplay"
              />
            </div>
          )}
        </div>

        {inCall && (
          <div className="table-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h4>Classroom Notebook</h4>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted, #64748b)", margin: 0 }}>
              Jot down quick questions or notes during the lecture.
            </p>
            <textarea
              className="input"
              rows={12}
              placeholder="Take personal lecture notes here..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ resize: "vertical", width: "100%" }}
            />
            <button
              className="button secondary"
              onClick={() => {
                const blob = new Blob([notes], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `notes-${selectedRoom}-${new Date().toISOString().slice(0, 10)}.txt`;
                a.click();
              }}
              disabled={!notes.trim()}
            >
              💾 Export Notes
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
