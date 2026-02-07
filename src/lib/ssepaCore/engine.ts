import { addDaysUtc, diffDaysUtc, toUtcStartOfDay } from "./dateMath";
import { mergeIntervals } from "./custody";
import type {
  AllocationSlice,
  Conviction,
  CustodyInterval,
  IndultoBarrierResult,
  ProgressionRequirement,
  ReplayResult,
  WaterfallPriority,
} from "./types";

function priorityOf(c: Conviction, remainingDays: number, tiebreakerAt: Date): WaterfallPriority {
  const natureRank = c.nature === "COMUM" ? 1 : 0; // HEDIONDO/EQUIPARADO primeiro
  const speciesRank = c.species === "RECLUSAO" ? 0 : 1;
  const remainingDaysRank = -remainingDays; // maior primeiro
  const tiebreakerAtRank = tiebreakerAt.getTime();
  return { natureRank, speciesRank, remainingDaysRank, tiebreakerAtRank };
}

function comparePriority(a: WaterfallPriority, b: WaterfallPriority) {
  if (a.natureRank !== b.natureRank) return a.natureRank - b.natureRank;
  if (a.speciesRank !== b.speciesRank) return a.speciesRank - b.speciesRank;
  if (a.remainingDaysRank !== b.remainingDaysRank) return a.remainingDaysRank - b.remainingDaysRank;
  return a.tiebreakerAtRank - b.tiebreakerAtRank;
}

function isTitleActiveAt(c: Conviction, at: Date) {
  const t = at.getTime();
  return c.titleWindows.some((w) => {
    const s = toUtcStartOfDay(w.startAt).getTime();
    const e = w.endAt ? toUtcStartOfDay(w.endAt).getTime() : Infinity;
    return t >= s && t < e;
  });
}

function firstTitleStartAt(c: Conviction) {
  const min = c.titleWindows
    .map((w) => toUtcStartOfDay(w.startAt).getTime())
    .sort((a, b) => a - b)[0];
  return new Date(min ?? 0);
}

function cutIntervalsToCurrent(intervals: CustodyInterval[], tCurrent: Date) {
  const cur = toUtcStartOfDay(tCurrent);
  const out: CustodyInterval[] = [];
  for (const i of intervals) {
    const s = toUtcStartOfDay(i.startAt);
    const e = toUtcStartOfDay(i.endAt);
    if (e.getTime() <= s.getTime()) continue;
    if (s.getTime() >= cur.getTime()) continue;
    out.push({ startAt: s, endAt: e.getTime() > cur.getTime() ? cur : e, sourceIds: i.sourceIds });
  }
  return mergeIntervals(out);
}

// Stateless replay com cascata (Art. 76 CP) para extinção.
export function replayExecutionWaterfall(params: {
  custodyIntervals: CustodyInterval[];
  convictions: Conviction[];
  tCurrent?: Date;
}): ReplayResult {
  const tCurrent = toUtcStartOfDay(params.tCurrent ?? new Date());
  const custodyIntervals = cutIntervalsToCurrent(params.custodyIntervals, tCurrent);
  if (!custodyIntervals.length) {
    return {
      t0: tCurrent,
      tCurrent,
      custodyIntervals,
      allocations: [],
      servedDaysByConviction: Object.fromEntries(params.convictions.map((c) => [c.id, 0])),
      remainingDaysByConviction: Object.fromEntries(params.convictions.map((c) => [c.id, c.totalDays])),
      extinguishedAtByConviction: Object.fromEntries(params.convictions.map((c) => [c.id, null])),
      totalServedDays: 0,
    };
  }

  const t0 = custodyIntervals[0].startAt;
  const served: Record<string, number> = Object.fromEntries(params.convictions.map((c) => [c.id, 0]));
  const remaining: Record<string, number> = Object.fromEntries(params.convictions.map((c) => [c.id, c.totalDays]));
  const extinguishedAt: Record<string, Date | null> = Object.fromEntries(params.convictions.map((c) => [c.id, null]));
  const allocations: AllocationSlice[] = [];

  // Processa intervalo por intervalo (dias corridos, [start,end) em UTC).
  for (const interval of custodyIntervals) {
    let cursor = interval.startAt;
    const end = interval.endAt;

    while (cursor.getTime() < end.getTime()) {
      const active = params.convictions.filter((c) => isTitleActiveAt(c, cursor) && remaining[c.id] > 0);
      if (!active.length) {
        // Sem pool ativo: tempo preso sem título (ou faltam dados). Ignora para abate.
        cursor = end;
        break;
      }

      // monta fila de prioridade
      const sorted = [...active].sort((ca, cb) => {
        const ta = ca.firstCustodyStartAt ?? firstTitleStartAt(ca);
        const tb = cb.firstCustodyStartAt ?? firstTitleStartAt(cb);
        const pa = priorityOf(ca, remaining[ca.id], ta);
        const pb = priorityOf(cb, remaining[cb.id], tb);
        return comparePriority(pa, pb);
      });

      const top = sorted[0];
      const topRemaining = remaining[top.id];

      // quanto tempo contínuo podemos alocar ao topo antes de algo mudar?
      // 1) fim do intervalo
      const daysToIntervalEnd = diffDaysUtc(cursor, end);

      // 2) fim da janela de título do topo (se existir)
      const titleEndTimes = top.titleWindows
        .map((w) => ({ s: toUtcStartOfDay(w.startAt).getTime(), e: w.endAt ? toUtcStartOfDay(w.endAt).getTime() : Infinity }))
        .filter((w) => cursor.getTime() >= w.s && cursor.getTime() < w.e)
        .map((w) => w.e)
        .sort((a, b) => a - b);
      const nextTitleEndAt = titleEndTimes[0] === Infinity ? null : new Date(titleEndTimes[0]);
      const daysToTitleEnd = nextTitleEndAt ? diffDaysUtc(cursor, nextTitleEndAt) : daysToIntervalEnd;

      // 3) extinção do topo
      const daysToExtinguish = topRemaining;

      const allocDays = Math.max(0, Math.min(daysToIntervalEnd, daysToTitleEnd, daysToExtinguish));
      if (allocDays <= 0) {
        // segurança contra loops
        cursor = addDaysUtc(cursor, 1);
        continue;
      }

      const toAt = addDaysUtc(cursor, allocDays);
      allocations.push({ fromAt: cursor, toAt, days: allocDays, convictionId: top.id });
      served[top.id] += allocDays;
      remaining[top.id] -= allocDays;
      if (remaining[top.id] === 0 && !extinguishedAt[top.id]) {
        extinguishedAt[top.id] = toAt;
      }
      cursor = toAt;

      // Se extinguiu no meio do intervalo, o loop continua e o saldo vai para o próximo da fila.
    }
  }

  const totalServedDays = Object.values(served).reduce((a, b) => a + b, 0);

  return {
    t0,
    tCurrent,
    custodyIntervals,
    allocations,
    servedDaysByConviction: served,
    remainingDaysByConviction: remaining,
    extinguishedAtByConviction: extinguishedAt,
    totalServedDays,
  };
}

// Progressão: (remanescente na data-base) * fração, somando (Art. 111 LEP) com individualização.
export function computeProgressionRequirement(params: {
  baseDate: Date;
  custodyIntervals: CustodyInterval[];
  convictions: Conviction[];
  fractionByConvictionId: Record<string, number>; // ex.: 0.16, 0.4, 0.6
}): ProgressionRequirement {
  const baseDate = toUtcStartOfDay(params.baseDate);

  const replay = replayExecutionWaterfall({
    custodyIntervals: params.custodyIntervals,
    convictions: params.convictions,
    tCurrent: baseDate,
  });

  const remainingAtBase: Record<string, number> = { ...replay.remainingDaysByConviction };
  const requiredBy: Record<string, number> = {};
  let total = 0;

  for (const c of params.convictions) {
    const frac = params.fractionByConvictionId[c.id];
    if (typeof frac !== "number" || !isFinite(frac) || frac < 0) continue;
    const req = Math.ceil((remainingAtBase[c.id] ?? c.totalDays) * frac);
    requiredBy[c.id] = req;
    total += req;
  }

  return {
    baseDate,
    requiredDaysTotal: total,
    requiredDaysByConviction: requiredBy,
    remainingDaysByConvictionAtBase: remainingAtBase,
  };
}

export function checkIndultoBarrier(params: {
  convictions: Conviction[];
  replayResult: ReplayResult;
  fracaoImpedimento: number; // ex.: 0.66
}): IndultoBarrierResult {
  const totalHediondoDays = params.convictions
    .filter((c) => c.nature !== "COMUM")
    .reduce((sum, c) => sum + c.totalDays, 0);

  const servedHediondoDays = params.convictions
    .filter((c) => c.nature !== "COMUM")
    .reduce((sum, c) => sum + (params.replayResult.servedDaysByConviction[c.id] ?? 0), 0);

  const thresholdDays = Math.ceil(totalHediondoDays * params.fracaoImpedimento);
  const unlocked = servedHediondoDays >= thresholdDays;

  return { totalHediondoDays, servedHediondoDays, thresholdDays, unlocked };
}
