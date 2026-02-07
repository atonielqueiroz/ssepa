"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type NoteColor = "AMARELO" | "VERDE" | "VERMELHO" | "BRANCO" | "AZUL";
type EntityType = "SIMULACOES_LIST" | "SIMULACAO" | "PROCESSO" | "INCIDENTES" | "EVENTOS";

type Note = { id: string; color: NoteColor; text: string; createdAt: string; updatedAt: string };

type NoteState = Note & { mode: "VIEW" | "EDIT" };

type DraftNote = {
  id: "__draft__";
  color: NoteColor;
  text: string;
  mode: "EDIT";
  createdAt: string;
  updatedAt: string;
};

function colorStyle(c: NoteColor): { background: string; border: string } {
  switch (c) {
    case "AMARELO":
      return { background: "#FFF7CC", border: "#E7D78A" };
    case "VERDE":
      return { background: "#DDF7E3", border: "#9FD4AE" };
    case "VERMELHO":
      return { background: "#FFE1E1", border: "#E9A1A1" };
    case "AZUL":
      return { background: "#DDEBFF", border: "#9FB8E9" };
    case "BRANCO":
    default:
      return { background: "#FFFFFF", border: "#E4E4E7" };
  }
}

function Floppy() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 3h12l2 2v16H5V3z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 3v6h10V3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 21v-8h10v8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 10v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 7h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function StickyNotes({
  entityType,
  entityId,
  title = "Lembretes",
}: {
  entityType: EntityType;
  entityId: string;
  title?: string;
}) {
  const [notes, setNotes] = useState<(NoteState | DraftNote)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [authorName, setAuthorName] = useState<string>("Você");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingColor, setEditingColor] = useState<NoteColor>("AMARELO");
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const editRef = useRef<HTMLTextAreaElement | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<null | { id: string; left: number; top: number; text: string }>(null);
  const [palettePos, setPalettePos] = useState<null | { left: number; top: number }>(null);
  const paletteRef = useRef<HTMLDivElement | null>(null);

  function scrollToEnd() {
    const el = rowRef.current;
    if (!el) return;
    el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
  }

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("entityType", entityType);
    p.set("entityId", entityId);
    return p.toString();
  }, [entityType, entityId]);

  async function refresh() {
    setLoading(true);
    const res = await fetch(`/api/notes?${qs}`);
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data?.error ?? "Falha ao carregar lembretes.");
      return;
    }
    setError(null);
    const items: Note[] = data?.notes ?? [];
    setNotes(items.map((n) => ({ ...n, mode: "VIEW" as const })));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/me", { method: "GET" });
      const data = await res.json().catch(() => ({}));
      const n = data?.user?.name;
      if (typeof n === "string" && n.trim()) setAuthorName(n.trim());
    })();
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest?.("[data-note-tooltip]") || t.closest?.("[data-note-info]") || t.closest?.("[data-note-palette]")) return;
      setTooltip(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  function recomputePalettePosition() {
    if (!editingId) {
      setPalettePos(null);
      return;
    }
    const row = rowRef.current;
    if (!row) return;
    const noteEl = document.querySelector(`[data-note='${editingId}']`) as HTMLElement | null;
    if (!noteEl) return;

    const rowRect = row.getBoundingClientRect();
    const noteRect = noteEl.getBoundingClientRect();
    const paletteEl = paletteRef.current;
    const paletteWidth = paletteEl ? paletteEl.getBoundingClientRect().width : 140;
    const paletteHeight = paletteEl ? paletteEl.getBoundingClientRect().height : 28;

    // center above the note
    const centerX = noteRect.left - rowRect.left + noteRect.width / 2;
    let left = centerX - paletteWidth / 2;
    left = Math.max(0, Math.min(left, rowRect.width - paletteWidth));

    let top = noteRect.top - rowRect.top - paletteHeight - 10; // offset negativo, fora do card
    top = Math.max(0, top);

    setPalettePos({ left, top });
  }

  useEffect(() => {
    // wait for DOM paint
    requestAnimationFrame(() => recomputePalettePosition());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const onScroll = () => recomputePalettePosition();
    row.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      row.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  function onPlus() {
    setError(null);
    setNotes((prev) => {
      const existing = prev.filter((n) => n.id !== "__draft__");
      if (existing.length >= 8) {
        setError("Limite de 8 lembretes nesta página.");
        return prev;
      }
      // allow only one draft at a time
      if (prev.some((n) => n.id === "__draft__")) return prev;
      const now = new Date().toISOString();
      const draft: DraftNote = {
        id: "__draft__",
        color: "AMARELO",
        text: "",
        mode: "EDIT",
        createdAt: now,
        updatedAt: now,
      };
      // append (mais antigos à esquerda; novos à direita)
      return [...prev, draft];
    });
    setEditingId("__draft__");
    setEditingColor("AMARELO");
    setTimeout(() => {
      scrollToEnd();
      draftRef.current?.focus();
    }, 0);
  }

  async function createFromDraft() {
    const draft = notes.find((n) => n.id === "__draft__") as DraftNote | undefined;
    if (!draft) return;
    if (!draft.text.trim()) {
      setError("Digite o texto do lembrete.");
      return;
    }

    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entityType, entityId, color: draft.color, text: draft.text }),
    });
    if (!res.ok) {
      setError("Falha ao criar lembrete.");
      return;
    }

    await refresh();
    setEditingId(null);
    scrollToEnd();
  }

  async function saveExisting(id: string, patch: Partial<{ text: string; color: NoteColor }>) {
    const res = await fetch("/api/notes", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    if (!res.ok) {
      setError("Falha ao salvar lembrete.");
      return;
    }
    await refresh();
    setEditingId(null);
  }

  async function remove(id: string) {
    const ok = window.confirm("Excluir este lembrete?");
    if (!ok) return;

    const res = await fetch("/api/notes", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      setError("Falha ao excluir lembrete.");
      return;
    }
    await refresh();
  }

  function fmtDateTime(iso: string) {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  }

  function ColorDots({
    value,
    onPick,
    disabled,
  }: {
    value: NoteColor;
    onPick: (c: NoteColor) => void;
    disabled?: boolean;
  }) {
    const colors: { key: NoteColor; bg: string }[] = [
      { key: "AMARELO", bg: "#FFF7CC" },
      { key: "VERDE", bg: "#DDF7E3" },
      { key: "VERMELHO", bg: "#FFE1E1" },
      { key: "BRANCO", bg: "#FFFFFF" },
      { key: "AZUL", bg: "#DDEBFF" },
    ];
    return (
      <div className="flex items-center gap-1">
        {colors.map((c) => (
          <button
            key={c.key}
            type="button"
            disabled={disabled}
            onClick={() => onPick(c.key)}
            className={
              "h-4 w-4 rounded border " +
              (value === c.key ? "ring-2 ring-zinc-400" : "") +
              (disabled ? " opacity-60" : "")
            }
            style={{ background: c.bg }}
            title={c.key}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className="py-3"
      style={{
        borderTop: "1px solid var(--ssepa-border)",
        borderBottom: "1px solid var(--ssepa-border)",
      }}
    >
      <div className="px-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span>{title}</span>
          <button
            type="button"
            className="rounded border px-2 py-0.5 text-xs"
            style={{ borderColor: "var(--ssepa-border)", background: "transparent" }}
            onClick={onPlus}
            title="Novo lembrete"
          >
            +
          </button>
        </div>
      </div>

      <div className="px-3 pt-3">
        {error ? <div className="mb-2 text-xs text-red-700">{error}</div> : null}
        {loading ? <div className="mb-2 text-xs text-zinc-600">Carregando…</div> : null}

        <div className="relative">
          {editingId && palettePos ? (
            <div
              data-note-palette
              ref={paletteRef}
              className="absolute rounded border bg-white px-2 py-1 shadow-sm"
              style={{ left: palettePos.left, top: palettePos.top, zIndex: 60 }}
            >
              <ColorDots
                value={editingColor}
                onPick={(c) => {
                  setEditingColor(c);
                  setNotes((prev) =>
                    prev.map((x) =>
                      x.id === editingId ? ({ ...(x as any), color: c, updatedAt: new Date().toISOString() } as any) : x
                    )
                  );
                  requestAnimationFrame(() => recomputePalettePosition());
                }}
              />
            </div>
          ) : null}

          <div
            ref={rowRef}
            className="flex gap-3 overflow-x-auto pb-2"
            style={{ WebkitOverflowScrolling: "touch", paddingTop: editingId ? 34 : 0 }}
          >
            {notes.map((n) => {
            const cs = colorStyle(n.color);
            const isDraft = n.id === "__draft__";
            const isEdit = (n as any).mode === "EDIT";

            const created = fmtDateTime(n.createdAt);
            const updated = fmtDateTime(n.updatedAt);
            const edited = n.updatedAt !== n.createdAt;
            const meta = edited
              ? `Atualizado em ${updated} por ${authorName}`
              : `Criado em ${created} por ${authorName}`;

            return (
              <div
                key={n.id}
                data-note={n.id}
                className="relative flex h-[160px] w-[160px] flex-col justify-between rounded border p-3"
                style={{ background: cs.background, borderColor: cs.border }}
              >
                {/* actions */}
                {!isEdit ? (
                  <>
                    <div className="absolute right-2 top-2 flex gap-1">
                      <button
                        type="button"
                        className="rounded px-2 py-1 text-xs text-zinc-700 hover:bg-black/5"
                        title="Editar"
                        onClick={() => {
                          setEditingId(n.id);
                          setEditingColor(n.color);
                          setNotes((prev) => prev.map((x) => (x.id === n.id ? ({ ...(x as any), mode: "EDIT" } as any) : x)));
                          setTimeout(() => editRef.current?.focus(), 0);
                        }}
                      >
                        🖋️
                      </button>
                      <button
                        type="button"
                        className="rounded px-2 py-1 text-xs text-zinc-700 hover:bg-black/5"
                        title="Excluir"
                        onClick={() => remove(n.id)}
                      >
                        ⛔
                      </button>
                    </div>

                    <div className="absolute bottom-2 right-2">
                      <button
                        data-note-info
                        type="button"
                        className="flex h-4 w-4 items-center justify-center text-zinc-700"
                        title="Mais info"
                        onClick={(e) => {
                          e.stopPropagation();
                          const row = rowRef.current;
                          if (!row) return;
                          const noteEl = document.querySelector(`[data-note='${n.id}']`) as HTMLElement | null;
                          const infoEl = (e.currentTarget as HTMLElement) || null;
                          if (!noteEl || !infoEl) return;

                          const rowRect = row.getBoundingClientRect();
                          const noteRect = noteEl.getBoundingClientRect();
                          const infoRect = infoEl.getBoundingClientRect();

                          const text = meta;
                          const width = Math.min(260, rowRect.width);

                          // Prefer abrir à direita do ícone
                          let left = infoRect.right - rowRect.left;
                          if (left + width > rowRect.width) {
                            left = infoRect.left - rowRect.left - width;
                          }
                          left = Math.max(0, Math.min(left, rowRect.width - width));

                          // Abaixo e fora da nota
                          const top = noteRect.bottom - rowRect.top + 6;

                          setTooltip((prev) => (prev?.id === n.id ? null : { id: n.id, left, top, text }));
                        }}
                      >
                        <InfoIcon />
                      </button>
                    </div>
                  </>
                ) : null}

                {isEdit ? (
                  <div className="grid h-full gap-2">
                    <textarea
                      ref={isDraft ? draftRef : (editingId === n.id ? editRef : undefined)}
                      className="w-full flex-1 resize-none overflow-auto bg-transparent px-1 py-1 text-sm outline-none focus:outline-none"
                      style={{ boxShadow: "none" }}
                      rows={4}
                      value={n.text}
                      placeholder="Digite…"
                      maxLength={85}
                      onChange={(e) => {
                        const next = e.target.value.slice(0, 85);
                        setNotes((prev) => prev.map((x) => (x.id === n.id ? ({ ...(x as any), text: next, updatedAt: new Date().toISOString() } as any) : x)));
                      }}
                    />

                    <div className="grid gap-2">
                      <div className="flex items-center justify-end gap-2">
                        <div className="flex items-center gap-2">
                          <button
                          type="button"
                          className="rounded px-2 py-1 text-sm text-zinc-700 hover:bg-black/5"
                          title="Salvar"
                          aria-label="Salvar"
                          onClick={async () => {
                            if (isDraft) {
                              await createFromDraft();
                              return;
                            }
                            const cur = notes.find((x) => x.id === n.id) as NoteState | undefined;
                            if (!cur) return;
                            await saveExisting(n.id, { text: cur.text, color: cur.color });
                          }}
                        >
                          💾
                        </button>
                        <button
                          type="button"
                          className="rounded px-2 py-1 text-sm text-zinc-700 hover:bg-black/5"
                          title="Cancelar"
                          aria-label="Cancelar"
                          onClick={() => {
                            setError(null);
                            setTooltip(null);
                            if (isDraft) {
                              setNotes((prev) => prev.filter((x) => x.id !== "__draft__"));
                              setEditingId(null);
                              return;
                            }
                            setNotes((prev) => prev.map((x) => (x.id === n.id ? ({ ...(x as any), mode: "VIEW" } as any) : x)));
                            setEditingId(null);
                          }}
                        >
                          ❌
                        </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex flex-1 items-center justify-center text-center font-semibold text-sm text-zinc-900"
                    style={{
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                    }}
                    onDoubleClick={() => {
                      setEditingId(n.id);
                      setEditingColor(n.color);
                      setNotes((prev) => prev.map((x) => (x.id === n.id ? ({ ...(x as any), mode: "EDIT" } as any) : x)));
                      setTimeout(() => editRef.current?.focus(), 0);
                    }}
                    title="Duplo clique para editar"
                  >
                    {n.text}
                  </div>
                )}
              </div>
            );
          })}
          </div>

          {tooltip ? (
            <div
              data-note-tooltip
              className="absolute rounded border bg-white px-2 py-1 text-[10px] text-zinc-700 shadow-sm"
              style={{
                left: tooltip.left,
                top: tooltip.top,
                whiteSpace: "nowrap",
                maxWidth: "100%",
              }}
            >
              {tooltip.text}
            </div>
          ) : null}
        </div>

        {!loading && notes.length === 0 ? <div className="mt-2 text-xs text-zinc-600">Nenhum lembrete.</div> : null}
      </div>
    </div>
  );
}
