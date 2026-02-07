"use client";

import { useState } from "react";

export default function SettingsClient() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  async function createInvite() {
    setError(null);
    setInviteUrl(null);
    setLoading(true);
    const res = await fetch("/api/admin/invite-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data?.error ?? "Falha ao criar convite.");
      return;
    }
    setInviteUrl(data?.url ?? null);
  }

  return (
    <div className="rounded border bg-white p-4">
      <div className="text-lg font-semibold">Configurações</div>

      <div className="mt-4">
        <div className="text-sm font-medium">Convite (definir senha)</div>
        <div className="mt-1 text-sm text-zinc-600">Gera um link de uso único para o email informado.</div>

        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="w-80 max-w-full rounded border px-3 py-2 text-sm"
            placeholder="email@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="rounded border px-3 py-2 text-sm" disabled={loading || !email} onClick={createInvite}>
            {loading ? "Gerando…" : "Gerar convite"}
          </button>
        </div>

        {error ? <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}

        {inviteUrl ? (
          <div className="mt-3 rounded border bg-zinc-50 p-3">
            <div className="text-xs text-zinc-600">Link</div>
            <div className="mt-1 break-all font-mono text-xs">{inviteUrl}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
