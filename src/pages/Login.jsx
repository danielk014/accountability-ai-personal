import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Eye, EyeOff, Loader2, AlertTriangle } from "lucide-react";
import { supabase, supabaseMisconfigured } from "@/api/supabaseClient";

export default function Login() {
  const { login, register, isPasswordRecovery, clearPasswordRecovery } = useAuth();
  const navigate = useNavigate();

  // mode: "login" | "register" | "forgot" | "reset"
  const [mode, setMode]         = useState("login");
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState(() => localStorage.getItem("last_login_email") || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [error, setError]       = useState("");
  const [info, setInfo]         = useState("");
  const [loading, setLoading]   = useState(false);

  const switchMode = (m) => { setMode(m); setError(""); setInfo(""); };

  // When Supabase fires PASSWORD_RECOVERY event, switch to reset mode
  useEffect(() => {
    if (isPasswordRecovery) setMode("reset");
  }, [isPasswordRecovery]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    // ── Forgot password ──────────────────────────────────────────────────────
    if (mode === "forgot") {
      if (!email.trim()) { setError("Please enter your email address."); return; }
      setLoading(true);
      try {
        const { error: err } = await supabase.auth.resetPasswordForEmail(
          email.trim().toLowerCase(),
          { redirectTo: `${window.location.origin}/Login` }
        );
        if (err) throw new Error(err.message);
        setInfo("Password reset email sent — check your inbox.");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── Reset password (after clicking email link) ────────────────────────
    if (mode === "reset") {
      if (!newPassword.trim() || newPassword.trim().length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      setLoading(true);
      try {
        const { error: err } = await supabase.auth.updateUser({ password: newPassword.trim() });
        if (err) throw new Error(err.message);
        clearPasswordRecovery();
        navigate(createPageUrl("Dashboard"));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── Register ──────────────────────────────────────────────────────────
    if (mode === "register") {
      const trimName  = name.trim();
      const trimEmail = email.trim().toLowerCase();
      const trimPw    = password.trim();
      if (!trimName)  { setError("Please enter your name."); return; }
      if (!trimEmail) { setError("Please enter your email."); return; }
      if (trimPw.length < 6) { setError("Password must be at least 6 characters."); return; }
      if (trimPw !== confirmPassword.trim()) { setError("Passwords do not match."); return; }
      setLoading(true);
      try {
        await register(trimEmail, trimPw, trimName);
        navigate(createPageUrl("Dashboard"));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── Login ─────────────────────────────────────────────────────────────
    const trimEmail = email.trim();
    const trimPassword = password.trim();
    if (!trimEmail || !trimPassword) { setError("Please fill in all fields."); return; }
    setLoading(true);
    localStorage.setItem("last_login_email", trimEmail);
    try {
      await login(trimEmail, trimPassword);
      navigate(createPageUrl("Dashboard"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full px-4 py-3 rounded-xl border border-[hsl(220,13%,89%)] bg-white text-sm text-[hsl(220,13%,10%)] outline-none transition-all duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)] focus:border-[hsl(211,100%,50%)] focus:ring-2 focus:ring-[hsl(211,100%,50%)]/15 placeholder:text-[hsl(220,9%,60%)]";
  const labelCls = "block text-xs font-semibold text-[hsl(220,9%,40%)] mb-1.5 tracking-wide";
  const btnCls = "w-full py-3 rounded-xl bg-[hsl(211,100%,50%)] hover:bg-[hsl(211,100%,45%)] text-white font-semibold text-sm transition-all duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)] disabled:opacity-40 flex items-center justify-center gap-2 mt-2 shadow-sm shadow-[hsl(211,100%,50%)]/20 active:scale-[0.98]";

  return (
    <div className="min-h-screen bg-[hsl(220,14%,97%)] flex items-center justify-center p-4">
      <div className="w-full max-w-[400px]">

        {/* Config error banner */}
        {supabaseMisconfigured && (
          <div className="mb-6 flex gap-3 items-start bg-[hsl(0,80%,97%)] border border-[hsl(0,60%,88%)] rounded-2xl px-4 py-3">
            <AlertTriangle className="w-5 h-5 text-[hsl(0,72%,51%)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[hsl(0,60%,35%)]">App not configured</p>
              <p className="text-xs text-[hsl(0,50%,45%)] mt-0.5">
                <code className="font-mono">VITE_SUPABASE_URL</code> and <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> are missing.
                Add them to <code className="font-mono">.env.local</code> or your deployment platform's environment settings.
              </p>
            </div>
          </div>
        )}

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-[18px] bg-[#1e2228] flex items-center justify-center mx-auto mb-5 overflow-hidden shadow-lg shadow-black/[0.12]">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699863bb9965c7b81ed00428/8af80c917_c05151408_logo.png"
              alt="Accountable"
              className="w-13 h-13 object-contain"
            />
          </div>
          <h1 className="text-[28px] font-bold text-[hsl(220,13%,10%)] tracking-tight">Accountable</h1>
          <p className="text-[hsl(220,9%,46%)] mt-1.5 text-[15px]">Your personal accountability partner</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm shadow-black/[0.04] border border-[hsl(220,13%,93%)] p-7">

          {/* ── Reset password mode ────────────────────────────────────────── */}
          {mode === "reset" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="mb-2">
                <h2 className="text-lg font-semibold text-[hsl(220,13%,10%)]">Set new password</h2>
                <p className="text-sm text-[hsl(220,9%,46%)] mt-1">Choose a new password for your account.</p>
              </div>

              <div>
                <label className={labelCls}>New password</label>
                <div className="relative">
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    autoFocus
                    className={cn(inputCls, "pr-11")}
                  />
                  <button type="button" onClick={() => setShowNewPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(220,9%,55%)] hover:text-[hsl(220,13%,30%)] transition">
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="px-4 py-2.5 rounded-xl bg-[hsl(0,80%,97%)] border border-[hsl(0,60%,88%)] text-xs text-[hsl(0,72%,45%)] font-medium">{error}</div>
              )}

              <button type="submit" disabled={loading} className={btnCls}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Update password
              </button>
            </form>
          )}

          {/* ── Forgot password mode ───────────────────────────────────────── */}
          {mode === "forgot" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="mb-2">
                <h2 className="text-lg font-semibold text-[hsl(220,13%,10%)]">Reset your password</h2>
                <p className="text-sm text-[hsl(220,9%,46%)] mt-1">We'll send a reset link to your email.</p>
              </div>

              <div>
                <label className={labelCls}>Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                  className={inputCls}
                />
              </div>

              {error && (
                <div className="px-4 py-2.5 rounded-xl bg-[hsl(0,80%,97%)] border border-[hsl(0,60%,88%)] text-xs text-[hsl(0,72%,45%)] font-medium">{error}</div>
              )}
              {info && (
                <div className="px-4 py-2.5 rounded-xl bg-[hsl(152,50%,96%)] border border-[hsl(152,40%,82%)] text-xs text-[hsl(152,50%,30%)] font-medium">{info}</div>
              )}

              <button type="submit" disabled={loading} className={btnCls}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Send reset email
              </button>

              <button type="button" onClick={() => { setMode("login"); setError(""); setInfo(""); }}
                className="w-full text-center text-xs text-[hsl(220,9%,46%)] hover:text-[hsl(220,13%,18%)] transition">
                Back to sign in
              </button>
            </form>
          )}

          {/* ── Register mode ──────────────────────────────────────────────── */}
          {mode === "register" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="mb-2">
                <h2 className="text-lg font-semibold text-[hsl(220,13%,10%)]">Create your account</h2>
                <p className="text-sm text-[hsl(220,9%,46%)] mt-1">Start your accountability journey.</p>
              </div>

              <div>
                <label className={labelCls}>Full name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Your name" autoComplete="name" autoFocus
                  className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" autoComplete="email"
                  className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Password</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    autoComplete="new-password"
                    className={cn(inputCls, "pr-11")}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(220,9%,55%)] hover:text-[hsl(220,13%,30%)] transition">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className={labelCls}>Confirm password</label>
                <div className="relative">
                  <input
                    type={showConfirmPw ? "text" : "password"}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                    className={cn(inputCls, "pr-11")}
                  />
                  <button type="button" onClick={() => setShowConfirmPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(220,9%,55%)] hover:text-[hsl(220,13%,30%)] transition">
                    {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="px-4 py-2.5 rounded-xl bg-[hsl(0,80%,97%)] border border-[hsl(0,60%,88%)] text-xs text-[hsl(0,72%,45%)] font-medium">{error}</div>
              )}

              <button type="submit" disabled={loading} className={btnCls}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Create account
              </button>

              <p className="text-center text-xs text-[hsl(220,9%,46%)] pt-1">
                Already have an account?{" "}
                <button type="button" onClick={() => switchMode("login")}
                  className="text-[hsl(211,100%,50%)] font-semibold hover:underline">
                  Sign in
                </button>
              </p>
            </form>
          )}

          {/* ── Login mode ─────────────────────────────────────────────────── */}
          {mode === "login" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelCls}>Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" autoComplete="email"
                  className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Password</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className={cn(inputCls, "pr-11")}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(220,9%,55%)] hover:text-[hsl(220,13%,30%)] transition">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="text-right -mt-1">
                <button type="button" onClick={() => switchMode("forgot")}
                  className="text-xs text-[hsl(211,100%,50%)] hover:underline font-medium">
                  Forgot password?
                </button>
              </div>

              {error && (
                <div className="px-4 py-2.5 rounded-xl bg-[hsl(0,80%,97%)] border border-[hsl(0,60%,88%)] text-xs text-[hsl(0,72%,45%)] font-medium">{error}</div>
              )}

              <button type="submit" disabled={loading} className={btnCls}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Sign in
              </button>

              <p className="text-center text-xs text-[hsl(220,9%,46%)] pt-1">
                Don't have an account?{" "}
                <button type="button" onClick={() => switchMode("register")}
                  className="text-[hsl(211,100%,50%)] font-semibold hover:underline">
                  Create one
                </button>
              </p>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-[hsl(220,9%,60%)] mt-6">
          Your data is stored securely in the cloud.
        </p>
      </div>
    </div>
  );
}
