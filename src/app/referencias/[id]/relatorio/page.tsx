import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { art112Fractions } from "@/lib/art112";
import { execObsClass, execStatusClass, formatExecStatus } from "@/lib/executionStatus";
// layout.tsx já aplica AppShell

function fmt(d: Date | null | undefined) {
  if (!d) return "—";
  const iso = d.toISOString().slice(0, 10);
  const [y, m, day] = iso.split("-");
  return `${day}/${m}/${y}`;
}

type MissingItem = { label: string; hint: string };

export default async function RelatorioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: referenceId } = await params;
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const ref = await prisma.reference.findFirst({
    where: { id: referenceId, userId, status: "ACTIVE" },
    include: {
      processos: {
        orderBy: { createdAt: "asc" },
        include: {
          eventos: { orderBy: { eventDate: "asc" } },
          crimes: { orderBy: { factDate: "asc" } },
        },
      },
      incidentes: { orderBy: [{ referenceDate: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!ref) redirect("/referencias");

  const missingCritical: MissingItem[] = [];
  if (!ref.executadoNascimento) {
    missingCritical.push({
      label: "Data de nascimento do executado",
      hint: "Sem esta data, a prescrição pode ser imprecisa (ex.: art. 115 do CP).",
    });
  }

  const processosParaCalculo = (ref.processos as any[]).filter((p) => (p as any).includeInCalculations !== false);

  // For MVP, require at least denunciation received + sentence for any prescrição calc
  const missingByProc: Record<string, MissingItem[]> = {};
  for (const p of processosParaCalculo) {
    const miss: MissingItem[] = [];
    if (!p.denunciaRecebidaAt) miss.push({ label: "Recebimento da denúncia/queixa", hint: "Marco interruptivo relevante." });
    if (!p.sentencaAt) miss.push({ label: "Sentença", hint: "Marco interruptivo relevante." });
    if (!p.transitAtProcesso && (!p.transitAtAcusacao || !p.transitAtDefesa)) {
      miss.push({
        label: "Trânsito em julgado (processo ou acusação+defesa)",
        hint: "Necessário para fechar linhas temporais com segurança.",
      });
    }
    if (miss.length) missingByProc[p.id] = miss;
  }

  const canGeneratePrescricao = missingCritical.length === 0 && Object.keys(missingByProc).length === 0;

  // ALERTAS automáticos (não bloqueiam cálculos)
  const alertas: { title: string; detail: string }[] = [];

  const hasFaltaGrave = (ref as any).incidentes?.some((i: any) => i.type === "HOMOLOGACAO_FALTA_GRAVE");
  if (hasFaltaGrave) {
    alertas.push({
      title: "ALERTA: falta grave registrada",
      detail: "Há registro de falta grave. Isso pode impactar remição, data-base e outros efeitos na execução penal.",
    });
  }

  // PROGRESSÃO ESPECIAL — ART. 112, §3º–§4º (LEP — Lei 13.769/2018)
  const progEspecialVisible =
    ref.reeducandoGender === "FEMININO" && (ref.reeducandaGestante || ref.reeducandaMaeOuResponsavelCriancaOuPcd);
  const progEspecialEnabled = !!ref.progEspecial112_3_enabled;
  const progEspecialReqs = {
    I: !!ref.progEspecial112_3_req_I_semViolencia,
    II: !!ref.progEspecial112_3_req_II_naoCrimeContraFilho,
    III: !!ref.progEspecial112_3_req_III_cumpriuUmOitavoRegAnterior,
    IV: !!ref.progEspecial112_3_req_IV_primariaBomComport,
    V: !!ref.progEspecial112_3_req_V_naoOrgCrim,
  };
  const progEspecialMissing = Object.entries(progEspecialReqs)
    .filter(([, ok]) => !ok)
    .map(([k]) => k);

  const progEspecialRevokedReasons: string[] = [];
  if (hasFaltaGrave) progEspecialRevokedReasons.push("falta grave registrada");
  if (ref.novoCrimeDoloso) progEspecialRevokedReasons.push("novo crime doloso");
  const progEspecialRevoked = progEspecialRevokedReasons.length > 0;

  const progEspecialEligible = progEspecialVisible && progEspecialEnabled && progEspecialMissing.length === 0 && !progEspecialRevoked;
  const progEspecialEffectiveFraction = progEspecialEligible ? "1/8 (12,5%)" : "regra normal";

  if (progEspecialEnabled && progEspecialVisible && progEspecialRevoked) {
    alertas.push({
      title: "ALERTA — revogação da progressão especial (art. 112, §4º, LEP)",
      detail: `${progEspecialRevokedReasons.join(" e ")}.`,
    });
  }

  // Vedação ao livramento condicional (art. 83, CP) quando a progressão enquadra em VI(a), VI-A ou VIII
  const lcVedadoCrimes: { inciso: string; motivo: string }[] = [];
  for (const p of processosParaCalculo) {
    for (const c of (p as any).crimes ?? []) {
      const base = art112Fractions({
        hasViolence: !!c.hasViolence,
        isHediondoOrEquiparado: (c as any).nature ? (c as any).nature !== "COMUM" : !!c.isHediondo,
        hasResultDeath: !!c.hasResultDeath,
        hasOrgCrimLead: !!c.hasOrgCrimLead,
        hasMilicia: !!c.hasMilicia,
        isFeminicidio: !!c.isFeminicidio,
        art112ChoiceMode: (c as any).art112ChoiceMode ?? "AUTO",
        art112Inciso: (c as any).art112Inciso ?? null,
        factDate: c.factDate,
      });

      const f = progEspecialEligible
        ? {
            primario: { ...base.primario, percent: 12.5 },
            reincidente: { ...base.reincidente, percent: 12.5 },
          }
        : base;

      const incs = [f.primario.inciso, f.reincidente.inciso];
      for (const inciso of incs) {
        if (inciso === "VI(a)" || inciso === "VI-A" || inciso === "VIII") {
          lcVedadoCrimes.push({ inciso, motivo: "impede livr. cond. (art. 83, CP)" });
        }
      }
    }
  }
  if (lcVedadoCrimes.length) {
    const uniq = Array.from(new Set(lcVedadoCrimes.map((x) => x.inciso)));
    alertas.push({
      title: "ALERTA: vedação ao livramento condicional",
      detail: `Inciso(s): ${uniq.join(", ")} — impede livr. cond. (art. 83, CP).`,
    });
  }

  // Se elegível, a fração efetiva da progressão (simulação) passa a ser 12,5% (1/8), sem bloquear.
  // (MVP: exibimos isso no relatório e na tabela; o motor completo de cálculo será evoluído.)

  function daysBetween(a: Date, b: Date) {
    const ms = b.getTime() - a.getTime();
    return Math.max(0, Math.floor(ms / 86400000));
  }

  function isCustodyStart(t: string) {
    return t.startsWith("PRISAO_") || t === "RECAPTURA";
  }

  function isCustodyEnd(t: string) {
    return t === "SOLTURA_ALVARA" || t === "LIBERDADE_SEM_CAUTELAR" || t === "LIBERDADE_COM_CAUTELAR" || t === "LIBERDADE_PROVISORIA";
  }

  function calcDetractionForProcess(eventos: any[]) {
    // MVP: soma intervalos prisão->liberdade e cautelarStart->cautelarEnd quando não marcado "noDetraction".
    let detDays = 0;
    let openCustody: Date | null = null;

    for (const e of eventos) {
      if (e.noDetraction) continue;

      if (isCustodyStart(e.type)) {
        if (!openCustody) openCustody = e.eventDate;
      }

      if (isCustodyEnd(e.type)) {
        if (openCustody) {
          detDays += daysBetween(openCustody, e.eventDate);
          openCustody = null;
        }
      }

      // cautelar: se tiver start+end, soma
      if (e.cautelarStart && e.cautelarEnd) {
        detDays += daysBetween(e.cautelarStart, e.cautelarEnd);
      }
    }

    return detDays;
  }

  return (
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">Relatório (rascunho — estilo SEEU)</h1>
            <div className="mt-1 text-sm text-zinc-600">Simulação: {ref.title}</div>
            <div className="mt-2 text-sm text-zinc-600">Status da execução:</div>
            {(() => {
              const s = formatExecStatus({
                execRegime: (ref as any).execRegime,
                execSituacao: (ref as any).execSituacao,
                execMarkerMonitorado: (ref as any).execMarkerMonitorado,
                execMarkerRecolhido: (ref as any).execMarkerRecolhido,
                execMarkerSoltoCumprindo: (ref as any).execMarkerSoltoCumprindo,
                execObservacao: (ref as any).execObservacao,
                execDestacar: (ref as any).execDestacar,
              });
              return (
                <div className="mt-2 rounded border bg-white p-2 text-sm">
                  <span className={execStatusClass(s)}>{s.text}</span>
                  {s.observacao ? (
                    <span className={"ml-2 " + execObsClass(s)}>
                      “{s.observacao}”
                    </span>
                  ) : null}
                </div>
              );
            })()}
          </div>
          <div className="flex gap-2">
            <Link className="rounded border px-3 py-2 text-sm" href={`/referencias/${referenceId}`}>
              Voltar
            </Link>
          </div>
        </div>

        {alertas.length ? (
          <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="font-medium">Alertas</div>
            <ul className="mt-2 list-disc pl-5">
              {alertas.map((a, idx) => (
                <li key={idx}>
                  <span className="font-medium">{a.title}:</span> {a.detail}
                </li>
              ))}
            </ul>
            {lcVedadoCrimes.length ? (
              <div className="mt-2 text-sm">
                <span className="font-medium">Livramento condicional:</span> vedado/não aplicável (art. 83, CP) — exibido apenas como simulação.
              </div>
            ) : null}
          </div>
        ) : null}

        {progEspecialVisible ? (
          <div className="mt-4 rounded border">
            <div className="border-b bg-zinc-50 p-3 font-medium">PROGRESSÃO ESPECIAL — ART. 112, §3º–§4º, LEP</div>
            <div className="p-3 text-sm">
              <div className="text-zinc-700">Lei 13.769/2018 — fração 1/8 (12,5%).</div>
              <div className="mt-2">
                <span className="font-medium">Aplicar (§3º):</span> {progEspecialEnabled ? "Sim" : "Não"}
              </div>

              {progEspecialEnabled ? (
                <div className="mt-2">
                  <div className="font-medium">Checklist cumulativo (§3º, I–V)</div>
                  <ul className="mt-2 list-disc pl-5">
                    <li>I — não ter cometido crime com violência ou grave ameaça: {progEspecialReqs.I ? "atendido" : "pendente"}</li>
                    <li>II — não ter cometido crime contra filho/dependente: {progEspecialReqs.II ? "atendido" : "pendente"}</li>
                    <li>III — ter cumprido ao menos 1/8 da pena no regime anterior: {progEspecialReqs.III ? "atendido" : "pendente"}</li>
                    <li>IV — ser primária e ter bom comportamento carcerário (diretor): {progEspecialReqs.IV ? "atendido" : "pendente"}</li>
                    <li>V — não ter integrado organização criminosa: {progEspecialReqs.V ? "atendido" : "pendente"}</li>
                  </ul>

                  {progEspecialRevoked ? (
                    <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-amber-900">
                      <span className="font-medium">Benefício revogado (§4º):</span> {progEspecialRevokedReasons.join(" e ")}.
                    </div>
                  ) : null}

                  <div className="mt-2">
                    <span className="font-medium">Fração efetivamente usada na simulação:</span> {progEspecialEffectiveFraction}
                  </div>

                  {(!progEspecialEligible && !progEspecialRevoked) ? (
                    <div className="mt-2 text-sm text-zinc-700">
                      Status: {progEspecialMissing.length ? `pendente de confirmação (itens: ${progEspecialMissing.join(", ")})` : "não elegível"}
                    </div>
                  ) : null}

                  {progEspecialEligible ? (
                    <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 p-2 text-emerald-900">
                      Elegível: aplicar 1/8 (12,5%) — art. 112, §3º, LEP.
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-2 text-sm text-zinc-700">Status: não aplicado.</div>
              )}
            </div>
          </div>
        ) : null}

        <div className="mt-6 rounded border">
          <div className="border-b bg-zinc-50 p-3 font-medium">Checklist de completude</div>
          <div className="p-3 text-sm">
            {canGeneratePrescricao ? (
              <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
                Dados essenciais presentes. (Cálculo completo de prescrição ainda será implementado.)
              </div>
            ) : (
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-900">
                Faltam dados essenciais para gerar um relatório de prescrição com precisão.
              </div>
            )}

            {missingCritical.length ? (
              <div className="mt-3">
                <div className="font-medium">Essenciais (Executado)</div>
                <ul className="mt-2 list-disc pl-5 text-sm text-zinc-800">
                  {missingCritical.map((m, i) => (
                    <li key={i}>
                      <span className="font-medium">{m.label}</span> — {m.hint} (preencha em “Editar” na simulação)
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {Object.keys(missingByProc).length ? (
              <div className="mt-3">
                <div className="font-medium">Essenciais (Por processo criminal)</div>
                <div className="mt-2 grid gap-2">
                  {ref.processos.map((p) => {
                    const miss = missingByProc[p.id];
                    if (!miss) return null;
                    return (
                      <div key={p.id} className="rounded border bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium">Processo {p.number}</div>
                          <Link className="rounded border px-2 py-1 text-xs" href={`/referencias/${referenceId}/processos/${p.id}`}>
                            Abrir processo
                          </Link>
                        </div>
                        <ul className="mt-2 list-disc pl-5 text-sm text-zinc-800">
                          {miss.map((m, i) => (
                            <li key={i}>
                              <span className="font-medium">{m.label}</span> — {m.hint}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 rounded border">
          <div className="border-b bg-zinc-50 p-3 font-medium">Dados do executado</div>
          <div className="p-3 text-sm">
            <div>
              <span className="font-medium">Nome:</span> {ref.executadoNome ?? "—"}
            </div>
            <div className="mt-1">
              <span className="font-medium">Data de nascimento:</span> {fmt(ref.executadoNascimento)}
            </div>
            {ref.executadoNascimentoSourceText ? (
              <div className="mt-1 text-xs text-zinc-600">
                <span className="font-medium">Fonte:</span> {ref.executadoNascimentoSourceText}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 rounded border">
          <div className="border-b bg-zinc-50 p-3 font-medium">Detração (prévia)</div>
          <div className="p-3 text-sm">
            {ref.processos.every((p) => (p as any).eventos?.length === 0) ? (
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-900">
                Nenhum evento de prisão/soltura/cautelar foi informado. O sistema considerará <span className="font-medium">detração = 0</span>, o que pode impactar o cumprimento da pena e as datas calculadas.
              </div>
            ) : (
              <div className="grid gap-2">
                {ref.processos.map((p) => {
                  const eventos = (p as any).eventos ?? [];
                  const d = calcDetractionForProcess(eventos);
                  return (
                    <div key={p.id} className="rounded border bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium">Processo {p.number}</div>
                        <Link className="rounded border px-2 py-1 text-xs" href={`/referencias/${referenceId}/processos/${p.id}/eventos`}>
                          Ver eventos
                        </Link>
                      </div>
                      <div className="mt-1 text-sm">
                        <span className="font-medium">Detração sugerida (MVP):</span> {d} dia(s)
                      </div>
                      <div className="mt-1 text-xs text-zinc-600">
                        Regra: por padrão, computa prisão e cautelares. Se o advogado marcar “Não contar/detrair” em um evento, o período é excluído.
                      </div>
                      <div className="mt-1 text-xs text-zinc-600">
                        Observação: há divergência jurisprudencial quanto à detração de cautelares (alguns juízes limitam a medidas mais restritivas; outros admitem até comparecimento).
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 rounded border">
          <div className="border-b bg-zinc-50 p-3 font-medium">Processos e marcos</div>
          <div className="p-3 text-sm">
            {ref.processos.length === 0 ? (
              <div className="text-zinc-600">Nenhum processo criminal cadastrado.</div>
            ) : (
              <div className="grid gap-3">
                {ref.processos.map((p) => {
                  const src: any = (p as any).marcosSource ?? {};
                  return (
                    <div key={p.id} className="rounded border bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium">Processo {p.number}</div>
                        <Link className="rounded border px-2 py-1 text-xs" href={`/referencias/${referenceId}/processos/${p.id}`}>
                          Abrir
                        </Link>
                      </div>
                      {p.juizoVaraCondenacao ? (
                        <div className="mt-1 text-xs text-zinc-600">Juízo/Vara: {p.juizoVaraCondenacao}</div>
                      ) : null}

                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        <div>
                          <div className="text-xs font-medium">Recebimento denúncia</div>
                          <div>{fmt(p.denunciaRecebidaAt)}</div>
                          {src.denunciaRecebidaAt ? <div className="text-xs text-zinc-600">Fonte: {src.denunciaRecebidaAt}</div> : null}
                        </div>
                        <div>
                          <div className="text-xs font-medium">Sentença</div>
                          <div>{fmt(p.sentencaAt)}</div>
                          {src.sentencaAt ? <div className="text-xs text-zinc-600">Fonte: {src.sentencaAt}</div> : null}
                        </div>
                        <div>
                          <div className="text-xs font-medium">Acórdão</div>
                          <div>{fmt(p.acordaoAt)}</div>
                          {src.acordaoAt ? <div className="text-xs text-zinc-600">Fonte: {src.acordaoAt}</div> : null}
                        </div>
                        <div>
                          <div className="text-xs font-medium">REsp</div>
                          <div>{fmt(p.respAt)}</div>
                          {src.respAt ? <div className="text-xs text-zinc-600">Fonte: {src.respAt}</div> : null}
                        </div>
                        <div>
                          <div className="text-xs font-medium">RE</div>
                          <div>{fmt(p.reAt)}</div>
                          {src.reAt ? <div className="text-xs text-zinc-600">Fonte: {src.reAt}</div> : null}
                        </div>
                        <div>
                          <div className="text-xs font-medium">Trânsito (processo)</div>
                          <div>{fmt(p.transitAtProcesso)}</div>
                          {src.transitAtProcesso ? <div className="text-xs text-zinc-600">Fonte: {src.transitAtProcesso}</div> : null}
                        </div>
                        <div>
                          <div className="text-xs font-medium">Trânsito (acusação/MP)</div>
                          <div>{fmt(p.transitAtAcusacao)}</div>
                          {src.transitAtAcusacao ? <div className="text-xs text-zinc-600">Fonte: {src.transitAtAcusacao}</div> : null}
                        </div>
                        <div>
                          <div className="text-xs font-medium">Trânsito (defesa)</div>
                          <div>{fmt(p.transitAtDefesa)}</div>
                          {src.transitAtDefesa ? <div className="text-xs text-zinc-600">Fonte: {src.transitAtDefesa}</div> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 text-xs text-zinc-600">
          Observação: este relatório ainda é um rascunho (MVP). A etapa seguinte será calcular prescrição (CP) e anexar justificativas “lei no tempo”.
        </div>
      </div>
  );
}
