"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
// layout.tsx já aplica AppShell
import { calcSaldoRemicao, type IncidenteDTO } from "@/lib/remicao";

type IncType = "REMICAO" | "HOMOLOGACAO_FALTA_GRAVE";

const TYPE_LABEL: Record<IncType, string> = {
  REMICAO: "Remição",
  HOMOLOGACAO_FALTA_GRAVE: "Homologação de falta grave",
};

export default function IncidentesPage() {
  const params = useParams<{ id: string }>();
  const referenceId = params.id;
  const router = useRouter();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<IncType>("REMICAO");
  const [referenceDate, setReferenceDate] = useState("");
  const [autuacaoAt, setAutuacaoAt] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [sourceText, setSourceText] = useState("");

  // remição
  const [remicaoDias, setRemicaoDias] = useState(0);
  const [remicaoStatus, setRemicaoStatus] = useState<"HOMOLOGADA" | "NAO_HOMOLOGADA">("HOMOLOGADA");

  // falta grave fração
  const [fracNum, setFracNum] = useState(1);
  const [fracDen, setFracDen] = useState(3);

  const [includeNaoHomologada, setIncludeNaoHomologada] = useState(true);

  const dto: IncidenteDTO[] = useMemo(() => {
    return items.map((i) => ({
      id: i.id,
      type: i.type,
      referenceDate: i.referenceDate,
      remicaoDias: i.remicaoDias,
      remicaoStatus: i.remicaoStatus,
      fracNum: i.fracNum,
      fracDen: i.fracDen,
    }));
  }, [items]);

  const resumo = useMemo(() => calcSaldoRemicao(dto, includeNaoHomologada), [dto, includeNaoHomologada]);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/incidentes?referenceId=${referenceId}`);
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data?.error ?? "Falha ao carregar incidentes.");
      return;
    }
    setItems(data.incidentes ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload: any = {
      referenceId,
      type,
      referenceDate,
      autuacaoAt: autuacaoAt || null,
      numero,
      complemento,
      sourceText,
    };

    if (type === "REMICAO") {
      payload.remicaoDias = remicaoDias;
      payload.remicaoStatus = remicaoStatus;
    }

    if (type === "HOMOLOGACAO_FALTA_GRAVE") {
      payload.fracNum = fracNum;
      payload.fracDen = fracDen;
      payload.complemento = `${fracNum}/${fracDen}`;
    }

    const res = await fetch("/api/incidentes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "Falha ao salvar incidente.");
      return;
    }

    setReferenceDate("");
    setAutuacaoAt("");
    setNumero("");
    setComplemento("");
    setSourceText("");
    setRemicaoDias(0);
    setRemicaoStatus("HOMOLOGADA");
    setFracNum(1);
    setFracDen(3);

    await load();
  }

  async function onDelete(id: string) {
    if (!confirm("Excluir este incidente?")) return;
    const res = await fetch(`/api/incidentes/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data?.error ?? "Falha ao excluir.");
      return;
    }
    await load();
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Incidentes</h1>
          <div className="mt-1 text-sm ssepa-muted">Remições e faltas graves (estilo SEEU). A perda por falta grave é aplicada até 1/3 (art. 127 LEP), com arredondamento favorável ao executado.</div>
        </div>
        <div className="flex gap-2">
          <button className="rounded border px-3 py-2 text-sm" onClick={() => router.push(`/referencias/${referenceId}`)}>
            Voltar
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="ssepa-panel rounded">
          <div className="ssepa-panel-header p-3 font-medium">Cadastrar incidente</div>
          <form className="p-3 space-y-3" onSubmit={onSubmit}>
            <div>
              <label className="text-sm font-medium">Tipo *</label>
              <select className="mt-1 w-full rounded border bg-white px-3 py-2" value={type} onChange={(e) => setType(e.target.value as IncType)}>
                <option value="REMICAO">Remição</option>
                <option value="HOMOLOGACAO_FALTA_GRAVE">Homologação de falta grave</option>
              </select>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Data de referência *</label>
                <input className="mt-1 w-full rounded border px-3 py-2" type="date" value={referenceDate} onChange={(e) => setReferenceDate(e.target.value)} required />
              </div>
              <div>
                <label className="text-sm font-medium">Data de autuação (opcional)</label>
                <input className="mt-1 w-full rounded border px-3 py-2" type="date" value={autuacaoAt} onChange={(e) => setAutuacaoAt(e.target.value)} />
              </div>
            </div>

            {type === "REMICAO" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Dias remidos *</label>
                  <input className="mt-1 w-full rounded border px-3 py-2" type="number" min={0} value={remicaoDias} onChange={(e) => setRemicaoDias(Number(e.target.value))} required />
                </div>
                <div>
                  <label className="text-sm font-medium">Status *</label>
                  <select className="mt-1 w-full rounded border bg-white px-3 py-2" value={remicaoStatus} onChange={(e) => setRemicaoStatus(e.target.value as any)}>
                    <option value="HOMOLOGADA">Homologada (SEEU)</option>
                    <option value="NAO_HOMOLOGADA">Não homologada (simulação)</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="rounded border bg-white p-3">
                <div className="font-medium">Perda de remição (art. 127 LEP)</div>
                <div className="mt-1 text-xs ssepa-muted">O juiz pode revogar até 1/3 do tempo remido. Informe a fração aplicada na decisão.</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Fração (numerador)</label>
                    <input className="mt-1 w-full rounded border px-3 py-2" type="number" min={0} value={fracNum} onChange={(e) => setFracNum(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Fração (denominador)</label>
                    <input className="mt-1 w-full rounded border px-3 py-2" type="number" min={1} value={fracDen} onChange={(e) => setFracDen(Number(e.target.value))} />
                  </div>
                </div>
                <div className="mt-2 text-xs ssepa-muted">Arredondamento: piso (mais favorável ao executado).</div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Nº do incidente (opcional)</label>
              <input className="mt-1 w-full rounded border px-3 py-2" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex.: 15018746" />
            </div>

            <div>
              <label className="text-sm font-medium">Complemento (opcional)</label>
              <input className="mt-1 w-full rounded border px-3 py-2" value={complemento} onChange={(e) => setComplemento(e.target.value)} placeholder="Ex.: 20 dias" />
            </div>

            <div>
              <label className="text-sm font-medium">Fonte nos autos</label>
              <textarea className="mt-1 w-full rounded border px-3 py-2" rows={3} value={sourceText} onChange={(e) => setSourceText(e.target.value)} placeholder="Mov/seq/evento, documento, páginas…" />
            </div>

            {error ? <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}

            <button className="ssepa-btn rounded px-3 py-2 text-sm" type="submit">Cadastrar</button>
          </form>
        </div>

        <div className="ssepa-panel rounded">
          <div className="ssepa-panel-header p-3 font-medium">Resumo de remição</div>
          <div className="p-3 text-sm">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includeNaoHomologada} onChange={(e) => setIncludeNaoHomologada(e.target.checked)} />
              Incluir remições não homologadas (simulação)
            </label>

            <div className="mt-3 grid gap-1">
              <div><span className="font-medium">Homologada:</span> {resumo.totalHomologada} dia(s)</div>
              <div><span className="font-medium">Não homologada:</span> {resumo.totalNao} dia(s)</div>
              <div><span className="font-medium">Perdido (faltas graves):</span> {resumo.totalPerdido} dia(s)</div>
              <div className="mt-2 rounded border bg-white p-2"><span className="font-medium">Saldo remido líquido:</span> {resumo.saldo} dia(s)</div>
              <div className="mt-1 text-xs ssepa-muted">A perda é aplicada apenas sobre o saldo existente até a data da falta grave; remições futuras não são atingidas, salvo nova falta.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 ssepa-panel rounded">
        <div className="ssepa-panel-header p-3 font-medium">Incidentes cadastrados</div>
        <div className="p-3 text-sm">
          {loading ? <div className="ssepa-muted">Carregando…</div> : null}
          {!loading && items.length === 0 ? <div className="ssepa-muted">Nenhum incidente cadastrado.</div> : null}

          {items.length ? (
            <div className="overflow-hidden rounded border">
              <table className="w-full text-sm">
                <thead className="ssepa-table-head text-left">
                  <tr>
                    <th className="p-2">Nº</th>
                    <th className="p-2">Tipo</th>
                    <th className="p-2">Complemento</th>
                    <th className="p-2">Referência</th>
                    <th className="p-2">Autuação</th>
                    <th className="p-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className="border-t">
                      <td className="p-2">{it.numero || "—"}</td>
                      <td className="p-2">{TYPE_LABEL[it.type as IncType] ?? it.type}</td>
                      <td className="p-2">
                        {it.type === "REMICAO" ? (
                          <span>{it.remicaoDias} dia(s) — {it.remicaoStatus === "HOMOLOGADA" ? "Homologada" : "Não homologada"}</span>
                        ) : it.type === "HOMOLOGACAO_FALTA_GRAVE" ? (
                          <span>Perda {it.fracNum}/{it.fracDen} (até 1/3)</span>
                        ) : (
                          <span>{it.complemento || "—"}</span>
                        )}
                        {it.sourceText ? <div className="mt-1 text-[11px] ssepa-muted">Fonte: {it.sourceText}</div> : null}
                      </td>
                      <td className="p-2">{it.referenceDate.split("-").reverse().join("/")}</td>
                      <td className="p-2">{it.autuacaoAt ? it.autuacaoAt.split("-").reverse().join("/") : "—"}</td>
                      <td className="p-2 text-right">
                        <button className="rounded border px-2 py-1 text-xs" onClick={() => onDelete(it.id)} type="button">
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
