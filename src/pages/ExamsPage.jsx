import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Input } from "../components/ui.jsx";
import {
  fetchExams,
  saveExam,
  deleteExam,
  fetchExamQuestions,
  fetchExamQuestionsForStudent,
  saveExamQuestions,
  startExamAttempt,
  saveExamAnswer,
  submitExamAttempt,
  fetchExamAttempts,
  fetchMyExamAttempts,
  notifyBatch,
} from "../lib/academy.js";

const emptyExam = { id: null, title: "", batch_name: "", duration_minutes: 20, passing_score: 60 };
const emptyQ = () => ({ question: "", options: ["", "", "", ""], correctIndex: 0, marks: 1 });

export default function ExamsPage({ access, batches = [] }) {
  const canManage = access.isStaffOrAdmin || access.isFaculty;
  const isStudent = access.isStudent;

  const [exams, setExams] = useState([]);
  const [myAttempts, setMyAttempts] = useState([]);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState("");
  const [modal, setModal] = useState(null); // 'exam' | 'questions' | 'attempts'
  const [current, setCurrent] = useState(null);
  const [examForm, setExamForm] = useState(emptyExam);
  const [questions, setQuestions] = useState([]);
  const [attemptRows, setAttemptRows] = useState([]);
  const [busy, setBusy] = useState(false);

  // Live attempt
  const [attempt, setAttempt] = useState(null); // { attempt, exam, questions }
  const [answers, setAnswers] = useState({});
  const [qIdx, setQIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState(null);
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    const { rows, error } = await fetchExams();
    if (error?.suitePending) { setPending(true); return; }
    if (error) setErr(error.message);
    setExams(rows);
    if (isStudent && access.userId) {
      const { rows: a } = await fetchMyExamAttempts(access.userId);
      setMyAttempts(a);
    }
  }, [isStudent, access.userId]);

  useEffect(() => { load(); }, [load]);

  const attemptFor = (examId) => myAttempts.find((a) => a.exam_id === examId);

  // ---- manage exam ----
  const openCreate = () => { setExamForm({ ...emptyExam, batch_name: batches[0]?.name || "" }); setModal("exam"); };
  const openEditExam = (ex) => { setCurrent(ex); setExamForm({ id: ex.id, title: ex.title, batch_name: ex.batch_name, duration_minutes: ex.duration_minutes, passing_score: ex.passing_score }); setModal("exam"); };

  const saveExamForm = async (publish) => {
    setBusy(true); setErr("");
    const payload = {
      ...(examForm.id ? { id: examForm.id } : {}),
      title: examForm.title.trim(),
      batch_name: examForm.batch_name,
      duration_minutes: Number(examForm.duration_minutes) || 20,
      passing_score: Number(examForm.passing_score) || 50,
      created_by: access.userId,
      status: publish ? "published" : "draft",
    };
    const { row, error } = await saveExam(payload);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    if (publish && row) {
      notifyBatch(row.batch_name, { type: "exam", title: `New exam: ${row.title}`, body: `${row.duration_minutes} min`, link: "Exams" });
    }
    setModal(null); load();
  };

  const openQuestions = async (ex) => {
    setCurrent(ex);
    const { rows } = await fetchExamQuestions(ex.id);
    setQuestions(rows.length ? rows.map((q) => ({ question: q.question, options: q.options, correctIndex: q.correct_index, marks: q.marks })) : [emptyQ()]);
    setModal("questions");
  };
  const saveQuestions = async () => {
    setBusy(true); setErr("");
    const clean = questions.filter((q) => q.question.trim() && q.options.filter((o) => o.trim()).length >= 2);
    const { error } = await saveExamQuestions(current.id, clean);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setModal(null);
  };

  const openAttempts = async (ex) => {
    setCurrent(ex);
    const { rows } = await fetchExamAttempts(ex.id);
    setAttemptRows(rows);
    setModal("attempts");
  };
  const toggleRelease = async (ex) => {
    await saveExam({ id: ex.id, results_released: !ex.results_released });
    load();
  };

  const removeExam = async (ex) => {
    if (!window.confirm(`Delete "${ex.title}"?`)) return;
    await deleteExam(ex.id); load();
  };

  // ---- take exam ----
  const startTest = async (ex) => {
    setErr("");
    const { rows: qs } = await fetchExamQuestionsForStudent(ex.id);
    if (!qs.length) { alert("This exam has no questions yet."); return; }
    const { row, error } = await startExamAttempt(ex.id, access.userId);
    if (error) { setErr(error.message); return; }
    setAttempt({ attempt: row, exam: ex, questions: qs });
    setAnswers({});
    setQIdx(0);
    setResult(null);
    setTimeLeft(ex.duration_minutes * 60);
  };

  const finish = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!attempt) return;
    const { row, error } = await submitExamAttempt(attempt.attempt.id);
    if (error) { setErr(error.message); return; }
    setResult(row);
    load();
  }, [attempt, load]);

  useEffect(() => {
    if (!attempt || result) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timerRef.current); finish(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [attempt, result, finish]);

  const pick = async (questionId, optionIdx) => {
    setAnswers((a) => ({ ...a, [questionId]: optionIdx }));
    await saveExamAnswer(attempt.attempt.id, questionId, optionIdx);
  };

  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ---------- render: taking an exam ----------
  if (attempt) {
    if (result) {
      return (
        <section className="page">
          <div className="table-card" style={{ padding: "2rem", maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
            <h2 style={{ color: result.passed ? "var(--positive)" : "var(--danger)" }}>
              {result.passed ? "Passed" : "Not passed"}
            </h2>
            <p style={{ fontSize: "1.1rem", fontWeight: 600 }}>{result.score} / {result.total} ({result.percentage}%)</p>
            <button className="button primary" onClick={() => { setAttempt(null); setResult(null); }}>Back to exams</button>
          </div>
        </section>
      );
    }
    const q = attempt.questions[qIdx];
    return (
      <section className="page">
        <div className="page-header">
          <div><h2>{attempt.exam.title}</h2><p>Question {qIdx + 1} of {attempt.questions.length}</p></div>
          <div className="row-actions" style={{ alignItems: "center" }}>
            <span className="mini-tag" style={{ fontSize: "0.95rem" }}>⏱ {mmss(timeLeft)}</span>
            <button className="button primary" onClick={finish}>Submit exam</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: "1.5rem" }}>
          <div className="table-card" style={{ padding: "1.5rem" }}>
            <h3 style={{ lineHeight: 1.5 }}>{q.question}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "1rem" }}>
              {q.options.map((opt, oi) => (
                <button
                  key={oi}
                  className={answers[q.id] === oi ? "button primary" : "button secondary"}
                  style={{ justifyContent: "flex-start", textAlign: "left" }}
                  onClick={() => pick(q.id, oi)}
                >
                  {String.fromCharCode(65 + oi)}. {opt}
                </button>
              ))}
            </div>
            <div className="form-actions" style={{ marginTop: "1.5rem" }}>
              <button className="button secondary" disabled={qIdx === 0} onClick={() => setQIdx((i) => i - 1)}>← Prev</button>
              <button className="button secondary" disabled={qIdx === attempt.questions.length - 1} onClick={() => setQIdx((i) => i + 1)}>Next →</button>
            </div>
          </div>
          <div className="table-card" style={{ padding: "1rem", height: "fit-content" }}>
            <h4 style={{ marginTop: 0 }}>Questions</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.4rem" }}>
              {attempt.questions.map((qq, i) => (
                <button
                  key={qq.id}
                  className={answers[qq.id] !== undefined ? "button primary small" : "button secondary small"}
                  onClick={() => setQIdx(i)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ---------- render: exam list ----------
  return (
    <section className="page">
      <div className="page-header">
        <div><h2>Exams</h2><p>{canManage ? "Create timed MCQ exams and evaluate results." : "Your exams and results."}</p></div>
        {canManage && !pending && <button className="button primary" onClick={openCreate}>+ Create exam</button>}
      </div>

      {pending && (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <h3>Exams setup pending</h3>
          <p>Run <code>supabase/migration-academy-suite-v2.sql</code> to enable exams.</p>
        </div>
      )}
      {err && <div className="auth-message error">{err}</div>}

      {!pending && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: "1rem" }}>
          {exams.filter((e) => !isStudent || e.status === "published").map((ex) => {
            const at = isStudent ? attemptFor(ex.id) : null;
            return (
              <div key={ex.id} className="table-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                <div className="card-heading between">
                  <div>
                    <h3 style={{ margin: 0 }}>{ex.title}</h3>
                    <p style={{ margin: "2px 0 0" }}>
                      <span className="mini-tag">{ex.batch_name}</span>{" "}
                      {ex.status !== "published" && <span className="mini-tag warn">{ex.status}</span>}
                    </p>
                  </div>
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                  {ex.duration_minutes} min · pass {ex.passing_score}%
                </div>
                {isStudent ? (
                  at?.submitted_at ? (
                    <div className="info-box">
                      <strong>
                        {ex.results_released
                          ? `${at.passed ? "Passed" : "Not passed"} — ${at.score}/${at.total} (${at.percentage}%)`
                          : "Submitted — awaiting result release"}
                      </strong>
                    </div>
                  ) : (
                    <button className="button primary" onClick={() => startTest(ex)}>Start exam</button>
                  )
                ) : (
                  <div className="row-actions">
                    <button className="button secondary small" onClick={() => openQuestions(ex)}>Questions</button>
                    <button className="button secondary small" onClick={() => openAttempts(ex)}>Results</button>
                    <button className="button secondary small" onClick={() => toggleRelease(ex)}>
                      {ex.results_released ? "Hide results" : "Release results"}
                    </button>
                    {ex.status !== "published" && (
                      <button className="button primary small" onClick={() => saveExam({ id: ex.id, status: "published" }).then(load)}>Publish</button>
                    )}
                    <button className="button secondary small" onClick={() => openEditExam(ex)}>Edit</button>
                    <button className="button ghost small danger" onClick={() => removeExam(ex)}>Delete</button>
                  </div>
                )}
              </div>
            );
          })}
          {exams.length === 0 && <div className="table-card table-empty" style={{ padding: "2rem" }}>No exams yet.</div>}
        </div>
      )}

      {modal === "exam" && (
        <Modal title={examForm.id ? "Edit exam" : "Create exam"} onClose={() => setModal(null)}>
          <form className="form-grid" onSubmit={(e) => { e.preventDefault(); saveExamForm(true); }}>
            {err && <div className="form-error-banner">{err}</div>}
            <Input label="Title" value={examForm.title} onChange={(v) => setExamForm({ ...examForm, title: v })} required />
            <div className="field">
              <label>Batch</label>
              <select value={examForm.batch_name} onChange={(e) => setExamForm({ ...examForm, batch_name: e.target.value })} required>
                <option value="">— select —</option>
                {batches.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
            </div>
            <div className="field-row">
              <Input label="Duration (min)" type="number" min="1" value={examForm.duration_minutes} onChange={(v) => setExamForm({ ...examForm, duration_minutes: v })} required />
              <Input label="Passing %" type="number" min="0" max="100" value={examForm.passing_score} onChange={(v) => setExamForm({ ...examForm, passing_score: v })} required />
            </div>
            <div className="form-actions">
              <button type="button" className="button secondary" onClick={() => saveExamForm(false)} disabled={busy}>Save draft</button>
              <button type="submit" className="button primary" disabled={busy}>{busy ? "Saving…" : "Publish"}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "questions" && current && (
        <Modal title={`Questions — ${current.title}`} onClose={() => setModal(null)}>
          <div className="form-grid">
            {err && <div className="form-error-banner">{err}</div>}
            {questions.map((q, qi) => (
              <div key={qi} className="table-card" style={{ padding: "1rem" }}>
                <Input label={`Question ${qi + 1}`} value={q.question} onChange={(v) => setQuestions((qs) => qs.map((x, i) => i === qi ? { ...x, question: v } : x))} />
                {q.options.map((opt, oi) => (
                  <div key={oi} style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.4rem" }}>
                    <input type="radio" checked={q.correctIndex === oi} onChange={() => setQuestions((qs) => qs.map((x, i) => i === qi ? { ...x, correctIndex: oi } : x))} />
                    <input className="input" value={opt} placeholder={`Option ${String.fromCharCode(65 + oi)}`} onChange={(e) => setQuestions((qs) => qs.map((x, i) => i === qi ? { ...x, options: x.options.map((o, k) => k === oi ? e.target.value : o) } : x))} />
                  </div>
                ))}
                <button className="button ghost small danger" style={{ marginTop: "0.5rem" }} onClick={() => setQuestions((qs) => qs.filter((_, i) => i !== qi))}>Remove question</button>
              </div>
            ))}
            <button className="button secondary" onClick={() => setQuestions((qs) => [...qs, emptyQ()])}>+ Add question</button>
            <div className="form-actions">
              <button className="button secondary" onClick={() => setModal(null)} disabled={busy}>Cancel</button>
              <button className="button primary" onClick={saveQuestions} disabled={busy}>{busy ? "Saving…" : "Save questions"}</button>
            </div>
          </div>
        </Modal>
      )}

      {modal === "attempts" && current && (
        <Modal title={`Results — ${current.title}`} onClose={() => setModal(null)}>
          <table>
            <thead><tr><th>Student</th><th>Submitted</th><th>Score</th><th>Result</th></tr></thead>
            <tbody>
              {attemptRows.length === 0 && <tr><td colSpan={4} className="table-empty">No attempts yet.</td></tr>}
              {attemptRows.map((a) => (
                <tr key={a.id}>
                  <td>{a.student?.full_name || a.student?.email || a.student_id.slice(0, 8)}</td>
                  <td>{a.submitted_at ? new Date(a.submitted_at).toLocaleString() : "In progress"}</td>
                  <td>{a.submitted_at ? `${a.score}/${a.total} (${a.percentage}%)` : "—"}</td>
                  <td>{a.submitted_at ? (a.passed ? <span className="mini-tag ok">Pass</span> : <span className="mini-tag warn">Fail</span>) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </section>
  );
}
