import React, { useState, useEffect } from "react";
import { Modal, Input } from "../components/ui.jsx";
import { supabase } from "../lib/supabaseClient.js";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DEFAULT_SCHEDULE = [
  {
    id: "1",
    day: "Monday",
    time: "09:30 AM - 11:00 AM",
    subject: "Full-Stack Web Development",
    batch: "FSW-2026-A",
    faculty: "Prof. Arvind Kumar",
    room: "Virtual Room 101",
    link: "https://meet.jit.si/OksyAcademy-WebDev",
  },
  {
    id: "2",
    day: "Monday",
    time: "11:30 AM - 01:00 PM",
    subject: "Database Systems & Supabase",
    batch: "FSW-2026-A",
    faculty: "Dr. Meera Nair",
    room: "Virtual Room 102",
    link: "https://meet.jit.si/OksyAcademy-Databases",
  },
  {
    id: "3",
    day: "Tuesday",
    time: "10:00 AM - 11:30 AM",
    subject: "React & Modern Frontend Architecture",
    batch: "FSW-2026-A",
    faculty: "Prof. Arvind Kumar",
    room: "Virtual Room 101",
    link: "https://meet.jit.si/OksyAcademy-WebDev",
  },
  {
    id: "4",
    day: "Wednesday",
    time: "02:00 PM - 03:30 PM",
    subject: "Financial Accounting & Business Logic",
    batch: "BCOM-2026",
    faculty: "CMA Suresh Pillai",
    room: "Virtual Room 201",
    link: "https://meet.jit.si/OksyAcademy-Accounts",
  },
  {
    id: "5",
    day: "Thursday",
    time: "10:00 AM - 11:30 AM",
    subject: "AI & Automated Development Workflows",
    batch: "FSW-2026-A",
    faculty: "Anoopdas V S",
    room: "Virtual Room 101",
    link: "https://meet.jit.si/OksyAcademy-AI",
  },
  {
    id: "6",
    day: "Friday",
    time: "02:00 PM - 04:00 PM",
    subject: "Weekly Project Review & Lab Sessions",
    batch: "All Batches",
    faculty: "Faculty Panel",
    room: "Main Lab",
    link: "https://meet.jit.si/OksyAcademy-MainLab",
  },
];

export default function TimetablePage({ isAdmin, role, batches = [], onNavigateToClass }) {
  const canManage = isAdmin || role === "faculty";
  const [selectedDay, setSelectedDay] = useState(() => {
    const todayIndex = new Date().getDay(); // 0 is Sunday
    return todayIndex === 0 ? "Monday" : DAYS[todayIndex - 1] || "Monday";
  });

  const [schedule, setSchedule] = useState(() => {
    try {
      const saved = localStorage.getItem("oksy_timetables");
      return saved ? JSON.parse(saved) : DEFAULT_SCHEDULE;
    } catch {
      return DEFAULT_SCHEDULE;
    }
  });
  const [selectedBatch, setSelectedBatch] = useState("All");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem("oksy_timetables", JSON.stringify(schedule));
    } catch {
      // ignore
    }
  }, [schedule]);

  const [form, setForm] = useState({
    day: "Monday",
    time: "10:00 AM - 11:30 AM",
    subject: "",
    batch: batches[0]?.name || "All Batches",
    faculty: "",
    room: "Virtual Room 101",
    link: "",
  });

  useEffect(() => {
    async function loadRemote() {
      try {
        const { data, error } = await supabase.from("timetables").select("*");
        if (!error && data && data.length > 0) {
          setSchedule(data);
        }
      } catch {
        // Fallback to default in-memory schedule
      }
    }
    loadRemote();
  }, []);

  const filteredSlots = schedule.filter((item) => {
    const dayMatch = item.day === selectedDay;
    const batchMatch = selectedBatch === "All" || item.batch === selectedBatch || item.batch === "All Batches";
    return dayMatch && batchMatch;
  });

  const handleAddSlot = async (e) => {
    e.preventDefault();
    if (!form.subject || !form.time) return;

    const newSlot = {
      ...form,
      id: "slot_" + Date.now(),
      link: form.link || `https://meet.jit.si/OksyAcademy-${form.subject.replace(/\\s+/g, "")}`,
    };

    setSchedule((prev) => [...prev, newSlot]);
    setShowModal(false);

    try {
      await supabase.from("timetables").insert([newSlot]);
    } catch {
      // Ignored if offline or migration pending
    }
  };

  const handleDeleteSlot = async (id) => {
    if (!window.confirm("Delete this scheduled slot?")) return;
    setSchedule((prev) => prev.filter((s) => s.id !== id));
    try {
      await supabase.from("timetables").delete().eq("id", id);
    } catch {
      // Ignored if offline
    }
  };

  return (
    <section className="page">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2>Class Timetable & Schedule</h2>
          <p>View upcoming lecture slots, assigned faculty, and 1-click classroom join links.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <select
            className="input"
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
            style={{ width: "auto" }}
          >
            <option value="All">All Batches</option>
            {batches.map((b) => (
              <option key={b.name || b.id} value={b.name || b.id}>
                {b.name || b.id}
              </option>
            ))}
          </select>
          {canManage && (
            <button className="button primary" onClick={() => setShowModal(true)}>
              + Add Class Slot
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", overflowX: "auto", paddingBottom: "0.5rem" }}>
        {DAYS.map((day) => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`button ${selectedDay === day ? "primary" : "secondary"}`}
            style={{ minWidth: "110px", borderRadius: "9999px", padding: "0.5rem 1rem", fontSize: "0.9rem" }}
          >
            {day}
          </button>
        ))}
      </div>

      <div className="table-card" style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ margin: 0 }}>{selectedDay}'s Sessions</h3>
          <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>{filteredSlots.length} slot(s) scheduled</span>
        </div>

        {filteredSlots.length === 0 ? (
          <div style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--text-muted, #64748b)" }}>
            <p style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>No classes scheduled for {selectedDay}.</p>
            <p style={{ fontSize: "0.9rem" }}>Select another day or add a new schedule slot.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
            {filteredSlots.map((slot) => (
              <div
                key={slot.id}
                style={{
                  border: "1px solid var(--border, #e2e8f0)",
                  borderRadius: "12px",
                  padding: "1.25rem",
                  background: "var(--surface, #ffffff)",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.8rem", padding: "0.2rem 0.6rem", background: "var(--accent-light, #eff6ff)", color: "var(--accent, #2563eb)", borderRadius: "6px", fontWeight: "600" }}>
                      {slot.time}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted, #64748b)" }}>
                      {slot.batch}
                    </span>
                  </div>
                  <h4 style={{ margin: "0.5rem 0", fontSize: "1.1rem" }}>{slot.subject}</h4>
                  <p style={{ fontSize: "0.9rem", color: "var(--text-muted, #64748b)", margin: "0.25rem 0" }}>
                    👨‍🏫 {slot.faculty}
                  </p>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted, #64748b)", margin: "0.25rem 0" }}>
                    📍 {slot.room}
                  </p>
                </div>

                <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border, #e2e8f0)", display: "flex", gap: "0.5rem" }}>
                  <button
                    className="button primary full"
                    onClick={() => {
                      if (onNavigateToClass) {
                        onNavigateToClass(slot.subject, slot.link);
                      } else {
                        window.open(slot.link, "_blank");
                      }
                    }}
                    style={{ fontSize: "0.9rem", padding: "0.5rem" }}
                  >
                    🎥 Join Live Room
                  </button>
                  {canManage && (
                    <button
                      className="button secondary"
                      style={{ color: "var(--danger, #ef4444)", padding: "0.5rem 0.8rem" }}
                      onClick={() => handleDeleteSlot(slot.id)}
                      title="Delete Slot"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <Modal title="Schedule Class Slot" onClose={() => setShowModal(false)}>
          <form onSubmit={handleAddSlot} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="field">
              <label>Day of Week</label>
              <select className="input" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>
                {DAYS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Subject / Module Name</label>
              <Input
                required
                placeholder="e.g. Full-Stack Web Development"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Time Slot</label>
              <Input
                required
                placeholder="e.g. 10:00 AM - 11:30 AM"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Batch</label>
              <Input
                placeholder="e.g. FSW-2026-A"
                value={form.batch}
                onChange={(e) => setForm({ ...form, batch: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Faculty Name</label>
              <Input
                required
                placeholder="e.g. Prof. Arvind Kumar"
                value={form.faculty}
                onChange={(e) => setForm({ ...form, faculty: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Room / Platform</label>
              <Input
                value={form.room}
                onChange={(e) => setForm({ ...form, room: e.target.value })}
              />
            </div>
            <div className="modal-actions" style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button type="button" className="button secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button type="submit" className="button primary">
                Save Slot
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
