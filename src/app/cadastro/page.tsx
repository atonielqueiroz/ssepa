"use client";

import { useState } from "react";
import Link from "next/link";

export default function CadastroPage() {
  const [form, setForm] = useState({
    name: "",
    oabNumber: "",
    oabUf: "",
    phone: "",
    email: "",
    recoveryEmail: "",
    password: "",
    acceptTerms: false,
    acceptPrivacy: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.acceptTerms || !form.acceptPrivacy) {
      setError("Você precisa aceitar o Termo e a Política de Privacidade.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data?.error ?? "Falha ao criar conta.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md p-6">
        <h1 className="text-2xl font-semibold">Conta criada</h1>
        <p className="mt-2 text-sm text-zinc-700">
          Agora você já pode entrar.
        </p>
        <Link className="mt-4 inline-block ssepa-link underline" href="/login">
          Ir para login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Criar conta</h1>
      <p className="mt-2 text-sm text-zinc-600">
        SSEPA — seus cálculos são estimativas. O advogado deve conferir antes de usar.
      </p>

      <form className="mt-6 space-y-3" onSubmit={onSubmit}>
        <Field label="Nome completo" required>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </Field>

        <div className="grid grid-cols-3 gap-2">
          <Field label="OAB" required>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={form.oabNumber}
              onChange={(e) => setForm({ ...form, oabNumber: e.target.value })}
              required
            />
          </Field>
          <Field label="UF" required>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={form.oabUf}
              onChange={(e) => setForm({ ...form, oabUf: e.target.value.toUpperCase() })}
              maxLength={2}
              required
            />
          </Field>
          <Field label="Celular" required>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
            />
          </Field>
        </div>

        <Field label="Email (login)" required>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </Field>

        <Field label="Email de recuperação" required>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            type="email"
            value={form.recoveryEmail}
            onChange={(e) => setForm({ ...form, recoveryEmail: e.target.value })}
            required
          />
        </Field>

        <Field label="Senha" required>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            minLength={8}
            required
          />
        </Field>

        <div className="rounded border bg-zinc-50 p-3 text-xs text-zinc-700">
          <div className="font-medium">Termo de responsabilidade (resumo)</div>
          <p className="mt-1">
            As informações e cálculos gerados pelo SSEPA são estimativas. O uso é de
            responsabilidade do advogado, que deve conferir tudo nos autos antes de
            utilizar/protocolar. Podem existir erros, imprecisões e divergências.
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
          {loading ? "Criando…" : "Criar conta"}
        </button>
      </form>

      <div className="mt-4 text-sm">
        Já tem conta?{" "}
        <Link className="ssepa-link underline" href="/login">
          Entrar
        </Link>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-medium">
        {label} {required ? <span className="text-red-600">*</span> : null}
      </label>
      {children}
    </div>
  );
}
