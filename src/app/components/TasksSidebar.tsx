"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { TaskTabsInline } from "@/app/components/TaskTabsInline";
import { emitTasksChanged, onTasksChanged } from "@/app/components/tasksEvents";

type TaskItem = { id: string; title: string; status: "OPEN" | "DONE" | "ARCHIVED"; updatedAt: string };

export function TasksSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem("ssepa.sidebar.collapsed");
      setCollapsed(v === "1");
    } catch {}
  }, []);

  const [showArchived, setShowArchived] = useState(false);

  // Sortable (touch-friendly) in sidebar
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStatusRef = useRef<"OPEN" | "DONE" | "ARCHIVED" | null>(null);
  const orderDraftRef = useRef<string[] | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  async function load(nextShowArchived = showArchived) {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/tasks?view=${nextShowArchived ? "archived" : "active"}`);
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data?.error ?? "Falha ao carregar tarefas.");
      return;
    }

    setTasks(Array.isArray(data?.tasks) ? data.tasks : []);
  }

  useEffect(() => {
    load(showArchived);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  useEffect(() => {
    return onTasksChanged(() => {
      load(showArchived);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  async function create() {
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle("");

    if (showArchived) setShowArchived(false);

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "Falha ao criar tarefa.");
      return;
    }

    await load(false);
    emitTasksChanged();
  }

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
      setError(data?.error ?? "Falha ao arquivar.");
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
      setError(data?.error ?? "Falha ao desarquivar.");
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
      setError(data?.error ?? "Falha ao excluir.");
      return;
    }
    await load();
  }

  async function reorder(group: "OPEN" | "DONE" | "ARCHIVED", orderedIds: string[]) {
    const res = await fetch("/api/tasks/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ view: showArchived ? "archived" : "active", group, orderedIds }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "Falha ao reordenar.");
    }
  }

  function findOverId(ids: string[], clientY: number) {
    for (const id of ids) {
      const el = itemRefs.current[id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      if (clientY < mid) return id;
    }
    return ids.length ? ids[ids.length - 1] : null;
  }

  function startDrag(e: React.PointerEvent, id: string, status: "OPEN" | "DONE" | "ARCHIVED") {
    dragStatusRef.current = status;
    setDraggingId(id);

    // ids dentro do mesmo status, respeitando a aba
    const same = tasks.filter((t) => t.status === status).slice(0, 12).map((t) => t.id);
    orderDraftRef.current = same;

    try {
      (e.currentTarget as any).setPointerCapture?.(e.pointerId);
    } catch {}

    let raf = 0;
    let lastOver: string | null = null;

    function onMove(ev: PointerEvent) {
      if (!orderDraftRef.current || !dragStatusRef.current) return;
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        if (!orderDraftRef.current || !dragStatusRef.current) return;

        const overId = findOverId(orderDraftRef.current, ev.clientY);
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

        // otimista (apenas dentro do status)
        const byId = new Map(tasks.map((t) => [t.id, t] as const));
        const ordered = list.map((x) => byId.get(x)).filter(Boolean) as TaskItem[];
        const rest = tasks.filter((t) => t.status !== status);
        setTasks([...ordered, ...rest]);
      });
    }

    async function onUp() {
      const st = dragStatusRef.current;
      const draft = orderDraftRef.current;
      setDraggingId(null);
      dragStatusRef.current = null;
      orderDraftRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);

      if (st && draft && draft.length) {
        await reorder(st, draft);
        emitTasksChanged();
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  }

  return (
    <aside className={"ssepa-sidebar" + (collapsed ? " is-collapsed" : "") }>
      <div className="ssepa-sidebar-inner">
        {collapsed ? (
          <button
            type="button"
            className="ssepa-sidebar-tab"
            onClick={() => {
              setCollapsed(false);
              try {
                window.localStorage.setItem("ssepa.sidebar.collapsed", "0");
              } catch {}
            }}
            title="Expandir"
            aria-label="Expandir tarefas"
          >
            <span className="ssepa-sidebar-tab-lines" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        ) : null}

        {!collapsed ? (
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold" title="Tarefas">Tarefas</div>
            <div className="flex items-center gap-2">
              {/* Atualizar removido */}
              <button
                type="button"
                className="ssepa-link px-2 py-1 text-xs"
                onClick={() => {
                  const next = !collapsed;
                  setCollapsed(next);
                  try {
                    window.localStorage.setItem("ssepa.sidebar.collapsed", next ? "1" : "0");
                  } catch {}
                }}
                title={collapsed ? "Expandir" : "Recolher"}
              >
                ➖
              </button>
            </div>
          </div>
        ) : null}

        <div className="ssepa-sidebar-body">
          {error ? <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div> : null}

          <div className="mt-3">
            <div className="mt-1 flex gap-2">
              <input
                className="w-full rounded border px-2 py-2 text-sm"
                placeholder="Digite e Enter…"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") create();
                }}
              />
              <button type="button" className="rounded border px-3 py-2 text-sm" onClick={create}>
                +
              </button>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <TaskTabsInline
                leftLabel="Recentes"
                leftActive={!showArchived}
                onLeft={() => setShowArchived(false)}
                rightLabel="Arquivados"
                rightActive={showArchived}
                onRight={() => setShowArchived(true)}
              />
              <Link className="text-xs underline" href="/tarefas">
                Ver todas
              </Link>
            </div>

            {loading ? <div className="mt-2 text-xs text-zinc-600">Carregando…</div> : null}

            <div className="mt-2 space-y-1">
              {tasks.length === 0 && !loading ? <div className="text-xs text-zinc-600">Sem tarefas.</div> : null}
              {tasks.slice(0, 12).map((t) => (
                <div
                  key={t.id}
                  ref={(el) => {
                    itemRefs.current[t.id] = el;
                  }}
                  className={"flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-zinc-50 " + (draggingId === t.id ? "opacity-60" : "")}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      className="ssepa-link px-1 py-0.5 text-xs"
                      onPointerDown={(e) => startDrag(e, t.id, t.status)}
                      title="Arrastar"
                      style={{ touchAction: "none" }}
                    >
                      ≡
                    </button>

                    {!showArchived ? (
                      <button type="button" className="ssepa-link px-1 py-0.5 text-xs" onClick={() => toggleDone(t)} title="Concluir/desfazer">
                        {t.status === "DONE" ? "☑" : "☐"}
                      </button>
                    ) : (
                      <button type="button" className="ssepa-link px-2 py-0.5 text-xs" onClick={() => unarchive(t)} title="Desarquivar">
                        ⏏️
                      </button>
                    )}

                    <Link className="min-w-0 truncate text-xs" href={`/tarefas/${t.id}`} title={t.title}>
                      <span className={showArchived ? "line-through text-zinc-500" : (t.status === "DONE" ? "line-through text-zinc-500" : "text-zinc-900")}>{t.title}</span>
                    </Link>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {!showArchived && t.status === "DONE" ? (
                      <button type="button" className="ssepa-link px-1 py-0.5 text-xs" onClick={() => archive(t)} title="Arquivar">
                        ⬇️
                      </button>
                    ) : null}
                    <button type="button" className="ssepa-link px-1 py-0.5 text-xs" onClick={() => remove(t)} title="Excluir">
                      -
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
