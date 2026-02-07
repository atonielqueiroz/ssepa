import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { AppShell } from "@/app/components/AppShell";
import { ReferenceTabs } from "./ReferenceTabs";
import { ReferenceHeader } from "./ReferenceHeader";
import { StickyNotes } from "@/app/components/StickyNotes";
import { ProgressaoBar } from "./ProgressaoBar";
import { buildCoreInputsFromReference } from "@/lib/ssepaCore/domainAdapter";
import { replayExecutionWaterfall } from "@/lib/ssepaCore/engine";

export default async function ReferenceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const ref = await prisma.reference.findFirst({
    where: { id, userId, status: "ACTIVE" },
    include: {
      incidentes: { select: { type: true } },
    },
  });
  if (!ref) redirect("/referencias");

  const [processos, incidentes, eventos, lastPrison, lastFalta, processosComCrimes] = await Promise.all([
    prisma.processoCriminal.count({ where: { referenceId: id } }),
    prisma.incidente.count({ where: { referenceId: id } }),
    prisma.processoEvento.count({ where: { processo: { referenceId: id } } }),
    prisma.processoEvento.findFirst({
      where: {
        processo: { referenceId: id },
        type: {
          in: ["PRISAO_FLAGRANTE", "PRISAO_PREVENTIVA", "PRISAO_TEMPORARIA", "RECAPTURA"],
        },
      },
      orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
      select: { eventDate: true, type: true },
    }),
    prisma.incidente.findFirst({
      where: { referenceId: id, type: "HOMOLOGACAO_FALTA_GRAVE" },
      orderBy: [{ referenceDate: "desc" }, { createdAt: "desc" }],
      select: { referenceDate: true },
    }),
    prisma.processoCriminal.findMany({
      where: { referenceId: id, includeInCalculations: { not: false } },
      select: {
        id: true,
        includeInCalculations: true,
        eventos: {
          select: { id: true, type: true, eventDate: true, noDetraction: true },
          orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }],
        },
        crimes: {
          where: { status: "ATIVO" },
          select: {
            id: true,
            law: true,
            article: true,
            description: true,
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
            equiparadoType: true,
            art112ChoiceMode: true,
            art112Inciso: true,
          },
        },
      },
    }),
  ]);

  let baseDateSuggestionAt: Date | null = null;
  let baseDateSuggestionWhy: string | null = null;
  if (lastPrison?.eventDate && (!lastFalta?.referenceDate || lastPrison.eventDate >= lastFalta.referenceDate)) {
    baseDateSuggestionAt = lastPrison.eventDate;
    baseDateSuggestionWhy = "Sugestão: última prisão/recaptura";
  } else if (lastFalta?.referenceDate) {
    baseDateSuggestionAt = lastFalta.referenceDate;
    baseDateSuggestionWhy = "Sugestão: última falta grave";
  }

  const progEspecialVisible =
    ref.reeducandoGender === "FEMININO" &&
    (!!ref.reeducandaGestante || !!ref.reeducandaMaeOuResponsavelCriancaOuPcd);
  const progEspecialEnabled = !!ref.progEspecial112_3_enabled;
  const progEspecialAllReqs =
    !!ref.progEspecial112_3_req_I_semViolencia &&
    !!ref.progEspecial112_3_req_II_naoCrimeContraFilho &&
    !!ref.progEspecial112_3_req_III_cumpriuUmOitavoRegAnterior &&
    !!ref.progEspecial112_3_req_IV_primariaBomComport &&
    !!ref.progEspecial112_3_req_V_naoOrgCrim;
  const progEspecialRevoked = !!ref.incidentes.some((i) => i.type === "HOMOLOGACAO_FALTA_GRAVE") || !!ref.novoCrimeDoloso;
  const progEspecialApplies = progEspecialVisible && progEspecialEnabled && progEspecialAllReqs && !progEspecialRevoked;

  const crimesFlat = processosComCrimes.flatMap((p) => p.crimes);
  const penaTotalDays = crimesFlat.reduce((acc, c) => acc + c.penaltyYears * 365 + c.penaltyMonths * 30 + c.penaltyDays, 0);

  const isArchived = !!ref.archivedAt;
  const archivedStyle: CSSProperties | undefined = isArchived
    ? ({
        color: "#717873",
        borderColor: "#717873",
        ["--ssepa-border" as any]: "#717873",
        ["--ssepa-accent" as any]: "#717873",
      } as CSSProperties)
    : undefined;

  // SSEPA Core (stateless replay): calcula pena cumprida na data-base via cascata (Art. 76 CP).
  const coreBaseDate = ref.baseDateProgressaoAt ? new Date(ref.baseDateProgressaoAt) : null;
  const coreComputedPenaCumpridaBaseDays = (() => {
    if (!coreBaseDate) return null;
    try {
      const { custodyIntervals, convictions } = buildCoreInputsFromReference({ processos: processosComCrimes as any });
      const replay = replayExecutionWaterfall({ custodyIntervals, convictions, tCurrent: coreBaseDate });
      return replay.totalServedDays;
    } catch {
      return null;
    }
  })();

  const coreComputedCumpridoDesdeBaseDays = (() => {
    if (!coreBaseDate || typeof coreComputedPenaCumpridaBaseDays !== "number") return null;
    try {
      const { custodyIntervals, convictions } = buildCoreInputsFromReference({ processos: processosComCrimes as any });
      const replayNow = replayExecutionWaterfall({ custodyIntervals, convictions, tCurrent: new Date() });
      return Math.max(0, replayNow.totalServedDays - coreComputedPenaCumpridaBaseDays);
    } catch {
      return null;
    }
  })();

  return (
    <AppShell>
      <div className="grid gap-4" style={archivedStyle}>
        <ReferenceHeader
          referenceId={ref.id}
          execNumber={ref.execNumber}
          executadoNome={ref.executadoNome}
          reviewStatus={((ref as any).source as any)?.reviewStatus ?? null}
          executadoNascimento={ref.executadoNascimento ? ref.executadoNascimento.toISOString().slice(0, 10) : null}
          executadoNascimentoSourceText={ref.executadoNascimentoSourceText ?? null}
          title={ref.title}
          reeducandoGender={ref.reeducandoGender}
          reeducandaGestante={ref.reeducandaGestante}
          reeducandaMaeOuResponsavelCriancaOuPcd={ref.reeducandaMaeOuResponsavelCriancaOuPcd}
          novoCrimeDoloso={ref.novoCrimeDoloso}
          hasFaltaGrave={ref.incidentes.some((i) => i.type === "HOMOLOGACAO_FALTA_GRAVE")}
          execRegime={ref.execRegime}
          execSituacao={ref.execSituacao}
          execMarkerMonitorado={ref.execMarkerMonitorado}
          execMarkerRecolhido={ref.execMarkerRecolhido}
          execMarkerSoltoCumprindo={ref.execMarkerSoltoCumprindo}
          execObservacao={ref.execObservacao}
          execDestacar={ref.execDestacar}
          baseDateProgressaoAt={ref.baseDateProgressaoAt ? ref.baseDateProgressaoAt.toISOString().slice(0, 10) : null}
          baseDateProgressaoSourceText={ref.baseDateProgressaoSourceText ?? null}
          baseDateSuggestionAt={baseDateSuggestionAt ? baseDateSuggestionAt.toISOString().slice(0, 10) : null}
          baseDateSuggestionWhy={baseDateSuggestionWhy}
          basePenaCumpridaDays={(ref as any).basePenaCumpridaDays ?? coreComputedPenaCumpridaBaseDays ?? null}
          basePenaCumpridaSourceText={(ref as any).basePenaCumpridaSourceText ?? null}
          archivedAtIso={ref.archivedAt ? ref.archivedAt.toISOString() : null}
          progressWidget={
            <div className="w-full max-w-[520px]">
              <ProgressaoBar
                baseDateISO={ref.baseDateProgressaoAt ? ref.baseDateProgressaoAt.toISOString().slice(0, 10) : null}
                penaTotalDays={penaTotalDays}
                penaCumpridaBaseDays={(ref as any).basePenaCumpridaDays ?? coreComputedPenaCumpridaBaseDays ?? null}
                cumpridoDesdeBaseDays={coreComputedCumpridoDesdeBaseDays}
                progEspecialApplies={progEspecialApplies}
                crimes={crimesFlat.map((c) => ({
                  id: c.id,
                  penaltyDaysTotal: c.penaltyYears * 365 + c.penaltyMonths * 30 + c.penaltyDays,
                  label: `${c.law} ${c.article}${c.description ? ` (${c.description})` : ""}`,
                  factDateISO: c.factDate ? c.factDate.toISOString().slice(0, 10) : null,
                  hasViolence: c.hasViolence,
                  isHediondoOrEquiparado: (c as any).nature ? (c as any).nature !== "COMUM" : c.isHediondo,
                  hasResultDeath: c.hasResultDeath,
                  hasOrgCrimLead: c.hasOrgCrimLead,
                  hasMilicia: c.hasMilicia,
                  isFeminicidio: (c as any).isFeminicidio ?? false,
                  art112ChoiceMode: (c as any).art112ChoiceMode ?? "AUTO",
                  art112Inciso: (c as any).art112Inciso,
                }))}
              />
            </div>
          }
        />

        <StickyNotes entityType="SIMULACAO" entityId={ref.id} />

        <ReferenceTabs referenceId={id} counts={{ processos, eventos, incidentes }} />
      </div>

      <div className="mt-4">{children}</div>
    </AppShell>
  );
}
