import { toUtcStartOfDay } from "./dateMath";
import type { CustodyEvent, CustodyInterval } from "./types";

// Constrói uma linha do tempo global de custódia a partir de eventos (já consolidados).
// Regras:
// - Considera pares start/end (start abre custódia; end fecha custódia).
// - ESCAPE fecha custódia; RECAPTURE abre.
// - Eventos redundantes são tolerados.
export function buildCustodyIntervals(events: CustodyEvent[]): CustodyInterval[] {
  const sorted = [...events]
    .map((e) => ({ ...e, at: toUtcStartOfDay(e.at) }))
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const intervals: CustodyInterval[] = [];
  let openStart: Date | null = null;
  let openSources: string[] = [];

  function open(at: Date, sourceId?: string) {
    if (openStart) return; // já aberto
    openStart = at;
    openSources = [];
    if (sourceId) openSources.push(sourceId);
  }

  function close(at: Date, sourceId?: string) {
    if (!openStart) return;
    if (sourceId) openSources.push(sourceId);
    if (at.getTime() > openStart.getTime()) {
      intervals.push({ startAt: openStart, endAt: at, sourceIds: openSources.length ? openSources : undefined });
    }
    openStart = null;
    openSources = [];
  }

  for (const e of sorted) {
    if (e.type === "CUSTODY_START" || e.type === "RECAPTURE") open(e.at, e.sourceId);
    else if (e.type === "CUSTODY_END" || e.type === "ESCAPE") close(e.at, e.sourceId);
  }

  // Intervalo aberto não é fechado automaticamente: engine deve receber tCurrent e cortar.
  return mergeIntervals(intervals);
}

export function mergeIntervals(intervals: CustodyInterval[]): CustodyInterval[] {
  const sorted = [...intervals].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const out: CustodyInterval[] = [];

  for (const cur of sorted) {
    const last = out[out.length - 1];
    if (!last) {
      out.push(cur);
      continue;
    }
    // Se encostam ou sobrepõem, mescla.
    if (cur.startAt.getTime() <= last.endAt.getTime()) {
      const endAt = cur.endAt.getTime() > last.endAt.getTime() ? cur.endAt : last.endAt;
      const sourceIds = [...(last.sourceIds ?? []), ...(cur.sourceIds ?? [])];
      out[out.length - 1] = {
        startAt: last.startAt,
        endAt,
        sourceIds: sourceIds.length ? Array.from(new Set(sourceIds)) : undefined,
      };
    } else {
      out.push(cur);
    }
  }

  return out;
}
