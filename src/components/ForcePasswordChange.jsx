import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

// Shown instead of the main app whenever profile.must_change_password is
// true — i.e. this login still has the temp password a super-admin set for
// it via "Create Login". See the engineering review, finding M6.
export default function ForcePasswordChange() {
  const { changePassword, signOut } = useAuth();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Choose a password of at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }
    setSubmitting(true);
    const { error: changeError } = await changePassword(password);
    setSubmitting(false);
    if (changeError) setError(changeError.message);
    // On success, profile.must_change_password is now false — App.jsx's own
    // gate re-renders into the real app automatically, nothing else to do here.
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-welcome">
          <img src="/oksy-logo.jpeg" alt="Oksy Academy" />
          <h1>Set a new password</h1>
          <p>
            Your login was created with a temporary password. Choose your own
            before continuing.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label>New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              autoFocus
            />
          </div>

          <div className="field">
            <label>Confirm new password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>

          {error && <div className="auth-message error">{error}</div>}

          <button className="button primary full" type="submit" disabled={submitting}>
            {submitting ? "Please wait..." : "Set password and continue"}
          </button>
        </form>

        <p className="auth-footnote">
          Wrong account? <button type="button" className="link-button" onClick={signOut}>Sign out</button>
        </p>
      </div>
    </div>
  );
}
