import React, { useState, useEffect } from "react";
import { Modal, Input } from "../components/ui.jsx";

const SAMPLE_EXAMS = [
  {
    id: "exam_1",
    title: "Full-Stack Web & React Fundamentals",
    batch: "FSW-2026-A",
    durationMins: 15,
    passingScore: 60,
    status: "Available",
    questions: [
      {
        id: "q1",
        question: "Which hook is used in React to manage side effects such as data fetching?",
        options: ["useMemo", "useEffect", "useCallback", "useReducer"],
        correctIndex: 1,
      },
      {
        id: "q2",
        question: "What is the primary benefit of Row Level Security (RLS) in PostgreSQL/Supabase?",
        options: [
          "Compresses database backups",
          "Restricts database row access based on authenticated user claims",
          "Automates index creation",
          "Translates SQL queries to GraphQL",
        ],
        correctIndex: 1,
      },
      {
        id: "q3",
        question: "In Vite, which configuration enables manual vendor chunk splitting to reduce initial bundle size?",
        options: [
          "build.rollupOptions.output.manualChunks",
          "vite.compiler.chunkOptimizer",
          "package.json splitVendors",
          "server.proxy.chunking",
        ],
        correctIndex: 0,
      },
      {
        id: "q4",
        question: "Which of the following is true regarding React 19 server components?",
        options: [
          "They cannot execute asynchronous operations",
          "They run exclusively on the server and do not ship JS bundle to client",
          "They replace the HTML5 DOM completely",
          "They require jQuery to mount",
        ],
        correctIndex: 1,
      },
    ],
  },
  {
    id: "exam_2",
    title: "Financial Accounting & Ratio Analysis",
    batch: "BCOM-2026",
    durationMins: 20,
    passingScore: 50,
    status: "Upcoming",
    questions: [],
  },
];

export default function ExamsPage({ isAdmin, role }) {
  const canManage = isAdmin || role === "faculty";
  const [exams, setExams] = useState(() => {
    try {
      const saved = localStorage.getItem("oksy_exams");
      return saved ? JSON.parse(saved) : SAMPLE_EXAMS;
    } catch {
      return SAMPLE_EXAMS;
    }
  });
  const [activeExam, setActiveExam] = useState(null); // Exam object currently in progress
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [qIndex]: selectedOptionIndex }
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newExamForm, setNewExamForm] = useState({
    title: "",
    batch: "FSW-2026-A",
    durationMins: 20,
    passingScore: 60,
  });

  useEffect(() => {
    try {
      localStorage.setItem("oksy_exams", JSON.stringify(exams));
    } catch {
      // ignore
    }
  }, [exams]);

  const handleCreateExam = (e) => {
    e.preventDefault();
    if (!newExamForm.title) return;
    const newExam = {
      id: "exam_" + Date.now(),
      ...newExamForm,
      durationMins: Number(newExamForm.durationMins),
      passingScore: Number(newExamForm.passingScore),
      status: "Available",
      questions: [
        {
          id: "q_auto_1",
          question: `Standard comprehensive assessment on ${newExamForm.title}: Question 1`,
          options: ["Core Principle A", "Core Principle B", "Core Principle C", "Core Principle D"],
          correctIndex: 0,
        },
        {
          id: "q_auto_2",
          question: `Practical implementation and architectural consideration for ${newExamForm.batch}`,
          options: ["Standard Architecture", "Optimized Pattern", "Legacy Pattern", "None of the above"],
          correctIndex: 1,
        },
      ],
    };
    setExams((prev) => [...prev, newExam]);
    setShowCreateModal(false);
  };

  // Timer countdown
  useEffect(() => {
    if (!activeExam || timeLeft <= 0 || result) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleFinishExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeExam, timeLeft, result]);

  const startExam = (exam) => {
    if (!exam.questions || exam.questions.length === 0) {
      alert("This exam has no questions added yet.");
      return;
    }
    setActiveExam(exam);
    setCurrentQIndex(0);
    setAnswers({});
    setResult(null);
    setTimeLeft(exam.durationMins * 60);
  };

  const handleSelectOption = (qIdx, optionIdx) => {
    if (result) return;
    setAnswers((prev) => ({ ...prev, [qIdx]: optionIdx }));
  };

  const handleFinishExam = () => {
    if (!activeExam) return;
    let correctCount = 0;
    activeExam.questions.forEach((q, idx) => {
      if (answers[idx] === q.correctIndex) {
        correctCount += 1;
      }
    });

    const total = activeExam.questions.length;
    const percentage = Math.round((correctCount / total) * 100);
    const passed = percentage >= activeExam.passingScore;

    setResult({
      score: correctCount,
      total,
      percentage,
      passed,
    });
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <section className="page">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2>Examinations & Quizzes</h2>
          <p>Online assessments with timed evaluation, anti-cheat question navigation, and instant grading.</p>
        </div>
        {!activeExam && canManage && (
          <button className="button primary" onClick={() => setShowCreateModal(true)}>
            + Create Exam
          </button>
        )}
        {activeExam && !result && (
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span style={{ fontSize: "1.2rem", fontWeight: "700", color: timeLeft < 120 ? "#ef4444" : "#2563eb", background: "var(--surface, #ffffff)", padding: "0.4rem 0.8rem", borderRadius: "8px", border: "1px solid var(--border, #e2e8f0)" }}>
              ⏱ {formatTimer(timeLeft)}
            </span>
            <button className="button primary" onClick={handleFinishExam}>
              Submit Exam
            </button>
          </div>
        )}
      </div>

      {!activeExam ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1rem" }}>
          {exams.map((exam) => (
            <div key={exam.id} className="table-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.8rem", padding: "0.2rem 0.6rem", background: "var(--border, #e2e8f0)", borderRadius: "4px" }}>
                    {exam.batch}
                  </span>
                  <span style={{ fontSize: "0.8rem", fontWeight: "600", color: exam.status === "Available" ? "#10b981" : "#d97706" }}>
                    ● {exam.status}
                  </span>
                </div>
                <h3 style={{ margin: "0.5rem 0" }}>{exam.title}</h3>
                <div style={{ fontSize: "0.9rem", color: "var(--text-muted, #64748b)", margin: "0.5rem 0" }}>
                  <div>⏳ Duration: {exam.durationMins} Minutes</div>
                  <div>🎯 Passing Score: {exam.passingScore}%</div>
                  <div>❓ Questions: {exam.questions?.length || 0} MCQs</div>
                </div>
              </div>

              <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border, #e2e8f0)" }}>
                {exam.status === "Available" ? (
                  <button className="button primary full" onClick={() => startExam(exam)}>
                    Start Assessment Now
                  </button>
                ) : (
                  <button className="button secondary full" disabled>
                    Scheduled Soon
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : result ? (
        <div className="table-card" style={{ padding: "2.5rem", textAlign: "center", maxWidth: "600px", margin: "0 auto" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>
            {result.passed ? "🎉" : "📚"}
          </div>
          <h2 style={{ color: result.passed ? "#10b981" : "#ef4444", marginBottom: "0.5rem" }}>
            {result.passed ? "Assessment Passed!" : "Needs Improvement"}
          </h2>
          <p style={{ fontSize: "1.2rem", fontWeight: "600", margin: "0.5rem 0" }}>
            Your Score: {result.score} / {result.total} ({result.percentage}%)
          </p>
          <p style={{ color: "var(--text-muted, #64748b)", fontSize: "0.95rem" }}>
            {result.passed
              ? "Congratulations! You have satisfied the passing criteria."
              : "Review the course materials and discuss questions with your faculty."}
          </p>

          <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.5rem", justifyContent: "center" }}>
            <button className="button secondary" onClick={() => setActiveExam(null)}>
              ← Back to Exam List
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: "1.5rem" }}>
          <div className="table-card" style={{ padding: "2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <span style={{ fontSize: "0.9rem", color: "var(--text-muted, #64748b)", fontWeight: "600" }}>
                Question {currentQIndex + 1} of {activeExam.questions.length}
              </span>
              <span style={{ fontSize: "0.85rem", padding: "0.2rem 0.6rem", background: "var(--border, #e2e8f0)", borderRadius: "4px" }}>
                1 Mark
              </span>
            </div>

            <h3 style={{ fontSize: "1.2rem", marginBottom: "1.5rem", lineHeight: "1.5" }}>
              {activeExam.questions[currentQIndex]?.question}
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {activeExam.questions[currentQIndex]?.options.map((opt, oIdx) => {
                const isSelected = answers[currentQIndex] === oIdx;
                return (
                  <button
                    key={oIdx}
                    onClick={() => handleSelectOption(currentQIndex, oIdx)}
                    style={{
                      textAlign: "left",
                      padding: "1rem",
                      borderRadius: "8px",
                      border: isSelected ? "2px solid #2563eb" : "1px solid var(--border, #e2e8f0)",
                      background: isSelected ? "#eff6ff" : "var(--surface, #ffffff)",
                      color: "inherit",
                      fontSize: "0.95rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        border: isSelected ? "2px solid #2563eb" : "1px solid #94a3b8",
                        background: isSelected ? "#2563eb" : "transparent",
                        color: isSelected ? "#ffffff" : "inherit",
                        fontSize: "0.8rem",
                        fontWeight: "600",
                      }}
                    >
                      {String.fromCharCode(65 + oIdx)}
                    </span>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid var(--border, #e2e8f0)" }}>
              <button
                className="button secondary"
                disabled={currentQIndex === 0}
                onClick={() => setCurrentQIndex((p) => Math.max(0, p - 1))}
              >
                ← Previous
              </button>
              <button
                className="button primary"
                disabled={currentQIndex === activeExam.questions.length - 1}
                onClick={() => setCurrentQIndex((p) => Math.min(activeExam.questions.length - 1, p + 1))}
              >
                Next →
              </button>
            </div>
          </div>

          <div className="table-card" style={{ padding: "1.25rem", height: "fit-content" }}>
            <h4 style={{ margin: "0 0 1rem 0" }}>Question Navigator</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem" }}>
              {activeExam.questions.map((_, idx) => {
                const isAnswered = answers[idx] !== undefined;
                const isCurrent = currentQIndex === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentQIndex(idx)}
                    style={{
                      padding: "0.6rem 0",
                      borderRadius: "6px",
                      border: isCurrent ? "2px solid #2563eb" : "1px solid var(--border, #e2e8f0)",
                      background: isAnswered ? "#dbeafe" : "transparent",
                      color: isAnswered ? "#1e40af" : "inherit",
                      fontWeight: isCurrent ? "700" : "500",
                      cursor: "pointer",
                    }}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: "1.25rem", fontSize: "0.8rem", color: "var(--text-muted, #64748b)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.3rem" }}>
                <span style={{ width: "12px", height: "12px", background: "#dbeafe", borderRadius: "2px" }}></span> Answered
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span style={{ width: "12px", height: "12px", border: "1px solid #cbd5e1", borderRadius: "2px" }}></span> Unanswered
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <Modal title="Create New Examination" onClose={() => setShowCreateModal(false)}>
          <form onSubmit={handleCreateExam} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="field">
              <label>Exam Title</label>
              <Input
                required
                placeholder="e.g. JavaScript & Asynchronous Programming"
                value={newExamForm.title}
                onChange={(e) => setNewExamForm({ ...newExamForm, title: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Target Batch</label>
              <Input
                required
                placeholder="e.g. FSW-2026-A"
                value={newExamForm.batch}
                onChange={(e) => setNewExamForm({ ...newExamForm, batch: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Duration (Minutes)</label>
              <Input
                type="number"
                required
                min={5}
                value={newExamForm.durationMins}
                onChange={(e) => setNewExamForm({ ...newExamForm, durationMins: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Passing Score (%)</label>
              <Input
                type="number"
                required
                min={30}
                max={100}
                value={newExamForm.passingScore}
                onChange={(e) => setNewExamForm({ ...newExamForm, passingScore: e.target.value })}
              />
            </div>
            <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button type="button" className="button secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button type="submit" className="button primary">
                Save Exam
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
