"use client";

import { useMemo } from "react";
import { art112Fractions, listArt112Options, type Art112Inciso, isVedadoLivramentoCondicional } from "@/lib/art112";

export type Art112AssistantValue = {
  mode: "AUTO" | "MANUAL";
  inciso: Art112Inciso | "";
};

export type ProgEspecial112State = {
  visible: boolean;
  enabled: boolean;
  req_I_semViolencia: boolean;
  req_II_naoCrimeContraFilho: boolean;
  req_III_cumpriuUmOitavoRegAnterior: boolean;
  req_IV_primariaBomComport: boolean;
  req_V_naoOrgCrim: boolean;
  revoked: boolean;
  revokedReasons: string[];
  saving?: boolean;
};

export function Art112Assistant({
  factDate,
  hasViolence,
  isHediondoOrEquiparado,
  hasResultDeath,
  hasOrgCrimLead,
  hasMilicia,
  isFeminicidio,
  value,
  onChange,
  progEspecial,
  onChangeProgEspecial,
  onSaveProgEspecial,
}: {
  factDate?: string; // YYYY-MM-DD
  hasViolence: boolean;
  isHediondoOrEquiparado: boolean;
  hasResultDeath: boolean;
  hasOrgCrimLead: boolean;
  hasMilicia: boolean;
  isFeminicidio?: boolean;
  value: Art112AssistantValue;
  onChange: (next: Art112AssistantValue) => void;

  progEspecial?: ProgEspecial112State;
  onChangeProgEspecial?: (next: ProgEspecial112State) => void;
  onSaveProgEspecial?: () => void;
}) {
  const factDateObj = useMemo(() => {
    if (!factDate) return undefined;
    // treat as UTC date
    return new Date(`${factDate}T00:00:00.000Z`);
  }, [factDate]);

  const suggestion = useMemo(() => {
    return art112Fractions({
      hasViolence,
      isHediondoOrEquiparado,
      hasResultDeath,
      hasOrgCrimLead,
      hasMilicia,
      isFeminicidio: !!isFeminicidio,
      factDate: factDateObj,
      art112ChoiceMode: "AUTO",
      art112Inciso: null,
    });
  }, [factDateObj, isHediondoOrEquiparado, hasMilicia, hasOrgCrimLead, hasResultDeath, hasViolence, isFeminicidio]);

  const options = useMemo(() => listArt112Options(factDateObj), [factDateObj]);

  function labelWithLc(o: any) {
    return (
      <>
        {o.label}
        {isVedadoLivramentoCondicional(o.inciso) ? (
          <span className="ml-2 text-xs font-medium text-red-700">impede livr. cond. (art. 83, CP)</span>
        ) : null}
      </>
    );
  }

  return (
    <div className="rounded border bg-zinc-50 p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">Assistente do art. 112 (LEP)</div>
          <div className="mt-1 text-xs text-zinc-700">
            Atenção: a falta de informação precisa sobre a <span className="font-medium">condenação definitiva</span> (qualificadoras,
            causas de aumento, hediondez/equiparação no tempo, etc.) pode alterar o cálculo final.
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name="art112_mode"
            checked={value.mode === "AUTO"}
            onChange={() => onChange({ mode: "AUTO", inciso: "" })}
          />
          <span>
            <span className="font-medium">Usar sugestão</span>
            <div className="text-xs text-zinc-600">
              Primário: {suggestion.primario.percent}% (inc. {suggestion.primario.inciso}) · Reinc.: {suggestion.reincidente.percent}% (inc. {suggestion.reincidente.inciso})
              {factDateObj && factDateObj.getTime() < new Date("2020-01-23T00:00:00.000Z").getTime() ? (
                <span className="ml-1">· fato anterior ao Pacote Anticrime</span>
              ) : null}
            </div>
          </span>
        </label>

        <label className="flex items-start gap-2">
          <input
            type="radio"
            name="art112_mode"
            checked={value.mode === "MANUAL"}
            onChange={() => onChange({ mode: "MANUAL", inciso: value.inciso || "I" })}
          />
          <span>
            <span className="font-medium">Escolher manualmente (ambiguidade/obscuridade)</span>
            <div className="text-xs text-zinc-600">Abra a lista e selecione o inciso/percentual desejado.</div>
          </span>
        </label>
      </div>

      {value.mode === "MANUAL" ? (
        <div className="mt-3 rounded border bg-white p-2">
          <div className="text-xs font-medium">Lista de incisos (art. 112)</div>
          <div className="mt-2 grid gap-2">
            {options.map((o) => (
              <label key={o.inciso} className="flex items-start gap-2">
                <input
                  type="radio"
                  name="art112_inciso"
                  checked={value.inciso === o.inciso}
                  onChange={() => onChange({ mode: "MANUAL", inciso: o.inciso })}
                />
                <span>
                  <span className="font-medium">{o.inciso}</span> — {labelWithLc(o)}
                  <div className="text-xs text-zinc-600">{o.percent}%</div>
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {progEspecial?.visible ? (
        <div className="mt-3 rounded border bg-white p-3">
          <div className="font-medium">Progressão especial — art. 112, §3º–§4º (LEP)</div>
          <div className="mt-1 text-xs text-zinc-600">Lei 13.769/2018 — fração 1/8 (12,5%).</div>

          {progEspecial.revoked ? (
            <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              <span className="font-medium">Benefício revogado (§4º):</span> {progEspecial.revokedReasons.join(" e ")}. O cálculo usa a regra normal.
            </div>
          ) : null}

          <label className="mt-3 flex items-start gap-2">
            <input
              type="checkbox"
              checked={progEspecial.enabled}
              onChange={(e) => onChangeProgEspecial?.({ ...progEspecial, enabled: e.target.checked })}
            />
            <span>
              <span className="font-medium">Aplicar progressão especial (§3º — 1/8)</span>
              <div className="text-xs text-zinc-600">Sem bloquear cálculos. O relatório indicará pendências/inelegibilidade.</div>
            </span>
          </label>

          {progEspecial.enabled ? (
            <div className="mt-3 rounded border bg-zinc-50 p-2 text-sm">
              <div className="text-xs font-medium">Checklist cumulativo (§3º, I–V)</div>
              <div className="mt-2 grid gap-2">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={progEspecial.req_I_semViolencia}
                    onChange={(e) => onChangeProgEspecial?.({ ...progEspecial, req_I_semViolencia: e.target.checked })}
                  />
                  <span>I — não ter cometido crime com violência ou grave ameaça</span>
                </label>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={progEspecial.req_II_naoCrimeContraFilho}
                    onChange={(e) => onChangeProgEspecial?.({ ...progEspecial, req_II_naoCrimeContraFilho: e.target.checked })}
                  />
                  <span>II — não ter cometido crime contra filho/dependente</span>
                </label>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={progEspecial.req_III_cumpriuUmOitavoRegAnterior}
                    onChange={(e) => onChangeProgEspecial?.({ ...progEspecial, req_III_cumpriuUmOitavoRegAnterior: e.target.checked })}
                  />
                  <span>III — ter cumprido ao menos 1/8 da pena no regime anterior</span>
                </label>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={progEspecial.req_IV_primariaBomComport}
                    onChange={(e) => onChangeProgEspecial?.({ ...progEspecial, req_IV_primariaBomComport: e.target.checked })}
                  />
                  <span>IV — ser primária e ter bom comportamento carcerário (diretor)</span>
                </label>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={progEspecial.req_V_naoOrgCrim}
                    onChange={(e) => onChangeProgEspecial?.({ ...progEspecial, req_V_naoOrgCrim: e.target.checked })}
                  />
                  <span>V — não ter integrado organização criminosa</span>
                </label>
              </div>

              <div className="mt-2 text-xs text-zinc-600">
                Fração efetiva: {(!progEspecial.revoked && progEspecial.req_I_semViolencia && progEspecial.req_II_naoCrimeContraFilho && progEspecial.req_III_cumpriuUmOitavoRegAnterior && progEspecial.req_IV_primariaBomComport && progEspecial.req_V_naoOrgCrim) ? (
                  <span className="font-medium">12,5% (1/8)</span>
                ) : (
                  <span className="font-medium">regra normal (pendente/não elegível)</span>
                )}
              </div>
            </div>
          ) : null}

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              className="rounded border px-3 py-2 text-xs"
              disabled={progEspecial.saving}
              onClick={() => onSaveProgEspecial?.()}
            >
              {progEspecial.saving ? "Salvando…" : "Salvar progressão especial no caso"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-2 text-[11px] text-zinc-600">
        Base: LEP, art. 112. (Motor completo “lei no tempo” será refinado.)
      </div>
    </div>
  );
}
