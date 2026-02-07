type ProcLike = {
  transitAtProcesso?: Date | null;
  transitAtAcusacao?: Date | null;
  transitAtDefesa?: Date | null;
  eventos?: Array<{ type: string; eventDate: Date; cautelarTypes?: any }>;
};

export function hasCondenacaoDefinitiva(p: ProcLike) {
  return !!p.transitAtProcesso || (!!p.transitAtAcusacao && !!p.transitAtDefesa);
}

export function hasCustodyOrCautelar(p: ProcLike) {
  const eventos = (p.eventos ?? []).slice().sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());

  let custodyOpen = false;
  let sawRestriction = false;

  for (const e of eventos) {
    const t = e.type;

    // prisão/início
    if (t.startsWith("PRISAO_") || t === "RECAPTURA") {
      custodyOpen = true;
      sawRestriction = true;
    }

    // soltura/liberdade (encerra prisão)
    if (t === "SOLTURA_ALVARA" || t === "LIBERDADE_SEM_CAUTELAR" || t === "LIBERDADE_PROVISORIA") {
      custodyOpen = false;
    }

    // liberdade com cautelar: não está preso, mas segue sob restrição
    if (t === "LIBERDADE_COM_CAUTELAR") {
      custodyOpen = false;
      sawRestriction = true;
    }

    // cautelar explícita
    if (t === "CAUTELAR_INICIO") sawRestriction = true;

    const ct = (e as any).cautelarTypes;
    if (Array.isArray(ct) && ct.length) sawRestriction = true;
  }

  return custodyOpen || sawRestriction;
}

export const EXECUCAO_PROVISORIA_JUSTIFICATIVA =
  "Em alguns casos, o réu permanece preso/recolhido ou sob cautelares após sentença, mesmo sem trânsito em julgado, e o feito pode ser encaminhado à execução para análise de benefícios. Pode haver unificação de condenações definitivas com provisórias; por isso é necessário confirmar e registrar o trânsito em julgado. Se não houver, tratar como execução provisória.";
