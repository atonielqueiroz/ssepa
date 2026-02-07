export type Art112Inciso =
  | "I"
  | "II"
  | "III"
  | "IV"
  | "V"
  | "VI(a)"
  | "VI(b)"
  | "VI(c)"
  | "VI-A"
  | "VII"
  | "VIII";

export type Art112Option = {
  inciso: Art112Inciso;
  label: string;
  percent: number;
  // Marca visual (ex.: veda LC)
  flags?: {
    vedaLivramentoCondicional?: boolean;
  };
};

export type Art112Result = {
  percent: number;
  inciso: Art112Inciso;
  label: string;
  summary?: string;
  basis?: {
    lepArt112: string;
    notes?: string;
  };
};

export type Crime112Inputs = {
  hasViolence: boolean;
  isHediondoOrEquiparado: boolean;
  hasResultDeath: boolean;
  hasOrgCrimLead: boolean;
  hasMilicia: boolean;
  isFeminicidio?: boolean;

  // pré-anticrime: reincidência específica em hediondo/equiparado (Lei 8.072/90, art. 2º, §2º)
  hasPriorHediondoConviction?: boolean;

  // override
  art112ChoiceMode?: "AUTO" | "MANUAL";
  art112Inciso?: string | null;

  factDate?: Date;
};

/**
 * Lista (pós Lei 13.964/2019) com todos os incisos do art. 112 (LEP).
 * Observação: o motor versionado será expandido (marcos temporais, exceções, teses).
 */
export const ART112_OPTIONS_POST_ANTICRIME: Art112Option[] = [
  { inciso: "I", percent: 16, label: "Primário / sem violência ou grave ameaça" },
  { inciso: "II", percent: 20, label: "Reincidente / sem violência ou grave ameaça" },
  { inciso: "III", percent: 25, label: "Primário / com violência ou grave ameaça" },
  { inciso: "IV", percent: 30, label: "Reincidente / com violência ou grave ameaça" },
  { inciso: "V", percent: 40, label: "Primário / hediondo ou equiparado" },
  { inciso: "VI(a)", percent: 50, label: "Primário / hediondo ou equiparado com resultado morte", flags: { vedaLivramentoCondicional: true } },
  { inciso: "VI(b)", percent: 50, label: "Comando de organização criminosa para prática de hediondo ou equiparado" },
  { inciso: "VI(c)", percent: 50, label: "Constituição de milícia privada" },
  { inciso: "VI-A", percent: 55, label: "Primário / feminicídio", flags: { vedaLivramentoCondicional: true } },
  { inciso: "VII", percent: 60, label: "Reincidente / hediondo ou equiparado" },
  { inciso: "VIII", percent: 70, label: "Reincidente / hediondo ou equiparado com resultado morte", flags: { vedaLivramentoCondicional: true } },
];

export const PACOTE_ANTICRIME_EFFECTIVE = new Date("2020-01-23T00:00:00.000Z");

function isPostAnticrime(factDate?: Date) {
  // Quando não há data, assumimos cenário "pós" (mais atual), mas o ideal é sempre informar a data do fato.
  if (!factDate) return true;
  return factDate.getTime() >= PACOTE_ANTICRIME_EFFECTIVE.getTime();
}

function parseInciso(v?: string | null): Art112Inciso | null {
  if (!v) return null;
  const raw = String(v).trim();
  const up = raw.toUpperCase();
  const allowed = ["I", "II", "III", "IV", "V", "VI(A)", "VI(B)", "VI(C)", "VI-A", "VII", "VIII"];
  if (!allowed.includes(up)) return null;

  // normalize parentheses casing: VI(a)
  if (up === "VI(A)") return "VI(a)";
  if (up === "VI(B)") return "VI(b)";
  if (up === "VI(C)") return "VI(c)";
  if (up === "VI-A") return "VI-A";
  return up as Art112Inciso;
}

export function listArt112Options(_factDate?: Date): Art112Option[] {
  return ART112_OPTIONS_POST_ANTICRIME;
}

export function isVedadoLivramentoCondicional(inciso: Art112Inciso) {
  return inciso === "VI(a)" || inciso === "VI-A" || inciso === "VIII";
}

/**
 * Escolha automática (MVP) com explicação curta.
 */
function autoPickIncisos(inputs: Crime112Inputs): { prim: Art112Inciso; reinc: Art112Inciso } {
  const primSemViol = "I" as const;
  const reincSemViol = "II" as const;
  const primViol = "III" as const;
  const reincViol = "IV" as const;

  if (inputs.isHediondoOrEquiparado) {
    const prim = inputs.isFeminicidio ? ("VI-A" as const) : ("V" as const);
    const reinc = "VII" as const;

    if (inputs.hasResultDeath) {
      return { prim: "VI(a)", reinc: "VIII" };
    }

    if (inputs.hasOrgCrimLead) {
      return { prim: "VI(b)", reinc: "VI(b)" };
    }

    if (inputs.hasMilicia) {
      return { prim: "VI(c)", reinc: "VI(c)" };
    }

    return { prim, reinc };
  }

  if (inputs.hasViolence) return { prim: primViol, reinc: reincViol };
  return { prim: primSemViol, reinc: reincSemViol };
}

/**
 * Motor simplificado do art. 112 (LEP), com suporte a override.
 *
 * IMPORTANTE:
 * - isto não substitui análise jurídica completa (reincidência específica, concurso, unificação, teses, marcos temporais etc.).
 * - a data (factDate) aqui está sendo usada como proxy para "lei no tempo" (MVP); poderemos refinar depois.
 */
export function art112Fractions(inputs: Crime112Inputs): { primario: Art112Result; reincidente: Art112Result } {
  const post = isPostAnticrime(inputs.factDate);

  const manualInciso = inputs.art112ChoiceMode === "MANUAL" ? parseInciso(inputs.art112Inciso) : null;

  // --- REGRA PRÉ-PACOTE ANTICRIME (até 22/01/2020) ---
  // a) Crime comum: 1/6 (LEP art. 112, redação Lei 10.792/2003)
  // b) Hediondo/equiparado: 2/5 (primário em hediondo) ou 3/5 (reincidente específico em hediondo)
  //    com fundamento no art. 2º, §2º, Lei 8.072/90 (Lei 11.464/2007).
  if (!post && !manualInciso) {
    if (inputs.isHediondoOrEquiparado) {
      const isEspecifica = !!inputs.hasPriorHediondoConviction;
      const notes = isEspecifica
        ? "Sugestão (pré-23/01/2020): 3/5 por reincidência específica em hediondo/equiparado."
        : "Sugestão (pré-23/01/2020): 2/5 como primário em hediondo/equiparado.";

      return {
        primario: {
          percent: 40,
          inciso: "V",
          label: "2/5 (pré-23/01/2020) — primário em hediondo/equiparado",
          summary: notes,
          basis: { lepArt112: "Lei 8.072/1990, art. 2º, §2º (Lei 11.464/2007)", notes },
        },
        reincidente: {
          percent: isEspecifica ? 60 : 40,
          inciso: isEspecifica ? "VII" : "V",
          label: isEspecifica
            ? "3/5 (pré-23/01/2020) — reincidência específica em hediondo/equiparado"
            : "2/5 (pré-23/01/2020) — sem reincidência específica",
          summary: notes,
          basis: { lepArt112: "Lei 8.072/1990, art. 2º, §2º (Lei 11.464/2007)", notes },
        },
      };
    }

    const notes = "Sugestão (pré-23/01/2020): 1/6 (LEP art. 112, redação Lei 10.792/2003).";
    return {
      primario: {
        percent: 16,
        inciso: "I",
        label: "1/6 (pré-23/01/2020)",
        summary: notes,
        basis: { lepArt112: "LEP art. 112 (Lei 10.792/2003)", notes },
      },
      reincidente: {
        percent: 16,
        inciso: "I",
        label: "1/6 (pré-23/01/2020)",
        summary: notes,
        basis: { lepArt112: "LEP art. 112 (Lei 10.792/2003)", notes },
      },
    };
  }

  // --- PÓS-PACOTE ANTICRIME (a partir de 23/01/2020) ou escolha manual ---
  if (manualInciso) {
    const opt = ART112_OPTIONS_POST_ANTICRIME.find((o) => o.inciso === manualInciso);
    const percent = opt?.percent ?? 0;
    const label = opt?.label ?? "Seleção manual";
    const notes = "Fração escolhida manualmente pelo usuário (ambiguidade/obscuridade nos autos).";
    return {
      primario: { percent, inciso: manualInciso, label, summary: notes, basis: { lepArt112: "LEP, art. 112", notes } },
      reincidente: { percent, inciso: manualInciso, label, summary: notes, basis: { lepArt112: "LEP, art. 112", notes } },
    };
  }

  const picked = autoPickIncisos(inputs);
  const primOpt = ART112_OPTIONS_POST_ANTICRIME.find((o) => o.inciso === picked.prim);
  const reincOpt = ART112_OPTIONS_POST_ANTICRIME.find((o) => o.inciso === picked.reinc);

  const notes = "Fração sugerida automaticamente (pós-Pacote Anticrime, MVP).";

  return {
    primario: {
      percent: primOpt?.percent ?? 0,
      inciso: picked.prim,
      label: primOpt?.label ?? "Sugestão",
      summary: notes,
      basis: { lepArt112: "LEP, art. 112", notes },
    },
    reincidente: {
      percent: reincOpt?.percent ?? 0,
      inciso: picked.reinc,
      label: reincOpt?.label ?? "Sugestão",
      summary: notes,
      basis: { lepArt112: "LEP, art. 112", notes },
    },
  };
}
