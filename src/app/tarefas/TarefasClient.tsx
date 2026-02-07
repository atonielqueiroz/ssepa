"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { TaskTabsInline } from "@/app/components/TaskTabsInline";
import { emitTasksChanged, onTasksChanged } from "@/app/components/tasksEvents";

type TaskItem = { id: string; title: string; status: "OPEN" | "DONE" | "ARCHIVED"; updatedAt: string };

export default function TarefasClient() {
  const [view, setView] = useState<"active" | "archived">("active");
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => (view === "archived" ? "Tarefas arquivadas" : "Tarefas"), [view]);

  async function load(nextView = view) {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/tasks?view=${encodeURIComponent(nextView)}`);
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data?.error ?? "Falha ao carregar tarefas.");
      return;
    }
    setTasks(Array.isArray(data?.tasks) ? data.tasks : []);
  }

  async function reorder(group: "OPEN" | "DONE" | "ARCHIVED", orderedIds: string[]) {
    const res = await fetch("/api/tasks/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ view, group, orderedIds }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "Falha ao reordenar.");
    }
  }

  useEffect(() => {
    load(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    return onTasksChanged(() => {
      load(view);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setView("active");
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  async function toggleDone(t: TaskItem) {
    const next = t.status === "DONE" ? "OPEN" : "DONE";
    const res = await fetch(`/api/tasks/${encodeURIComponent(t.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "Falha ao atualizar tarefa.");
      return;
    }
    await load();
    emitTasksChanged();
  }

  async function archive(t: TaskItem) {
    const res = await fetch(`/api/tasks/${encodeURIComponent(t.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "ARCHIVED" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "Falha ao arquivar tarefa.");
      return;
    }
    await load();
    emitTasksChanged();
  }

  async function unarchive(t: TaskItem) {
    // volta para Recentes como concluída (riscada)
    const res = await fetch(`/api/tasks/${encodeURIComponent(t.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "DONE" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "Falha ao desarquivar tarefa.");
      return;
    }
    await load();
    emitTasksChanged();
  }

  async function remove(t: TaskItem) {
    const ok = window.confirm("Excluir esta tarefa?");
    if (!ok) return;
    const res = await fetch(`/api/tasks/${encodeURIComponent(t.id)}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "Falha ao excluir tarefa.");
      return;
    }
    await load();
  }

  const openTasks = tasks.filter((t) => t.status === "OPEN");
  const doneTasks = tasks.filter((t) => t.status === "DONE");

  // Sortable (touch-friendly)
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const draggingGroupRef = useRef<"OPEN" | "DONE" | null>(null);
  const orderDraftRef = useRef<string[] | null>(null);
  const openRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const doneRefs = useRef<Record<string, HTMLDivElement | null>>({});

  function getListIds(group: "OPEN" | "DONE") {
    return (group === "OPEN" ? openTasks : doneTasks).map((t) => t.id);
  }

  function setOptimisticOrder(group: "OPEN" | "DONE", orderedIds: string[]) {
    const byId = new Map(tasks.map((t) => [t.id, t] as const));
    const ordered = orderedIds.map((id) => byId.get(id)).filter(Boolean) as TaskItem[];
    const other = (group === "OPEN" ? doneTasks : openTasks).filter((t) => !orderedIds.includes(t.id));
    setTasks(group === "OPEN" ? [...ordered, ...other] : [...other, ...ordered]);
  }

  function findOverId(group: "OPEN" | "DONE", clientY: number) {
    const refs = group === "OPEN" ? openRefs.current : doneRefs.current;
    const ids = getListIds(group);
    for (const id of ids) {
      const el = refs[id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      if (clientY < mid) return id;
    }
    return ids[ids.length - 1] || null;
  }

  function startDrag(e: React.PointerEvent, id: string, group: "OPEN" | "DONE") {
    // só arrasta dentro do mesmo grupo
    draggingGroupRef.current = group;
    setDraggingId(id);
    orderDraftRef.current = getListIds(group);

    try {
      (e.currentTarget as any).setPointerCapture?.(e.pointerId);
    } catch {}

    let raf = 0;
    let lastOver: string | null = null;

    function onMove(ev: PointerEvent) {
      if (!draggingGroupRef.current || !orderDraftRef.current) return;
      if (raf) return;

      raf = window.requestAnimationFrame(() => {
        raf = 0;
        if (!draggingGroupRef.current || !orderDraftRef.current) return;

        const overId = findOverId(draggingGroupRef.current, ev.clientY);
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
        setOptimisticOrder(draggingGroupRef.current, list);
      });
    }

    async function onUp() {
      const g = draggingGroupRef.current;
      const draft = orderDraftRef.current;
      setDraggingId(null);
      draggingGroupRef.current = null;
      orderDraftRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);

      if (g && draft && draft.length) {
        // manter otimista (sem reload) para não piscar
        await reorder(g, draft);
        emitTasksChanged();
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <div className="flex items-center gap-2">
          <TaskTabsInline
            leftLabel="Recentes"
            leftActive={view === "active"}
            onLeft={() => setView("active")}
            rightLabel="Arquivados"
            rightActive={view === "archived"}
            onRight={() => setView("archived")}
          />
          <Link className="rounded border px-3 py-2 text-sm" href="/referencias">
            Voltar
          </Link>
        </div>
      </div>

      {error ? <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}

      <div className="mt-4 divide-y divide-[var(--ssepa-border)]/60">
        {loading ? <div className="py-4 text-sm text-zinc-600">Carregando…</div> : null}

        {!loading && tasks.length === 0 ? <div className="py-4 text-sm text-zinc-600">Nenhuma tarefa.</div> : null}

        {!loading && view !== "archived" ? (
          <>
            {openTasks.map((t) => (
              <div
                key={t.id}
                ref={(el) => {
                  openRefs.current[t.id] = el;
                }}
                className={"py-3 " + (draggingId === t.id ? "opacity-60" : "")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="ssepa-link px-1 py-0.5 text-xs"
                        onPointerDown={(e) => startDrag(e, t.id, "OPEN")}
                        title="Arrastar"
                        style={{ touchAction: "none" }}
                      >
                        ≡
                      </button>
                      <button type="button" className="ssepa-link px-1 py-0.5 text-xs" onClick={() => toggleDone(t)} title="Concluir/desfazer">
                        ☐
                      </button>
                      <Link className="ssepa-link underline font-semibold" href={`/tarefas/${t.id}`}>
                        {t.title}
                      </Link>
                    </div>
                    <div className="mt-1 text-xs text-zinc-600">Atualizada em {new Date(t.updatedAt).toLocaleString("pt-BR")}</div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button type="button" className="ssepa-link px-1 py-1 text-xs" onClick={() => remove(t)} title="Excluir">
                      -
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {doneTasks.length ? <div className="py-2 text-xs uppercase tracking-wide text-zinc-500">Concluídas</div> : null}

            {doneTasks.map((t) => (
              <div
                key={t.id}
                ref={(el) => {
                  doneRefs.current[t.id] = el;
                }}
                className={"py-3 " + (draggingId === t.id ? "opacity-60" : "")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="ssepa-link px-1 py-0.5 text-xs"
                        onPointerDown={(e) => startDrag(e, t.id, "DONE")}
                        title="Arrastar"
                        style={{ touchAction: "none" }}
                      >
                        ≡
                      </button>
                      <button type="button" className="ssepa-link px-1 py-0.5 text-xs" onClick={() => toggleDone(t)} title="Concluir/desfazer">
                        ☑
                      </button>
                      <Link className="ssepa-link underline font-semibold line-through" href={`/tarefas/${t.id}`}>
                        {t.title}
                      </Link>
                    </div>
                    <div className="mt-1 text-xs text-zinc-600">Atualizada em {new Date(t.updatedAt).toLocaleString("pt-BR")}</div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button type="button" className="ssepa-link px-1 py-1 text-xs" onClick={() => archive(t)} title="Arquivar">
                      ⬇️
                    </button>
                    <button type="button" className="ssepa-link px-1 py-1 text-xs" onClick={() => remove(t)} title="Excluir">
                      -
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : null}

        {!loading && view === "archived" ? (
          tasks.map((t) => (
            <div key={t.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">⬇️</span>
                    <Link className="ssepa-link underline font-semibold line-through" href={`/tarefas/${t.id}`}>
                      {t.title}
                    </Link>
                  </div>
                  <div className="mt-1 text-xs text-zinc-600">Atualizada em {new Date(t.updatedAt).toLocaleString("pt-BR")}</div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" className="ssepa-link px-2 py-1 text-xs" onClick={() => unarchive(t)} title="Desarquivar">
                    ⏏️
                  </button>
                  <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => remove(t)} title="Excluir">
                    -
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : null}
      </div>
    </div>
  );
}
