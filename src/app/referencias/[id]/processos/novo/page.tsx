"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { GuidanceBanner } from "@/app/components/GuidanceBanner";

export default function NovoProcessoPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const referenceId = params.id;

  const [number, setNumber] = useState("");
  const [notes, setNotes] = useState("");

  const [juizoVaraCondenacao, setJuizoVaraCondenacao] = useState("");

  // status da execução (agora fica na Execução/Simulação; não no processo)

  // Marcos processuais são preenchidos dentro do processo (Sentença/Recursos/Trânsito), após criar.

  const [irParaEventos, setIrParaEventos] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/processos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        referenceId,
        number,
        notes,
        juizoVaraCondenacao,
        // Marcos processuais são preenchidos dentro do processo (Sentença/Recursos/Trânsito), após criar.
      }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data?.error ?? "Falha ao criar processo.");
      return;
    }

    const pid = data.id;
    if (irParaEventos) {
      router.push(`/referencias/${referenceId}/processos/${pid}/eventos`);
    } else {
      router.push(`/referencias/${referenceId}/processos/${pid}#editar`);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Novo Processo Criminal</h1>
      <GuidanceBanner />
      <p className="mt-2 text-sm text-zinc-600">Cadastre o processo, depois os crimes e os eventos (prisão/soltura/cautelares).</p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="text-sm font-medium">Processo Criminal nº *</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="0000000-00.0000.0.00.0000"
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium">Juízo/Vara de condenação (opcional)</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={juizoVaraCondenacao}
            onChange={(e) => setJuizoVaraCondenacao(e.target.value)}
            placeholder="Ex.: 3ª Vara Criminal de Araguaína/TO"
          />
        </div>

        {/* Status da execução: preenchido na Execução/Simulação */}

        <div className="rounded border bg-zinc-50 p-3 text-sm text-zinc-700">
          Marcos processuais agora são preenchidos <span className="font-medium">dentro do processo</span>, após criar (Sentença/Recursos/Trânsito).
        </div>

        <div>
          <label className="text-sm font-medium">Observações / Fonte nos autos</label>
          <textarea
            className="mt-1 w-full rounded border px-3 py-2"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Indique onde consta a informação: mov/seq/evento, arquivo, páginas…"
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={irParaEventos} onChange={(e) => setIrParaEventos(e.target.checked)} />
          Após criar, ir para o cadastro de eventos (prisão/soltura/cautelares)
        </label>

        {error ? <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}

        <div className="flex gap-2">
          <button className="ssepa-btn rounded px-3 py-2 text-sm disabled:opacity-50" disabled={loading} type="submit">
            {loading ? "Salvando…" : "Criar"}
          </button>
          <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => router.push(`/referencias/${referenceId}`)}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
