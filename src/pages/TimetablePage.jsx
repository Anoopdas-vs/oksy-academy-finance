import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Input } from "../components/ui.jsx";
import {
  fetchTimetable,
  saveTimetableSlot,
  deleteTimetableSlot,
  fetchFacultyProfiles,
  notifyBatch,
} from "../lib/academy.js";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MODES = [
  { value: "live", label: "Live (online)" },
  { value: "in_person", label: "In person" },
];

const emptyForm = {
  id: null,
  batch_name: "",
  faculty_id: "",
  subject: "",
  day_of_week: "Monday",
  starts_at: "10:00",
  ends_at: "11:30",
  mode: "live",
  room: "",
  join_link: "",
  status: "scheduled",
};

const emptyNotify = { batch_name: "", title: "", body: "" };

export default function TimetablePage({ access, batches = [], onOpenLiveClass }) {
  const canManage = access.isStaffOrAdmin;
  const [slots, setSlots] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState("");
  const [day, setDay] = useState(DAYS[new Date().getDay() ? new Date().getDay() - 1 : 0] || "Monday");
  const [batchFilter, setBatchFilter] = useState("all");
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notifyForm, setNotifyForm] = useState(emptyNotify);
  const [showNotify, setShowNotify] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { rows, error } = await fetchTimetable();
    if (error?.suitePending) setPending(true);
    else if (error) setErr(error.message);
    setSlots(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    if (canManage) fetchFacultyProfiles().then(({ rows }) => setFaculty(rows));
  }, [load, canManage]);

  const facultyName = useMemo(() => {
    const m = new Map(faculty.map((f) => [f.id, f.full_name || f.email]));
    return (id) => m.get(id) || "Unassigned";
  }, [faculty]);

  const visible = slots.filter((s) => {
    if (s.day_of_week !== day) return false;
    if (batchFilter !== "all" && s.batch_name !== batchFilter) return false;
    return true;
  });

  const openCreate = () => {
    setForm({ ...emptyForm, batch_name: batches[0]?.name || "" });
    setShowForm(true);
  };
  const openEdit = (s) => {
    setForm({
      id: s.id,
      batch_name: s.batch_name,
      faculty_id: s.faculty_id || "",
      subject: s.subject,
      day_of_week: s.day_of_week,
      starts_at: (s.starts_at || "10:00").slice(0, 5),
      ends_at: (s.ends_at || "11:30").slice(0, 5),
      mode: s.mode,
      room: s.room || "",
      join_link: s.join_link || "",
      status: s.status,
    });
    setShowForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setSaving(true);
    const payload = {
      ...(form.id ? { id: form.id } : {}),
      batch_name: form.batch_name,
      faculty_id: form.faculty_id || null,
      subject: form.subject.trim(),
      day_of_week: form.day_of_week,
      starts_at: form.starts_at,
      ends_at: form.ends_at,
      mode: form.mode,
      room: form.room.trim() || null,
      join_link: form.join_link.trim() || null,
      status: form.status,
    };
    const { error } = await saveTimetableSlot(payload);
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    if (form.id) {
      notifyBatch(payload.batch_name, {
        type: "timetable",
        title: `Timetable updated: ${payload.subject}`,
        body: `${payload.day_of_week} ${payload.starts_at}–${payload.ends_at}`,
        link: "Timetable",
      });
    }
    setShowForm(false);
    load();
  };

  const cancelSlot = async (s) => {
    if (!window.confirm(`Cancel ${s.subject} for ${s.batch_name}?`)) return;
    await saveTimetableSlot({ id: s.id, status: "cancelled" });
    notifyBatch(s.batch_name, {
      type: "timetable",
      title: `Class cancelled: ${s.subject}`,
      body: `${s.day_of_week} ${(s.starts_at || "").slice(0, 5)}`,
      link: "Timetable",
    });
    load();
  };
  const removeSlot = async (s) => {
    if (!window.confirm("Delete this slot permanently?")) return;
    await deleteTimetableSlot(s.id);
    load();
  };

  const openNotify = () => {
    setNotifyForm({ ...emptyNotify, batch_name: batchFilter !== "all" ? batchFilter : batches[0]?.name || "" });
    setNotifyMsg("");
    setShowNotify(true);
  };
  const sendNotify = async (e) => {
    e.preventDefault();
    setNotifying(true);
    setNotifyMsg("");
    const { count, error } = await notifyBatch(notifyForm.batch_name, {
      type: "announcement",
      title: notifyForm.title.trim(),
      body: notifyForm.body.trim() || null,
    });
    setNotifying(false);
    if (error) {
      setNotifyMsg(error.message);
      return;
    }
    setNotifyMsg(`Sent to ${count} student${count === 1 ? "" : "s"} in ${notifyForm.batch_name}.`);
    setNotifyForm(emptyNotify);
  };

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h2>Timetable</h2>
          <p>
            {canManage
              ? "Schedule classes, assign faculty and set join links."
              : "Your weekly class schedule."}
          </p>
        </div>
        {canManage && !pending && (
          <div className="row-actions">
            <button className="button secondary" onClick={openNotify}>
              📣 Notify batch
            </button>
            <button className="button primary" onClick={openCreate}>
              + Schedule class
            </button>
          </div>
        )}
      </div>

      {pending && (
        <div className="empty-state">
          <div className="empty-icon">🗓️</div>
          <h3>Timetable setup pending</h3>
          <p>Run <code>supabase/migration-academy-suite-v2.sql</code> to enable the timetable.</p>
        </div>
      )}
      {err && <div className="auth-message error">{err}</div>}

      {!pending && (
        <>
          <div className="toolbar">
            <div className="subtab-switch">
              {DAYS.map((d) => (
                <button
                  key={d}
                  className={day === d ? "subtab active" : "subtab"}
                  onClick={() => setDay(d)}
                >
                  {d.slice(0, 3)}
                </button>
              ))}
            </div>
            {canManage && (
              <select
                className="input"
                style={{ width: "auto" }}
                value={batchFilter}
                onChange={(e) => setBatchFilter(e.target.value)}
              >
                <option value="all">All batches</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Subject</th>
                  <th>Batch</th>
                  <th>Faculty</th>
                  <th>Mode</th>
                  <th></th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={canManage ? 7 : 6}>Loading…</td></tr>
                )}
                {!loading && visible.length === 0 && (
                  <tr><td colSpan={canManage ? 7 : 6} className="table-empty">No classes on {day}.</td></tr>
                )}
                {visible.map((s) => (
                  <tr key={s.id} className={s.status === "cancelled" ? "row-muted" : ""}>
                    <td>{(s.starts_at || "").slice(0, 5)}–{(s.ends_at || "").slice(0, 5)}</td>
                    <td><strong>{s.subject}</strong></td>
                    <td><span className="mini-tag">{s.batch_name}</span></td>
                    <td>{facultyName(s.faculty_id)}</td>
                    <td>{s.mode === "live" ? "Live" : "In person"}</td>
                    <td>
                      {s.status === "cancelled" ? (
                        <span className="mini-tag warn">Cancelled</span>
                      ) : s.mode === "live" && s.join_link ? (
                        <button
                          className="button secondary small"
                          onClick={() => onOpenLiveClass?.()}
                        >
                          Live Class →
                        </button>
                      ) : null}
                    </td>
                    {canManage && (
                      <td className="row-actions">
                        <button className="button secondary small" onClick={() => openEdit(s)}>Edit</button>
                        {s.status !== "cancelled" && (
                          <button className="button ghost small" onClick={() => cancelSlot(s)}>Cancel</button>
                        )}
                        <button className="button ghost small danger" onClick={() => removeSlot(s)}>Delete</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showForm && (
        <Modal title={form.id ? "Edit class" : "Schedule class"} onClose={() => setShowForm(false)}>
          <form className="form-grid" onSubmit={submit}>
            {err && <div className="form-error-banner">{err}</div>}
            <div className="field">
              <label>Batch</label>
              <select
                value={form.batch_name}
                onChange={(e) => setForm({ ...form, batch_name: e.target.value })}
                required
              >
                <option value="">— select —</option>
                {batches.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Faculty</label>
              <select
                value={form.faculty_id}
                onChange={(e) => setForm({ ...form, faculty_id: e.target.value })}
              >
                <option value="">Unassigned</option>
                {faculty.map((f) => (
                  <option key={f.id} value={f.id}>{f.full_name || f.email}</option>
                ))}
              </select>
            </div>
            <Input label="Subject" value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} required />
            <div className="field">
              <label>Day</label>
              <select value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}>
                {DAYS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="field-row">
              <Input label="Start" type="time" value={form.starts_at} onChange={(v) => setForm({ ...form, starts_at: v })} required />
              <Input label="End" type="time" value={form.ends_at} onChange={(v) => setForm({ ...form, ends_at: v })} required />
            </div>
            <div className="field">
              <label>Mode</label>
              <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <Input label="Room" value={form.room} onChange={(v) => setForm({ ...form, room: v })} />
            <Input label="Join link" value={form.join_link} onChange={(v) => setForm({ ...form, join_link: v })} placeholder="https://meet.jit.si/…" />
            <div className="form-actions">
              <button type="button" className="button secondary" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
              <button type="submit" className="button primary" disabled={saving}>
                {saving ? "Saving…" : form.id ? "Save changes" : "Schedule"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showNotify && (
        <Modal title="Notify batch" onClose={() => setShowNotify(false)}>
          <form className="form-grid" onSubmit={sendNotify}>
            {notifyMsg && (
              <div className={notifyMsg.startsWith("Sent") ? "auth-message notice" : "form-error-banner"}>
                {notifyMsg}
              </div>
            )}
            <div className="field">
              <label>Batch</label>
              <select
                value={notifyForm.batch_name}
                onChange={(e) => setNotifyForm({ ...notifyForm, batch_name: e.target.value })}
                required
              >
                <option value="">— select —</option>
                {batches.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
            </div>
            <Input
              label="Title"
              value={notifyForm.title}
              onChange={(v) => setNotifyForm({ ...notifyForm, title: v })}
              required
            />
            <div className="field">
              <label>Message (optional)</label>
              <textarea
                className="input"
                rows={3}
                value={notifyForm.body}
                onChange={(e) => setNotifyForm({ ...notifyForm, body: e.target.value })}
              />
            </div>
            <div className="form-actions">
              <button type="button" className="button secondary" onClick={() => setShowNotify(false)} disabled={notifying}>
                Close
              </button>
              <button type="submit" className="button primary" disabled={notifying || !notifyForm.batch_name}>
                {notifying ? "Sending…" : "Send"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
