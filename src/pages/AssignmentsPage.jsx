import React, { useEffect, useState } from "react";
import { Modal, Input } from "../components/ui.jsx";
import { today } from "../lib/format.js";

const DEFAULT_ASSIGNMENTS = [
  {
    id: "asg_1",
    title: "E-Commerce Database Schema Design",
    batch: "FSW-2026-A",
    dueDate: "2026-09-18",
    maxMarks: 50,
    status: "Pending",
    description: "Design a normalized PostgreSQL schema with tables for users, products, orders, order_items, and payments. Include ER diagrams and foreign key constraints.",
    submission: null,
  },
  {
    id: "asg_2",
    title: "React Full-Stack Financial Dashboard",
    batch: "FSW-2026-A",
    dueDate: "2026-09-22",
    maxMarks: 100,
    status: "Submitted",
    description: "Build a responsive React dashboard with chart analytics, filters, and Supabase authentication. Submit GitHub repo link and live demo URL.",
    submission: {
      date: "2026-09-08",
      link: "https://github.com/student/oksy-dashboard",
      notes: "Implemented all views with dark mode and chart tooltips.",
      marks: 92,
      feedback: "Excellent architecture and clean code separation!",
      status: "Graded",
    },
  },
  {
    id: "asg_3",
    title: "Double-Entry Ledger Balancing Case Study",
    batch: "BCOM-2026",
    dueDate: "2026-09-15",
    maxMarks: 50,
    status: "Pending",
    description: "Review the provided case study and reconcile the bank accounts against cash ledger entries. Detail all reconciling items.",
    submission: null,
  },
];

export default function AssignmentsPage({ isAdmin, role, batches = [] }) {
  const canManage = isAdmin || role === "faculty";
  const [assignments, setAssignments] = useState(() => {
    try {
      const saved = localStorage.getItem("oksy_assignments");
      return saved ? JSON.parse(saved) : DEFAULT_ASSIGNMENTS;
    } catch {
      return DEFAULT_ASSIGNMENTS;
    }
  });
  const [filter, setFilter] = useState("All");
  const [activeModal, setActiveModal] = useState(null); // 'create' | 'submit' | 'grade'
  const [selectedAsg, setSelectedAsg] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem("oksy_assignments", JSON.stringify(assignments));
    } catch {
      // ignore
    }
  }, [assignments]);

  // Form states
  const [createForm, setCreateForm] = useState({
    title: "",
    batch: batches[0]?.name || "FSW-2026-A",
    dueDate: today(),
    maxMarks: 100,
    description: "",
  });

  const [submitForm, setSubmitForm] = useState({
    link: "",
    notes: "",
  });

  const [gradeForm, setGradeForm] = useState({
    marks: "",
    feedback: "",
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (!createForm.title) return;
    const newAsg = {
      ...createForm,
      id: "asg_" + Date.now(),
      status: "Pending",
      submission: null,
    };
    setAssignments((prev) => [newAsg, ...prev]);
    setActiveModal(null);
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this assignment?")) {
      setAssignments((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!submitForm.link && !submitForm.notes) return;
    setAssignments((prev) =>
      prev.map((a) =>
        a.id === selectedAsg.id
          ? {
              ...a,
              status: "Submitted",
              submission: {
                date: today(),
                link: submitForm.link,
                notes: submitForm.notes,
                marks: null,
                feedback: null,
                status: "Under Review",
              },
            }
          : a
      )
    );
    setActiveModal(null);
    alert("Project submitted successfully!");
  };

  const handleGrade = (e) => {
    e.preventDefault();
    setAssignments((prev) =>
      prev.map((a) =>
        a.id === selectedAsg.id
          ? {
              ...a,
              submission: {
                ...a.submission,
                marks: Number(gradeForm.marks),
                feedback: gradeForm.feedback,
                status: "Graded",
              },
            }
          : a
      )
    );
    setActiveModal(null);
  };

  const filtered = assignments.filter((a) => {
    if (filter === "Pending") return a.status === "Pending";
    if (filter === "Submitted") return a.status === "Submitted" && a.submission?.status !== "Graded";
    if (filter === "Graded") return a.submission?.status === "Graded";
    return true;
  });

  return (
    <section className="page">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2>Projects & Assignments</h2>
          <p>Assign practical coursework, submit project deliverables, and track faculty feedback and grades.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {canManage && (
            <button className="button primary" onClick={() => setActiveModal("create")}>
              + Create Assignment
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {["All", "Pending", "Submitted", "Graded"].map((tab) => (
          <button
            key={tab}
            className={`button ${filter === tab ? "primary" : "secondary"}`}
            onClick={() => setFilter(tab)}
            style={{ borderRadius: "9999px", padding: "0.4rem 1rem", fontSize: "0.85rem" }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {filtered.length === 0 ? (
          <div className="table-card" style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted, #64748b)" }}>
            No assignments match this filter.
          </div>
        ) : (
          filtered.map((asg) => {
            const isGraded = asg.submission?.status === "Graded";
            const isSubmitted = asg.status === "Submitted";

            return (
              <div
                key={asg.id}
                className="table-card"
                style={{
                  padding: "1.5rem",
                  borderLeft: isGraded
                    ? "4px solid #10b981"
                    : isSubmitted
                    ? "4px solid #3b82f6"
                    : "4px solid #f59e0b",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.4rem" }}>
                      <span style={{ fontSize: "0.8rem", padding: "0.15rem 0.5rem", background: "var(--border, #e2e8f0)", borderRadius: "4px" }}>
                        {asg.batch}
                      </span>
                      <span
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: "600",
                          color: isGraded ? "#10b981" : isSubmitted ? "#3b82f6" : "#d97706",
                        }}
                      >
                        ● {isGraded ? `Graded: ${asg.submission.marks}/${asg.maxMarks}` : isSubmitted ? "Submitted" : "Pending Submission"}
                      </span>
                    </div>
                    <h3 style={{ margin: "0.25rem 0" }}>{asg.title}</h3>
                  </div>

                  <div style={{ textAlign: "right", fontSize: "0.85rem" }}>
                    <div>Due: <strong>{asg.dueDate}</strong></div>
                    <div style={{ color: "var(--text-muted, #64748b)" }}>Max Marks: {asg.maxMarks}</div>
                  </div>
                </div>

                <p style={{ margin: "0.75rem 0", color: "var(--text-muted, #475569)", fontSize: "0.95rem", lineHeight: "1.5" }}>
                  {asg.description}
                </p>

                {asg.submission && (
                  <div style={{ marginTop: "1rem", padding: "0.8rem", background: "var(--accent-light, #f8fafc)", borderRadius: "8px", fontSize: "0.9rem" }}>
                    <div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>Submission Details:</div>
                    {asg.submission.link && (
                      <div>
                        Project URL:{" "}
                        <a href={asg.submission.link} target="_blank" rel="noreferrer" style={{ color: "var(--accent, #2563eb)" }}>
                          {asg.submission.link}
                        </a>
                      </div>
                    )}
                    {asg.submission.notes && <div style={{ marginTop: "0.25rem" }}>Notes: {asg.submission.notes}</div>}
                    {asg.submission.feedback && (
                      <div style={{ marginTop: "0.4rem", color: "#065f46", fontWeight: "500" }}>
                        Faculty Feedback: "{asg.submission.feedback}"
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  {!isSubmitted && (
                    <button
                      className="button primary"
                      onClick={() => {
                        setSelectedAsg(asg);
                        setSubmitForm({ link: "", notes: "" });
                        setActiveModal("submit");
                      }}
                    >
                      📤 Submit Project
                    </button>
                  )}
                  {canManage && isSubmitted && !isGraded && (
                    <button
                      className="button secondary"
                      onClick={() => {
                        setSelectedAsg(asg);
                        setGradeForm({ marks: "", feedback: "" });
                        setActiveModal("grade");
                      }}
                    >
                      ✍ Grade Submission
                    </button>
                  )}
                  {canManage && (
                    <button
                      className="button secondary"
                      style={{ color: "var(--danger, #ef4444)" }}
                      onClick={() => handleDelete(asg.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {activeModal === "create" && (
        <Modal title="Create New Assignment" onClose={() => setActiveModal(null)}>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="field">
              <label>Assignment Title</label>
              <Input
                required
                placeholder="e.g. React Full-Stack App"
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Batch</label>
              <Input
                placeholder="e.g. FSW-2026-A"
                value={createForm.batch}
                onChange={(e) => setCreateForm({ ...createForm, batch: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Due Date</label>
              <Input
                type="date"
                required
                value={createForm.dueDate}
                onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Max Marks</label>
              <Input
                type="number"
                required
                value={createForm.maxMarks}
                onChange={(e) => setCreateForm({ ...createForm, maxMarks: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Instructions & Description</label>
              <textarea
                className="input"
                rows={4}
                required
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              />
            </div>
            <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button type="button" className="button secondary" onClick={() => setActiveModal(null)}>
                Cancel
              </button>
              <button type="submit" className="button primary">
                Publish Assignment
              </button>
            </div>
          </form>
        </Modal>
      )}

      {activeModal === "submit" && selectedAsg && (
        <Modal title={`Submit Project: ${selectedAsg.title}`} onClose={() => setActiveModal(null)}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="field">
              <label>Project / GitHub / Drive URL</label>
              <Input
                required
                placeholder="https://github.com/your-username/project"
                value={submitForm.link}
                onChange={(e) => setSubmitForm({ ...submitForm, link: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Submission Comments / Summary</label>
              <textarea
                className="input"
                rows={4}
                placeholder="Briefly describe what you built, libraries used, or any notes for the instructor..."
                value={submitForm.notes}
                onChange={(e) => setSubmitForm({ ...submitForm, notes: e.target.value })}
              />
            </div>
            <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button type="button" className="button secondary" onClick={() => setActiveModal(null)}>
                Cancel
              </button>
              <button type="submit" className="button primary">
                Confirm & Submit
              </button>
            </div>
          </form>
        </Modal>
      )}

      {activeModal === "grade" && selectedAsg && (
        <Modal title={`Grade Submission: ${selectedAsg.title}`} onClose={() => setActiveModal(null)}>
          <form onSubmit={handleGrade} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="field">
              <label>Score (Out of {selectedAsg.maxMarks})</label>
              <Input
                type="number"
                max={selectedAsg.maxMarks}
                min={0}
                required
                placeholder={`0 - ${selectedAsg.maxMarks}`}
                value={gradeForm.marks}
                onChange={(e) => setGradeForm({ ...gradeForm, marks: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Instructor Feedback</label>
              <textarea
                className="input"
                rows={4}
                placeholder="Great work on data normalization..."
                value={gradeForm.feedback}
                onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })}
              />
            </div>
            <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button type="button" className="button secondary" onClick={() => setActiveModal(null)}>
                Cancel
              </button>
              <button type="submit" className="button primary">
                Save Grade
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
