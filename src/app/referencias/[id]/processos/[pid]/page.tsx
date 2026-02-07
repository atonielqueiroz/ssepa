import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
// layout.tsx já aplica AppShell
import { art112Fractions } from "@/lib/art112";
import { CrimeRowActions } from "./CrimeRowActions";
import { explainNature } from "@/lib/crimeExplain";
import { ProcessoMarcosEditor } from "./ProcessoMarcosEditor";
import { SentenceInfoEditor } from "./SentenceInfoEditor";
import { TransitoInfoEditor } from "./TransitoInfoEditor";
import { EXECUCAO_PROVISORIA_JUSTIFICATIVA, hasCondenacaoDefinitiva, hasCustodyOrCautelar } from "@/lib/execucaoProvisoria";
// (status da execução exibido apenas na Execução/Simulação)

export default async function ProcessoPage({
  params,
}: {
  params: Promise<{ id: string; pid: string }>;
}) {
  const { id: referenceId, pid } = await params;
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const proc = await prisma.processoCriminal.findFirst({
    where: {
      id: pid,
      referenceId,
      reference: { userId, status: "ACTIVE" },
    },
    include: {
      reference: {
        select: {
          execNumber: true,
          executadoNome: true,
          reeducandoGender: true,
          reeducandaGestante: true,
          reeducandaMaeOuResponsavelCriancaOuPcd: true,
          novoCrimeDoloso: true,
          progEspecial112_3_enabled: true,
          progEspecial112_3_req_I_semViolencia: true,
          progEspecial112_3_req_II_naoCrimeContraFilho: true,
          progEspecial112_3_req_III_cumpriuUmOitavoRegAnterior: true,
          progEspecial112_3_req_IV_primariaBomComport: true,
          progEspecial112_3_req_V_naoOrgCrim: true,
          incidentes: { select: { type: true } },
        },
      },
      crimes: { orderBy: { factDate: "asc" } },
      eventos: { orderBy: { eventDate: "asc" }, select: { type: true, eventDate: true, cautelarTypes: true } },
    },
  });

  if (!proc) return notFound();

  const hasTransit = hasCondenacaoDefinitiva(proc as any);
  const restricted = hasCustodyOrCautelar(proc as any);
  const showExecProvAlert = restricted && !hasTransit;

  const totalDays = proc.crimes.reduce((acc, c) => acc + c.penaltyYears * 365 + c.penaltyMonths * 30 + c.penaltyDays, 0);

  const progEspecialVisible =
    proc.reference.reeducandoGender === "FEMININO" &&
    (proc.reference.reeducandaGestante || proc.reference.reeducandaMaeOuResponsavelCriancaOuPcd);
  const progEspecialEnabled = !!proc.reference.progEspecial112_3_enabled;
  const progEspecialAllReqs =
    !!proc.reference.progEspecial112_3_req_I_semViolencia &&
    !!proc.reference.progEspecial112_3_req_II_naoCrimeContraFilho &&
    !!proc.reference.progEspecial112_3_req_III_cumpriuUmOitavoRegAnterior &&
    !!proc.reference.progEspecial112_3_req_IV_primariaBomComport &&
    !!proc.reference.progEspecial112_3_req_V_naoOrgCrim;
  const hasFaltaGrave = (proc.reference as any).incidentes?.some((i: any) => i.type === "HOMOLOGACAO_FALTA_GRAVE");
  const progEspecialRevoked = !!hasFaltaGrave || !!proc.reference.novoCrimeDoloso;
  const progEspecialApplies = progEspecialVisible && progEspecialEnabled && progEspecialAllReqs && !progEspecialRevoked;

  // Avoid hydration mismatches by formatting dates deterministically (UTC)
  function formatDateBR(d: Date) {
    const iso = d.toISOString().slice(0, 10); // YYYY-MM-DD
    const [y, m, day] = iso.split("-");
    return `${day}/${m}/${y}`;
  }

  return (
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">Processo Criminal nº {proc.number}</h1>
            <div className="mt-1 text-sm text-zinc-600">
              Vinculado à Execução {proc.reference.execNumber ?? "(sem número)"}
              {proc.reference.executadoNome ? ` — ${proc.reference.executadoNome}` : ""}
            </div>
            {showExecProvAlert ? (
              <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="font-medium">Preso sem condenação definitiva (execução provisória).</div>
                <div className="mt-2 text-xs" title={EXECUCAO_PROVISORIA_JUSTIFICATIVA}>
                  Confirme e registre o trânsito em julgado (data + fonte) nos marcos do processo.
                </div>
              </div>
            ) : null}

            {proc.notes ? (
              <div className="mt-2 whitespace-pre-wrap text-xs text-zinc-600">{proc.notes}</div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="rounded border px-3 py-2 text-sm" href={`/referencias/${referenceId}`}>
              Voltar
            </Link>
            <Link className="rounded border px-3 py-2 text-sm" href={`/referencias/${referenceId}/processos/${pid}/eventos`}>
              Eventos (prisão/soltura)
            </Link>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="font-medium">Informações gerais</div>
            <Link className="ssepa-btn rounded px-3 py-2 text-sm" href={`/referencias/${referenceId}/processos/${pid}/crimes/novo`}>
              Cadastrar crimes
            </Link>
          </div>

          <div className="mt-3 text-sm">
            <SentenceInfoEditor processoId={pid} />
            {(() => {
              const naoSei = !!(proc as any).fatosBaseNaoSei;
              if (!naoSei) return null;
              return (
                <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                  Atenção: sem a data dos fatos, o SSEPA terá limitações. Isso pode dificultar a análise de direitos e impedir o auxílio do sistema no enquadramento dos percentuais para progressão de regime e livramento condicional.
                </div>
              );
            })()}

            {proc.crimes.length === 0 ? (
              <div className="text-zinc-600">Nenhum crime cadastrado ainda.</div>
            ) : (
              <>
                <div className="mt-3 h-px w-full bg-[var(--ssepa-border)]/60" />
                <details className="ssepa-tree rounded">
                <summary className="cursor-pointer select-none px-1 py-2 text-sm font-medium flex items-center gap-2 pl-[18px]">
                  <span className="ssepa-tree-toggle" aria-hidden="true" />
                  <span className="ssepa-tree-label">
                    {(() => {
                      const totalDays = proc.crimes.reduce((acc, c) => acc + c.penaltyYears * 365 + c.penaltyMonths * 30 + c.penaltyDays, 0);
                      const y = Math.floor(totalDays / 365);
                      const m = Math.floor((totalDays % 365) / 30);
                      const d = totalDays % 30;
                      return `📂 Tipificação e penas — Pena total: ${y}a${m}m${d}d`;
                    })()}
                  </span>
                </summary>

                <div className="mt-2 pl-4 divide-y divide-[var(--ssepa-border)]/60">
                  <div className="grid gap-0">
                    {proc.crimes.map((c) => {
                      const base = art112Fractions({
                        hasViolence: c.hasViolence,
                        isHediondoOrEquiparado: (c as any).nature ? (c as any).nature !== "COMUM" : c.isHediondo,
                        hasResultDeath: c.hasResultDeath,
                        hasOrgCrimLead: c.hasOrgCrimLead,
                        hasMilicia: c.hasMilicia,
                        isFeminicidio: (c as any).isFeminicidio ?? false,
                        art112ChoiceMode: (c as any).art112ChoiceMode ?? "AUTO",
                        art112Inciso: (c as any).art112Inciso,
                        factDate: (c.factDate ?? ((proc as any).fatosBaseAt ?? undefined)) as any,
                      });

                      const f = progEspecialApplies
                        ? {
                            primario: { ...base.primario, percent: 12.5, summary: "art. 112, §3º, LEP (Lei 13.769/2018)" },
                            reincidente: { ...base.reincidente, percent: 12.5, summary: "art. 112, §3º, LEP (Lei 13.769/2018)" },
                          }
                        : base;

                      const natureInfo = explainNature((c as any).nature, (c as any).equiparadoType);
                      const pena = `${c.penaltyYears}a${c.penaltyMonths}m${c.penaltyDays}d`;

                      return (
                        <details key={c.id} className="py-2">
                          <summary className="cursor-pointer select-none px-1 py-2 text-sm flex items-center justify-between gap-3 pl-[18px]">
                            <span className="ssepa-tree-toggle" aria-hidden="true" />
                            <span className="min-w-0 ssepa-tree-label">
                              <span className="font-medium">🪶</span> <span className="font-semibold">{pena}</span> — {c.law} · {c.article}
                              {c.description ? <span className="text-zinc-700"> ({c.description})</span> : null}
                            </span>
                            <a className="shrink-0 text-sm text-zinc-700 hover:underline" href={`/referencias/${referenceId}/processos/${pid}/crimes/${c.id}/editar`}>
                              Editar
                            </a>
                          </summary>

                          <div className="mt-2 px-1 pb-2 text-sm">
                            {(() => {
                              const base = (proc as any).fatosBaseAt as Date | null | undefined;
                              const eff = (c.factDate ?? base) as Date | null | undefined;
                              if (!eff) return <div className="text-xs text-zinc-600">Data do fato: —</div>;
                              if (base && c.factDate && c.factDate.getTime() === base.getTime()) {
                                // não duplica (igual ao dado-base do processo)
                                return null;
                              }
                              return <div className="text-xs text-zinc-600">Data do fato: {formatDateBR(eff)}</div>;
                            })()}

                            <div className="mt-2 text-xs text-zinc-700">
                              <div>
                                <span className="font-medium">Natureza:</span>{" "}
                                {(() => {
                                  const isHed = natureInfo.label.toLowerCase().includes("hediondo") || natureInfo.label.toLowerCase().includes("equiparado");
                                  return (
                                    <span className={isHed ? "font-semibold text-red-700/80" : ""}>{natureInfo.label}</span>
                                  );
                                })()}
                              </div>
                              <div className="text-zinc-600">
                                <span className="font-medium">Base:</span> {natureInfo.bases.join(" · ")}
                              </div>
                            </div>

                            <div className="mt-2 text-xs text-zinc-700">
                              {(() => {
                                const reincStatus = ((proc as any).reincidenciaStatus as string | null | undefined) ?? null;
                                const isReinc = reincStatus === "REINCIDENTE";
                                const choice = isReinc ? f.reincidente : f.primario;
                                const label = isReinc ? "Reincidente" : "Primário";
                                return (
                                  <div>
                                    <span className="font-medium">Art. 112:</span> {choice.percent}% (inc. {choice.inciso})
                                    <span className="ml-2 text-zinc-600">({label})</span>
                                    {progEspecialApplies ? <span className="ml-2 font-medium text-emerald-700">§3º — 1/8</span> : null}
                                  </div>
                                );
                              })()}
                            </div>

                          </div>
                        </details>
                      );
                    })}
                  </div>
                </div>
              </details>
              </>
            )}

            <div className="mt-3 text-xs text-zinc-600">
              Art. 112: sugestão/seleção. Se houver ambiguidade nos autos, edite o crime e escolha manualmente o inciso/percentual. Regras completas/teses (e.g. reincidência específica, marcos temporais) serão tratadas no motor de regras.
            </div>

          </div>
        </div>

        <div id="editar" className="mt-4">
          <ProcessoMarcosEditor
            processoId={pid}
            baseCrimes={proc.crimes.map((c) => ({
              law: c.law,
              article: c.article,
              description: c.description,
              penaltyYears: c.penaltyYears,
              penaltyMonths: c.penaltyMonths,
              penaltyDays: c.penaltyDays,
            }))}
          />
        </div>

        <div className="mt-4 rounded border">
          <div className="border-b bg-zinc-50 p-3 font-medium">Informações sobre o Trânsito em Julgado</div>
          <div className="p-3 text-sm">
            <TransitoInfoEditor processoId={pid} />
          </div>
        </div>
      </div>
  );
}
