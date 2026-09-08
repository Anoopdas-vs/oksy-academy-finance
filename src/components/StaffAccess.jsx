import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../context/AuthContext.jsx";
import { ASSIGNABLE_ROLES, ROLE_LABEL } from "../lib/access.js";

export default function StaffAccess() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setError("");
      setRows(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
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

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h2>Staff Access</h2>
          <p>
            Approve new logins and control who can view confidential
            financial details (bank balances, expenses, inter-company and
            dashboard totals).
          </p>
        </div>
      </div>

      {error && <div className="auth-message error">{error}</div>}

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Financial Access</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6}>Loading...</td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6}>No accounts yet.</td>
              </tr>
            )}

            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.full_name || "—"}</strong>
                  {row.id === user?.id && (
                    <small className="table-sub">You</small>
                  )}
                </td>
                <td>{row.email}</td>
                <td>
                  {row.role === "super_admin" ? (
                    <span className="status-badge completed">Owner</span>
                  ) : (
                    <select
                      value={row.role}
                      disabled={row.id === user?.id || savingId === row.id}
                      onChange={(e) => updateRow(row.id, { role: e.target.value })}
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td>
                  {row.is_approved ? (
                    <span className="status-badge active">Approved</span>
                  ) : (
                    <span className="status-badge registered">Pending</span>
                  )}
                </td>
                <td>
                  {(() => {
                    const alwaysOn = row.role === "admin" || row.role === "super_admin";
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
                  {row.role === "super_admin" ? (
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
