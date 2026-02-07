import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const CreateRefSchema = z.object({
  execNumber: z.string().optional(),
  executadoNome: z.string().optional(),
  semExecucaoFormada: z.boolean().default(false),
  notes: z.string().optional(),
});

export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const u = new URL(req.url);
  const view = u.searchParams.get("view") || "active";

  const refs = await prisma.reference.findMany({
    where: {
      userId,
      status: "ACTIVE",
      ...(view === "archived" ? { archivedAt: { not: null } } : { archivedAt: null }),
    },
    orderBy:
      view === "archived"
        ? [{ archivedOrder: "asc" }, { archivedAt: "desc" }, { updatedAt: "desc" }]
        : [{ activeOrder: "asc" }, { updatedAt: "desc" }],
    take: view === "archived" ? 200 : 50,
    select: {
      id: true,
      title: true,
      execNumber: true,
      semExecucaoFormada: true,
      executadoNome: true,
      updatedAt: true,
      archivedAt: true,

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
          eventos: { select: { id: true, type: true, eventDate: true, noDetraction: true, createdAt: true }, orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }] },
          crimes: {
            where: { status: "ATIVO" },
            select: {
              id: true,
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

  // cálculo aqui para manter a Mesa sempre completa mesmo após ações client-side
  const { formatExecStatus } = await import("@/lib/executionStatus");
  const { art112Fractions } = await import("@/lib/art112");
  const { buildCoreInputsFromReference } = await import("@/lib/ssepaCore/domainAdapter");
  const { replayExecutionWaterfall } = await import("@/lib/ssepaCore/engine");

  function daysToAMD(days: number) {
    const d = Math.max(0, Math.floor(days));
    const a = Math.floor(d / 365);
    const rem = d % 365;
    const m = Math.floor(rem / 30);
    const dd = rem % 30;
    return `${a}a${m}m${dd}d`;
  }

  const rows = refs.map((r: any) => {
    let statusLabel: string | null = null;
    let statusIsRed = false;

    try {
      const regime = r.execRegime as string | null;
      const situ = r.execSituacao as string | null;
      if (regime && situ) {
        const s = formatExecStatus({
          execRegime: r.execRegime,
          execSituacao: r.execSituacao,
          execMarkerMonitorado: r.execMarkerMonitorado,
          execMarkerRecolhido: r.execMarkerRecolhido,
          execMarkerSoltoCumprindo: r.execMarkerSoltoCumprindo,
          execObservacao: r.execObservacao,
          execDestacar: r.execDestacar,
        });

        const regimeLabel = regime === "FECHADO" ? "Regime fechado" : regime === "SEMIABERTO" ? "Regime semiaberto" : "Regime aberto";
        statusIsRed = regime === "FECHADO" && (situ === "PRESO" || situ === "FORAGIDO");
        statusLabel = `${regimeLabel}: ${s.text}`;
      }
    } catch {}

    let progressPct: number | null = null;
    let progressLabel: string | null = null;
    let progressServedDays: number | null = null;
    let progressRequiredDays: number | null = null;
    let progressServedAmd: string | null = null;
    let progressRequiredAmd: string | null = null;

    try {
      const baseDate = r.baseDateProgressaoAt ? new Date(r.baseDateProgressaoAt) : null;
      const baseCumprida = typeof r.basePenaCumpridaDays === "number" ? r.basePenaCumpridaDays : null;
      if (baseDate && typeof baseCumprida === "number") {
        const processos = r.processos ?? [];
        const crimes = processos.flatMap((p: any) => p.crimes ?? []);
        const penaTotalDays = crimes.reduce((acc: number, c: any) => acc + c.penaltyYears * 365 + c.penaltyMonths * 30 + c.penaltyDays, 0);
        const penaRestante = Math.max(0, penaTotalDays - baseCumprida);

        const progEspecialVisible =
          r.reeducandoGender === "FEMININO" && ((r.reeducandaGestante as boolean) || (r.reeducandaMaeOuResponsavelCriancaOuPcd as boolean));
        const progEspecialEnabled = !!r.progEspecial112_3_enabled;
        const progEspecialAllReqs =
          !!r.progEspecial112_3_req_I_semViolencia &&
          !!r.progEspecial112_3_req_II_naoCrimeContraFilho &&
          !!r.progEspecial112_3_req_III_cumpriuUmOitavoRegAnterior &&
          !!r.progEspecial112_3_req_IV_primariaBomComport &&
          !!r.progEspecial112_3_req_V_naoOrgCrim;
        const progEspecialRevoked =
          !!(r.incidentes ?? []).some((i: any) => i.type === "HOMOLOGACAO_FALTA_GRAVE") || !!r.novoCrimeDoloso;
        const progEspecialApplies = progEspecialVisible && progEspecialEnabled && progEspecialAllReqs && !progEspecialRevoked;

        const percents = crimes
          .map((c: any) => {
            const base = art112Fractions({
              hasViolence: c.hasViolence,
              isHediondoOrEquiparado: c.nature ? c.nature !== "COMUM" : c.isHediondo,
              hasResultDeath: c.hasResultDeath,
              hasOrgCrimLead: c.hasOrgCrimLead,
              hasMilicia: c.hasMilicia,
              isFeminicidio: c.isFeminicidio ?? false,
              art112ChoiceMode: c.art112ChoiceMode ?? "AUTO",
              art112Inciso: c.art112Inciso,
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

            progressRequiredDays = reqDays;
            progressServedDays = cumpridoDesdeBase;
            progressRequiredAmd = daysToAMD(reqDays);
            progressServedAmd = daysToAMD(cumpridoDesdeBase);

            progressPct = Math.min(100, Math.max(0, (100 * cumpridoDesdeBase) / reqDays));
            progressLabel = `${Math.round(progressPct)}%`;
          }
        }
      }
    } catch (e) {
      console.error("[REFERENCIAS_PROGRESS] falha ao calcular", { referenceId: r.id, e });
    }

    return {
      id: r.id,
      title: r.title,
      execNumber: r.execNumber,
      executadoNome: r.executadoNome,
      semExecucaoFormada: r.semExecucaoFormada,
      updatedAtIso: r.updatedAt.toISOString(),
      statusLabel,
      statusIsRed,
      progressPct,
      progressLabel,
      progressServedDays,
      progressRequiredDays,
      progressServedAmd,
      progressRequiredAmd,
      archivedAtIso: r.archivedAt ? r.archivedAt.toISOString() : null,
    };
  });

  return NextResponse.json({ ok: true, rows });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = CreateRefSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const { execNumber, executadoNome, semExecucaoFormada, notes } = parsed.data;
  if (!semExecucaoFormada && (!execNumber || execNumber.trim().length < 5)) {
    return NextResponse.json({ error: "Informe o número da execução, ou marque 'Sem execução formada'." }, { status: 400 });
  }

  const exec = semExecucaoFormada ? null : execNumber!.trim();
  const nome = executadoNome?.trim() || null;

  const title = semExecucaoFormada
    ? `Sem execução formada${nome ? ` — ${nome}` : ""}`
    : `Execução Penal nº ${exec}${nome ? ` — ${nome}` : ""}`;

  const ref = await prisma.reference.create({
    data: {
      userId,
      execNumber: exec,
      executadoNome: nome,
      semExecucaoFormada,
      title,
      notes,
      activeOrder: BigInt(-Date.now()),
      archivedOrder: null,
      archivedAt: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: userId,
      targetUserId: null,
      action: "reference.create",
      metadata: { referenceId: ref.id },
      ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
      userAgent: req.headers.get("user-agent") || null,
    },
  });

  return NextResponse.json({ ok: true, id: ref.id });
}
