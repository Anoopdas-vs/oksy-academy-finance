import React from "react";
import { StatusBadge, Input, Modal } from "../components/ui.jsx";
import { formatMoney } from "../lib/format.js";
import { SearchBox, Pager } from "../components/SearchPager.jsx";
import { usePagedList } from "../lib/usePagedList.js";
import { downloadTemplate } from "../lib/templates.js";

export default function EnrollmentPage({
  students,
  batches = [],
  onFileSelected,
  onNew,
  onEdit,
  showForm,
  editingStudent,
  form,
  setForm,
  onCancel,
  onSave,
  saving,
  formError,
}) {
  const set = (patch) => setForm({ ...form, ...patch });

  // Picking a batch pre-fills the course name and course fee from the batch
  // master (both stay editable afterwards).
  const pickBatch = (name) => {
    const b = batches.find((x) => x.name === name);
    if (!b) return set({ batch: name });
    set({
      batch: name,
      course: b.course_name || form.course,
      course_fee: b.course_fee ?? form.course_fee,
    });
  };
  const paged = usePagedList(students, {
    searchFields: ["id", "name", "course", "batch"],
    pageSize: 20,
  });

  return (
    <section className="page">
      <div className="toolbar">
        <SearchBox
          value={paged.query}
          onChange={paged.setQuery}
          placeholder="Search Student ID, name, batch or course..."
        />
        <Pager
          page={paged.page}
          totalPages={paged.totalPages}
          onPageChange={paged.setPage}
          filteredCount={paged.filteredCount}
          totalCount={paged.totalCount}
        />
        <div className="toolbar-actions">
          <button className="button secondary" onClick={() => downloadTemplate(
            "student_enrollment_template.xlsx",
            ["Student ID", "Batch", "Name", "Course", "Registration Fee", "Course Fee", "Exam Fee", "Other Fee", "Waiver", "Status", "Enrollment Date"],
            ["DBHM002", "2026-B", "Jane Doe", "Hospital Administration", 5000, 45000, 2000, 0, 0, "Registered", "2026-06-01"]
          )}>
            Download Template
          </button>
          <label className="button secondary">
            Import Excel
            <input type="file" accept=".xlsx,.xls,.csv" onChange={onFileSelected} hidden />
          </label>
          <button className="button primary" onClick={onNew}>+ Add Student</button>
        </div>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Student ID</th><th>Batch</th><th>Name</th><th>Course</th>
              <th>Registration</th><th>Course Fee</th><th>Exam</th><th>Other</th>
              <th>Waiver</th><th>Status</th><th>Enrollment Date</th><th></th>
            </tr>
          </thead>
          <tbody>
            {paged.pageRows.map((s) => (
              <tr key={s.id}>
                <td><strong className="student-id">{s.id}</strong></td>
                <td>{s.batch}</td>
                <td><strong>{s.name}</strong></td>
                <td>{s.course}</td>
                <td>{formatMoney(s.registration_fee)}</td>
                <td>{formatMoney(s.course_fee)}</td>
                <td>{formatMoney(s.exam_fee)}</td>
                <td>{formatMoney(s.other_fee)}</td>
                <td>{formatMoney(s.waiver)}</td>
                <td><StatusBadge status={s.status} /></td>
                <td>{s.enrollment_date}</td>
                <td><button className="edit-button" onClick={() => onEdit(s)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title={editingStudent ? "Edit Student" : "New Student"} onClose={onCancel}>
          <form className="form-grid" onSubmit={onSave}>
            {formError && <div className="form-error-banner">{formError}</div>}
            <Input label="Student ID" value={form.id} onChange={(v) => set({ id: v })} required />
            <div className="field">
              <label>Batch</label>
              {batches.length > 0 ? (
                <select value={form.batch || ""} onChange={(e) => pickBatch(e.target.value)}>
                  <option value="">— none —</option>
                  {batches.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                  {form.batch && !batches.some((b) => b.name === form.batch) && (
                    <option value={form.batch}>{form.batch}</option>
                  )}
                </select>
              ) : (
                <input value={form.batch} onChange={(e) => set({ batch: e.target.value })} />
              )}
            </div>
            <Input label="Student Name" value={form.name} onChange={(v) => set({ name: v })} required />
            <Input label="Course" value={form.course} onChange={(v) => set({ course: v })} />
            <Input label="Registration Fee" type="number" min="0" value={form.registration_fee} onChange={(v) => set({ registration_fee: v })} />
            <Input label="Course Fee" type="number" min="0" value={form.course_fee} onChange={(v) => set({ course_fee: v })} />
            <Input label="Exam Fee" type="number" min="0" value={form.exam_fee} onChange={(v) => set({ exam_fee: v })} />
            <Input label="Other Fee" type="number" min="0" value={form.other_fee} onChange={(v) => set({ other_fee: v })} />
            <Input label="Waiver" type="number" min="0" value={form.waiver} onChange={(v) => set({ waiver: v })} />
            <div className="field">
              <label>Status</label>
              <select value={form.status} onChange={(e) => set({ status: e.target.value })}>
                <option>Registered</option>
                <option>Active</option>
                <option>Completed</option>
                <option>Dropped</option>
              </select>
            </div>
            <Input label="Enrollment Date" type="date" value={form.enrollment_date} onChange={(v) => set({ enrollment_date: v })} />
            <div className="form-actions">
              <button type="button" className="button secondary" onClick={onCancel} disabled={saving}>Cancel</button>
              <button type="submit" className="button primary" disabled={saving}>
                {saving ? "Saving..." : "Save Student"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
