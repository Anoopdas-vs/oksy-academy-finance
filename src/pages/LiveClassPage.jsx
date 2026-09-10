import React, { useCallback, useEffect, useState } from "react";
import {
  fetchTimetable,
  fetchLiveSessions,
  startLiveSession,
  endLiveSession,
  joinLiveSession,
  fetchAttendance,
} from "../lib/academy.js";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function LiveClassPage({ access }) {
  const today = DAY_NAMES[new Date().getDay()];
  const [slots, setSlots] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attendanceFor, setAttendanceFor] = useState(null); // session id
  const [attendance, setAttendance] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [tt, ls] = await Promise.all([fetchTimetable(), fetchLiveSessions()]);
    if (tt.error?.suitePending || ls.error?.suitePending) setPending(true);
    setSlots(tt.rows.filter((s) => s.mode === "live" && s.status !== "cancelled"));
    setSessions(ls.rows);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeSessionForSlot = (slotId) =>
    sessions.find((s) => s.slot_id === slotId && !s.ended_at);

  const openLink = (link) => {
    if (link) window.open(link, "_blank", "noopener");
  };

  const onStart = async (slot) => {
    const { row, error } = await startLiveSession(slot.id, access.userId);
    if (error) return alert(error.message);
    openLink(slot.join_link);
    if (row) setSessions((prev) => [row, ...prev]);
  };

  const onEnd = async (session) => {
    await endLiveSession(session.id);
    load();
  };

  const onJoin = async (slot) => {
    const active = activeSessionForSlot(slot.id);
    if (active && access.userId) await joinLiveSession(active.id, access.userId);
    openLink(slot.join_link);
  };

  const showAttendance = async (session) => {
    setAttendanceFor(session.id);
    const { rows } = await fetchAttendance(session.id);
    setAttendance(rows);
  };

  const todaySlots = slots.filter((s) => s.day_of_week === today);
  const canHost = access.isFaculty || access.isStaffOrAdmin;

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h2>Live Classes</h2>
          <p>Today’s live sessions{canHost ? " — start a class to open the room and take attendance." : " — join when your class is live."}</p>
        </div>
      </div>

      {pending && (
        <div className="empty-state">
          <div className="empty-icon">🎥</div>
          <h3>Live Class setup pending</h3>
          <p>Run <code>supabase/migration-academy-suite-v2.sql</code> to enable live sessions.</p>
        </div>
      )}

      {!pending && (
        <>
          <div className="table-card">
            <div className="card-heading"><div><h3>Today · {today}</h3></div></div>
            <table>
              <thead>
                <tr><th>Time</th><th>Subject</th><th>Batch</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={5}>Loading…</td></tr>}
                {!loading && todaySlots.length === 0 && (
                  <tr><td colSpan={5} className="table-empty">No live classes scheduled today.</td></tr>
                )}
                {todaySlots.map((s) => {
                  const active = activeSessionForSlot(s.id);
                  return (
                    <tr key={s.id}>
                      <td>{(s.starts_at || "").slice(0, 5)}–{(s.ends_at || "").slice(0, 5)}</td>
                      <td><strong>{s.subject}</strong></td>
                      <td><span className="mini-tag">{s.batch_name}</span></td>
                      <td>{active ? <span className="mini-tag ok">Live now</span> : <span className="mini-tag">Not started</span>}</td>
                      <td className="row-actions">
                        {canHost && !active && (
                          <button className="button primary small" onClick={() => onStart(s)}>Start</button>
                        )}
                        {canHost && active && (
                          <>
                            <button className="button secondary small" onClick={() => openLink(s.join_link)}>Open room</button>
                            <button className="button secondary small" onClick={() => showAttendance(active)}>Attendance</button>
                            <button className="button ghost small danger" onClick={() => onEnd(active)}>End</button>
                          </>
                        )}
                        {!canHost && (
                          <button
                            className="button primary small"
                            disabled={!active}
                            onClick={() => onJoin(s)}
                          >
                            {active ? "Join" : "Waiting…"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {access.isStaffOrAdmin && (
            <div className="table-card">
              <div className="card-heading"><div><h3>Recent sessions</h3><p>Monitor</p></div></div>
              <table>
                <thead><tr><th>Started</th><th>Class</th><th>Batch</th><th>Ended</th><th></th></tr></thead>
                <tbody>
                  {sessions.slice(0, 15).map((ls) => (
                    <tr key={ls.id}>
                      <td>{new Date(ls.started_at).toLocaleString()}</td>
                      <td>{ls.slot?.subject || "—"}</td>
                      <td>{ls.slot?.batch_name || "—"}</td>
                      <td>{ls.ended_at ? new Date(ls.ended_at).toLocaleTimeString() : <span className="mini-tag ok">Live</span>}</td>
                      <td><button className="button secondary small" onClick={() => showAttendance(ls)}>Attendance</button></td>
                    </tr>
                  ))}
                  {sessions.length === 0 && <tr><td colSpan={5} className="table-empty">No sessions yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {attendanceFor && (
        <div className="table-card">
          <div className="card-heading between">
            <div><h3>Attendance</h3><p>{attendance.length} present</p></div>
            <button className="button secondary small" onClick={() => setAttendanceFor(null)}>Close</button>
          </div>
          <table>
            <thead><tr><th>Student</th><th>Joined</th></tr></thead>
            <tbody>
              {attendance.map((a) => (
                <tr key={a.student_id}>
                  <td>{a.student?.full_name || a.student?.email || a.student_id}</td>
                  <td>{new Date(a.joined_at).toLocaleTimeString()}</td>
                </tr>
              ))}
              {attendance.length === 0 && <tr><td colSpan={2} className="table-empty">No one has joined yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
