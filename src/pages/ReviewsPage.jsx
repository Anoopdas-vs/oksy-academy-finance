import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "../components/ui.jsx";
import {
  fetchFacultyReviews,
  submitFacultyReview,
  fetchFacultyProfiles,
} from "../lib/academy.js";

const Stars = ({ n }) => <span aria-label={`${n} of 5`}>{"★".repeat(n)}{"☆".repeat(5 - n)}</span>;
const emptyForm = { faculty_id: "", faculty_name: "", subject: "", rating: 5, clarity: 5, punctuality: 5, comment: "" };

export default function ReviewsPage({ access }) {
  const isStudent = access.isStudent;
  const [reviews, setReviews] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { rows, error } = await fetchFacultyReviews();
    if (error?.suitePending) { setPending(true); return; }
    if (error) setErr(error.message);
    setReviews(rows);
    const { rows: f } = await fetchFacultyProfiles();
    setFaculty(f);
  }, []);
  useEffect(() => { load(); }, [load]);

  // Faculty see only reviews about themselves; the DB already scopes this,
  // but keep the guard for clarity.
  const scoped = useMemo(
    () => (access.isFaculty ? reviews.filter((r) => r.faculty_id === access.userId) : reviews),
    [reviews, access.isFaculty, access.userId]
  );

  const byFaculty = useMemo(() => {
    const m = new Map();
    scoped.forEach((r) => {
      const k = r.faculty_name;
      if (!m.has(k)) m.set(k, { name: k, n: 0, rating: 0, clarity: 0, punctuality: 0 });
      const g = m.get(k);
      g.n += 1; g.rating += r.rating; g.clarity += r.clarity; g.punctuality += r.punctuality;
    });
    return [...m.values()].map((g) => ({
      ...g,
      rating: (g.rating / g.n).toFixed(1),
      clarity: (g.clarity / g.n).toFixed(1),
      punctuality: (g.punctuality / g.n).toFixed(1),
    }));
  }, [scoped]);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    const chosen = faculty.find((f) => f.id === form.faculty_id);
    const { error } = await submitFacultyReview({
      faculty_id: form.faculty_id || null,
      faculty_name: chosen ? (chosen.full_name || chosen.email) : form.faculty_name.trim(),
      subject: form.subject.trim() || null,
      rating: Number(form.rating),
      clarity: Number(form.clarity),
      punctuality: Number(form.punctuality),
      comment: form.comment.trim() || null,
      student_id: access.userId,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setShowForm(false); setForm(emptyForm); load();
  };

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h2>Faculty Reviews</h2>
          <p>{isStudent ? "Rate your faculty — feedback is anonymised in reports." : "Student feedback and rating trends."}</p>
        </div>
        {isStudent && !pending && <button className="button primary" onClick={() => setShowForm(true)}>+ Add review</button>}
      </div>

      {pending && (
        <div className="empty-state">
          <div className="empty-icon">⭐</div>
          <h3>Reviews setup pending</h3>
          <p>Run <code>supabase/migration-academy-suite-v2.sql</code> to enable reviews.</p>
        </div>
      )}
      {err && <div className="auth-message error">{err}</div>}

      {!pending && (
        <>
          {byFaculty.length > 0 && (
            <div className="table-card">
              <div className="card-heading"><div><h3>Averages</h3></div></div>
              <table>
                <thead><tr><th>Faculty</th><th>Reviews</th><th>Overall</th><th>Clarity</th><th>Punctuality</th></tr></thead>
                <tbody>
                  {byFaculty.map((g) => (
                    <tr key={g.name}>
                      <td><strong>{g.name}</strong></td>
                      <td>{g.n}</td>
                      <td>{g.rating}</td>
                      <td>{g.clarity}</td>
                      <td>{g.punctuality}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="table-card">
            <div className="card-heading"><div><h3>Recent reviews</h3></div></div>
            <table>
              <thead><tr><th>Faculty</th><th>Subject</th><th>Rating</th><th>Comment</th><th>Date</th></tr></thead>
              <tbody>
                {scoped.length === 0 && <tr><td colSpan={5} className="table-empty">No reviews yet.</td></tr>}
                {scoped.map((r) => (
                  <tr key={r.id}>
                    <td>{r.faculty_name}</td>
                    <td>{r.subject || "—"}</td>
                    <td><Stars n={r.rating} /></td>
                    <td>{r.comment || "—"}</td>
                    <td>{(r.created_at || "").slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showForm && (
        <Modal title="Rate a faculty member" onClose={() => setShowForm(false)}>
          <form className="form-grid" onSubmit={submit}>
            {err && <div className="form-error-banner">{err}</div>}
            <div className="field">
              <label>Faculty</label>
              <select value={form.faculty_id} onChange={(e) => setForm({ ...form, faculty_id: e.target.value })} required>
                <option value="">— select —</option>
                {faculty.map((f) => <option key={f.id} value={f.id}>{f.full_name || f.email}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Subject (optional)</label>
              <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>
            {["rating", "clarity", "punctuality"].map((k) => (
              <div className="field" key={k}>
                <label style={{ textTransform: "capitalize" }}>{k}</label>
                <select value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })}>
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
                </select>
              </div>
            ))}
            <div className="field">
              <label>Comment</label>
              <textarea className="input" rows={3} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
            </div>
            <div className="form-actions">
              <button type="button" className="button secondary" onClick={() => setShowForm(false)} disabled={busy}>Cancel</button>
              <button type="submit" className="button primary" disabled={busy}>{busy ? "Submitting…" : "Submit review"}</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
