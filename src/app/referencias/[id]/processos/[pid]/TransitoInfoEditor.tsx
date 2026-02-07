"use client";

import { useEffect, useState } from "react";
import { NotesField } from "@/app/components/NotesField";
import { FieldNote, ProcessoNotes, parseProcessNotes } from "@/lib/processNotes";

type Form = {
  transitAtProcesso: string;
  transitAtAcusacao: string;
  transitAtDefesa: string;
  notasProc: string;
  notasProcDestacar: boolean;
  notasAcus: string;
  notasAcusDestacar: boolean;
  notasDef: string;
  notasDefDestacar: boolean;
};

type EditKey = "PROC" | "ACUS" | "DEF" | null;

function normalizeDateInput(v: string) {
  const s = (v || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^\s*(\d{2})\/(\d{2})\/(\d{4})\s*$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s;
}

function fmt(d: string) {
  if (!d) return "—";
  const s = d.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  const [y, m, day] = s.split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

function TransitoItem({
  label,
  dateValue,
  notasValue,
  notasDestacar,
  onEdit,
  isEditing,
  onChangeDate,
  onChangeNotas,
  onToggleDestacar,
  onSave,
  onCancel,
  saving,
}: {
  label: string;
  dateValue: string;
  notasValue: string;
  notasDestacar: boolean;
  onEdit: () => void;
  isEditing: boolean;
  onChangeDate: (v: string) => void;
  onChangeNotas: (v: string) => void;
  onToggleDestacar: (v: boolean) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const editLinkClass = "bg-transparent p-0 text-sm text-zinc-700 hover:underline";
  const actionLinkClass = "bg-transparent p-0 text-sm text-zinc-700 hover:underline disabled:opacity-50";

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-zinc-700">{label}</div>
        <button type="button" className={editLinkClass} onClick={onEdit}>
          Editar
        </button>
      </div>

      {isEditing ? (
        <div className="mt-2">
          <input
            className="w-full rounded border px-3 py-2"
            type="date"
            value={dateValue}
            onChange={(e) => onChangeDate(e.target.value)}
          />
          <div className="mt-2">
            <NotesField
              label="Notas"
              value={notasValue}
              onChange={onChangeNotas}
              placeholder="Notas nos autos (mov/seq/pág.)"
              destacar={notasDestacar}
              onToggleDestacar={onToggleDestacar}
              minRows={2}
            />
          </div>

          <div className="mt-2 flex gap-3">
            <button type="button" className={actionLinkClass} onClick={onSave} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" className={actionLinkClass} onClick={onCancel} disabled={saving}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 text-sm text-zinc-900">
          {fmt(dateValue)}
          {notasValue ? (
            <div className={"mt-1 text-xs " + (notasDestacar ? "text-red-700" : "text-zinc-600")}>
              Nota: {notasValue}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function TransitoInfoEditor({ processoId }: { processoId: string }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<EditKey>(null);

  const [f, setF] = useState<Form>({
    transitAtProcesso: "",
    transitAtAcusacao: "",
    transitAtDefesa: "",
    notasProc: "",
    notasProcDestacar: false,
    notasAcus: "",
    notasAcusDestacar: false,
    notasDef: "",
    notasDefDestacar: false,
  });
  useEffect(() => {
    setLoading(true);
    (async () => {
      const res = await fetch(`/api/processos/${processoId}`);
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) {
        setError(data?.error ?? "Falha ao carregar trânsito em julgado.");
        return;
      }
      const p = data.processo;
      const ms = p.marcosSource ?? {};
      const getText = (v: any) => (typeof v === "string" ? v : v?.text ?? "");
      const getDest = (k: string) => !!ms[`${k}_destacar`];

      setF({
        transitAtProcesso: p.transitAtProcesso ?? "",
        transitAtAcusacao: p.transitAtAcusacao ?? "",
        transitAtDefesa: p.transitAtDefesa ?? "",
        notasProc: getText(ms.transitAtProcesso),
        notasProcDestacar: getDest("transitAtProcesso"),
        notasAcus: getText(ms.transitAtAcusacao),
        notasAcusDestacar: getDest("transitAtAcusacao"),
        notasDef: getText(ms.transitAtDefesa),
        notasDefDestacar: getDest("transitAtDefesa"),
      });
    })();
  }, [processoId]);

  async function save() {
    setError(null);
    setSaving(true);

    const res = await fetch(`/api/processos/${processoId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transitAtProcesso: normalizeDateInput(f.transitAtProcesso) || null,
        transitAtAcusacao: normalizeDateInput(f.transitAtAcusacao) || null,
        transitAtDefesa: normalizeDateInput(f.transitAtDefesa) || null,
        fonte_transitAtProcesso: f.notasProc,
        fonte_transitAtProcesso_destacar: f.notasProcDestacar,
        fonte_transitAtAcusacao: f.notasAcus,
        fonte_transitAtAcusacao_destacar: f.notasAcusDestacar,
        fonte_transitAtDefesa: f.notasDef,
        fonte_transitAtDefesa_destacar: f.notasDefDestacar,
      }),
    });

    const data = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setError(data?.error ?? "Falha ao salvar trânsito em julgado.");
      return;
    }

    setEditKey(null);
    window.location.reload();
  }

  return (
    <div>
      {loading ? <div className="text-sm text-zinc-600">Carregando…</div> : null}

      <div className="mt-2 grid gap-6 md:grid-cols-3">
        <TransitoItem
          label="Trânsito (processo)"
          dateValue={f.transitAtProcesso}
          notasValue={f.notasProc}
          notasDestacar={f.notasProcDestacar}
          onEdit={() => setEditKey("PROC")}
          isEditing={editKey === "PROC"}
          onChangeDate={(v) => setF((prev) => ({ ...prev, transitAtProcesso: v }))}
          onChangeNotas={(v) => setF((prev) => ({ ...prev, notasProc: v }))}
          onToggleDestacar={(v) => setF((prev) => ({ ...prev, notasProcDestacar: v }))}
          onSave={save}
          onCancel={() => setEditKey(null)}
          saving={saving}
        />
        <TransitoItem
          label="Trânsito (acusação/MP)"
          dateValue={f.transitAtAcusacao}
          notasValue={f.notasAcus}
          notasDestacar={f.notasAcusDestacar}
          onEdit={() => setEditKey("ACUS")}
          isEditing={editKey === "ACUS"}
          onChangeDate={(v) => setF((prev) => ({ ...prev, transitAtAcusacao: v }))}
          onChangeNotas={(v) => setF((prev) => ({ ...prev, notasAcus: v }))}
          onToggleDestacar={(v) => setF((prev) => ({ ...prev, notasAcusDestacar: v }))}
          onSave={save}
          onCancel={() => setEditKey(null)}
          saving={saving}
        />
        <TransitoItem
          label="Trânsito (defesa)"
          dateValue={f.transitAtDefesa}
          notasValue={f.notasDef}
          notasDestacar={f.notasDefDestacar}
          onEdit={() => setEditKey("DEF")}
          isEditing={editKey === "DEF"}
          onChangeDate={(v) => setF((prev) => ({ ...prev, transitAtDefesa: v }))}
          onChangeNotas={(v) => setF((prev) => ({ ...prev, notasDef: v }))}
          onToggleDestacar={(v) => setF((prev) => ({ ...prev, notasDefDestacar: v }))}
          onSave={save}
          onCancel={() => setEditKey(null)}
          saving={saving}
        />
      </div>

      {error ? <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}
    </div>
  );
}
