export type ExecRegime = "FECHADO" | "SEMIABERTO" | "ABERTO";
export type ExecSituacao =
  | "PRESO"
  | "FORAGIDO"
  | "SUSPENSA_AGUARDANDO_CAPTURA"
  | "CUMPRINDO"
  | "AGUARDANDO_INICIO"
  | "OUTRO";

export type ExecStatusInput = {
  execRegime: ExecRegime | null | undefined;
  execSituacao: ExecSituacao | null | undefined;
  execMarkerMonitorado?: boolean | null;
  execMarkerRecolhido?: boolean | null;
  execMarkerSoltoCumprindo?: boolean | null;
  execObservacao?: string | null;
  execDestacar?: boolean | null;
};

export function formatExecStatus(i: ExecStatusInput): {
  text: string;
  observacao: string | null;
  isRed: boolean;
  destacarObs: boolean;
} {
  const regime = i.execRegime ?? null;
  const situ = i.execSituacao ?? null;
  const obs = (i.execObservacao ?? "").trim() || null;
  const destacarObs = !!i.execDestacar;

  if (!regime || !situ) {
    return { text: "—", observacao: obs, isRed: false, destacarObs };
  }

  let text = "";
  let isRed = false;

  if (regime === "FECHADO") {
    if (situ === "PRESO") {
      text = "PRESO";
      isRed = true;
    } else if (situ === "FORAGIDO") {
      text = "FORAGIDO";
      isRed = true;
    } else if (situ === "SUSPENSA_AGUARDANDO_CAPTURA") {
      text = "Suspensa, aguardando captura";
    } else if (situ === "OUTRO") {
      text = "Outro";
    } else {
      text = "Outro";
    }
  }

  if (regime === "SEMIABERTO") {
    if (situ === "AGUARDANDO_INICIO") {
      text = "Aguardando início";
    } else if (situ === "OUTRO") {
      text = "Outro";
    } else {
      const parts: string[] = [];
      if (i.execMarkerMonitorado) parts.push("Monitorado");
      if (i.execMarkerRecolhido) parts.push("Recolhido");
      text = parts.length ? `Cumprindo — ${parts.join(", ")}` : "Cumprindo";
    }
  }

  if (regime === "ABERTO") {
    if (situ === "AGUARDANDO_INICIO") {
      text = "Aguardando início";
    } else if (situ === "OUTRO") {
      text = "Outro";
    } else {
      const parts: string[] = [];
      if (i.execMarkerMonitorado) parts.push("Monitorado");
      if (i.execMarkerSoltoCumprindo) parts.push("Solto cumprindo");
      text = parts.length ? `Cumprindo — ${parts.join(", ")}` : "Cumprindo";
    }
  }

  return {
    text,
    observacao: obs,
    isRed,
    destacarObs,
  };
}

export function execStatusClass(i: ReturnType<typeof formatExecStatus>) {
  // Classe para o TEXTO principal (regime/situação). Destaque é aplicado só na observação.
  if (i.isRed) return "text-red-700";
  return "text-zinc-700";
}

export function execObsClass(i: ReturnType<typeof formatExecStatus>) {
  return i.destacarObs ? "font-semibold text-red-700" : "text-zinc-700";
}
