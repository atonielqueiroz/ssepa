"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
// layout.tsx já aplica AppShell

type EventoType =
  | "PRISAO_FLAGRANTE"
  | "PRISAO_PREVENTIVA"
  | "PRISAO_TEMPORARIA"
  | "PRISAO_TJ_INICIO_CUMPRIMENTO"
  | "SOLTURA_ALVARA"
  | "LIBERDADE_SEM_CAUTELAR"
  | "LIBERDADE_COM_CAUTELAR"
  | "LIBERDADE_PROVISORIA"
  | "CAUTELAR_INICIO"
  | "CAUTELAR_FIM"
  | "FUGA"
  | "RECAPTURA"
  | "OUTRO";

type CautelarType =
  | "COMPARECIMENTO_PERIODICO"
  | "PROIBICAO_LUGARES"
  | "PROIBICAO_CONTATO"
  | "PROIBICAO_AUSENTAR_COMARCA"
  | "RECOLHIMENTO_NOTURNO"
  | "SUSPENSAO_FUNCAO"
  | "INTERNACAO_PROVISORIA"
  | "FIANCA"
  | "MONITORACAO_ELETRONICA"
  | "OUTRA";

const TYPE_LABEL: Record<EventoType, string> = {
  PRISAO_FLAGRANTE: "Prisão em flagrante",
  PRISAO_PREVENTIVA: "Prisão preventiva",
  PRISAO_TEMPORARIA: "Prisão temporária",
  PRISAO_TJ_INICIO_CUMPRIMENTO: "Prisão por trânsito em julgado / início do cumprimento",
  SOLTURA_ALVARA: "Soltura (alvará)",
  LIBERDADE_SEM_CAUTELAR: "Liberdade/relaxamento/revogação — sem cautelar",
  LIBERDADE_COM_CAUTELAR: "Liberdade/relaxamento/revogação — com cautelar",
  LIBERDADE_PROVISORIA: "Liberdade provisória (legado)",
  CAUTELAR_INICIO: "Início de medida cautelar",
  CAUTELAR_FIM: "Término/revogação de cautelar",
  FUGA: "Fuga/evasão",
  RECAPTURA: "Recaptura",
  OUTRO: "Outro",
};

const CAUTELAR_LABEL: Record<CautelarType, string> = {
  COMPARECIMENTO_PERIODICO: "Comparecimento periódico em juízo",
  PROIBICAO_LUGARES: "Proibição de acesso/frequência a lugares",
  PROIBICAO_CONTATO: "Proibição de contato com pessoa determinada",
  PROIBICAO_AUSENTAR_COMARCA: "Proibição de ausentar-se da comarca",
  RECOLHIMENTO_NOTURNO: "Recolhimento domiciliar noturno e nos dias de folga",
  SUSPENSAO_FUNCAO: "Suspensão do exercício de função",
  INTERNACAO_PROVISORIA: "Internação provisória",
  FIANCA: "Fiança",
  MONITORACAO_ELETRONICA: "Monitoração eletrônica",
  OUTRA: "Outra (descrever)",
};

type Evento = {
  id: string;
  type: EventoType;
  eventDate: string; // YYYY-MM-DD
  motivo: string;
  sourceText: string;
  cautelarTypes?: string[];
  cautelarOtherText?: string;
  cautelarStart?: string | null;
  cautelarEnd?: string | null;
  noDetraction?: boolean;
};

export default function ProcessoEventosPage() {
  const router = useRouter();
  const params = useParams<{ id: string; pid: string }>();
  const referenceId = params.id;
  const processoId = params.pid;

  const [items, setItems] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<EventoType>("PRISAO_FLAGRANTE");
  const [eventDate, setEventDate] = useState("");
  const [motivo, setMotivo] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [noDetraction, setNoDetraction] = useState(false);

  const [cautelarStart, setCautelarStart] = useState<string>("");
  const [cautelarEnd, setCautelarEnd] = useState<string>("");
  const [cautelarTypes, setCautelarTypes] = useState<CautelarType[]>([]);
  const [cautelarOtherText, setCautelarOtherText] = useState("");

  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/processos/${processoId}/eventos`);
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data?.error ?? "Falha ao carregar eventos.");
      return;
    }
    setItems(data.eventos ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processoId]);

  const last = useMemo(() => (items.length ? items[items.length - 1] : null), [items]);
  const needsFollowUp = useMemo(() => {
    if (!last) return false;
    return (
      last.type === "SOLTURA_ALVARA" ||
      last.type === "LIBERDADE_PROVISORIA" ||
      last.type === "LIBERDADE_SEM_CAUTELAR" ||
      last.type === "LIBERDADE_COM_CAUTELAR" ||
      last.type === "CAUTELAR_FIM"
    );
  }, [last]);

  const followUpMode = useMemo<"CAUTELAR_REVOGACAO" | "NOVA_PRISAO" | null>(() => {
    if (!last) return null;
    if (last.type === "LIBERDADE_COM_CAUTELAR") return "CAUTELAR_REVOGACAO";
    // Em solturas/liberdade sem cautelar, a checagem é se houve nova prisão depois.
    if (last.type === "SOLTURA_ALVARA" || last.type === "LIBERDADE_SEM_CAUTELAR" || last.type === "LIBERDADE_PROVISORIA" || last.type === "CAUTELAR_FIM") {
      return "NOVA_PRISAO";
    }
    return null;
  }, [last]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      type,
      eventDate,
      motivo,
      sourceText,
      noDetraction,
      cautelarTypes,
      cautelarOtherText,
      cautelarStart: cautelarStart || null,
      cautelarEnd: cautelarEnd || null,
    };

    const url = editingId ? `/api/processos/${processoId}/eventos/${editingId}` : `/api/processos/${processoId}/eventos`;
    const method = editingId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setError(data?.error ?? "Falha ao salvar evento.");
      return;
    }

    await onCancelEdit();
    await load();
  }

  const [editingId, setEditingId] = useState<string | null>(null);

  async function onStartEdit(it: Evento) {
    setEditingId(it.id);
    setType(it.type);
    setEventDate(it.eventDate);
    setMotivo(it.motivo ?? "");
    setSourceText(it.sourceText ?? "");
    setNoDetraction(!!it.noDetraction);
    setCautelarTypes(((it.cautelarTypes ?? []) as any) as CautelarType[]);
    setCautelarOtherText(it.cautelarOtherText ?? "");
    // scroll to form
    setTimeout(() => (document.getElementById("eventDate") as HTMLInputElement | null)?.focus(), 50);
  }

  async function onCancelEdit() {
    setEditingId(null);
    setType("PRISAO_FLAGRANTE");
    setEventDate("");
    setMotivo("");
    setSourceText("");
    setNoDetraction(false);
    setCautelarTypes([]);
    setCautelarOtherText("");
  }

  async function onDelete(id: string) {
    if (!confirm("Excluir este evento?")) return;
    const res = await fetch(`/api/processos/${processoId}/eventos/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data?.error ?? "Falha ao excluir.");
      return;
    }
    if (editingId === id) await onCancelEdit();
    await load();
  }

  return (
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Eventos do processo</h1>
            <div className="mt-1 text-sm ssepa-muted">
              Prisões, solturas, cautelares, fuga/recaptura etc. Esses dados alimentam o relatório e a análise de interrupções.
            </div>
          </div>
          <div className="flex gap-2">
            <button className="rounded border px-3 py-2 text-sm" onClick={() => router.push(`/referencias/${referenceId}/processos/${processoId}`)}>
              Voltar
            </button>
          </div>
        </div>

      {needsFollowUp ? (
        <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="font-medium">Checagem rápida</div>

          {followUpMode === "CAUTELAR_REVOGACAO" ? (
            <>
              <div className="mt-1">
                O último evento foi <span className="font-medium">{TYPE_LABEL[last!.type]}</span>. Houve <span className="font-medium">revogação da medida cautelar</span> depois?
              </div>
              <div className="mt-1 text-xs text-amber-900/90">
                Observação: na prática, isso costuma ocorrer na <span className="font-medium">sentença</span> quando é concedido o <span className="font-medium">direito de recorrer em liberdade</span>.
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded border bg-white px-3 py-1.5 text-sm"
                  onClick={() => {
                    setType("CAUTELAR_FIM");
                    setEventDate("");
                    (document.getElementById("eventDate") as HTMLInputElement | null)?.focus();
                  }}
                >
                  Sim — registrar revogação (CAUTELAR_FIM)
                </button>
                <button
                  type="button"
                  className="rounded border bg-white px-3 py-1.5 text-sm"
                  onClick={() => alert("Ok — se houver revogação depois, registre o evento CAUTELAR_FIM para fechar o período.")}
                >
                  Não
                </button>
                <button
                  type="button"
                  className="rounded border bg-white px-3 py-1.5 text-sm"
                  onClick={() => alert("Sem problemas — você pode continuar e preencher depois. O relatório ficará com aviso de incompletude.")}
                >
                  Não sei
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mt-1">
                O último evento foi <span className="font-medium">{TYPE_LABEL[last!.type]}</span>. Após essa data, houve <span className="font-medium">nova prisão</span> no mesmo processo?
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded border bg-white px-3 py-1.5 text-sm"
                  onClick={() => {
                    setType("PRISAO_PREVENTIVA");
                    setEventDate("");
                    (document.getElementById("eventDate") as HTMLInputElement | null)?.focus();
                  }}
                >
                  Sim — adicionar prisão
                </button>
                <button
                  type="button"
                  className="rounded border bg-white px-3 py-1.5 text-sm"
                  onClick={() => {
                    setType("PRISAO_TJ_INICIO_CUMPRIMENTO");
                    setEventDate("");
                    (document.getElementById("eventDate") as HTMLInputElement | null)?.focus();
                  }}
                >
                  Sim — prisão por trânsito em julgado
                </button>
                <button
                  type="button"
                  className="rounded border bg-white px-3 py-1.5 text-sm"
                  onClick={() => alert("Ok — se surgir nova prisão depois, adicione aqui para manter o relatório correto.")}
                >
                  Não
                </button>
                <button
                  type="button"
                  className="rounded border bg-white px-3 py-1.5 text-sm"
                  onClick={() => alert("Sem problemas — você pode continuar e preencher depois. O relatório ficará com aviso de incompletude.")}
                >
                  Não sei
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded border">
          <div className="border-b bg-zinc-50 p-3 font-medium">{editingId ? "Editar evento" : "Adicionar evento"}</div>
          <form className="p-3 space-y-3" onSubmit={onAdd}>
            <div>
              <label className="text-sm font-medium">Tipo *</label>
              <select
                className="mt-1 w-full rounded border bg-white px-3 py-2"
                value={type}
                onChange={(e) => {
                  const v = e.target.value as EventoType;
                  setType(v);
                  // defaults
                  if (v === "LIBERDADE_COM_CAUTELAR") {
                    setNoDetraction(false);
                    setCautelarStart(eventDate);
                  }
                }}
              >
                {Object.keys(TYPE_LABEL).map((k) => (
                  <option key={k} value={k}>
                    {TYPE_LABEL[k as EventoType]}
                  </option>
                ))}
              </select>
              {(type === "LIBERDADE_COM_CAUTELAR" || type === "CAUTELAR_INICIO" || type === "CAUTELAR_FIM") ? null : (
                <div className="mt-1 text-xs text-zinc-600">A opção de “Não contar/detrair” aparece apenas quando houver medida cautelar.</div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Data *</label>
              <input
                id="eventDate"
                className="mt-1 w-full rounded border px-3 py-2"
                type="date"
                value={eventDate}
                onChange={(e) => {
                  setEventDate(e.target.value);
                  // se for liberdade com cautelar, a data costuma ser o início da cautelar
                  if (type === "LIBERDADE_COM_CAUTELAR" && !cautelarStart) setCautelarStart(e.target.value);
                }}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium">Motivo / detalhes</label>
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: prisão preventiva decretada; liberdade provisória; revogação; cautelar monitoramento…"
              />
            </div>

            {(type === "LIBERDADE_COM_CAUTELAR" || type === "CAUTELAR_INICIO" || type === "CAUTELAR_FIM") ? (
              <div className="rounded border bg-white p-3">
                <div className="font-medium">Medidas cautelares</div>
                <div className="mt-1 text-xs text-zinc-600">
                  Sugestão: computar para detração. Há divergência: alguns juízes reconhecem apenas medidas mais restritivas, outros admitem até comparecimento periódico.
                </div>

                <div className="mt-3 grid gap-2">
                  <div className="text-xs font-medium">Quais foram aplicadas?</div>
                  <div className="grid gap-1">
                    {(Object.keys(CAUTELAR_LABEL) as CautelarType[]).map((ct) => (
                      <label key={ct} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={cautelarTypes.includes(ct)}
                          onChange={(e) => {
                            if (e.target.checked) setCautelarTypes([...cautelarTypes, ct]);
                            else setCautelarTypes(cautelarTypes.filter((x) => x !== ct));
                          }}
                        />
                        <span>{CAUTELAR_LABEL[ct]}</span>
                      </label>
                    ))}
                  </div>

                  {cautelarTypes.includes("OUTRA") ? (
                    <div>
                      <label className="text-sm font-medium">Descreva a(s) outra(s)</label>
                      <input className="mt-1 w-full rounded border px-3 py-2" value={cautelarOtherText} onChange={(e) => setCautelarOtherText(e.target.value)} />
                    </div>
                  ) : null}

                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">Início da cautelar</label>
                      <input className="mt-1 w-full rounded border px-3 py-2" type="date" value={cautelarStart} onChange={(e) => setCautelarStart(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Fim/revogação</label>
                      <input className="mt-1 w-full rounded border px-3 py-2" type="date" value={cautelarEnd} onChange={(e) => setCautelarEnd(e.target.value)} />
                    </div>
                  </div>

                  <label className="mt-2 flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={noDetraction} onChange={(e) => setNoDetraction(e.target.checked)} />
                    <span>
                      <span className="font-medium">Não contar/detrair</span>
                      <div className="text-xs text-zinc-600">Marque se você não quiser computar este período como detração.</div>
                    </span>
                  </label>
                </div>
              </div>
            ) : null}

            <div>
              <label className="text-sm font-medium">Fonte nos autos</label>
              <textarea className="mt-1 w-full rounded border px-3 py-2" rows={3} value={sourceText} onChange={(e) => setSourceText(e.target.value)} placeholder="Mov/seq/evento, arquivo, páginas…" />
            </div>

            {error ? <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}

            <div className="flex flex-wrap gap-2">
              <button className="ssepa-btn rounded px-3 py-2 text-sm disabled:opacity-50" disabled={saving} type="submit">
                {saving ? "Salvando…" : editingId ? "Salvar alterações" : "Adicionar"}
              </button>
              {editingId ? (
                <button type="button" className="rounded border px-3 py-2 text-sm" onClick={onCancelEdit}>
                  Cancelar edição
                </button>
              ) : null}
            </div>
          </form>
        </div>

        <div className="rounded border">
          <div className="border-b bg-zinc-50 p-3 font-medium">Eventos cadastrados</div>
          <div className="p-3 text-sm">
            {loading ? (
              <div className="text-zinc-600">Carregando…</div>
            ) : items.length === 0 ? (
              <div className="text-zinc-600">Nenhum evento cadastrado.</div>
            ) : (
              <div className="overflow-hidden rounded border">
                <table className="w-full text-sm">
                  <thead className="bg-white text-left">
                    <tr>
                      <th className="p-2">Data</th>
                      <th className="p-2">Tipo</th>
                      <th className="p-2">Motivo</th>
                      <th className="p-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id} className="border-t">
                        <td className="p-2">{it.eventDate.split("-").reverse().join("/")}</td>
                        <td className="p-2">{TYPE_LABEL[it.type]}</td>
                        <td className="p-2">
                          <div className="text-xs text-zinc-800">{it.motivo || "—"}</div>
                          {it.sourceText ? <div className="mt-1 text-[11px] text-zinc-600">Fonte: {it.sourceText}</div> : null}
                        </td>
                        <td className="p-2 text-right">
                          <div className="flex justify-end gap-2">
                            <button className="rounded border px-2 py-1 text-xs" onClick={() => onStartEdit(it)} type="button">
                              Editar
                            </button>
                            <button className="rounded border px-2 py-1 text-xs" onClick={() => onDelete(it.id)} type="button">
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-3 text-xs text-zinc-600">
              Dica: mantenha a sequência coerente (prisão → soltura/cautelar → nova prisão…). Se faltar informação, o relatório exibirá aviso de incompletude.
            </div>
          </div>
        </div>
      </div>
      </div>
  );
}
