import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../context/useAuth.js";
import { ASSIGNABLE_ROLES, ROLE_LABEL } from "../lib/access.js";

export default function StaffAccess() {
  const { user, profile: currentProfile } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");

  const isOwner = currentProfile?.role === "super_admin";
  const selectableRoles = isOwner
    ? ["super_admin", ...ASSIGNABLE_ROLES]
    : ASSIGNABLE_ROLES;

  useEffect(() => {
    let ignore = false;
    async function load() {
      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (!ignore) {
        if (fetchError) {
          setError(fetchError.message);
        } else {
          setError("");
          setRows(data || []);
        }
        setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  const updateRow = async (id, patch) => {
    setSavingId(id);
    const { error: updateError } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", id);

    if (updateError) {
      alert(updateError.message);
    } else {
      setRows((prev) =>
        prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
      );
    }
    setSavingId(null);
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

  return (
    <section className="page">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2>User Approvals & Role Access</h2>
          <p>
            Approve registered accounts and assign roles across the academy (Admin, Executive, Faculty, Student, Professionals).
          </p>
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
          <select
            className="input"
            style={{ width: "auto" }}
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="all">All Roles ({rows.length})</option>
            {selectableRoles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]} ({rows.filter((x) => x.role === r).length})
              </option>
            ))}
          </select>
        </div>

        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Assigned Role</th>
              <th>Status</th>
              <th>Financial Access</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6}>Loading user accounts...</td>
              </tr>
            )}

            {!loading && filteredRows.length === 0 && (
              <tr>
                <td colSpan={6} className="table-empty">No accounts match the criteria.</td>
              </tr>
            )}

            {filteredRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.full_name || "—"}</strong>
                  {row.id === user?.id && (
                    <span style={{ marginLeft: "0.4rem", fontSize: "0.75rem", padding: "0.1rem 0.4rem", background: "var(--border, #e2e8f0)", borderRadius: "4px" }}>
                      You
                    </span>
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
                      {selectableRoles.map((r) => (
                        <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td>
                  {row.is_approved ? (
                    <span className="status-badge active">Approved</span>
                  ) : (
                    <span className="status-badge registered" style={{ background: "#fef3c7", color: "#92400e" }}>
                      Pending Approval
                    </span>
                  )}
                </td>
                <td>
                  {(() => {
                    const alwaysOn = row.role === "admin" || row.role === "super_admin";
                    const isFinanceRelevant = row.role === "admin" || row.role === "super_admin" || row.role === "staff";
                    if (!isFinanceRelevant) {
                      return <span style={{ fontSize: "0.8rem", color: "var(--text-muted, #94a3b8)" }}>Not applicable</span>;
                    }
                    return (
                      <label className="permission-toggle">
                        <input
                          type="checkbox"
                          checked={alwaysOn ? true : !!row.can_view_financials}
                          disabled={alwaysOn || savingId === row.id}
                          onChange={(e) =>
                            updateRow(row.id, { can_view_financials: e.target.checked })
                          }
                        />
                        <span>
                          {alwaysOn ? "Always" : row.can_view_financials ? "Granted" : "Restricted"}
                        </span>
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
                      onClick={() =>
                        updateRow(row.id, { is_approved: false })
                      }
                    >
                      Revoke
                    </button>
                  ) : (
                    <button
                      className="button primary"
                      disabled={savingId === row.id}
                      onClick={() => updateRow(row.id, { is_approved: true })}
                    >
                      Approve
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
