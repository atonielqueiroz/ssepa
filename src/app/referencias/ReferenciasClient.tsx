"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { TaskTabsInline } from "@/app/components/TaskTabsInline";
import { emitTasksChanged, onTasksChanged } from "@/app/components/tasksEvents";

export type ReferenceRow = {
  id: string;
  title: string;
  execNumber: string | null;
  executadoNome: string | null;
  semExecucaoFormada: boolean;
  updatedAtIso: string;
  statusLabel: string | null;
  statusIsRed?: boolean | null;

  progressPct: number | null;
  progressLabel: string | null;
  progressServedAmd?: string | null;
  progressRequiredAmd?: string | null;

  archivedAtIso: string | null;
};

export default function ReferenciasClient({ initialRows }: { initialRows: ReferenceRow[] }) {
  const [view, setView] = useState<"active" | "archived">("active");
  const [rows, setRows] = useState<ReferenceRow[]>(initialRows);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const orderDraftRef = useRef<string[] | null>(null);
  const itemRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  async function load(nextView = view) {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/referencias?view=${encodeURIComponent(nextView)}`);
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data?.error ?? "Falha ao carregar.");
      return;
    }

    setRows(Array.isArray(data?.rows) ? data.rows : []);
  }

  useEffect(() => {
    // Sempre recarrega do backend para garantir que a barra da Mesa reflita
    // o mesmo cálculo e os mesmos campos (tempo cumprido/tempo a cumprir).
    // Importante: mantemos a lista atual na tela enquanto carrega (sem “sumir”).
    load(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    return onTasksChanged(() => {
      // reaproveitar o mesmo barramento (evento genérico)
      load(view);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  async function reorder(orderedIds: string[]) {
    const res = await fetch("/api/referencias/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ view, orderedIds }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "Falha ao reordenar.");
    }
  }

  function findOverId(clientY: number) {
    const ids = rows.map((r) => r.id);
    for (const id of ids) {
      const el = itemRefs.current[id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      if (clientY < mid) return id;
    }
    return ids.length ? ids[ids.length - 1] : null;
  }

  function startDrag(e: React.PointerEvent, id: string) {
    setDraggingId(id);
    orderDraftRef.current = rows.map((r) => r.id);

    let raf = 0;
    let lastOver: string | null = null;

    function onMove(ev: PointerEvent) {
      if (!orderDraftRef.current) return;
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        if (!orderDraftRef.current) return;

        const overId = findOverId(ev.clientY);
        if (!overId) return;
        if (lastOver === overId) return;
        lastOver = overId;

        const list = [...orderDraftRef.current];
        const from = list.indexOf(id);
        const to = list.indexOf(overId);
        if (from < 0 || to < 0 || from === to) return;

        list.splice(from, 1);
        list.splice(to, 0, id);
        orderDraftRef.current = list;

        const byId = new Map(rows.map((r) => [r.id, r] as const));
        setRows(list.map((rid) => byId.get(rid)!).filter(Boolean));
      });
    }

    async function onUp() {
      const draft = orderDraftRef.current;
      setDraggingId(null);
      orderDraftRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);

      if (draft && draft.length) {
        await reorder(draft);
        emitTasksChanged();
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  }

  return (
    <div className="mt-4 overflow-hidden rounded border">
      <div className="flex items-center justify-between bg-zinc-50 p-3">
        <div className="flex items-center gap-2">
          <span className="font-medium">Minhas Execuções Penais</span>
          <TaskTabsInline
            leftLabel="Recentes"
            leftActive={view === "active"}
            onLeft={() => setView("active")}
            rightLabel="Arquivadas"
            rightActive={view === "archived"}
            onRight={() => setView("archived")}
          />
        </div>
        <Link className="ssepa-btn rounded px-3 py-2 text-sm" href="/referencias/nova">
          Cadastrar
        </Link>
      </div>

      {error ? <div className="border-t bg-red-50 p-2 text-xs text-red-700">{error}</div> : null}
      {!error && loading && rows.length > 0 ? (
        <div className="border-t bg-zinc-50 p-2 text-xs text-zinc-600">Atualizando…</div>
      ) : null}

      <table className="w-full text-sm">
        <thead className="sr-only">
          <tr>
            <th>Execução</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && loading ? (
            <tr>
              <td className="p-3 text-zinc-600" colSpan={1}>
                Carregando…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td className="p-3 text-zinc-600" colSpan={1}>
                Nenhuma simulação.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr
                key={r.id}
                ref={(el) => {
                  itemRefs.current[r.id] = el;
                }}
                className={"border-t " + (draggingId === r.id ? "opacity-60" : "")}
              >
                <td className="p-3" colSpan={1}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="ssepa-link px-1 py-0.5 text-xs"
                          onPointerDown={(e) => startDrag(e, r.id)}
                          title="Arrastar"
                          style={{ touchAction: "none" }}
                        >
                          ≡
                        </button>
                        <Link className="ssepa-link underline font-semibold" href={`/referencias/${r.id}`}>
                          🗂 {r.execNumber ?? r.title}
                        </Link>
                        {r.executadoNome ? (
                          <span className="min-w-0 truncate text-xs text-zinc-700" title={r.executadoNome}>
                            — {r.executadoNome}
                          </span>
                        ) : null}
                      </div>

                      {r.statusLabel ? (
                        <div className="mt-1">
                          <span className="rounded border bg-white px-2 py-0.5 text-[11px] text-zinc-700">
                            {r.statusIsRed ? (
                              <span className="font-semibold text-red-700">{r.statusLabel}</span>
                            ) : (
                              <span>{r.statusLabel}</span>
                            )}
                          </span>
                        </div>
                      ) : null}

                      {view === "active" ? null : (
                        <div className="mt-1 text-xs text-zinc-600">
                          Arquivada em {r.archivedAtIso ? new Date(r.archivedAtIso).toLocaleString("pt-BR") : "—"}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {/* Progressão — à direita (Mesa do Advogado) */}
                      {(() => {
                        const pct = typeof r.progressPct === "number" && Number.isFinite(r.progressPct) ? r.progressPct : null;
                        if (pct === null) return null;

                        const labelPct = r.progressLabel ?? `${Math.round(pct)}%`;
                        const served = r.progressServedAmd;
                        const req = r.progressRequiredAmd;
                        const overlay = served && req ? `PROGRESSÃO - ${served} / ${req}` : "PROGRESSÃO";

                        return (
                          <div className="ml-2 flex items-center gap-2 text-zinc-700">
                            <div className="relative h-10 w-64 overflow-hidden rounded bg-zinc-200">
                              <div
                                className="absolute left-0 top-0 h-10 bg-[color:var(--ssepa-accent)]"
                                style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                              />
                              <div className="absolute inset-0 flex items-center justify-center px-2 text-center text-[11px] font-semibold text-zinc-900">
                                {overlay}
                              </div>
                            </div>
                            <div className="text-xs font-semibold">{labelPct}</div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
