import React, { useState } from "react";
import { useAuth } from "../context/useAuth.js";

export default function Login() {
  const { signIn, signInWithGoogle, resetPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    const { error: signInError } = await signIn(email, password);
    if (signInError) setError(signInError.message);
    setSubmitting(false);
  };

  const handleForgot = async () => {
    setError("");
    setNotice("");
    if (!email) {
      setError("Enter your email above first, then tap “Forgot password”.");
      return;
    }
    const { error: resetError } = await resetPassword(email);
    if (resetError) setError(resetError.message);
    else setNotice(`If ${email} has an account, a password-reset link is on its way.`);
  };

  const handleGoogle = async () => {
    setError("");
    const { error: oauthError } = await signInWithGoogle();
    if (oauthError) setError(oauthError.message);
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-welcome">
          <img src="/oksy-logo.jpeg" alt="Oksy Academy" />
          <h1>Welcome to Oksy Academy</h1>
          <p>Academy Portal — sign in to continue</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@oksy.in"
              autoComplete="username"
            />
          </div>

          <div className="field">
            <div className="label-row">
              <label>Password</label>
              <button type="button" className="link-button" onClick={handleForgot}>
                Forgot password?
              </button>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && <div className="auth-message error">{error}</div>}
          {notice && <div className="auth-message notice">{notice}</div>}

          <button className="button primary full" type="submit" disabled={submitting}>
            {submitting ? "Please wait..." : "Sign In"}
          </button>
        </form>

        <div className="auth-or"><span>or</span></div>

        <button type="button" className="button google-button full" onClick={handleGoogle}>
          <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </button>

        <p className="auth-footnote">
          Access is by invitation. An Oksy Academy admin creates your login —
          contact them if you don't have one.
        </p>
      </div>
    </div>
  );
}
