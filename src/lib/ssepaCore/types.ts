export type CrimeNature = "COMUM" | "HEDIONDO" | "EQUIPARADO";
export type PenaltySpecies = "RECLUSAO" | "DETENCAO";

export type CustodyEventType =
  | "CUSTODY_START"
  | "CUSTODY_END"
  | "ESCAPE"
  | "RECAPTURE";

export type CustodyEvent = {
  at: Date;
  type: CustodyEventType;
  sourceId?: string;
};

export type CustodyInterval = {
  startAt: Date; // inclusive (UTC start of day)
  endAt: Date; // exclusive (UTC start of day)
  sourceIds?: string[];
};

export type ConvictionTitleWindow = {
  startAt: Date; // inclusive
  endAt?: Date; // exclusive; undefined = open
  kind: "PROVISORIO" | "DEFINITIVO";
  sourceId?: string;
};

export type Conviction = {
  id: string;
  processId?: string;

  nature: CrimeNature;
  species: PenaltySpecies;

  // Total da pena (em dias corridos) para fins de extinção.
  totalDays: number;

  // Janelas em que a condenação tinha título prisional ativo.
  titleWindows: ConvictionTitleWindow[];

  // Usado só para desempate (mais antigo = maior prioridade)
  firstCustodyStartAt?: Date;

  // Opcional: data do fato / referência para regras no tempo.
  factAt?: Date | null;
};

export type WaterfallPriority = {
  natureRank: number; // menor = maior prioridade
  speciesRank: number;
  remainingDaysRank: number; // maior pena primeiro
  tiebreakerAtRank: number; // mais antigo primeiro
};

export type AllocationSlice = {
  fromAt: Date;
  toAt: Date; // exclusive
  days: number;
  convictionId: string;
};

export type ReplayResult = {
  t0: Date;
  tCurrent: Date;
  custodyIntervals: CustodyInterval[];
  allocations: AllocationSlice[];
  servedDaysByConviction: Record<string, number>;
  remainingDaysByConviction: Record<string, number>;
  extinguishedAtByConviction: Record<string, Date | null>;
  totalServedDays: number;
};

export type ProgressionRequirement = {
  baseDate: Date;
  // requisito em dias (soma do remanescente * fração)
  requiredDaysTotal: number;
  requiredDaysByConviction: Record<string, number>;
  remainingDaysByConvictionAtBase: Record<string, number>;
};

export type IndultoBarrierResult = {
  totalHediondoDays: number;
  servedHediondoDays: number;
  thresholdDays: number;
  unlocked: boolean;
};
