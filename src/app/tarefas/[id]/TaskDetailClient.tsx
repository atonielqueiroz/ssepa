"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Task = { id: string; title: string; summary: string | null; status: "OPEN" | "DONE" | "ARCHIVED" };
type Note = {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; email: string };
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function formatRich(text: string) {
  // **negrito**, *itálico*, __sublinhado__
  let s = escapeHtml(text);
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__(.+?)__/g, "<u>$1</u>");
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
  s = s.replace(/\n/g, "<br/>");
  return s;
}

export default function TaskDetailClient({ id }: { id: string }) {
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<Task | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState("");
  const [editingSummary, setEditingSummary] = useState(false);

  const [composer, setComposer] = useState("");
  const [sending, setSending] = useState(false);

  // viewMode removido (só anotações)

  const listRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  async function load() {
    setError(null);
    setLoading(true);
    const r1 = await fetch(`/api/tasks/${encodeURIComponent(id)}`);
    const d1 = await r1.json().catch(() => ({}));
    const r2 = await fetch(`/api/tasks/${encodeURIComponent(id)}/notes`);
    const d2 = await r2.json().catch(() => ({}));
    setLoading(false);

    if (!r1.ok) {
      setError(d1?.error ?? "Falha ao carregar tarefa.");
      return;
    }
    if (!r2.ok) {
      setError(d2?.error ?? "Falha ao carregar anotações.");
      return;
    }

    setTask(d1.task);
    setSummary(d1.task?.summary ?? "");
    setNotes(Array.isArray(d2.notes) ? d2.notes : []);

    setTimeout(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const headerTitle = useMemo(() => {
    if (!task) return "Tarefa";
    return `${task.status === "DONE" ? "☑" : "☐"} ${task.title}`;
  }, [task]);

  async function saveSummary() {
    if (!task) return;
    setError(null);
    const res = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ summary: summary.trim() ? summary : null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "Falha ao salvar descrição.");
      return;
    }
    setTask((t) => (t ? { ...t, summary: summary.trim() ? summary : null } : t));
    setEditingSummary(false);
  }

  async function toggleDone() {
    if (!task) return;
    const next = task.status === "DONE" ? "OPEN" : "DONE";
    const res = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "Falha ao atualizar status.");
      return;
    }
    setTask((t) => (t ? { ...t, status: next as any } : t));
  }

  async function archive() {
    if (!task) return;
    const res = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "ARCHIVED" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "Falha ao arquivar.");
      return;
    }
    setTask((t) => (t ? { ...t, status: "ARCHIVED" } : t));
  }

  function wrapSelection(prefix: string, suffix: string) {
    const el = composerRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = composer.slice(0, start);
    const sel = composer.slice(start, end);
    const after = composer.slice(end);
    const next = before + prefix + sel + suffix + after;
    setComposer(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + prefix.length + sel.length + suffix.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function sendNote() {
    const text = composer.trim();
    if (!text) return;
    setSending(true);
    setError(null);

    const res = await fetch(`/api/tasks/${encodeURIComponent(id)}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: composer }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);

    if (!res.ok) {
      setError(data?.error ?? "Falha ao enviar anotação.");
      return;
    }

    setComposer("");
    await load();
  }

  async function editNote(noteId: string) {
    const curr = notes.find((n) => n.id === noteId);
    if (!curr) return;

    const next = window.prompt("Editar anotação:", curr.text);
    if (next === null) return;

    const res = await fetch(`/api/tasks/${encodeURIComponent(id)}/notes/${encodeURIComponent(noteId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: next }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "Falha ao editar anotação.");
      return;
    }
    await load();
  }

  async function deleteNote(noteId: string) {
    const ok = window.confirm("Excluir esta anotação?");
    if (!ok) return;

    const res = await fetch(`/api/tasks/${encodeURIComponent(id)}/notes/${encodeURIComponent(noteId)}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "Falha ao excluir anotação.");
      return;
    }
    await load();
  }

  if (loading) return <div className="text-sm text-zinc-600">Carregando…</div>;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500">Tarefa</div>
          <div className="text-2xl font-semibold">{headerTitle}</div>
        </div>
        <div className="flex items-center gap-2">
          {task?.status === "DONE" ? (
            <button type="button" className="rounded border px-3 py-2 text-sm" onClick={archive} title="Arquivar">
              📥
            </button>
          ) : null}
          <button type="button" className="rounded border px-3 py-2 text-sm" onClick={toggleDone}>
            {task?.status === "DONE" ? "Marcar como aberta" : "Concluir"}
          </button>
          <Link className="rounded border px-3 py-2 text-sm" href="/tarefas">
            Voltar
          </Link>
        </div>
      </div>

      {error ? <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}

      <div className="mt-4 divide-y divide-[var(--ssepa-border)]/60">
        <div className="py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-zinc-700">Descrição</div>
            {!editingSummary ? (
              <button type="button" className="rounded border px-3 py-2 text-xs" onClick={() => setEditingSummary(true)}>
                Editar
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button type="button" className="rounded border px-3 py-2 text-xs" onClick={() => setEditingSummary(false)}>
                  Cancelar
                </button>
                <button type="button" className="ssepa-btn rounded px-3 py-2 text-xs" onClick={saveSummary}>
                  Salvar
                </button>
              </div>
            )}
          </div>

          {!editingSummary ? (
            <div className="mt-2 whitespace-pre-wrap text-sm text-zinc-900">{task?.summary ? task.summary : <span className="text-zinc-500">(sem descrição)</span>}</div>
          ) : (
            <textarea className="mt-2 w-full rounded border p-2 text-sm" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
          )}
        </div>

        <div className="py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-zinc-700">Anotações</div>
          </div>

          <div ref={listRef} className="mt-3 max-h-[55vh] space-y-3 overflow-auto p-1">
            {notes.length === 0 ? <div className="text-sm text-zinc-600">Nenhuma anotação ainda.</div> : null}
            {notes.map((n) => (
              <div key={n.id} className="py-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-zinc-600">
                      <span className="font-medium text-zinc-800">{n.user.name}</span>
                      <span className="ml-2">{new Date(n.createdAt).toLocaleString("pt-BR")}</span>
                      {n.updatedAt !== n.createdAt ? <span className="ml-2">(editada)</span> : null}
                    </div>
                    <div className="mt-2 text-sm text-zinc-900" dangerouslySetInnerHTML={{ __html: formatRich(n.text) }} />
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => editNote(n.id)} title="Editar">
                      Editar
                    </button>
                    <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => deleteNote(n.id)} title="Excluir">
                      -
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Atividade removida */}
          </div>

          <div className="mt-3">
            <div className="text-xs text-zinc-600">Escrever anotação…</div>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <button type="button" className="rounded border px-2 py-1" onClick={() => wrapSelection("**", "**")} title="Negrito">
                B
              </button>
              <button type="button" className="rounded border px-2 py-1 italic" onClick={() => wrapSelection("*", "*")} title="Itálico">
                I
              </button>
              <button type="button" className="rounded border px-2 py-1" onClick={() => wrapSelection("__", "__")} title="Sublinhado">
                U
              </button>
            </div>
            <textarea
              ref={composerRef}
              className="mt-2 w-full rounded border p-2 text-sm"
              rows={3}
              placeholder="Digite sua anotação"
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!sending) sendNote();
                }
              }}
            />
            <div className="mt-2 flex items-center justify-end">
              <button type="button" className="ssepa-btn rounded px-4 py-2 text-sm" onClick={sendNote} disabled={sending}>
                {sending ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
