"use client";

import { useEffect, useState } from "react";

export default function CompletarCadastroPage() {
  const [form, setForm] = useState({
    oabNumber: "",
    oabUf: "",
    phone: "",
    recoveryEmail: "",
    acceptTerms: false,
    acceptPrivacy: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // no-op; placeholder if we later prefill from server
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.acceptTerms || !form.acceptPrivacy) {
      setError("Você precisa aceitar o Termo e a Política de Privacidade.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/complete-profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data?.error ?? "Falha ao salvar.");
      return;
    }
    setDone(true);
    window.location.href = "/referencias";
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Complete seu cadastro</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Para usar o SSEPA, complete seus dados profissionais e aceite o termo.
      </p>

      {done ? null : (
        <form className="mt-6 space-y-3" onSubmit={onSubmit}>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-sm font-medium">OAB *</label>
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={form.oabNumber}
                onChange={(e) => setForm({ ...form, oabNumber: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">UF *</label>
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={form.oabUf}
                onChange={(e) => setForm({ ...form, oabUf: e.target.value.toUpperCase() })}
                maxLength={2}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Celular *</label>
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Email de recuperação *</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              type="email"
              value={form.recoveryEmail}
              onChange={(e) => setForm({ ...form, recoveryEmail: e.target.value })}
              required
            />
          </div>

          <div className="rounded border bg-zinc-50 p-3 text-xs text-zinc-700">
            <div className="font-medium">Termo de responsabilidade (resumo)</div>
            <p className="mt-1">
              As informações e cálculos gerados pelo SSEPA são estimativas. O uso é de
              responsabilidade do advogado, que deve conferir tudo nos autos antes de
              utilizar/protocolar.
            </p>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.acceptTerms}
              onChange={(e) => setForm({ ...form, acceptTerms: e.target.checked })}
            />
            <span>Aceito o Termo de Responsabilidade</span>
          </label>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.acceptPrivacy}
              onChange={(e) => setForm({ ...form, acceptPrivacy: e.target.checked })}
            />
            <span>Aceito a Política de Privacidade</span>
          </label>

          {error ? (
            <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            className="ssepa-btn w-full rounded px-3 py-2 disabled:opacity-50"
            disabled={loading}
            type="submit"
          >
            {loading ? "Salvando…" : "Salvar"}
          </button>
        </form>
      )}
    </div>
  );
}
