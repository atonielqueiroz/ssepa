import { buildCustodyIntervals } from "./custody";
import { toUtcStartOfDay } from "./dateMath";
import type { Conviction, CustodyEvent, CustodyInterval } from "./types";

type ProcessoLike = {
  id: string;
  includeInCalculations?: boolean;
  crimes: Array<{
    id: string;
    transitDate: Date;
    penaltyYears: number;
    penaltyMonths: number;
    penaltyDays: number;
    nature?: "COMUM" | "HEDIONDO" | "EQUIPARADO";
    isHediondo?: boolean;
    law: string;
    article: string;
    factDate?: Date | null;
  }>;
  eventos: Array<{
    id: string;
    type:
      | "PRISAO_FLAGRANTE"
      | "PRISAO_PREVENTIVA"
      | "PRISAO_TEMPORARIA"
      | "PRISAO_TJ_INICIO_CUMPRIMENTO"
      | "SOLTURA_ALVARA"
      | "LIBERDADE_SEM_CAUTELAR"
      | "LIBERDADE_COM_CAUTELAR"
      | "LIBERDADE_PROVISORIA"
      | "DECISAO_CESSA_CUSTODIA"
      | "FUGA"
      | "RECAPTURA"
      | string;
    eventDate: Date;
    noDetraction?: boolean;
  }>;
};

function penaltyToDays(y: number, m: number, d: number) {
  // Convenção SEEU-like: 365 dias/ano, 30 dias/mês.
  return Math.max(0, y * 365 + m * 30 + d);
}

function inferSpecies(_crime: { law: string; article: string }) {
  // MVP: não temos campo explícito. Mantemos RECLUSÃO como default.
  // (Pode ser refinado por tabela de tipos penais depois.)
  return "RECLUSAO" as const;
}

export function buildCoreInputsFromReference(params: {
  processos: ProcessoLike[];
}): {
  custodyEvents: CustodyEvent[];
  custodyIntervals: CustodyInterval[];
  convictions: Conviction[];
} {
  const processos = params.processos.filter((p) => p.includeInCalculations !== false);

  const custodyEvents: CustodyEvent[] = [];

  for (const p of processos) {
    for (const e of p.eventos) {
      if (e.noDetraction) continue;
      const t = e.type;
      if (t === "PRISAO_FLAGRANTE" || t === "PRISAO_PREVENTIVA" || t === "PRISAO_TEMPORARIA" || t === "PRISAO_TJ_INICIO_CUMPRIMENTO") {
        custodyEvents.push({ at: e.eventDate, type: "CUSTODY_START", sourceId: e.id });
      } else if (
        t === "SOLTURA_ALVARA" ||
        t === "LIBERDADE_SEM_CAUTELAR" ||
        t === "LIBERDADE_COM_CAUTELAR" ||
        t === "LIBERDADE_PROVISORIA" ||
        t === "DECISAO_CESSA_CUSTODIA"
      ) {
        custodyEvents.push({ at: e.eventDate, type: "CUSTODY_END", sourceId: e.id });
      } else if (t === "FUGA") {
        custodyEvents.push({ at: e.eventDate, type: "ESCAPE", sourceId: e.id });
      } else if (t === "RECAPTURA") {
        custodyEvents.push({ at: e.eventDate, type: "RECAPTURE", sourceId: e.id });
      }
    }
  }

  const custodyIntervals = buildCustodyIntervals(custodyEvents);

  // Para título provisório, usamos o primeiro marco de custódia do processo.
  const firstCustodyStartByProcess: Record<string, Date | null> = {};
  for (const p of processos) {
    const starts = p.eventos
      .filter((e) =>
        ["PRISAO_FLAGRANTE", "PRISAO_PREVENTIVA", "PRISAO_TEMPORARIA", "PRISAO_TJ_INICIO_CUMPRIMENTO", "RECAPTURA"].includes(e.type)
      )
      .map((e) => toUtcStartOfDay(e.eventDate))
      .sort((a, b) => a.getTime() - b.getTime());
    firstCustodyStartByProcess[p.id] = starts[0] ?? null;
  }

  const convictions: Conviction[] = [];
  for (const p of processos) {
    for (const c of p.crimes) {
      const nature = c.nature ?? (c.isHediondo ? "HEDIONDO" : "COMUM");
      const transit = toUtcStartOfDay(c.transitDate);
      const firstCustody = firstCustodyStartByProcess[p.id];

      const titleWindows: Conviction["titleWindows"] = [];
      if (firstCustody && firstCustody.getTime() < transit.getTime()) {
        titleWindows.push({ startAt: firstCustody, endAt: transit, kind: "PROVISORIO" });
      }
      titleWindows.push({ startAt: transit, kind: "DEFINITIVO" });

      convictions.push({
        id: c.id,
        processId: p.id,
        nature,
        species: inferSpecies(c),
        totalDays: penaltyToDays(c.penaltyYears, c.penaltyMonths, c.penaltyDays),
        titleWindows,
        firstCustodyStartAt: firstCustody ?? undefined,
        factAt: c.factDate ?? null,
      });
    }
  }

  return { custodyEvents, custodyIntervals, convictions };
}
