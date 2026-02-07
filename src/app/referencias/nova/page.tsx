"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GuidanceBanner } from "@/app/components/GuidanceBanner";

export default function NovaReferenciaPage() {
  const router = useRouter();
  const [execNumber, setExecNumber] = useState("");
  const [executadoNome, setExecutadoNome] = useState("");
  const [semExecucaoFormada, setSemExecucaoFormada] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/referencias", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ execNumber, executadoNome, semExecucaoFormada, notes }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data?.error ?? "Falha ao criar referência.");
      return;
    }

    router.push(`/referencias/${data.id}`);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Nova Execução</h1>
      <GuidanceBanner />

      <form className="mt-6 space-y-3" onSubmit={onSubmit}>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={semExecucaoFormada}
            onChange={(e) => setSemExecucaoFormada(e.target.checked)}
          />
          Sem execução formada
        </label>

        <div>
          <label className="text-sm font-medium">Execução Penal nº *</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={execNumber}
            onChange={(e) => setExecNumber(e.target.value)}
            disabled={semExecucaoFormada}
            placeholder={semExecucaoFormada ? "(não informado)" : "0000000-00.0000.0.00.0000"}
          />
          <p className="mt-1 text-xs text-zinc-600">
            Você pode deixar “Sem execução formada” para organizar dados enquanto a execução ainda não foi
            formalizada.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium">Nome do executado</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={executadoNome}
            onChange={(e) => setExecutadoNome(e.target.value)}
            placeholder="Ex.: Marcos Sousa e Silva"
          />
          <p className="mt-1 text-xs text-zinc-600">Ajuda a identificar rapidamente a simulação na lista.</p>
        </div>

        <div>
          <label className="text-sm font-medium">Observações</label>
          <textarea
            className="mt-1 w-full rounded border px-3 py-2"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Anote informações úteis…"
          />
        </div>

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
          {loading ? "Salvando…" : "Criar"}
        </button>
      </form>
    </div>
  );
}
