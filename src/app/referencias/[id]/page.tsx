import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { EXECUCAO_PROVISORIA_JUSTIFICATIVA, hasCondenacaoDefinitiva, hasCustodyOrCautelar } from "@/lib/execucaoProvisoria";
import { layerLabel, penaStr } from "@/lib/processLayers";
import { ConsiderarNosCalculosToggle } from "./ConsiderarNosCalculosToggle";
import { GuidanceTriggerLink } from "@/app/components/GuidanceTriggerLink";
import { art112Fractions } from "@/lib/art112";

function addDaysUTC(date: Date, days: number) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function formatDateBR(isoDate: string) {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

export default async function ReferencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const ref = await prisma.reference.findFirst({
    where: { id, userId, status: "ACTIVE" },
    include: {
      incidentes: { select: { type: true } },
      processos: {
        orderBy: { createdAt: "asc" },
        include: {
          eventos: { orderBy: { eventDate: "asc" }, select: { type: true, eventDate: true, cautelarTypes: true } },
          crimes: { orderBy: { factDate: "asc" } },
          decisions: { orderBy: { decisionDate: "asc" }, select: { id: true, type: true, decisionDate: true, source: true } },
        },
      },
    },
  });
  if (!ref) return notFound();

  const baseDateISO = (ref as any).baseDateProgressaoAt ? (ref as any).baseDateProgressaoAt.toISOString().slice(0, 10) : null;
  const baseCumpridaDays: number | null = typeof (ref as any).basePenaCumpridaDays === "number" ? (ref as any).basePenaCumpridaDays : null;

  const processosParaCalculo = (ref.processos ?? []).filter((p: any) => (p as any).includeInCalculations !== false);
  const crimesParaCalculo = processosParaCalculo.flatMap((p: any) => p.crimes ?? []);
  const totalPenaltyDays = crimesParaCalculo.reduce((acc: number, c: any) => acc + c.penaltyYears * 365 + c.penaltyMonths * 30 + c.penaltyDays, 0);

  const baseRemainingDays = Math.max(0, totalPenaltyDays - (baseCumpridaDays ?? 0));

  const progEspecialVisible =
    (ref as any).reeducandoGender === "FEMININO" &&
    (((ref as any).reeducandaGestante as boolean) || ((ref as any).reeducandaMaeOuResponsavelCriancaOuPcd as boolean));
  const progEspecialEnabled = !!(ref as any).progEspecial112_3_enabled;
  const progEspecialAllReqs =
    !!(ref as any).progEspecial112_3_req_I_semViolencia &&
    !!(ref as any).progEspecial112_3_req_II_naoCrimeContraFilho &&
    !!(ref as any).progEspecial112_3_req_III_cumpriuUmOitavoRegAnterior &&
    !!(ref as any).progEspecial112_3_req_IV_primariaBomComport &&
    !!(ref as any).progEspecial112_3_req_V_naoOrgCrim;
  const hasFaltaGrave = (ref as any).incidentes?.some((i: any) => i.type === "HOMOLOGACAO_FALTA_GRAVE");
  const progEspecialRevoked = !!hasFaltaGrave || !!(ref as any).novoCrimeDoloso;
  const progEspecialApplies = progEspecialVisible && progEspecialEnabled && progEspecialAllReqs && !progEspecialRevoked;

  const crimeFractions = crimesParaCalculo.map((c: any) => {
    const base = art112Fractions({
      hasViolence: c.hasViolence,
      isHediondoOrEquiparado: (c as any).nature ? (c as any).nature !== "COMUM" : c.isHediondo,
      hasResultDeath: c.hasResultDeath,
      hasOrgCrimLead: c.hasOrgCrimLead,
      hasMilicia: c.hasMilicia,
      isFeminicidio: (c as any).isFeminicidio ?? false,
      art112ChoiceMode: (c as any).art112ChoiceMode ?? "AUTO",
      art112Inciso: (c as any).art112Inciso,
      factDate: c.factDate,
    });

    const f = progEspecialApplies
      ? {
          primario: { ...base.primario, percent: 12.5, summary: "art. 112, §3º, LEP (Lei 13.769/2018)", inciso: "§3º" as any },
          reincidente: { ...base.reincidente, percent: 12.5, summary: "art. 112, §3º, LEP (Lei 13.769/2018)", inciso: "§3º" as any },
        }
      : base;

    const penaDays = c.penaltyYears * 365 + c.penaltyMonths * 30 + c.penaltyDays;

    return {
      id: c.id as string,
      artigo: `Art. ${c.article}`,
      descricao: c.description as string | null,
      penaDays,
      primario: f.primario,
      reincidente: f.reincidente,
    };
  });

  const maxPrimario = crimeFractions.reduce((acc: any, x: any) => (x.primario.percent > acc.percent ? x.primario : acc), { percent: 0, inciso: "" });
  const maxReinc = crimeFractions.reduce((acc: any, x: any) => (x.reincidente.percent > acc.percent ? x.reincidente : acc), { percent: 0, inciso: "" });

  const detPrimarioCrimes = crimeFractions.filter((x: any) => x.primario.percent === maxPrimario.percent).map((x: any) => `${x.artigo}${x.descricao ? ` (${x.descricao})` : ""}`);
  const detReincCrimes = crimeFractions.filter((x: any) => x.reincidente.percent === maxReinc.percent).map((x: any) => `${x.artigo}${x.descricao ? ` (${x.descricao})` : ""}`);

  const reqPrimarioDays = maxPrimario.percent ? Math.ceil(baseRemainingDays * (maxPrimario.percent / 100)) : null;
  const reqReincDays = maxReinc.percent ? Math.ceil(baseRemainingDays * (maxReinc.percent / 100)) : null;

  const baseDateObj = baseDateISO ? new Date(`${baseDateISO}T00:00:00.000Z`) : null;
  const alvoPrimarioISO = baseDateObj && typeof reqPrimarioDays === "number" ? addDaysUTC(baseDateObj, reqPrimarioDays).toISOString().slice(0, 10) : null;
  const alvoReincISO = baseDateObj && typeof reqReincDays === "number" ? addDaysUTC(baseDateObj, reqReincDays).toISOString().slice(0, 10) : null;

  const todayISO = new Date().toISOString().slice(0, 10);
  const todayObj = new Date(`${todayISO}T00:00:00.000Z`);
  function progressPct(targetISO: string | null) {
    if (!baseDateObj || !targetISO) return 0;
    const targetObj = new Date(`${targetISO}T00:00:00.000Z`);
    const total = Math.max(1, Math.round((targetObj.getTime() - baseDateObj.getTime()) / 86400000));
    const done = Math.max(0, Math.round((todayObj.getTime() - baseDateObj.getTime()) / 86400000));
    return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
  }

  const pctPrim = progressPct(alvoPrimarioISO);
  const pctReinc = progressPct(alvoReincISO);

  return (
    <div>
      {ref.notes ? <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{ref.notes}</p> : null}


      <div className="mt-6 text-sm">
        <div className="flex justify-end">
          {/* Incidentes são da Execução/Simulação: usar a aba "Incidentes" */}
          {/* Relatório é da Execução/Simulação: usar a aba "Relatório" */}
          <GuidanceTriggerLink className="ssepa-btn rounded px-3 py-2 text-sm" href={`/referencias/${ref.id}/processos/novo`}>
            Cadastrar
          </GuidanceTriggerLink>
        </div>
        <div className="mt-3 h-px w-full bg-[var(--ssepa-border)]/60" />

        <div className="mt-3">
          {ref.processos.length === 0 ? (
            <div className="text-zinc-600">Nenhum processo cadastrado.</div>
          ) : (
            <div className="divide-y divide-[var(--ssepa-border)]/60">
              {ref.processos.map((p) => {
                const hasTransit = hasCondenacaoDefinitiva(p as any);
                const restricted = hasCustodyOrCautelar(p as any);
                const showAlert = restricted && !hasTransit;

                const camadas = (p.decisions ?? [])
                  .filter((d: any) => d.type !== "SENTENCA")
                  .map((d: any) => {
                    const src: any = (d.source as any) ?? {};
                    const status = (src.layerStatus as string) === "ALTERADA" ? "ALTERADA" : "MANTIDA";
                    const numero = (src.layerNumero as string) ?? "";
                    const obs = (src.layerObs as string) ?? "";
                    const crimes = Array.isArray(src.layerCrimes) ? src.layerCrimes : [];
                    return { type: d.type as string, status, numero, obs, crimes };
                  });

                return (
                  <details key={p.id} className="ssepa-tree py-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-1 pl-[18px]">
                      <span className="ssepa-tree-toggle" aria-hidden="true" />
                      <div className="min-w-0 font-medium ssepa-tree-label">
                        🗂 Processo Criminal nº{" "}
                        <Link href={`/referencias/${ref.id}/processos/${p.id}`} className="hover:underline">
                          {p.number}
                        </Link>
                      </div>
                      <div className="flex items-center gap-3">
                        <ConsiderarNosCalculosToggle processoId={p.id} initial={(p as any).includeInCalculations !== false} />
                        <Link className="rounded border px-2 py-1 text-xs" href={`/referencias/${ref.id}/processos/${p.id}#editar`}>
                          Editar
                        </Link>
                      </div>
                    </summary>

                    <div className="mt-2 pl-4">
                      {showAlert ? (
                        <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                          <div className="font-medium">Preso sem condenação definitiva (execução provisória).</div>
                          <div className="mt-1 text-[11px] text-amber-900/90" title={EXECUCAO_PROVISORIA_JUSTIFICATIVA}>
                            Confirme e registre o trânsito em julgado (data + fonte).
                          </div>
                          <div className="mt-2">
                            <Link className="rounded border border-amber-300 bg-white px-2 py-1 text-[11px]" href={`/referencias/${ref.id}/processos/${p.id}#editar`}>
                              Registrar trânsito (data + fonte)
                            </Link>
                          </div>
                        </div>
                      ) : null}

                      {(() => {
                        const baseCrimes = p.crimes ?? [];
                        const baseTotalDays = baseCrimes.reduce((acc: number, c: any) => acc + c.penaltyYears * 365 + c.penaltyMonths * 30 + c.penaltyDays, 0);
                        const baseY = Math.floor(baseTotalDays / 365);
                        const baseM = Math.floor((baseTotalDays % 365) / 30);
                        const baseD = baseTotalDays % 30;
                        const baseTotalLabel = `${baseY}a${baseM}m${baseD}d`;

                        const camadasAll = camadas;
                        const lastCamada = camadasAll.length ? camadasAll[camadasAll.length - 1] : null;
                        const activeKey = lastCamada ? `LAYER_${camadasAll.length - 1}` : 'SENTENCA';

                        function crimesTotalLabel(crs: any[]) {
                          const totalDays = (crs ?? []).reduce((acc: number, c: any) => acc + (c.penaltyYears ?? 0) * 365 + (c.penaltyMonths ?? 0) * 30 + (c.penaltyDays ?? 0), 0);
                          const y = Math.floor(totalDays / 365);
                          const m = Math.floor((totalDays % 365) / 30);
                          const d = totalDays % 30;
                          return `${y}a${m}m${d}d`;
                        }

                        return (
                          <div className="mt-2">
                            <div className="ssepa-tree relative pl-2">
                              <div className="absolute left-2 top-0 bottom-0 w-px bg-[var(--ssepa-border)]/60" />

                              <div className="grid gap-2">
                                <div className="relative pl-6">
                                  <div className="absolute left-2 top-3 h-px w-4 bg-[var(--ssepa-border)]/60" />
                                  <details className="py-2" open={!camadasAll.length}>
                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-1 text-sm font-medium text-zinc-700 pl-[18px]">
                                      <span className="ssepa-tree-toggle" aria-hidden="true" />
                                      <span className="min-w-0 ssepa-tree-label">📂 Sentença / Condenação originária — Pena total: {baseTotalLabel}</span>
                                      {activeKey === 'SENTENCA' ? <span className="shrink-0 text-[11px] font-semibold text-emerald-700">ATIVA</span> : null}
                                    </summary>
                                    <div className="mt-2 pl-4 text-sm">
                                      {baseCrimes.length === 0 ? (
                                        <div className="text-zinc-600">Nenhum crime cadastrado na sentença.</div>
                                      ) : (
                                        <ul className="list-disc pl-5">
                                          {baseCrimes.map((c) => (
                                            <li key={c.id} className="py-0.5">
                                              <span className="font-medium">
                                                🪶<span className="font-semibold">{penaStr(c).replace(/\s+/g, "")}</span> - Art. {c.article} ({c.law})
                                              </span>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  </details>
                                </div>

                                {camadasAll.length ? (
                                  <div className="grid gap-2">
                                    {camadasAll.map((c, idx) => {
                                      const tipo =
                                        c.type === "APELACAO"
                                          ? "APELACAO"
                                          : c.type === "RESP"
                                            ? "RESP"
                                            : c.type === "RE"
                                              ? "RE"
                                              : c.type === "HC"
                                                ? "HC"
                                                : c.type === "REVISAO_CRIMINAL"
                                                  ? "REVISAO_CRIMINAL"
                                                  : "OUTRO";

                                      const title = `📂 ${layerLabel(tipo as any)}${c.numero ? ` ${c.numero}` : ""}`;
                                      const layerCrimes = Array.isArray(c.crimes) && c.crimes.length ? c.crimes : baseCrimes;
                                      const totalLabel = crimesTotalLabel(layerCrimes as any);
                                      const isActive = activeKey === `LAYER_${idx}`;

                                      return (
                                        <div key={idx} className="relative pl-6">
                                          <div className="absolute left-2 top-3 h-px w-4 bg-[var(--ssepa-border)]/60" />
                                          <details className="py-2">
                                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-1 text-sm font-medium text-zinc-700 pl-[18px]">
                                              <span className="ssepa-tree-toggle" aria-hidden="true" />
                                              <span className="min-w-0 ssepa-tree-label">{title} — Pena total: {totalLabel}</span>
                                              {isActive ? <span className="shrink-0 text-[11px] font-semibold text-emerald-700">ATIVA</span> : null}
                                            </summary>
                                            <div className="mt-2 pl-4 text-sm">
                                              {c.obs ? <div className="text-xs text-zinc-600">Nota: {c.obs}</div> : null}
                                              {Array.isArray(layerCrimes) && layerCrimes.length ? (
                                                <ul className="mt-2 list-disc pl-5">
                                                  {layerCrimes.map((cr: any, j: number) => (
                                                    <li key={j} className="py-0.5">
                                                      <span className="font-medium">
                                                        🪶<span className="font-semibold">{penaStr(cr).replace(/\s+/g, "")}</span> - Art. {cr.article} ({cr.law})
                                                      </span>
                                                    </li>
                                                  ))}
                                                </ul>
                                              ) : (
                                                <div className="mt-2 text-xs text-zinc-600">Nenhum crime/pena registrado nesta camada.</div>
                                              )}
                                            </div>
                                          </details>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="mt-3 flex gap-2">
                        <Link className="rounded border px-2 py-1 text-xs" href={`/referencias/${ref.id}/processos/${p.id}`}>
                          Abrir
                        </Link>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
