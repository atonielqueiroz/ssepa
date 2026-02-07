export type IncidenteDTO = {
  id: string;
  type: "REMICAO" | "HOMOLOGACAO_FALTA_GRAVE" | string;
  referenceDate: string; // YYYY-MM-DD
  remicaoDias?: number | null;
  remicaoStatus?: "HOMOLOGADA" | "NAO_HOMOLOGADA" | null;
  fracNum?: number | null;
  fracDen?: number | null;
};

function toDate(d: string) {
  return new Date(`${d}T00:00:00.000Z`);
}

export function calcSaldoRemicao(incidentes: IncidenteDTO[], includeNaoHomologada: boolean) {
  const items = [...incidentes]
    .filter((i) => i.type === "REMICAO" || i.type === "HOMOLOGACAO_FALTA_GRAVE")
    .sort((a, b) => toDate(a.referenceDate).getTime() - toDate(b.referenceDate).getTime());

  let saldo = 0;
  let totalHomologada = 0;
  let totalNao = 0;
  let totalPerdido = 0;

  for (const it of items) {
    if (it.type === "REMICAO") {
      const dias = it.remicaoDias ?? 0;
      const st = it.remicaoStatus ?? "HOMOLOGADA";
      if (st === "HOMOLOGADA") {
        totalHomologada += dias;
        saldo += dias;
      } else {
        totalNao += dias;
        if (includeNaoHomologada) saldo += dias;
      }
      continue;
    }

    if (it.type === "HOMOLOGACAO_FALTA_GRAVE") {
      const n = it.fracNum ?? 0;
      const d = it.fracDen ?? 1;
      const frac = n / d;
      // arredondamento mais favorável ao executado: piso
      const perda = Math.floor(saldo * frac);
      const efetiva = Math.min(perda, saldo);
      saldo -= efetiva;
      totalPerdido += efetiva;
    }
  }

  return {
    saldo,
    totalHomologada,
    totalNao,
    totalPerdido,
  };
}
