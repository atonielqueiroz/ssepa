"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { NotesField } from "@/app/components/NotesField";

type Form = {
  denunciaRecebidaAt: string;
  sentencaAt: string;

  fatosBaseAt: string;
  fatosBaseNaoSei: boolean;

  notasDenuncia: string;
  notasDenunciaDestacar: boolean;

  notasSentenca: string;
  notasSentencaDestacar: boolean;

  dispositivoSentenca: string;
  dispositivoSentencaDestacar: boolean;

  regimeInicialFixado: "FECHADO" | "SEMIABERTO" | "ABERTO" | "";
  recorrerEmLiberdade: "SIM" | "NAO" | "";
  cautelaresAposSentenca: "CESSAM" | "MANTIDAS" | "";
};

type InlineNote = { text: string; highlight?: boolean };

type EditKey = "FATOS" | "DENUNCIA" | "SENTENCA" | "REINCIDENCIA" | "GENERAL" | null;

export function SentenceInfoEditor({ processoId }: { processoId: string }) {
  const params = useParams<{ id: string; pid: string }>();
  const referenceId = params.id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentencaSaved, setSentencaSaved] = useState(false);
  const [editKey, setEditKey] = useState<EditKey>(null);

  const [extracted, setExtracted] = useState<Array<{ law: string; article: string; description?: string }>>([]);

  const [reincStatus, setReincStatus] = useState<"PRIMARIO" | "REINCIDENTE" | "">("");
  const [reincSuggested, setReincSuggested] = useState<"PRIMARIO" | "REINCIDENTE" | null>(null);
  const [reincWhy, setReincWhy] = useState<string | null>(null);
  const [reincEspHed, setReincEspHed] = useState(false);

  const [estadoNaData, setEstadoNaData] = useState<"PRESO" | "CAUTELAR_ATIVA" | "SOLTO" | "DOMICILIAR" | null>(null);
  const [recorrerChoice, setRecorrerChoice] = useState<"SIM_SEM" | "SIM_COM" | "NAO_MANTIDA" | "NAO_ORDEM" | "">("");
  const [recorrerSuggested, setRecorrerSuggested] = useState<typeof recorrerChoice>("");
  const [recorrerIncompat, setRecorrerIncompat] = useState<{ msg: string; recomendadoTipo?: string } | null>(null);

  const [f, setF] = useState<Form>({
    denunciaRecebidaAt: "",
    sentencaAt: "",
    fatosBaseAt: "",
    fatosBaseNaoSei: false,
    notasDenuncia: "",
    notasDenunciaDestacar: false,
    notasSentenca: "",
    notasSentencaDestacar: false,
    dispositivoSentenca: "",
    dispositivoSentencaDestacar: false,

    regimeInicialFixado: "",
    recorrerEmLiberdade: "",
    cautelaresAposSentenca: "",
  });

  useEffect(() => {
    setLoading(true);
    (async () => {
      const res = await fetch(`/api/processos/${processoId}`);
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) {
        setError(data?.error ?? "Falha ao carregar informações da sentença.");
        return;
      }
      const p = data.processo;
      const ms = p.marcosSource ?? {};
      const saved = !!p.sentencaSaved;
      setSentencaSaved(saved);
      setEditKey(saved ? null : "GENERAL"); // porta de entrada: se nunca salvou, já abre pra preencher

      const suggested = (p.reincidenciaSuggested ?? null) as any;
      const chosen = (p.reincidenciaStatus ?? suggested ?? "") as any;
      setReincStatus(chosen);
      setReincSuggested(suggested);
      setReincWhy(p.reincidenciaSuggestedWhy ?? null);
      setReincEspHed(!!p.reincidenteEspecificoHediondo);

      const evs = (p.consolidatedEventos ?? []) as Array<{ type: string; eventDate: string; motivo?: string | null; cautelarTypes?: any; cautelarOtherText?: string | null }>;
      const isDet = (t: string) => t.startsWith("PRISAO_") || t === "RECAPTURA" || t === "CAUTELAR_INICIO" || t === "LIBERDADE_COM_CAUTELAR" || t === "DECISAO_MANTEM_RESTRICAO";
      const isInt = (t: string) => t === "FUGA" || t.startsWith("SOLTURA_") || t === "LIBERDADE_SEM_CAUTELAR" || t === "LIBERDADE_PROVISORIA" || t === "CAUTELAR_FIM" || t === "DECISAO_CESSA_CUSTODIA";

      const decisionISO = (p.sentencaAt ?? "") as string;
      const cut = decisionISO || null;
      if (cut) {
        let active = false;
        let lastDet: any = null;
        for (const e of evs) {
          if (e.eventDate > cut) break;
          if (isDet(e.type)) {
            active = true;
            lastDet = e;
          }
          if (isInt(e.type)) {
            active = false;
            lastDet = null;
          }
        }

        let estado: "PRESO" | "CAUTELAR_ATIVA" | "SOLTO" | "DOMICILIAR" = "SOLTO";
        if (active && lastDet) {
          if (String(lastDet.type).startsWith("PRISAO_") || lastDet.type === "RECAPTURA") estado = "PRESO";
          else {
            const blob = JSON.stringify({ motivo: lastDet.motivo, cautelarTypes: lastDet.cautelarTypes, cautelarOtherText: lastDet.cautelarOtherText }).toLowerCase();
            estado = blob.includes("domiciliar") ? "DOMICILIAR" : "CAUTELAR_ATIVA";
          }
        }
        setEstadoNaData(estado);

        const sug = estado === "SOLTO" ? "SIM_SEM" : (estado === "CAUTELAR_ATIVA" ? "SIM_COM" : "NAO_MANTIDA");
        setRecorrerSuggested(sug);
        setRecorrerChoice(sug);
      } else {
        setEstadoNaData(null);
        setRecorrerSuggested("");
      }

      const getText = (v: any) => (typeof v === "string" ? v : v?.text ?? "");
      const getDest = (k: string) => !!ms[`${k}_destacar`];

      setF({
        denunciaRecebidaAt: p.denunciaRecebidaAt ?? "",
        sentencaAt: p.sentencaAt ?? "",
        fatosBaseAt: p.fatosBaseAt ?? "",
        fatosBaseNaoSei: !!p.fatosBaseNaoSei,
        notasDenuncia: getText(ms.denunciaRecebidaAt),
        notasDenunciaDestacar: getDest("denunciaRecebidaAt"),
        notasSentenca: getText(ms.sentencaAt),
        notasSentencaDestacar: getDest("sentencaAt"),
        dispositivoSentenca: getText(ms.dispositivoSentenca),
        dispositivoSentencaDestacar: getDest("dispositivoSentenca"),

        regimeInicialFixado: (p.regimeInicialFixado ?? "") as any,
        recorrerEmLiberdade: (p.recorrerEmLiberdade ?? "") as any,
        cautelaresAposSentenca: (p.cautelaresAposSentenca ?? "") as any,
      });
    })();
  }, [processoId]);

  function normalizeLaw(text: string) {
    const t = (text || "").toLowerCase();
    if (t.includes("11.343") || t.includes("lei 11343") || t.includes("lei nº 11.343")) return "Lei 11.343/06";
    if (t.includes("10.826") || t.includes("lei 10826")) return "Lei 10.826/03";
    if (t.includes("8.072") || t.includes("lei 8072")) return "Lei 8.072/90";
    if (t.includes("codigo penal") || t.includes("código penal") || t.includes("\ncp") || t.includes(" cp")) return "CP";
    return "CP";
  }

  function inferDescription(law: string, article: string) {
    const a = article.replace(/\s+/g, " ").toLowerCase();
    if (law.includes("11.343") && a.includes("art. 33")) {
      if (a.includes("c/c") && a.includes("art. 40")) return "Tráfico (causa de aumento art. 40)";
      return "Tráfico";
    }
    if (law === "CP") {
      if (a.includes("art. 121")) return "Homicídio";
      if (a.includes("art. 157")) return "Roubo";
      if (a.includes("art. 155")) return "Furto";
      if (a.includes("art. 33")) return "Tráfico";
    }
    return "";
  }

  const extractedFromDispositivo = useMemo(() => {
    const text = f.dispositivoSentenca || "";
    const law = normalizeLaw(text);

    // captura segmentos tipo: art. 33, § 4º, III / art 121 §2º II
    const re = /(art\.?|artigo)\s*(\d+[a-z]?)\s*([^\n;]*)/gi;
    const out: Array<{ law: string; article: string; description?: string }> = [];

    for (const m of text.matchAll(re)) {
      const num = m[2];
      const tail = (m[3] || "").trim();

      // corta cauda até encontrar próximo "art" explícito (para não engolir tudo)
      const tailStop = tail.split(/(?=\bart\.?\b|\bartigo\b)/i)[0].trim();

      // tenta manter §/incisos e também "c/c art. X"
      let piece = `art. ${num}`;

      // pega "§ ..." e incisos logo após
      const qual = tailStop.match(/^(?:,?\s*(?:§\s*\d+º?|inc\.?\s*[ivxlcdm]+|inciso\s*[ivxlcdm]+|[ivxlcdm]+|caput|par\.?\s*único|paragrafo\s*único|parágrafo\s*único|al[ií]nea\s*[a-z]))+/i);
      if (qual?.[0]) piece += " " + qual[0].trim().replace(/^,\s*/, "").replace(/\s+/g, " ");

      // captura c/c art. ... (um ou mais)
      const cc = tailStop.match(/c\/c\s*(?:art\.?|artigo)\s*\d+[a-z]?(?:\s*,\s*(?:§\s*\d+º?|inc\.?\s*[ivxlcdm]+|[ivxlcdm]+))?/gi);
      if (cc?.length) {
        const ccNorm = cc
          .map((s) => s.replace(/c\/c\s*/i, "").replace(/artigo/gi, "art.").replace(/\s+/g, " ").trim())
          .map((s) => s.replace(/^art\./i, "art."));
        piece += " c/c " + ccNorm.join(" c/c ");
      }

      piece = piece.replace(/\s+,/g, ",").replace(/\s+/g, " ").trim();
      if (!out.some((x) => x.article.toLowerCase() === piece.toLowerCase())) {
        const description = inferDescription(law, piece);
        out.push({ law, article: piece, description: description || undefined });
      }
    }

    return out;
  }, [f.dispositivoSentenca]);

  function fmt(d: string) {
    if (!d) return "—";
    const [y, m, day] = d.split("-");
    if (!y || !m || !day) return d;
    return `${day}/${m}/${y}`;
  }

  function renderInlineField(label: string, value: ReactNode, note?: InlineNote, valueClassName?: string) {
    return (
      <div className="mt-2 text-sm text-zinc-900">
        <span className="font-semibold">{label}:</span>
        <span className={["ml-1", valueClassName].filter(Boolean).join(" ")}>{value}</span>
        {note?.text ? (
          <div className={"mt-1 text-xs " + (note.highlight ? "text-red-700" : "text-zinc-600")}>
            Nota: {note.text}
          </div>
        ) : null}
      </div>
    );
  }

  async function save() {
    setError(null);
    setSaving(true);

    const res = await fetch(`/api/processos/${processoId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sentencaSaved: true,
        denunciaRecebidaAt: f.denunciaRecebidaAt || null,
        sentencaAt: f.sentencaAt || null,
        fatosBaseAt: f.fatosBaseNaoSei ? null : (f.fatosBaseAt || null),
        fatosBaseNaoSei: !!f.fatosBaseNaoSei,
        fonte_denunciaRecebidaAt: f.notasDenuncia,
        fonte_denunciaRecebidaAt_destacar: f.notasDenunciaDestacar,
        fonte_sentencaAt: f.notasSentenca,
        fonte_sentencaAt_destacar: f.notasSentencaDestacar,
        fonte_dispositivoSentenca: f.dispositivoSentenca,
        fonte_dispositivoSentenca_destacar: f.dispositivoSentencaDestacar,
        reincidenciaMode: "MANUAL",
        reincidenciaStatus: reincStatus || null,
        regimeInicialFixado: f.regimeInicialFixado || null,
        recorrerEmLiberdade: f.recorrerEmLiberdade || null,
        cautelaresAposSentenca: f.cautelaresAposSentenca || null,
      }),
    });

    const data = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setError(data?.error ?? "Falha ao salvar informações da sentença.");
      return;
    }

    setSentencaSaved(true);
    setEditKey(null);
    window.location.reload();
  }

  const editLinkClass = "bg-transparent p-0 text-sm text-zinc-700 hover:underline";
  const actionLinkClass = "bg-transparent p-0 text-sm text-zinc-700 hover:underline disabled:opacity-50";

  const isGeneralEditing = editKey === "GENERAL";

  const reincDisplay =
    reincStatus === "REINCIDENTE"
      ? "Reincidente"
      : reincStatus === "PRIMARIO"
        ? "Primário"
        : "—";

  const isSentencaEditing = editKey === "SENTENCA";
  const regimeDisplayText = f.regimeInicialFixado === "FECHADO" ? "Fechado" : f.regimeInicialFixado === "SEMIABERTO" ? "Semiaberto" : f.regimeInicialFixado === "ABERTO" ? "Aberto" : "Não informado";
  const dispositivoDisplayValue = f.dispositivoSentenca ? (
    <span className={`inline-flex w-full flex-wrap items-center rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm leading-snug ${f.dispositivoSentencaDestacar ? "text-red-700" : "text-zinc-700"}`}>
      {f.dispositivoSentenca}
    </span>
  ) : "—";
  const concedidoRecorrerText = f.recorrerEmLiberdade === "SIM" ? "Sim" : f.recorrerEmLiberdade === "NAO" ? "Não" : "—";
  const renderRecorrerEvent = () => {
    if (!estadoNaData || !f.sentencaAt || !recorrerChoice) return null;
    const dateBR = f.sentencaAt.split("-").reverse().join("/");

    const real = estadoNaData;
    const intended =
      recorrerChoice === "SIM_SEM"
        ? "SOLTO"
        : recorrerChoice === "SIM_COM"
          ? "CAUTELAR_ATIVA"
          : "PRESO";

    if (real === intended || (real === "DOMICILIAR" && intended === "CAUTELAR_ATIVA")) {
      return <div className="text-xs text-emerald-700">Compatível com os registros.</div>;
    }

    let evento = null;

    if (real === "PRESO" && intended === "SOLTO") evento = "Soltura (fim detração / início interrupção)";
    else if (real === "PRESO" && intended === "CAUTELAR_ATIVA") evento = "Prisão → cautelar ativa";
    else if (real === "SOLTO" && intended === "PRESO") evento = "Ordem de prisão (início detração)";
    else if (real === "SOLTO" && intended === "CAUTELAR_ATIVA") evento = "Início de cautelares (detração por cautelar)";
    else if ((real === "CAUTELAR_ATIVA" || real === "DOMICILIAR") && intended === "SOLTO") evento = "Revogação cautelar / soltura (fim detração / início interrupção)";
    else if ((real === "CAUTELAR_ATIVA" || real === "DOMICILIAR") && intended === "PRESO") evento = "Ordem/decretação de prisão (cautelar → prisão)";
    else evento = "Ajustar eventos de custódia/cautelar";

    return (
      <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
        Sua seleção indica mudança do status de liberdade. Para refletir isso na linha do tempo, registre um evento em {dateBR}.
        <div className="mt-1">
          <span className="font-medium">Evento sugerido:</span> {evento}.
        </div>
        <div className="mt-2">
          <a className="rounded border border-amber-300 bg-white px-2 py-1 text-[11px]" href={`/referencias/${referenceId}/processos/${processoId}/eventos`}>
            Ir para Eventos
          </a>
        </div>
      </div>
    );
  };

  const reincSuggestionText = reincSuggested
    ? reincSuggested === "PRIMARIO"
      ? "Sugestão: Primário — não consta condenação anterior com trânsito em julgado anterior à data dos fatos."
      : "Sugestão: Reincidente — identificamos condenação anterior com trânsito em julgado anterior à data dos fatos."
    : "Sugestão indisponível: faltam datas para comparação. Você pode selecionar manualmente.";

  return (
    <div className="space-y-4">
      {loading ? <div className="text-sm text-zinc-600">Carregando…</div> : null}

      <section className="rounded border bg-white">
        <div className="rounded-t border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700 flex items-center justify-between">
          <span>Informações gerais</span>
          <button
            type="button"
            className="bg-transparent p-0 text-sm text-zinc-700 hover:underline"
            onClick={() => setEditKey((prev) => (prev === "GENERAL" ? null : "GENERAL"))}
          >
            Editar
          </button>
        </div>
        <div className="space-y-6 px-4 py-4 text-sm text-zinc-900">
          <div className="space-y-2">
            {isGeneralEditing ? (
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-700">Data dos fatos:</div>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <input
                      className="rounded border px-3 py-2"
                      type="date"
                      value={f.fatosBaseAt}
                      disabled={f.fatosBaseNaoSei}
                      onChange={(e) => setF((prev) => ({ ...prev, fatosBaseAt: e.target.value }))}
                    />
                    <label className="flex items-center gap-2 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        checked={f.fatosBaseNaoSei}
                        onChange={(e) =>
                          setF((prev) => ({
                            ...prev,
                            fatosBaseNaoSei: e.target.checked,
                            fatosBaseAt: e.target.checked ? "" : prev.fatosBaseAt,
                          }))
                        }
                      />
                      Não sei
                    </label>
                  </div>

                  {f.fatosBaseNaoSei ? (
                    <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                      Atenção: sem a data dos fatos, o SSEPA terá limitações. Isso pode dificultar a análise de direitos e impedir o auxílio do sistema no enquadramento dos percentuais para progressão de regime e livramento condicional.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="mt-2">
                {renderInlineField("Data do(s) fato(s)", f.fatosBaseNaoSei ? "Não sei" : f.fatosBaseAt ? fmt(f.fatosBaseAt) : "—", undefined, "ssepa-highlight-value")}
              </div>
            )}
          </div>
          <div className="space-y-2">
            {isGeneralEditing ? (
              <>
                <div className="rounded border border-zinc-200 bg-zinc-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-zinc-700">Primariedade / Reincidência (Sugestão)*</div>
                  </div>

                  <div className="space-y-3">
                    <div className="mt-2 flex flex-wrap gap-3 text-sm">
                      <label className="flex items-center gap-2">
                        <input type="radio" name="reinc_status" checked={reincStatus === "PRIMARIO"} onChange={() => setReincStatus("PRIMARIO")} /> Primário
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="radio" name="reinc_status" checked={reincStatus === "REINCIDENTE"} onChange={() => setReincStatus("REINCIDENTE")} /> Reincidente
                      </label>
                    </div>

                    <div className="text-xs text-zinc-600">{reincSuggestionText}</div>
                    {reincEspHed ? (
                      <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                        Há condenação anterior por hediondo/equiparado com trânsito anterior ao fato desta condenação.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <div className="text-sm font-semibold text-zinc-700">Data do recebimento da Denúncia/Queixa:</div>
                    <input
                      className="w-full rounded border px-3 py-2"
                      type="date"
                      value={f.denunciaRecebidaAt}
                      onChange={(e) => setF((prev) => ({ ...prev, denunciaRecebidaAt: e.target.value }))}
                    />
                  </div>
                  <NotesField
                    label="Notas"
                    value={f.notasDenuncia}
                    onChange={(v) => setF((prev) => ({ ...prev, notasDenuncia: v }))}
                    placeholder="Notas nos autos (mov/seq/pág.)"
                    destacar={f.notasDenunciaDestacar}
                    onToggleDestacar={(v) => setF((prev) => ({ ...prev, notasDenunciaDestacar: v }))}
                    minRows={2}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-3">
                {renderInlineField("Primariedade / Reincidência", reincDisplay, { text: reincSuggestionText })}
                {renderInlineField(
                  "Data do recebimento da Denúncia/Queixa",
                  fmt(f.denunciaRecebidaAt),
                  f.notasDenuncia ? { text: `“${f.notasDenuncia}”`, highlight: f.notasDenunciaDestacar } : undefined
                )}
              </div>
            )}
          </div>
        {isGeneralEditing ? (
          <div className="flex gap-3">
            <button type="button" className={actionLinkClass} onClick={save} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" className={actionLinkClass} onClick={() => setEditKey(null)} disabled={saving}>
              Cancelar
            </button>
          </div>
        ) : null}
        </div>
      </section>

      <section className="rounded border bg-white">
        <div className="rounded-t border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
          Informações da Sentença – 1º grau
        </div>
        <div className="space-y-6 px-4 py-4 text-sm text-zinc-900">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-zinc-700">Dispositivo da Sentença</div>
              <button type="button" className={editLinkClass} onClick={() => setEditKey("SENTENCA")}>
                Editar
              </button>
            </div>
            <div className="text-xs text-zinc-600">
              Cole aqui o dispositivo da sentença (crimes/artigos e termos da condenação). Não precisa transcrever a fundamentação.
            </div>

            {editKey === "SENTENCA" ? (
              <div className="space-y-3">
                <NotesField
                  label=""
                  value={f.dispositivoSentenca}
                  onChange={(v) => {
                    setF((prev) => ({ ...prev, dispositivoSentenca: v }));
                  }}
                  placeholder="Cole aqui o dispositivo da sentença (crimes/artigos e termos da condenação). Não precisa transcrever a fundamentação."
                  destacar={f.dispositivoSentencaDestacar}
                  onToggleDestacar={(v) => setF((prev) => ({ ...prev, dispositivoSentencaDestacar: v }))}
                  minRows={4}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="rounded border bg-white px-3 py-1 text-sm"
                    onClick={() => setExtracted(extractedFromDispositivo)}
                  >
                    Identificar crimes no dispositivo
                  </button>
                  <div className="text-xs text-zinc-600">
                    Pré-cadastro: cria atalhos para preencher Lei/Artigo/Descrição. Você completa pena/data do fato e demais campos.
                  </div>
                </div>

                {extracted.length ? (
                  <div className="rounded border bg-white p-2 text-sm">
                    <div className="text-xs font-medium text-zinc-700">Crimes identificados (pré-cadastro)</div>
                    <div className="mt-2 grid gap-2">
                      {extracted.map((c, idx) => {
                        const href = `/referencias/${referenceId}/processos/${processoId}/crimes/novo?law=${encodeURIComponent(c.law)}&article=${encodeURIComponent(c.article)}${c.description ? `&desc=${encodeURIComponent(c.description)}` : ""}`;
                        return (
                          <div key={idx} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-zinc-50 px-2 py-2">
                            <div className="min-w-0">
                              <div className="text-sm font-medium">{c.article}</div>
                              <div className="text-xs text-zinc-600">
                                {c.law}
                                {c.description ? ` — ${c.description}` : ""}
                              </div>
                            </div>
                            <a className="ssepa-btn rounded px-3 py-1 text-sm" href={href}>
                              Pré-cadastrar
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                {renderInlineField(
                  "Data da Sentença",
                  f.sentencaAt ? fmt(f.sentencaAt) : "—",
                  f.notasSentenca ? { text: `“${f.notasSentenca}”`, highlight: f.notasSentencaDestacar } : undefined
                )}
                {renderInlineField("Dispositivo da Sentença", dispositivoDisplayValue)}
              </div>
            )}
          </div>

          {isSentencaEditing ? (
            <div className="rounded border border-zinc-200 bg-zinc-50 p-3 space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Regime inicial fixado</label>
                  <select className="mt-1 w-full rounded border bg-white px-3 py-2" value={f.regimeInicialFixado} onChange={(e) => setF((prev) => ({ ...prev, regimeInicialFixado: e.target.value as any }))}>
                    <option value="">Não informado</option>
                    <option value="FECHADO">Fechado</option>
                    <option value="SEMIABERTO">Semiaberto</option>
                    <option value="ABERTO">Aberto</option>
                  </select>
                </div>

                <div className="md:col-span-2 space-y-3">
                  <div className="text-sm font-medium">Recorrer em liberdade (Sugestão)*</div>
                  <div className="mt-1 text-xs text-zinc-600">
                    {f.sentencaAt && estadoNaData ? (
                      <>Dos registros de prisões, solturas e cautelares informados, consta que na data da sentença ({f.sentencaAt.split("-").reverse().join("/")}) o executado estava: {estadoNaData === "PRESO" ? "Preso" : estadoNaData === "SOLTO" ? "Solto" : estadoNaData === "DOMICILIAR" ? "Em prisão domiciliar" : "Com medida cautelar ativa"}.</>
                    ) : (
                      <>Dos registros de prisões, solturas e cautelares informados, consta que na data da sentença (—) o executado estava: —.</>
                    )}
                  </div>

                  <div className="mt-2 grid gap-2 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="recorrer" checked={recorrerChoice === "SIM_SEM"} onChange={() => setRecorrerChoice("SIM_SEM")} />
                      Sim, sem cautelares
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="recorrer" checked={recorrerChoice === "SIM_COM"} onChange={() => setRecorrerChoice("SIM_COM")} />
                      Sim, com cautelares
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="recorrer" checked={recorrerChoice === "NAO_MANTIDA"} onChange={() => setRecorrerChoice("NAO_MANTIDA")} />
                      Não (mantida prisão)
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="recorrer" checked={recorrerChoice === "NAO_ORDEM"} onChange={() => setRecorrerChoice("NAO_ORDEM")} />
                      Não (ordem de prisão)
                    </label>
                  </div>

                  <div className="mt-2 text-xs text-zinc-600">
                    {recorrerSuggested ? (
                      <>Sugestão: {recorrerSuggested === "SIM_SEM" ? "Sim, sem cautelares" : recorrerSuggested === "SIM_COM" ? "Sim, com cautelares" : "Não (mantida prisão)"}</>
                    ) : (
                      <>Sugestão indisponível: faltam datas para comparação. Você pode selecionar manualmente.</>
                    )}
                  </div>

                  {renderRecorrerEvent()}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded border border-zinc-200 bg-zinc-50 p-3 space-y-2">
              {renderInlineField("Regime inicial fixado", regimeDisplayText)}
              {renderInlineField("Concedido Direito Recorrer em liberdade", concedidoRecorrerText)}
              {renderRecorrerEvent()}
            </div>
          )}
        </div>
      </section>
      {!sentencaSaved ? (
        <div className="mt-3 text-xs text-amber-900">
          Salve as informações da sentença (mesmo incompleta) para liberar os recursos.
        </div>
      ) : null}

      {error ? <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}
    </div>
  );
}
