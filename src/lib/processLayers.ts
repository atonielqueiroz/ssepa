export type LayerTipo = "SENTENCA" | "APELACAO" | "RESP" | "RE" | "HC" | "REVISAO_CRIMINAL" | "OUTRO";
export type LayerStatus = "MANTIDA" | "ALTERADA";

export type LayerCrime = {
  law: string;
  article: string;
  description?: string;
  penaltyYears?: number;
  penaltyMonths?: number;
  penaltyDays?: number;
};

export type Layer = {
  tipo: LayerTipo;
  numero?: string;
  status: LayerStatus;
  observacao?: string;
  dataDecisao?: string; // YYYY-MM-DD (opcional)
  crimes?: LayerCrime[]; // só quando ALTERADA
};

export function layerLabel(tipo: LayerTipo) {
  switch (tipo) {
    case "SENTENCA":
      return "Sentença";
    case "APELACAO":
      return "Apelação";
    case "RESP":
      return "REsp";
    case "RE":
      return "RE";
    case "HC":
      return "HC";
    case "REVISAO_CRIMINAL":
      return "Revisão Criminal";
    default:
      return "Outro";
  }
}

export function pickVigenteCrimes(baseCrimes: LayerCrime[], layers: Layer[]) {
  // "fonte vigente": última camada ALTERADA; senão sentença
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i];
    if (l.status === "ALTERADA" && Array.isArray(l.crimes)) return l.crimes;
  }
  return baseCrimes;
}

export function penaStr(c: { penaltyYears?: number; penaltyMonths?: number; penaltyDays?: number }) {
  const y = c.penaltyYears ?? 0;
  const m = c.penaltyMonths ?? 0;
  const d = c.penaltyDays ?? 0;
  const parts: string[] = [];
  if (y) parts.push(`${y}a`);
  if (m) parts.push(`${m}m`);
  if (d) parts.push(`${d}d`);
  return parts.length ? parts.join(" ") : "—";
}
