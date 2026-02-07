import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { AppShell } from "@/app/components/AppShell";
import { StickyNotes } from "@/app/components/StickyNotes";
import { GuidanceBanner } from "@/app/components/GuidanceBanner";
import ReferenciasClient, { type ReferenceRow } from "@/app/referencias/ReferenciasClient";
import { execObsClass, formatExecStatus } from "@/lib/executionStatus";
import { art112Fractions } from "@/lib/art112";
import { buildCoreInputsFromReference } from "@/lib/ssepaCore/domainAdapter";
import { replayExecutionWaterfall } from "@/lib/ssepaCore/engine";

export default async function ReferenciasPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, profileCompleted: true } });
  if (!user?.profileCompleted) redirect("/completar-cadastro");

  // inicial: recentes (não arquivadas)
  const refs = await prisma.reference.findMany({
    where: { userId, status: "ACTIVE", archivedAt: null },
    orderBy: [{ activeOrder: "asc" }, { updatedAt: "desc" }],
    take: 50,
    select: {
      id: true,
      updatedAt: true,
      archivedAt: true,
      semExecucaoFormada: true,
      title: true,
      execNumber: true,
      executadoNome: true,
      execRegime: true,
      execSituacao: true,
      execMarkerMonitorado: true,
      execMarkerRecolhido: true,
      execMarkerSoltoCumprindo: true,
      execObservacao: true,
      execDestacar: true,

      baseDateProgressaoAt: true,
      basePenaCumpridaDays: true,

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
      processos: {
        where: { includeInCalculations: { not: false } },
        select: {
          id: true,
          includeInCalculations: true,
          eventos: { select: { id: true, type: true, eventDate: true, noDetraction: true }, orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }] },
          crimes: {
            where: { status: "ATIVO" },
            select: {
              id: true,
              law: true,
              article: true,
              factDate: true,
              transitDate: true,
              penaltyYears: true,
              penaltyMonths: true,
              penaltyDays: true,
              hasViolence: true,
              isHediondo: true,
              hasResultDeath: true,
              hasOrgCrimLead: true,
              hasMilicia: true,
              isFeminicidio: true,
              nature: true,
              art112ChoiceMode: true,
              art112Inciso: true,
            },
          },
        },
      },
    },
  });

  const rows: ReferenceRow[] = refs.map((r) => {
    let statusLabel: string | null = null;
    try {
      const regime = (r as any).execRegime as string | null;
      const situ = (r as any).execSituacao as string | null;
      if (regime && situ) {
        const s = formatExecStatus({
          execRegime: (r as any).execRegime,
          execSituacao: (r as any).execSituacao,
          execMarkerMonitorado: (r as any).execMarkerMonitorado,
          execMarkerRecolhido: (r as any).execMarkerRecolhido,
          execMarkerSoltoCumprindo: (r as any).execMarkerSoltoCumprindo,
          execObservacao: (r as any).execObservacao,
          execDestacar: (r as any).execDestacar,
        });
        statusLabel = s.text;
      }
    } catch {}

    let progressPct: number | null = null;
    let progressLabel: string | null = null;

    try {
      const baseDate = (r as any).baseDateProgressaoAt ? new Date((r as any).baseDateProgressaoAt) : null;
      const baseCumprida = typeof (r as any).basePenaCumpridaDays === "number" ? (r as any).basePenaCumpridaDays : null;
      if (baseDate && typeof baseCumprida === "number") {
        const processos = (r as any).processos ?? [];
        const crimes = processos.flatMap((p: any) => p.crimes ?? []);
        const penaTotalDays = crimes.reduce((acc: number, c: any) => acc + c.penaltyYears * 365 + c.penaltyMonths * 30 + c.penaltyDays, 0);
        const penaRestante = Math.max(0, penaTotalDays - baseCumprida);

        const progEspecialVisible =
          (r as any).reeducandoGender === "FEMININO" &&
          (((r as any).reeducandaGestante as boolean) || ((r as any).reeducandaMaeOuResponsavelCriancaOuPcd as boolean));
        const progEspecialEnabled = !!(r as any).progEspecial112_3_enabled;
        const progEspecialAllReqs =
          !!(r as any).progEspecial112_3_req_I_semViolencia &&
          !!(r as any).progEspecial112_3_req_II_naoCrimeContraFilho &&
          !!(r as any).progEspecial112_3_req_III_cumpriuUmOitavoRegAnterior &&
          !!(r as any).progEspecial112_3_req_IV_primariaBomComport &&
          !!(r as any).progEspecial112_3_req_V_naoOrgCrim;
        const progEspecialRevoked =
          !!((r as any).incidentes ?? []).some((i: any) => i.type === "HOMOLOGACAO_FALTA_GRAVE") || !!(r as any).novoCrimeDoloso;
        const progEspecialApplies = progEspecialVisible && progEspecialEnabled && progEspecialAllReqs && !progEspecialRevoked;

        const percents = crimes
          .map((c: any) => {
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
            return progEspecialApplies ? 12.5 : base.primario.percent;
          })
          .filter((p: any) => typeof p === "number" && p > 0);

        const controllingPercent = percents.length ? Math.max(...percents) : null;
        if (controllingPercent) {
          const reqDays = Math.ceil((penaRestante * controllingPercent) / 100);
          if (reqDays) {
            const { custodyIntervals, convictions } = buildCoreInputsFromReference({ processos });
            const replayBase = replayExecutionWaterfall({ custodyIntervals, convictions, tCurrent: baseDate });
            const replayNow = replayExecutionWaterfall({ custodyIntervals, convictions, tCurrent: new Date() });
            const cumpridoDesdeBase = Math.max(0, replayNow.totalServedDays - replayBase.totalServedDays);
            progressPct = Math.min(100, Math.max(0, (100 * cumpridoDesdeBase) / reqDays));
            progressLabel = `${Math.round(progressPct)}%`;
          }
        }
      }
    } catch {}

    return {
      id: r.id,
      title: r.title,
      execNumber: r.execNumber ?? null,
      executadoNome: r.executadoNome ?? null,
      semExecucaoFormada: r.semExecucaoFormada,
      updatedAtIso: r.updatedAt.toISOString(),
      statusLabel,
      progressPct,
      progressLabel,
      archivedAtIso: r.archivedAt ? r.archivedAt.toISOString() : null,
    };
  });

  return (
    <AppShell userName={user?.name ?? undefined}>
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Mesa de Execuções do Advogado</h1>
        </div>

        <GuidanceBanner />

        <div className="mt-3">
          <StickyNotes entityType="SIMULACOES_LIST" entityId={userId} />
        </div>

        <ReferenciasClient initialRows={rows} />
      </div>
    </AppShell>
  );
}
