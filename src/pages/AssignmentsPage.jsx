import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Input } from "../components/ui.jsx";
import { today } from "../lib/format.js";
import {
  fetchAssignments,
  saveAssignment,
  deleteAssignment,
  fetchSubmissions,
  submitAssignment,
  gradeSubmission,
  notifyBatch,
} from "../lib/academy.js";

const emptyCreate = { id: null, title: "", batch_name: "", due_date: today(), max_marks: 100, description: "" };

export default function AssignmentsPage({ access, batches = [] }) {
  const canManage = access.isStaffOrAdmin || access.isFaculty;
  const isStudent = access.isStudent;

  const [assignments, setAssignments] = useState([]);
  const [subs, setSubs] = useState([]);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState(null); // 'create' | 'submit' | 'grade' | 'subs'
  const [current, setCurrent] = useState(null);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [submitForm, setSubmitForm] = useState({ link: "", notes: "" });
  const [gradeForm, setGradeForm] = useState({ marks: "", feedback: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { rows, error } = await fetchAssignments();
    if (error?.suitePending) { setPending(true); setLoading(false); return; }
    if (error) setErr(error.message);
    setAssignments(rows);
    const { rows: sr } = await fetchSubmissions(rows.map((a) => a.id));
    setSubs(sr);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const mySub = useCallback(
    (asgId) => subs.find((s) => s.assignment_id === asgId && s.student_id === access.userId),
    [subs, access.userId]
  );
  const subsFor = useCallback((asgId) => subs.filter((s) => s.assignment_id === asgId), [subs]);

  const visible = useMemo(() => assignments.filter((a) => {
    if (isStudent && a.status !== "published") return false;
    if (filter === "published") return a.status === "published";
    if (filter === "draft") return a.status === "draft";
    return true;
  }), [assignments, filter, isStudent]);

  const openCreate = () => { setCreateForm({ ...emptyCreate, batch_name: batches[0]?.name || "" }); setModal("create"); };
  const openEdit = (a) => {
    setCurrent(a);
    setCreateForm({ id: a.id, title: a.title, batch_name: a.batch_name, due_date: a.due_date || today(), max_marks: a.max_marks, description: a.description || "" });
    setModal("create");
  };

  const doSave = async (publish) => {
    setBusy(true); setErr("");
    const payload = {
      ...(createForm.id ? { id: createForm.id } : {}),
      title: createForm.title.trim(),
      batch_name: createForm.batch_name,
      description: createForm.description.trim() || null,
      max_marks: Number(createForm.max_marks) || 100,
      due_date: createForm.due_date || null,
      faculty_id: access.userId,
      created_by: access.userId,
      status: publish ? "published" : "draft",
      ...(publish ? { published_at: new Date().toISOString() } : {}),
    };
    const { row, error } = await saveAssignment(payload);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    if (publish && row) {
      notifyBatch(row.batch_name, {
        type: "assignment",
        title: `New assignment: ${row.title}`,
        body: row.due_date ? `Due ${row.due_date}` : "",
        link: "Assignments",
      });
    }
    setModal(null); load();
  };

  const doDelete = async (a) => {
    if (!window.confirm(`Delete "${a.title}"?`)) return;
    await deleteAssignment(a.id); load();
  };

  const openSubmit = (a) => {
    const ex = mySub(a.id);
    setCurrent(a);
    setSubmitForm({ link: ex?.link || "", notes: ex?.notes || "" });
    setModal("submit");
  };
  const doSubmit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    const isLate = current.due_date && today() > current.due_date;
    const { error } = await submitAssignment(current.id, access.userId, { ...submitForm, isLate });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setModal(null); load();
  };

  const openGrade = (a, sub) => { setCurrent({ a, sub }); setGradeForm({ marks: sub.marks ?? "", feedback: sub.feedback || "" }); setModal("grade"); };
  const doGrade = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    const { error } = await gradeSubmission(current.sub.id, {
      marks: Number(gradeForm.marks),
      feedback: gradeForm.feedback,
      graderId: access.userId,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setModal(null); load();
  };

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h2>Assignments</h2>
          <p>{canManage ? "Create, publish and grade coursework." : "Your coursework and grades."}</p>
        </div>
        {canManage && !pending && (
          <button className="button primary" onClick={openCreate}>+ Create assignment</button>
        )}
      </div>

      {pending && (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>Assignments setup pending</h3>
          <p>Run <code>supabase/migration-academy-suite-v2.sql</code> to enable assignments.</p>
        </div>
      )}
      {err && <div className="auth-message error">{err}</div>}

      {!pending && (
        <>
          {canManage && (
            <div className="toolbar">
              <div className="subtab-switch">
                {["all", "published", "draft"].map((f) => (
                  <button key={f} className={filter === f ? "subtab active" : "subtab"} onClick={() => setFilter(f)}>
                    {f[0].toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {loading && <div className="table-card" style={{ padding: "2rem" }}>Loading…</div>}
            {!loading && visible.length === 0 && (
              <div className="table-card table-empty" style={{ padding: "2rem" }}>Nothing here yet.</div>
            )}
            {visible.map((a) => {
              const sub = isStudent ? mySub(a.id) : null;
              const all = subsFor(a.id);
              const graded = all.filter((s) => s.status === "graded").length;
              return (
                <div key={a.id} className="table-card" style={{ padding: "1.25rem" }}>
                  <div className="card-heading between">
                    <div>
                      <h3 style={{ margin: 0 }}>{a.title}</h3>
                      <p style={{ margin: "2px 0 0" }}>
                        <span className="mini-tag">{a.batch_name}</span>{" "}
                        {a.status === "draft" && <span className="mini-tag warn">Draft</span>}
                        {a.due_date && <> · Due {a.due_date}</>} · {a.max_marks} marks
                      </p>
                    </div>
                    <div className="row-actions">
                      {isStudent && (
                        <button className="button primary small" onClick={() => openSubmit(a)}>
                          {sub ? (sub.status === "graded" ? "View" : "Edit submission") : "Submit"}
                        </button>
                      )}
                      {canManage && (
                        <>
                          <button className="button secondary small" onClick={() => { setCurrent(a); setModal("subs"); }}>
                            Submissions ({graded}/{all.length})
                          </button>
                          <button className="button secondary small" onClick={() => openEdit(a)}>Edit</button>
                          <button className="button ghost small danger" onClick={() => doDelete(a)}>Delete</button>
                        </>
                      )}
                    </div>
                  </div>
                  {a.description && <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{a.description}</p>}
                  {isStudent && sub && (
                    <div className="info-box">
                      <strong>
                        {sub.status === "graded" ? `Graded: ${sub.marks}/${a.max_marks}` : "Submitted — awaiting review"}
                        {sub.is_late ? " · late" : ""}
                      </strong>
                      {sub.feedback && <span>Feedback: “{sub.feedback}”</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {modal === "create" && (
        <Modal title={createForm.id ? "Edit assignment" : "Create assignment"} onClose={() => setModal(null)}>
          <form className="form-grid" onSubmit={(e) => { e.preventDefault(); doSave(true); }}>
            {err && <div className="form-error-banner">{err}</div>}
            <Input label="Title" value={createForm.title} onChange={(v) => setCreateForm({ ...createForm, title: v })} required />
            <div className="field">
              <label>Batch</label>
              <select value={createForm.batch_name} onChange={(e) => setCreateForm({ ...createForm, batch_name: e.target.value })} required>
                <option value="">— select —</option>
                {batches.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
            </div>
            <div className="field-row">
              <Input label="Due date" type="date" value={createForm.due_date} onChange={(v) => setCreateForm({ ...createForm, due_date: v })} />
              <Input label="Max marks" type="number" min="1" value={createForm.max_marks} onChange={(v) => setCreateForm({ ...createForm, max_marks: v })} required />
            </div>
            <div className="field">
              <label>Instructions</label>
              <textarea className="input" rows={4} value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
            </div>
            <div className="form-actions">
              <button type="button" className="button secondary" onClick={() => doSave(false)} disabled={busy}>Save draft</button>
              <button type="submit" className="button primary" disabled={busy}>{busy ? "Saving…" : "Publish"}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "submit" && current && (
        <Modal title={`Submit: ${current.title}`} onClose={() => setModal(null)}>
          <form className="form-grid" onSubmit={doSubmit}>
            {err && <div className="form-error-banner">{err}</div>}
            <Input label="Project / repo / drive URL" value={submitForm.link} onChange={(v) => setSubmitForm({ ...submitForm, link: v })} required />
            <div className="field">
              <label>Notes</label>
              <textarea className="input" rows={4} value={submitForm.notes} onChange={(e) => setSubmitForm({ ...submitForm, notes: e.target.value })} />
            </div>
            <div className="form-actions">
              <button type="button" className="button secondary" onClick={() => setModal(null)} disabled={busy}>Cancel</button>
              <button type="submit" className="button primary" disabled={busy || mySub(current.id)?.status === "graded"}>
                {busy ? "Submitting…" : "Submit"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "grade" && current?.sub && (
        <Modal title="Grade submission" onClose={() => setModal(null)}>
          <form className="form-grid" onSubmit={doGrade}>
            {err && <div className="form-error-banner">{err}</div>}
            {current.sub.link && <p><a href={current.sub.link} target="_blank" rel="noreferrer">{current.sub.link}</a></p>}
            {current.sub.notes && <p style={{ color: "var(--muted)" }}>{current.sub.notes}</p>}
            <Input label={`Marks (out of ${current.a.max_marks})`} type="number" min="0" max={current.a.max_marks} value={gradeForm.marks} onChange={(v) => setGradeForm({ ...gradeForm, marks: v })} required />
            <div className="field">
              <label>Feedback</label>
              <textarea className="input" rows={4} value={gradeForm.feedback} onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })} />
            </div>
            <div className="form-actions">
              <button type="button" className="button secondary" onClick={() => setModal(null)} disabled={busy}>Cancel</button>
              <button type="submit" className="button primary" disabled={busy}>{busy ? "Saving…" : "Save grade"}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "subs" && current && (
        <Modal title={`Submissions — ${current.title}`} onClose={() => setModal(null)}>
          <table>
            <thead><tr><th>Student</th><th>When</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {subsFor(current.id).length === 0 && <tr><td colSpan={4} className="table-empty">No submissions yet.</td></tr>}
              {subsFor(current.id).map((s) => (
                <tr key={s.id}>
                  <td>{s.student_id.slice(0, 8)}…</td>
                  <td>{(s.submitted_at || "").slice(0, 10)}{s.is_late ? " · late" : ""}</td>
                  <td>{s.status === "graded" ? `${s.marks}/${current.max_marks}` : "Submitted"}</td>
                  <td><button className="button secondary small" onClick={() => openGrade(current, s)}>Grade</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </section>
  );
}
