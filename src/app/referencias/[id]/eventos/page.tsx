import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

function fmt(d: Date) {
  const iso = d.toISOString().slice(0, 10);
  const [y, m, day] = iso.split("-");
  return `${day}/${m}/${y}`;
}

function mapTipo(t: string) {
  if (t.startsWith("PRISAO_") || t === "RECAPTURA") return "PRISÃO/INÍCIO";
  if (t === "FUGA") return "INTERRUPÇÃO (fuga)";

  // Liberdade COM cautelar conta como restrição (potencialmente detraível)
  if (t === "LIBERDADE_COM_CAUTELAR") return "CAUTELAR/RESTRIÇÃO";

  // Solturas/liberdade sem cautelar: interrupção do cumprimento/prisão
  if (t.startsWith("SOLTURA_") || t === "LIBERDADE_SEM_CAUTELAR" || t === "LIBERDADE_PROVISORIA" || t === "DECISAO_CESSA_CUSTODIA") return "INTERRUPÇÃO";

  if (t === "CAUTELAR_INICIO" || t === "CAUTELAR_FIM") return "CAUTELAR";

  return "EVENTO";
}

function isEventoDetracao(t: string) {
  return (
    t.startsWith("PRISAO_") ||
    t === "RECAPTURA" ||
    t === "CAUTELAR_INICIO" ||
    t === "LIBERDADE_COM_CAUTELAR" ||
    t === "DECISAO_MANTEM_RESTRICAO"
  );
}

function isEventoInterrupcaoDetracao(t: string) {
  return (
    t === "FUGA" ||
    t.startsWith("SOLTURA_") ||
    t === "LIBERDADE_SEM_CAUTELAR" ||
    t === "LIBERDADE_PROVISORIA" ||
    t === "CAUTELAR_FIM" ||
    t === "DECISAO_CESSA_CUSTODIA"
  );
}

function dayKeyUTC(d: Date) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function daysBetweenUTC(a: Date, b: Date) {
  const aMs = Date.parse(dayKeyUTC(a) + "T00:00:00.000Z");
  const bMs = Date.parse(dayKeyUTC(b) + "T00:00:00.000Z");
  const diff = Math.max(0, bMs - aMs);
  return Math.floor(diff / 86400000);
}

function fmtDur(days: number) {
  const y = Math.floor(days / 365);
  const m = Math.floor((days % 365) / 30);
  const d = days % 30;
  return `${y}a${m}m${d}d`;
}

export default async function ReferenceEventosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: referenceId } = await params;
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const ref = await prisma.reference.findFirst({
    where: { id: referenceId, userId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!ref) redirect("/referencias");

  const eventos = await prisma.processoEvento.findMany({
    where: { processo: { referenceId } },
    orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      type: true,
      eventDate: true,
      motivo: true,
      noDetraction: true,
      cautelarTypes: true,
      cautelarOtherText: true,
      source: true,
      processo: { select: { id: true, number: true } },
    },
  });

  // -----------------------------
  // Detração / interrupções (automático)
  // -----------------------------
  let detracaoAtiva = false;
  let inicioDetracaoAtual: Date | null = null;
  let interrupcaoAtiva = false;
  let inicioInterrupcaoAtual: Date | null = null;
  let totalDetraidoDays = 0;

  const annotationsById = new Map<string, string[]>();
  for (const e of eventos) {
    const anns: string[] = [];

    // eventos marcados como "não contar/detrair" não alteram o estado automático
    if (e.noDetraction) {
      annotationsById.set(e.id, anns);
      continue;
    }

    const isDet = isEventoDetracao(e.type);
    const isInt = isEventoInterrupcaoDetracao(e.type);

    // 1) primeiro evento de detração
    if (isDet && !detracaoAtiva && !interrupcaoAtiva) {
      anns.push("Início da Detração");
      detracaoAtiva = true;
      inicioDetracaoAtual = e.eventDate;
    }

    // 2) evento que inicia interrupção
    if (isInt && detracaoAtiva && inicioDetracaoAtual) {
      const trecho = daysBetweenUTC(inicioDetracaoAtual, e.eventDate);
      totalDetraidoDays += trecho;
      anns.push("Fim da Detração / Início da Interrupção");
      anns.push(`Total detraído: ${fmtDur(totalDetraidoDays)}`);
      detracaoAtiva = false;
      inicioDetracaoAtual = null;
      interrupcaoAtiva = true;
      inicioInterrupcaoAtual = e.eventDate;
    }

    // 3) evento que encerra interrupção e retoma detração
    if (isDet && interrupcaoAtiva && inicioInterrupcaoAtual) {
      const interDays = daysBetweenUTC(inicioInterrupcaoAtual, e.eventDate);
      anns.push("Fim da Interrupção / Início da nova Detração");
      anns.push(`Total de interrupção: ${fmtDur(interDays)}`);
      interrupcaoAtiva = false;
      inicioInterrupcaoAtual = null;
      detracaoAtiva = true;
      inicioDetracaoAtual = e.eventDate;
    }

    // 4) eventos de detração durante detração ativa: ignorar (não reinicia)

    annotationsById.set(e.id, anns);
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Eventos</h1>
          <div className="mt-1 text-sm ssepa-muted">
            Linha cronológica consolidada (todos os processos). Cada evento aponta para o seu processo de origem.
          </div>
        </div>
      </div>

      <div className="mt-4 ssepa-panel rounded">
        <div className="ssepa-panel-header flex items-center justify-between gap-2 p-3">
          <div className="font-medium">Eventos (consolidado)</div>
          <div className="text-xs ssepa-muted">{eventos.length} registro(s)</div>
        </div>
        <div className="p-3 text-sm">
          {eventos.length === 0 ? (
            <div className="ssepa-muted">Nenhum evento cadastrado em nenhum processo.</div>
          ) : (
            <div className="overflow-hidden rounded border">
              <table className="w-full text-sm">
                <thead className="ssepa-table-head text-left">
                  <tr>
                    <th className="p-2">Data</th>
                    <th className="p-2">Tipo</th>
                    <th className="p-2">Complemento</th>
                    <th className="p-2">Processo</th>
                    <th className="p-2">Fonte</th>
                    <th className="p-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {eventos.map((e) => {
                    const src = (e.source as any)?.text ?? "";
                    const cautelarInfo = Array.isArray(e.cautelarTypes) && e.cautelarTypes.length
                      ? `Cautelar: ${e.cautelarTypes.join(", ")}${e.cautelarOtherText ? ` (${e.cautelarOtherText})` : ""}`
                      : "";

                    return (
                      <tr key={e.id} className="border-t">
                        <td className="p-2">{fmt(e.eventDate)}</td>
                        <td className="p-2">
                          <div className="font-medium">{mapTipo(e.type)}</div>
                          <div className="text-xs ssepa-muted">{e.type}</div>
                        </td>
                        <td className="p-2">
                          <div className="text-xs">{e.motivo || "—"}</div>
                          {cautelarInfo ? <div className="mt-1 text-[11px] ssepa-muted">{cautelarInfo}</div> : null}
                          {e.noDetraction ? <div className="mt-1 text-[11px] text-amber-800">Não contar/detrair (marcado)</div> : null}

                          {(() => {
                            const anns = annotationsById.get(e.id) ?? [];
                            if (!anns.length) return null;
                            function badgeClass(a: string) {
                              if (a.startsWith("Início da Detração") || a.startsWith("Fim da Interrupção")) {
                                return "inline-flex w-fit rounded bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-800";
                              }
                              if (a.startsWith("Fim da Detração")) {
                                return "inline-flex w-fit rounded bg-red-50 px-2 py-0.5 text-[11px] text-red-800";
                              }
                              if (a.startsWith("Total detraído")) {
                                return "inline-flex w-fit rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800";
                              }
                              if (a.startsWith("Total de interrupção")) {
                                return "inline-flex w-fit rounded bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-800";
                              }
                              return "inline-flex w-fit rounded bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-700";
                            }

                            return (
                              <div className="mt-2 grid gap-1">
                                {anns.map((a, idx) => (
                                  <div key={idx} className={badgeClass(a)}>
                                    {a}
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="p-2">
                          <div className="font-medium">{e.processo.number}</div>
                        </td>
                        <td className="p-2">
                          {src ? <div className="text-[11px] ssepa-muted">{src}</div> : <span className="ssepa-muted">—</span>}
                        </td>
                        <td className="p-2 text-right">
                          <Link
                            className="rounded border px-2 py-1 text-xs"
                            href={`/referencias/${referenceId}/processos/${e.processo.id}/eventos`}
                          >
                            Abrir no processo
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 text-xs ssepa-muted">
            Dica: após cadastrar “liberdade com cautelar”, confira se houve revogação (geralmente na sentença com direito de recorrer em liberdade).
          </div>
        </div>
      </div>
    </div>
  );
}
