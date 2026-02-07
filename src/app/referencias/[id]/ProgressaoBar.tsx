import { art112Fractions } from "@/lib/art112";

function formatDateBR(isoYYYYMMDD: string) {
  const [y, m, d] = isoYYYYMMDD.split("-");
  return `${d}/${m}/${y}`;
}

function addDaysISO(baseISO: string, days: number) {
  const dt = new Date(`${baseISO}T00:00:00.000Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function ProgressaoBar({
  baseDateISO,
  penaTotalDays,
  penaCumpridaBaseDays,
  cumpridoDesdeBaseDays,
  progEspecialApplies,
  crimes,
}: {
  baseDateISO: string | null; // YYYY-MM-DD
  penaTotalDays: number;
  penaCumpridaBaseDays: number | null;
  cumpridoDesdeBaseDays: number | null;
  progEspecialApplies: boolean;
  crimes: Array<{
    id: string;
    penaltyDaysTotal: number;
    label: string;
    factDateISO: string | null;
    hasViolence: boolean;
    isHediondoOrEquiparado: boolean;
    hasResultDeath: boolean;
    hasOrgCrimLead: boolean;
    hasMilicia: boolean;
    isFeminicidio: boolean;
    art112ChoiceMode: "AUTO" | "MANUAL";
    art112Inciso: any;
  }>;
}) {
  const missing = !baseDateISO || typeof penaCumpridaBaseDays !== "number";

  const penaCumprida = typeof penaCumpridaBaseDays === "number" ? penaCumpridaBaseDays : 0;
  const penaRestante = Math.max(0, penaTotalDays - penaCumprida);

  const crimePercents = crimes
    .map((c) => {
      const base = art112Fractions({
        hasViolence: c.hasViolence,
        isHediondoOrEquiparado: c.isHediondoOrEquiparado,
        hasResultDeath: c.hasResultDeath,
        hasOrgCrimLead: c.hasOrgCrimLead,
        hasMilicia: c.hasMilicia,
        isFeminicidio: c.isFeminicidio,
        art112ChoiceMode: c.art112ChoiceMode,
        art112Inciso: c.art112Inciso ?? null,
        factDate: c.factDateISO ? new Date(`${c.factDateISO}T00:00:00.000Z`) : undefined,
      });
      const percent = progEspecialApplies ? 12.5 : base.primario.percent;
      const inciso = progEspecialApplies ? "§3º" : base.primario.inciso;
      return { crime: c, percent, inciso };
    })
    .filter((x) => typeof x.percent === "number" && x.percent > 0);

  const uniquePercents = Array.from(new Set(crimePercents.map((x) => x.percent))).sort((a, b) => a - b);
  const controllingPercent = uniquePercents.length ? Math.max(...uniquePercents) : null;

  function fmtDays(total: number) {
    const y = Math.floor(total / 365);
    const m = Math.floor((total % 365) / 30);
    const d = total % 30;
    return `${y}a${m}m${d}d`;
  }

  return (
    <div className="w-full" style={{ boxSizing: "border-box", minHeight: 190 }}>
      {missing ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Para gerar a barra, preencha: <span className="font-medium">Data-base</span> e <span className="font-medium">Pena cumprida na data-base</span>.
        </div>
      ) : uniquePercents.length === 0 || !controllingPercent ? (
        <div className="text-sm text-zinc-600">Sem dados suficientes para calcular a fração.</div>
      ) : (
        (() => {
          const reqDays = Math.ceil((penaRestante * controllingPercent) / 100);
          const objetivoISO = addDaysISO(baseDateISO!, reqDays);
          const cumpridoDays = Math.max(0, cumpridoDesdeBaseDays ?? 0);
          const restanteDays = Math.max(0, reqDays - cumpridoDays);
          const pctDone = Math.min(100, Math.max(0, reqDays ? (100 * cumpridoDays) / reqDays : 0));

          return (
            <div className="flex flex-col gap-3">
              {/* Linha 1 */}
              <div className="flex items-baseline justify-between gap-3 text-xs text-zinc-600">
                <div className="min-w-0 whitespace-nowrap">
                  Data-base: <span className="font-medium text-zinc-800">{formatDateBR(baseDateISO!)}</span>
                </div>
                <div className="flex-1 text-center font-medium tracking-wide text-zinc-600">Progressão</div>
                <div className="min-w-0 whitespace-nowrap text-right">
                  Previsão: <span className="font-medium text-zinc-800">{formatDateBR(objetivoISO)}</span>
                </div>
              </div>

              {/* Linha 2 */}
              <div className="flex items-center justify-center">
                <div className="whitespace-nowrap text-center text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl">
                  {fmtDays(cumpridoDays)} / {fmtDays(reqDays)}
                  {progEspecialApplies ? <span className="ml-2 align-middle text-xs font-semibold text-emerald-700">§3º</span> : null}
                </div>
              </div>

              {/* Linha 3 */}
              <div className="flex items-center gap-3">
                <div className="relative h-6 flex-1 rounded bg-zinc-200">
                  <div className="absolute inset-y-0 left-0 rounded bg-[color:var(--ssepa-accent)]" style={{ width: `${pctDone}%` }} />
                  <div className="absolute inset-0 rounded ring-1 ring-black/5" />
                </div>
                <div className="w-10 text-right text-[11px] font-medium tabular-nums text-zinc-600">{pctDone.toFixed(0)}%</div>
              </div>

              {/* Linha 4 */}
              <div className="flex items-center justify-between gap-3 text-xs text-zinc-600">
                <div className="whitespace-nowrap">Percentual cumprido: <span className="font-medium text-zinc-800">{fmtDays(cumpridoDays)}</span></div>
                <div className="whitespace-nowrap text-right">Restante: <span className="font-medium text-zinc-800">{fmtDays(restanteDays)}</span></div>
              </div>

              <div className="text-center text-[11px] text-zinc-500">Requisito objetivo: {formatDateBR(objetivoISO)}</div>
            </div>
          );
        })()
      )}
    </div>
  );
}
