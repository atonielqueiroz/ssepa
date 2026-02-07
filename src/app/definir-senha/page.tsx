"use client";

import { useEffect, useState } from "react";

export default function DefinirSenhaPage() {
  const [token, setToken] = useState<string>("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      setToken(sp.get("nox") || "");
    } catch {}
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("Token inválido.");
      return;
    }
    if (!password || password.length < 10) {
      setError("A senha deve ter pelo menos 10 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/setup-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data?.error ?? "Falha ao definir senha.");
      return;
    }
    setOk(true);
  }

  if (ok) {
    return (
      <div className="mx-auto w-full max-w-md rounded border bg-white p-4">
        <div className="text-lg font-semibold">Senha definida.</div>
        <div className="mt-2 text-sm text-zinc-700">Você já pode entrar normalmente no SSEPA.</div>
        <div className="mt-3">
          <a className="ssepa-btn rounded px-4 py-2 text-sm" href="/login">
            Ir para login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md rounded border bg-white p-4">
      <div className="text-lg font-semibold">Definir senha (NOX)</div>
      <div className="mt-1 text-sm text-zinc-600">Link de uso único e com expiração. Crie uma senha forte.</div>

      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <div>
          <label className="text-sm font-medium">Nova senha</label>
          <input className="mt-1 w-full rounded border px-3 py-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">Confirmar senha</label>
          <input className="mt-1 w-full rounded border px-3 py-2" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>

        {error ? <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}

        <button className="ssepa-btn w-full rounded px-3 py-2 text-sm" type="submit" disabled={loading}>
          {loading ? "Salvando…" : "Salvar"}
        </button>
      </form>
    </div>
  );
}
