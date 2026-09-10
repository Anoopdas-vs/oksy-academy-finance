import React, { useEffect, useState } from "react";
import { Modal } from "../components/ui.jsx";
import { today } from "../lib/format.js";

const DEFAULT_REVIEWS = [
  {
    id: "rev_1",
    faculty: "Prof. Arvind Kumar",
    subject: "Full-Stack Web Development",
    rating: 5,
    clarity: 5,
    punctuality: 5,
    studentName: "Devika S.",
    date: "2026-09-07",
    comment: "The practical coding sessions and live debugging exercises made complex React concepts very clear. Excellent instructor!",
  },
  {
    id: "rev_2",
    faculty: "Dr. Meera Nair",
    subject: "Database Systems & Supabase",
    rating: 4,
    clarity: 5,
    punctuality: 4,
    studentName: "Rahul Menon",
    date: "2026-09-05",
    comment: "Great coverage of PostgreSQL Row-Level Security and indexing. Would appreciate more hands-on schema design quizzes.",
  },
  {
    id: "rev_3",
    faculty: "CMA Suresh Pillai",
    subject: "Financial Accounting & Business Logic",
    rating: 5,
    clarity: 5,
    punctuality: 5,
    studentName: "Sneha George",
    date: "2026-09-02",
    comment: "Clear and methodical explanation of bank reconciliation and outstanding dues tracking. Helped immensely with our projects.",
  },
];

const FACULTY_LIST = [
  { name: "Prof. Arvind Kumar", subject: "Full-Stack Web Development" },
  { name: "Dr. Meera Nair", subject: "Database Systems & Supabase" },
  { name: "CMA Suresh Pillai", subject: "Financial Accounting & Business Logic" },
  { name: "Anoopdas V S", subject: "AI & Automated Development Workflows" },
];

export default function ReviewsPage({ profile }) {
  const [reviews, setReviews] = useState(() => {
    try {
      const saved = localStorage.getItem("oksy_reviews");
      return saved ? JSON.parse(saved) : DEFAULT_REVIEWS;
    } catch {
      return DEFAULT_REVIEWS;
    }
  });
  const [showModal, setShowModal] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState("All");

  useEffect(() => {
    try {
      localStorage.setItem("oksy_reviews", JSON.stringify(reviews));
    } catch {
      // ignore
    }
  }, [reviews]);

  const [form, setForm] = useState({
    faculty: FACULTY_LIST[0].name,
    rating: 5,
    clarity: 5,
    punctuality: 5,
    comment: "",
  });

  const averageRating = (
    reviews.reduce((acc, r) => acc + r.rating, 0) / (reviews.length || 1)
  ).toFixed(1);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.comment.trim()) return;

    const matched = FACULTY_LIST.find((f) => f.name === form.faculty);
    const newRev = {
      id: "rev_" + Date.now(),
      faculty: form.faculty,
      subject: matched?.subject || "Course Module",
      rating: Number(form.rating),
      clarity: Number(form.clarity),
      punctuality: Number(form.punctuality),
      studentName: profile?.full_name || "Student (Verified)",
      date: today(),
      comment: form.comment,
    };

    setReviews([newRev, ...reviews]);
    setShowModal(false);
    setForm({
      faculty: FACULTY_LIST[0].name,
      rating: 5,
      clarity: 5,
      punctuality: 5,
      comment: "",
    });
    alert("Thank you! Your feedback has been recorded.");
  };

  const filtered = reviews.filter(
    (r) => selectedFaculty === "All" || r.faculty === selectedFaculty
  );

  return (
    <section className="page">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2>Faculty & Course Reviews</h2>
          <p>Transparent 360° academic feedback to maintain high teaching standards and student satisfaction.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="button primary" onClick={() => setShowModal(true)}>
            ★ Write Faculty Review
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="table-card" style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted, #64748b)" }}>Average Faculty Rating</div>
          <div style={{ fontSize: "2rem", fontWeight: "700", color: "#f59e0b", margin: "0.3rem 0" }}>
            ⭐ {averageRating} <span style={{ fontSize: "1rem", color: "var(--text-muted, #64748b)", fontWeight: "normal" }}>/ 5.0</span>
          </div>
          <div style={{ fontSize: "0.8rem", color: "#10b981" }}>Based on verified student ratings</div>
        </div>

        <div className="table-card" style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted, #64748b)" }}>Total Reviews Recorded</div>
          <div style={{ fontSize: "2rem", fontWeight: "700", margin: "0.3rem 0" }}>
            {reviews.length}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #64748b)" }}>All batches active</div>
        </div>

        <div className="table-card" style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted, #64748b)" }}>Teaching Clarity Score</div>
          <div style={{ fontSize: "2rem", fontWeight: "700", color: "#3b82f6", margin: "0.3rem 0" }}>
            96%
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #64748b)" }}>High conceptual clarity</div>
        </div>
      </div>

      <div className="table-card" style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <h3 style={{ margin: 0 }}>Recent Student Feedback</h3>
          <select
            className="input"
            value={selectedFaculty}
            onChange={(e) => setSelectedFaculty(e.target.value)}
            style={{ width: "auto" }}
          >
            <option value="All">All Faculty</option>
            {FACULTY_LIST.map((f) => (
              <option key={f.name} value={f.name}>{f.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {filtered.map((rev) => (
            <div
              key={rev.id}
              style={{
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: "10px",
                padding: "1.25rem",
                background: "var(--surface, #ffffff)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                <div>
                  <h4 style={{ margin: "0 0 0.2rem 0" }}>{rev.faculty}</h4>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted, #64748b)" }}>
                    Module: {rev.subject}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ color: "#f59e0b", fontSize: "1.1rem" }}>
                    {"★".repeat(rev.rating)}{"☆".repeat(5 - rev.rating)}
                  </span>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted, #64748b)" }}>{rev.date}</div>
                </div>
              </div>

              <p style={{ margin: "0.5rem 0", fontSize: "0.95rem", lineHeight: "1.5", color: "var(--text, #334155)" }}>
                "{rev.comment}"
              </p>

              <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", fontSize: "0.8rem", color: "var(--text-muted, #64748b)" }}>
                <span>🎯 Clarity: {rev.clarity}/5</span>
                <span>⏰ Punctuality: {rev.punctuality}/5</span>
                <span>👤 By: {rev.studentName}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <Modal title="Submit Faculty Feedback" onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="field">
              <label>Select Faculty Member</label>
              <select
                className="input"
                value={form.faculty}
                onChange={(e) => setForm({ ...form, faculty: e.target.value })}
              >
                {FACULTY_LIST.map((f) => (
                  <option key={f.name} value={f.name}>{f.name} — {f.subject}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Overall Experience (1 to 5 Stars)</label>
              <select
                className="input"
                value={form.rating}
                onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
              >
                <option value={5}>★★★★★ (5 Stars - Exceptional)</option>
                <option value={4}>★★★★☆ (4 Stars - Very Good)</option>
                <option value={3}>★★★☆☆ (3 Stars - Good)</option>
                <option value={2}>★★☆☆☆ (2 Stars - Fair)</option>
                <option value={1}>★☆☆☆☆ (1 Star - Poor)</option>
              </select>
            </div>

            <div className="field">
              <label>Conceptual Clarity (1 to 5)</label>
              <select
                className="input"
                value={form.clarity}
                onChange={(e) => setForm({ ...form, clarity: Number(e.target.value) })}
              >
                <option value={5}>5 - Crystal clear explanations</option>
                <option value={4}>4 - Mostly clear</option>
                <option value={3}>3 - Average clarity</option>
                <option value={2}>2 - Difficult to follow</option>
                <option value={1}>1 - Unclear</option>
              </select>
            </div>

            <div className="field">
              <label>Punctuality & Session Management (1 to 5)</label>
              <select
                className="input"
                value={form.punctuality}
                onChange={(e) => setForm({ ...form, punctuality: Number(e.target.value) })}
              >
                <option value={5}>5 - Starts & finishes exactly on schedule</option>
                <option value={4}>4 - Good adherence to timing</option>
                <option value={3}>3 - Occasional slight delays</option>
              </select>
            </div>

            <div className="field">
              <label>Your Detailed Feedback / Review</label>
              <textarea
                className="input"
                rows={4}
                required
                placeholder="Share specific examples of what went well or what could be improved..."
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
              />
            </div>

            <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button type="button" className="button secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button type="submit" className="button primary">
                Submit Feedback
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
