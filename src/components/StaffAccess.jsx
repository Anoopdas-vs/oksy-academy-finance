import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../context/useAuth.js";
import { ASSIGNABLE_ROLES, ROLE_LABEL } from "../lib/access.js";
import { Modal } from "./ui.jsx";
import { fetchFacultyBatches, setFacultyBatches } from "../lib/academy.js";

const LEARNER_ROLES = ["student", "professional"];

export default function StaffAccess() {
  const { user, profile: currentProfile } = useAuth();
  const [rows, setRows] = useState([]);
  const [batchNames, setBatchNames] = useState([]);
  const [facBatches, setFacBatches] = useState([]); // {faculty_id, batch_name}
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [facultyModal, setFacultyModal] = useState(null); // profile row

  const isOwner = currentProfile?.role === "super_admin";
  const selectableRoles = isOwner
    ? ["super_admin", ...ASSIGNABLE_ROLES]
    : ASSIGNABLE_ROLES;

  useEffect(() => {
    let ignore = false;
    async function load() {
      const [{ data, error: fetchError }, batchRes, fb] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("batches").select("name").eq("archived", false).order("name"),
        fetchFacultyBatches(),
      ]);
      if (ignore) return;
      if (fetchError) setError(fetchError.message);
      else {
        setError("");
        setRows(data || []);
      }
      setBatchNames((batchRes.data || []).map((b) => b.name));
      setFacBatches(fb.rows || []);
      setLoading(false);
    }
    load();
    return () => { ignore = true; };
  }, []);

  const updateRow = async (id, patch) => {
    setSavingId(id);
    const { error: updateError } = await supabase.from("profiles").update(patch).eq("id", id);
    if (updateError) alert(updateError.message);
    else setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setSavingId(null);
  };

  const saveFacultyBatches = async (facultyId, names) => {
    setSavingId(facultyId);
    const { error: e } = await setFacultyBatches(facultyId, names);
    if (e) alert(e.message);
    else {
      setFacBatches((prev) => [
        ...prev.filter((x) => x.faculty_id !== facultyId),
        ...names.map((n) => ({ faculty_id: facultyId, batch_name: n })),
      ]);
    }
    setSavingId(null);
    setFacultyModal(null);
  };

  const filteredRows = rows.filter((r) => {
    const term = search.toLowerCase().trim();
    const matchSearch =
      !term ||
      (r.full_name && r.full_name.toLowerCase().includes(term)) ||
      (r.email && r.email.toLowerCase().includes(term));
    const matchRole = filterRole === "all" || r.role === filterRole;
    return matchSearch && matchRole;
  });

  const pendingCount = rows.filter((r) => !r.is_approved).length;
  const facultyBatchCount = (id) => facBatches.filter((x) => x.faculty_id === id).length;

  return (
    <section className="page">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2>User Approvals & Role Access</h2>
          <p>Approve accounts, assign roles, and link students / faculty to their batch.</p>
        </div>
        {pendingCount > 0 && (
          <div style={{ background: "var(--accent-light, #eff6ff)", color: "var(--accent, #2563eb)", padding: "0.4rem 0.8rem", borderRadius: "8px", fontWeight: "600", fontSize: "0.85rem" }}>
            ⏳ {pendingCount} Pending Approval{pendingCount > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {error && <div className="auth-message error">{error}</div>}

      <div className="table-card">
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border, #e2e8f0)", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            className="input"
            style={{ maxWidth: "260px" }}
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="input" style={{ width: "auto" }} value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
            <option value="all">All Roles ({rows.length})</option>
            {selectableRoles.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]} ({rows.filter((x) => x.role === r).length})</option>
            ))}
          </select>
        </div>

        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Assigned Role</th>
              <th>Batch</th>
              <th>Status</th>
              <th>Financial Access</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7}>Loading user accounts...</td></tr>}
            {!loading && filteredRows.length === 0 && (
              <tr><td colSpan={7} className="table-empty">No accounts match the criteria.</td></tr>
            )}

            {filteredRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.full_name || "—"}</strong>
                  {row.id === user?.id && (
                    <span style={{ marginLeft: "0.4rem", fontSize: "0.75rem", padding: "0.1rem 0.4rem", background: "var(--border, #e2e8f0)", borderRadius: "4px" }}>You</span>
                  )}
                </td>
                <td>{row.email}</td>
                <td>
                  {row.role === "super_admin" && !isOwner ? (
                    <span className="status-badge completed">Owner</span>
                  ) : (
                    <select
                      value={row.role}
                      disabled={row.id === user?.id || savingId === row.id}
                      onChange={(e) => updateRow(row.id, { role: e.target.value })}
                    >
                      {selectableRoles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                  )}
                </td>
                <td>
                  {LEARNER_ROLES.includes(row.role) ? (
                    <select
                      value={row.batch_name || ""}
                      disabled={savingId === row.id}
                      onChange={(e) => updateRow(row.id, { batch_name: e.target.value || null })}
                    >
                      <option value="">— none —</option>
                      {batchNames.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  ) : row.role === "faculty" ? (
                    <button
                      className="button secondary small"
                      disabled={savingId === row.id}
                      onClick={() => setFacultyModal(row)}
                    >
                      {facultyBatchCount(row.id)} batch{facultyBatchCount(row.id) === 1 ? "" : "es"}
                    </button>
                  ) : (
                    <span className="table-sub">—</span>
                  )}
                </td>
                <td>
                  {row.is_approved ? (
                    <span className="status-badge active">Approved</span>
                  ) : (
                    <span className="status-badge registered" style={{ background: "#fef3c7", color: "#92400e" }}>Pending Approval</span>
                  )}
                </td>
                <td>
                  {(() => {
                    const alwaysOn = row.role === "admin" || row.role === "super_admin";
                    const isFinanceRelevant = alwaysOn || row.role === "staff";
                    if (!isFinanceRelevant) return <span style={{ fontSize: "0.8rem", color: "var(--text-muted, #94a3b8)" }}>Not applicable</span>;
                    return (
                      <label className="permission-toggle">
                        <input
                          type="checkbox"
                          checked={alwaysOn ? true : !!row.can_view_financials}
                          disabled={alwaysOn || savingId === row.id}
                          onChange={(e) => updateRow(row.id, { can_view_financials: e.target.checked })}
                        />
                        <span>{alwaysOn ? "Always" : row.can_view_financials ? "Granted" : "Restricted"}</span>
                      </label>
                    );
                  })()}
                </td>
                <td>
                  {row.role === "super_admin" && row.id === user?.id ? (
                    <span className="table-sub">—</span>
                  ) : row.is_approved ? (
                    <button
                      className="edit-button"
                      disabled={row.id === user?.id || savingId === row.id}
                      onClick={() => updateRow(row.id, { is_approved: false })}
                    >
                      Revoke
                    </button>
                  ) : (
                    <button className="button primary" disabled={savingId === row.id} onClick={() => updateRow(row.id, { is_approved: true })}>
                      Approve
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {facultyModal && (
        <FacultyBatchModal
          row={facultyModal}
          allBatches={batchNames}
          current={facBatches.filter((x) => x.faculty_id === facultyModal.id).map((x) => x.batch_name)}
          onClose={() => setFacultyModal(null)}
          onSave={(names) => saveFacultyBatches(facultyModal.id, names)}
        />
      )}
    </section>
  );
}

function FacultyBatchModal({ row, allBatches, current, onClose, onSave }) {
  const [checked, setChecked] = useState(new Set(current));
  const toggle = (b) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b); else next.add(b);
      return next;
    });
  };
  return (
    <Modal title={`Batches for ${row.full_name || row.email}`} onClose={onClose}>
      <div className="form-grid">
        {allBatches.length === 0 && <p className="table-sub">No batches yet — create them in Admin → Batches.</p>}
        {allBatches.map((b) => (
          <label key={b} className="permission-toggle" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input type="checkbox" checked={checked.has(b)} onChange={() => toggle(b)} />
            <span>{b}</span>
          </label>
        ))}
        <div className="form-actions">
          <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="button primary" onClick={() => onSave([...checked])}>Save</button>
        </div>
      </div>
    </Modal>
  );
}
