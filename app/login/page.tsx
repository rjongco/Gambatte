"use client";

import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Login failed");
        return;
      }
      // Bounce back to where they were headed (defaults to home).
      const from = new URLSearchParams(window.location.search).get("from");
      window.location.href = from && from.startsWith("/") ? from : "/";
    } catch {
      setError("Network error");
    } finally {
      setPending(false);
    }
  }

  const inputClass =
    "w-full rounded border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]";

  return (
    <main className="flex min-h-full items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-80 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-5"
      >
        <h1 className="mb-4 text-sm font-semibold tracking-tight text-[var(--color-text)]">
          gambatte — sign in
        </h1>
        <label className="mb-3 block">
          <span className="mb-1 block text-xs text-[var(--color-muted)]">Username</span>
          <input
            className={inputClass}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        </label>
        <label className="mb-4 block">
          <span className="mb-1 block text-xs text-[var(--color-muted)]">Password</span>
          <input
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={pending || !username || !password}
          className="w-full rounded bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
