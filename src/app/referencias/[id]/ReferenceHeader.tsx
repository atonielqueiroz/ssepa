"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { execObsClass, execStatusClass, formatExecStatus } from "@/lib/executionStatus";

export function ReferenceHeader({
  referenceId,
  execNumber,
  executadoNome,
  executadoNascimento,
  executadoNascimentoSourceText,
  title,
  reeducandoGender,
  reeducandaGestante,
  reeducandaMaeOuResponsavelCriancaOuPcd,
  novoCrimeDoloso,
  hasFaltaGrave,
  execRegime,
  execSituacao,
  execMarkerMonitorado,
  execMarkerRecolhido,
  execMarkerSoltoCumprindo,
  execObservacao,
  execDestacar,
  baseDateProgressaoAt,
  baseDateProgressaoSourceText,
  baseDateSuggestionAt,
  baseDateSuggestionWhy,
  basePenaCumpridaDays,
  basePenaCumpridaSourceText,
  progressWidget,
  reviewStatus,
  archivedAtIso,
}: {
  referenceId: string;
  execNumber: string | null;
  executadoNome: string | null;
  executadoNascimento: string | null; // YYYY-MM-DD
  executadoNascimentoSourceText: string | null;
  title: string;
  reeducandoGender: "MASCULINO" | "FEMININO" | "OUTRO" | null;
  reeducandaGestante: boolean;
  reeducandaMaeOuResponsavelCriancaOuPcd: boolean;
  novoCrimeDoloso: boolean;
  hasFaltaGrave: boolean;

  execRegime: "FECHADO" | "SEMIABERTO" | "ABERTO" | null;
  execSituacao: "PRESO" | "FORAGIDO" | "SUSPENSA_AGUARDANDO_CAPTURA" | "CUMPRINDO" | "AGUARDANDO_INICIO" | "OUTRO" | null;
  execMarkerMonitorado: boolean;
  execMarkerRecolhido: boolean;
  execMarkerSoltoCumprindo: boolean;
  execObservacao: string | null;
  execDestacar: boolean;

  baseDateProgressaoAt: string | null; // YYYY-MM-DD
  baseDateProgressaoSourceText: string | null;
  baseDateSuggestionAt: string | null;
  baseDateSuggestionWhy: string | null;

  basePenaCumpridaDays: number | null;
  basePenaCumpridaSourceText: string | null;

  progressWidget?: React.ReactNode;
  reviewStatus?:
    | "REVISAO_NAO_INICIADA"
    | "REVISAO_EM_ANDAMENTO"
    | "AGUARDANDO_CONFERENCIA"
    | "REVISAO_CONCLUIDA_100"
    | "RENUNCIADA"
    | "ARQUIVADA"
    | null;

  archivedAtIso?: string | null;
}) {
  const pathname = usePathname();
  const execLabel = execNumber ? `Execução Penal nº ${execNumber}` : title;
  const [editing, setEditing] = useState(false);
  const [revStatus, setRevStatus] = useState<string>(reviewStatus ?? "REVISAO_NAO_INICIADA");
  const [revSaving, setRevSaving] = useState(false);

  useEffect(() => {
    try {
      // "#editar" é usado em outras telas (ex.: processo criminal). Só auto-abrir o editor
      // quando estamos na página principal da execução: /referencias/{id}
      if (window.location.hash === "#editar" && pathname === `/referencias/${referenceId}`) setEditing(true);
    } catch {}
  }, [pathname, referenceId]);

  const [exec, setExec] = useState(execNumber ?? "");
  const [nome, setNome] = useState(executadoNome ?? "");
  const [nasc, setNasc] = useState(executadoNascimento ?? "");
  const [nascFonte, setNascFonte] = useState(executadoNascimentoSourceText ?? "");
  const [gender, setGender] = useState<"MASCULINO" | "FEMININO" | "OUTRO" | "">(reeducandoGender ?? "");
  const [gestante, setGestante] = useState(!!reeducandaGestante);
  const [maeResp, setMaeResp] = useState(!!reeducandaMaeOuResponsavelCriancaOuPcd);
  const [novoDoloso, setNovoDoloso] = useState(!!novoCrimeDoloso);

  const [stRegime, setStRegime] = useState<"FECHADO" | "SEMIABERTO" | "ABERTO" | "">(execRegime ?? "");
  const [stSitu, setStSitu] = useState<
    "PRESO" | "FORAGIDO" | "SUSPENSA_AGUARDANDO_CAPTURA" | "CUMPRINDO" | "AGUARDANDO_INICIO" | "OUTRO" | ""
  >(execSituacao ?? "");
  const [stMon, setStMon] = useState(!!execMarkerMonitorado);
  const [stRec, setStRec] = useState(!!execMarkerRecolhido);
  const [stSolto, setStSolto] = useState(!!execMarkerSoltoCumprindo);
  const [stObs, setStObs] = useState(execObservacao ?? "");
  const [stDest, setStDest] = useState(!!execDestacar);

  const [baseDate, setBaseDate] = useState(baseDateProgressaoAt ?? "");
  const [baseDateFonte, setBaseDateFonte] = useState(baseDateProgressaoSourceText ?? "");

  const initialCumprida = basePenaCumpridaDays ?? null;
  const [penaCumpridaY, setPenaCumpridaY] = useState(initialCumprida ? Math.floor(initialCumprida / 365) : 0);
  const [penaCumpridaM, setPenaCumpridaM] = useState(initialCumprida ? Math.floor((initialCumprida % 365) / 30) : 0);
  const [penaCumpridaD, setPenaCumpridaD] = useState(initialCumprida ? (initialCumprida % 30) : 0);
  const [penaCumpridaFonte, setPenaCumpridaFonte] = useState(basePenaCumpridaSourceText ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [archiving, setArchiving] = useState(false);
  const isArchived = !!archivedAtIso;
  const archiveButtonBg = isArchived ? "#246091" : "#5c1d19";
  const archiveButtonLabel = isArchived ? "Desarquivar" : "Arquivar";

  async function toggleArchive() {
    setArchiving(true);
    try {
      const nextArchived = !isArchived;
      const res = await fetch(`/api/referencias/${referenceId}/archive`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ archived: nextArchived }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Falha ao arquivar/restaurar.");

      // Após arquivar/restaurar, recarrega a execução (ou volta para a mesa ao arquivar)
      if (nextArchived) {
        window.location.href = "/referencias";
      } else {
        window.location.reload();
      }
    } catch (e: any) {
      setError(e?.message ?? "Falha ao arquivar/restaurar.");
    } finally {
      setArchiving(false);
    }
  }

  async function saveReviewStatus(next: string) {
    setRevSaving(true);
    try {
      const res = await fetch(`/api/referencias/${referenceId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviewStatus: next }),
      });
      setRevSaving(false);
      if (!res.ok) throw new Error();
    } catch {
      setRevSaving(false);
      // fallback: mantém sem travar a UI
    }
  }

  async function onSave() {
    setError(null);
    setSaving(true);
    const res = await fetch(`/api/referencias/${referenceId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        execNumber: exec,
        executadoNome: nome,
        executadoNascimento: nasc ? nasc : null,
        executadoNascimentoSourceText: nascFonte,
        reeducandoGender: gender || null,
        reeducandaGestante: gestante,
        reeducandaMaeOuResponsavelCriancaOuPcd: maeResp,
        novoCrimeDoloso: novoDoloso,

        execRegime: stRegime || null,
        execSituacao: stSitu || null,
        execMarkerMonitorado: stMon,
        execMarkerRecolhido: stRec,
        execMarkerSoltoCumprindo: stSolto,
        execObservacao: stObs,
        execDestacar: stDest,

        baseDateProgressaoAt: baseDate ? baseDate : null,
        baseDateProgressaoSourceText: baseDateFonte,
        basePenaCumpridaDays: (penaCumpridaY * 365 + penaCumpridaM * 30 + penaCumpridaD) || 0,
        basePenaCumpridaSourceText: penaCumpridaFonte,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data?.error ?? "Falha ao salvar.");
      return;
    }
    // Ao salvar vindo da “Mesa de Execuções”, a rota abre com #editar.
    // Se apenas recarregar, o hash mantém o editor aberto. Redireciona para a execução sem hash.
    window.location.href = `/referencias/${referenceId}`;
  }

  return (
    <div>
      {!editing ? (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-3">
              <h1 className="truncate text-2xl font-semibold">
                {execLabel}
                {executadoNome ? <span className="text-zinc-700"> — {executadoNome}</span> : null}
              </h1>

              <button
                type="button"
                onClick={toggleArchive}
                disabled={archiving}
                className="shrink-0 rounded px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                style={{ backgroundColor: archiveButtonBg }}
                title={archivedAtIso ? "Restaurar execução" : "Arquivar execução"}
              >
                {archiving ? "Aguarde…" : archiveButtonLabel}
              </button>
            </div>

            <div className="mt-2 text-xs text-zinc-600">Aviso: SSEPA é um simulador. Confira nos autos antes de usar.</div>

            <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_460px] lg:items-start">
              <div className="p-3">
                <div className="font-medium">Informações do executado</div>

                <div className="mt-2 text-sm text-zinc-700">
                  <div>
                    <span className="text-zinc-600">Nome:</span> {executadoNome ?? "—"}
                  </div>
                  <div className="mt-1">
                    <span className="text-zinc-600">Nascimento:</span> {executadoNascimento ? executadoNascimento.split("-").reverse().join("/") : "—"}
                    {executadoNascimentoSourceText ? <span className="ml-2 text-xs text-zinc-500">({executadoNascimentoSourceText})</span> : null}
                  </div>
                  <div className="mt-1">
                    <span className="text-zinc-600">Perfil (sexo):</span> {reeducandoGender ?? "—"}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-xs font-medium text-zinc-700">Status da execução</div>
                  {(() => {
                    const s = formatExecStatus({
                      execRegime,
                      execSituacao,
                      execMarkerMonitorado,
                      execMarkerRecolhido,
                      execMarkerSoltoCumprindo,
                      execObservacao,
                      execDestacar,
                    });
                    return (
                      <div className="mt-1 text-sm">
                        {(() => {
                          const regimeLabel =
                            execRegime === "FECHADO"
                              ? "Regime fechado"
                              : execRegime === "SEMIABERTO"
                                ? "Regime semiaberto"
                                : execRegime === "ABERTO"
                                  ? "Regime aberto"
                                  : "Regime";
                          return (
                            <>
                              <span className="text-zinc-600">{regimeLabel}: </span>
                              <span className={execStatusClass(s)}>{s.text}</span>
                            </>
                          );
                        })()}
                        {s.observacao ? <span className={"ml-2 " + execObsClass(s)}>“{s.observacao}”</span> : null}
                      </div>
                    );
                  })()}
                </div>

                {hasFaltaGrave || novoCrimeDoloso ? (
                  <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                    {hasFaltaGrave ? "ALERTA: falta grave registrada. " : ""}
                    {novoCrimeDoloso ? "ALERTA: novo crime doloso informado. " : ""}
                  </div>
                ) : null}
              </div>

              <div className="flex justify-center lg:justify-end">
                {progressWidget ?? null}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <div className="flex w-full items-center justify-between gap-2 rounded border px-2 py-1 text-xs lg:w-auto" style={{ borderColor: "var(--ssepa-border)" }}>
              <span className="text-zinc-600">Como está indo:</span>
              <select
                className={"bg-transparent outline-none " + (revStatus ? "font-semibold" : "")}
                value={revStatus}
                onChange={(e) => {
                  const next = e.target.value;
                  setRevStatus(next);
                  saveReviewStatus(next);
                }}
                disabled={revSaving}
              >
                <option value="REVISAO_NAO_INICIADA">Revisão não iniciada</option>
                <option value="REVISAO_EM_ANDAMENTO">Revisão em andamento</option>
                <option value="AGUARDANDO_CONFERENCIA">Aguardando conferência</option>
                <option value="REVISAO_CONCLUIDA_100">Revisão concluída (100%)</option>
                <option value="RENUNCIADA">Renunciada</option>
                <option value="ARQUIVADA">Arquivada</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                className="rounded border px-3 py-2 text-sm"
                onClick={() => setEditing(true)}
                type="button"
              >
                Editar
              </button>
              <a className="rounded border px-3 py-2 text-sm" href="/referencias">
                Voltar
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded border bg-white p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Execução Penal nº</label>
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={exec}
                onChange={(e) => setExec(e.target.value)}
                placeholder="0000000-00.0000.0.00.0000"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Nome do executado</label>
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Data de nascimento do executado (opcional)</label>
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                type="date"
                value={nasc}
                onChange={(e) => setNasc(e.target.value)}
              />
              <div className="mt-1 text-xs text-zinc-600">
                Sem esta data, o relatório de prescrição pode ficar impreciso ou indisponível (ex.: art. 115 do CP).
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Fonte nos autos (data de nascimento)</label>
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={nascFonte}
                onChange={(e) => setNascFonte(e.target.value)}
                placeholder="mov/seq/evento, documento, página…"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Perfil do reeducando (sexo)</label>
              <select className="mt-1 w-full rounded border bg-white px-3 py-2" value={gender} onChange={(e) => setGender(e.target.value as any)}>
                <option value="">Não informado</option>
                <option value="MASCULINO">Masculino</option>
                <option value="FEMININO">Feminino</option>
                <option value="OUTRO">Outro</option>
              </select>
            </div>

            {gender === "FEMININO" ? (
              <div className="grid gap-2 rounded border bg-zinc-50 p-3 md:col-span-2">
                <div className="text-sm font-medium">Art. 112, §3º–§4º (Lei 13.769/2018) — campos do caso</div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={gestante} onChange={(e) => setGestante(e.target.checked)} /> Gestante
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={maeResp} onChange={(e) => setMaeResp(e.target.checked)} /> Mãe ou responsável por criança/PcD
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={novoDoloso} onChange={(e) => setNovoDoloso(e.target.checked)} /> Novo crime doloso (intercorrência)
                </label>
                <div className="text-xs text-zinc-600">
                  Estes campos controlam a exibição e eventual revogação da progressão especial (§4º).
                </div>
              </div>
            ) : null}

            <div className="rounded border bg-zinc-50 p-3 md:col-span-2">
              <div className="text-sm font-medium">Status da execução</div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Regime</label>
                  <select
                    className="mt-1 w-full rounded border bg-white px-3 py-2"
                    value={stRegime}
                    onChange={(e) => {
                      const v = e.target.value as any;
                      setStRegime(v);
                      setStSitu("");
                      setStMon(false);
                      setStRec(false);
                      setStSolto(false);
                    }}
                  >
                    <option value="">Não informado</option>
                    <option value="FECHADO">Fechado</option>
                    <option value="SEMIABERTO">Semiaberto</option>
                    <option value="ABERTO">Aberto</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Situação</label>
                  <select
                    className="mt-1 w-full rounded border bg-white px-3 py-2"
                    value={stSitu}
                    onChange={(e) => setStSitu(e.target.value as any)}
                  >
                    <option value="">Selecione…</option>
                    {stRegime === "FECHADO" ? (
                      <>
                        <option value="PRESO">PRESO</option>
                        <option value="FORAGIDO">Foragido</option>
                        <option value="SUSPENSA_AGUARDANDO_CAPTURA">Suspensa, aguardando captura</option>
                        <option value="OUTRO">Outro</option>
                      </>
                    ) : null}
                    {stRegime === "SEMIABERTO" || stRegime === "ABERTO" ? (
                      <>
                        <option value="CUMPRINDO">Cumprindo</option>
                        <option value="AGUARDANDO_INICIO">Aguardando início</option>
                        <option value="OUTRO">Outro</option>
                      </>
                    ) : null}
                  </select>
                </div>
              </div>

              {stRegime === "SEMIABERTO" && stSitu === "CUMPRINDO" ? (
                <div className="mt-3 grid gap-2">
                  <div className="text-xs font-medium">Marcadores</div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={stMon} onChange={(e) => setStMon(e.target.checked)} /> Monitorado
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={stRec} onChange={(e) => setStRec(e.target.checked)} /> Recolhido
                  </label>
                </div>
              ) : null}

              {stRegime === "ABERTO" && stSitu === "CUMPRINDO" ? (
                <div className="mt-3 grid gap-2">
                  <div className="text-xs font-medium">Marcadores</div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={stMon} onChange={(e) => setStMon(e.target.checked)} /> Monitorado
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={stSolto} onChange={(e) => setStSolto(e.target.checked)} /> Solto cumprindo
                  </label>
                </div>
              ) : null}

              {stSitu === "OUTRO" ? (
                <div className="mt-3">
                  <label className="text-sm font-medium">Anotação (Outro)</label>
                  <input
                    className="mt-1 w-full rounded border bg-white px-3 py-2"
                    value={stObs}
                    onChange={(e) => setStObs(e.target.value)}
                    placeholder="Descreva…"
                  />
                </div>
              ) : (
                <div className="mt-3">
                  <label className="text-sm font-medium">Observação</label>
                  <input
                    className="mt-1 w-full rounded border bg-white px-3 py-2"
                    value={stObs}
                    onChange={(e) => setStObs(e.target.value)}
                    placeholder="Texto livre (opcional)"
                  />
                </div>
              )}

              <label className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={stDest} onChange={(e) => setStDest(e.target.checked)} /> Destacar
              </label>

              <div className="mt-4 rounded border bg-zinc-50 p-3">
                <div className="text-sm font-medium">Data-base para progressão</div>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Data-base (manual)</label>
                    <div className="mt-1 flex gap-2">
                      <input className="w-full rounded border bg-white px-3 py-2" type="date" value={baseDate} onChange={(e) => setBaseDate(e.target.value)} />
                      {baseDateSuggestionAt ? (
                        <button
                          type="button"
                          className="rounded border bg-white px-3 py-2 text-sm"
                          onClick={() => {
                            setBaseDate(baseDateSuggestionAt);
                            if (!baseDateFonte) setBaseDateFonte(baseDateSuggestionWhy ?? "");
                          }}
                          title={baseDateSuggestionWhy ?? "Sugestão"}
                        >
                          Usar sugestão
                        </button>
                      ) : null}
                    </div>
                    {baseDateSuggestionAt ? (
                      <div className="mt-1 text-xs text-zinc-600">
                        Sugestão: {baseDateSuggestionAt.split("-").reverse().join("/")} ({baseDateSuggestionWhy ?? ""})
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-zinc-600">Sem sugestão automática (cadastre eventos de prisão/recaptura ou falta grave).</div>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium">Fonte nos autos</label>
                    <input
                      className="mt-1 w-full rounded border bg-white px-3 py-2"
                      value={baseDateFonte}
                      onChange={(e) => setBaseDateFonte(e.target.value)}
                      placeholder="certidão/andamento/consulta…"
                    />
                    <div className="mt-1 text-xs text-zinc-600">
                      Jurisprudência pacífica: data-base = última prisão ou falta grave (SEEU). Ajuste conforme os autos.
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded border bg-zinc-50 p-3">
                <div className="text-sm font-medium">Pena cumprida na data-base</div>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Tempo cumprido (0a0m0d)</label>
                    <div className="mt-1 grid grid-cols-3 gap-2">
                      <input className="w-full rounded border bg-white px-3 py-2" type="number" min={0} value={penaCumpridaY} onChange={(e) => setPenaCumpridaY(Number(e.target.value || 0))} placeholder="Anos" />
                      <input className="w-full rounded border bg-white px-3 py-2" type="number" min={0} value={penaCumpridaM} onChange={(e) => setPenaCumpridaM(Number(e.target.value || 0))} placeholder="Meses" />
                      <input className="w-full rounded border bg-white px-3 py-2" type="number" min={0} value={penaCumpridaD} onChange={(e) => setPenaCumpridaD(Number(e.target.value || 0))} placeholder="Dias" />
                    </div>
                    <div className="mt-1 text-xs text-zinc-600">
                      Use o valor do atestado de pena/SEEU na data-base. Esse dado viabiliza o cálculo “Pena Restante × Fração”.
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Fonte nos autos</label>
                    <input className="mt-1 w-full rounded border bg-white px-3 py-2" value={penaCumpridaFonte} onChange={(e) => setPenaCumpridaFonte(e.target.value)} placeholder="atestado/SEEU/certidão…" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error ? (
            <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mt-4 flex gap-2">
            <button
              className="ssepa-btn rounded px-3 py-2 text-sm disabled:opacity-50"
              onClick={onSave}
              disabled={saving}
              type="button"
            >
              {saving ? "Salvando…" : "Salvar"}
            </button>
            <button
              className="rounded border px-3 py-2 text-sm"
              onClick={() => {
                setEditing(false);
                setError(null);
                setExec(execNumber ?? "");
                setNome(executadoNome ?? "");
                setNasc(executadoNascimento ?? "");
                setNascFonte(executadoNascimentoSourceText ?? "");
              }}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
