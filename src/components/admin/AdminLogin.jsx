import { useState } from "react";
import { ADMIN_USERNAME, signInAdmin } from "../../lib/adminAuth.js";

export default function AdminLogin({ onSignedIn }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await signInAdmin(username, password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSignedIn();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ivory px-4 text-ink">
      <div className="w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-[0_20px_50px_rgba(28,28,24,0.08)]">
        <div className="bg-terracotta px-8 py-8 text-center text-white">
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/80">Staff only</p>
          <h1 className="mt-2 font-display text-3xl leading-tight">The Maati Cafe & Restaurant</h1>
          <p className="mt-2 text-sm text-white/85">Sign in to manage the dine-in menu.</p>
        </div>
        <form className="space-y-4 px-8 py-7" onSubmit={onSubmit}>
          <label className="block text-sm">
            <span className="mb-1 block text-ink/65">Staff ID</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              className="h-12 w-full rounded-2xl bg-card-2 px-4"
              placeholder={ADMIN_USERNAME}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-ink/65">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="h-12 w-full rounded-2xl bg-card-2 px-4"
              required
            />
          </label>
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="h-12 w-full rounded-full bg-terracotta text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
