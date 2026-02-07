import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import type { Layer } from "@/lib/processLayers";
import {
  ProcessoNotes,
  hasProcessNotes,
  mergeProcessNotes,
  parseProcessNotes,
  stringifyProcessNotes,
} from "@/lib/processNotes";

function derivedDecisionEventType({
  recorrerEmLiberdade,
  cautelaresAposSentenca,
}: {
  recorrerEmLiberdade: "SIM" | "NAO" | null;
  cautelaresAposSentenca: "CESSAM" | "MANTIDAS" | null;
}) {
  if (!recorrerEmLiberdade) return null;
  if (recorrerEmLiberdade === "SIM") {
    if (!cautelaresAposSentenca) return null;
    return cautelaresAposSentenca === "CESSAM" ? "DECISAO_CESSA_CUSTODIA" : "DECISAO_MANTEM_RESTRICAO";
  }
  // NAO: custódia mantida
  return "DECISAO_MANTEM_RESTRICAO";
}

const LayerCrimeSchema = z.object({
  law: z.string().trim().min(1).max(60),
  article: z.string().trim().min(1).max(60),
  description: z.string().trim().max(120).optional(),
  penaltyYears: z.number().int().min(0).max(200).optional(),
  penaltyMonths: z.number().int().min(0).max(2400).optional(),
  penaltyDays: z.number().int().min(0).max(40000).optional(),
});

const LayerTipoEnum = z.enum(["SENTENCA", "APELACAO", "RESP", "RE", "HC", "REVISAO_CRIMINAL", "OUTRO"]);

const LayerSchema = z.object({
  tipo: LayerTipoEnum,
  numero: z.string().trim().max(80).optional(),
  status: z.enum(["MANTIDA", "ALTERADA"]),
  observacao: z.string().trim().max(160).optional(),
  dataDecisao: z.string().nullable().optional(),
  dateUnknown: z.boolean().optional(),
  crimes: z.array(LayerCrimeSchema).optional(),
});

const FieldNoteSchema = z.object({
  text: z.string().optional(),
  highlight: z.boolean().optional(),
});

const NotesSchema = z.object({
  general: z.string().optional(),
  dataFatos: FieldNoteSchema.optional(),
  denuncia: FieldNoteSchema.optional(),
  sentenca: FieldNoteSchema.optional(),
  dispositivo: FieldNoteSchema.optional(),
  regime: FieldNoteSchema.optional(),
  transitProcesso: FieldNoteSchema.optional(),
  transitAcusacao: FieldNoteSchema.optional(),
  transitDefesa: FieldNoteSchema.optional(),
});

const RecursosSelectionSchema = z.object({
  tipos: z.array(LayerTipoEnum),
});

const RecursosNotesSchema = z.record(z.string(), z.string());

const PatchSchema = z.object({
  denunciaRecebidaAt: z.string().nullable().optional(),
  sentencaAt: z.string().nullable().optional(),
  fatosBaseAt: z.string().nullable().optional(),
  fatosBaseNaoSei: z.boolean().optional(),
  acordaoAt: z.string().nullable().optional(),
  respAt: z.string().nullable().optional(),
  reAt: z.string().nullable().optional(),
  transitAtProcesso: z.string().nullable().optional(),
  transitAtAcusacao: z.string().nullable().optional(),
  transitAtDefesa: z.string().nullable().optional(),
  juizoVaraCondenacao: z.string().optional(),

  // per-field notes (previously "fonte")
  fonte_denunciaRecebidaAt: z.string().optional(),
  fonte_denunciaRecebidaAt_destacar: z.boolean().optional(),
  fonte_sentencaAt: z.string().optional(),
  fonte_sentencaAt_destacar: z.boolean().optional(),
  fonte_dispositivoSentenca: z.string().optional(),
  fonte_dispositivoSentenca_destacar: z.boolean().optional(),
  fonte_acordaoAt: z.string().optional(),
  fonte_acordaoAt_destacar: z.boolean().optional(),
  fonte_respAt: z.string().optional(),
  fonte_respAt_destacar: z.boolean().optional(),
  fonte_reAt: z.string().optional(),
  fonte_reAt_destacar: z.boolean().optional(),
  fonte_transitAtProcesso: z.string().optional(),
  fonte_transitAtProcesso_destacar: z.boolean().optional(),
  fonte_transitAtAcusacao: z.string().optional(),
  fonte_transitAtAcusacao_destacar: z.boolean().optional(),
  fonte_transitAtDefesa: z.string().optional(),
  fonte_transitAtDefesa_destacar: z.boolean().optional(),

  // Sentença como porta de entrada
  sentencaSaved: z.boolean().optional(),

  reincidenciaMode: z.enum(["AUTO", "MANUAL"]).optional(),
  reincidenciaStatus: z.enum(["PRIMARIO", "REINCIDENTE"]).nullable().optional(),

  regimeInicialFixado: z.enum(["FECHADO", "SEMIABERTO", "ABERTO"]).nullable().optional(),
  recorrerEmLiberdade: z.enum(["SIM", "NAO"]).nullable().optional(),
  cautelaresAposSentenca: z.enum(["CESSAM", "MANTIDAS"]).nullable().optional(),

  includeInCalculations: z.boolean().optional(),

  recursosSelection: RecursosSelectionSchema.optional(),
  recursosNotes: RecursosNotesSchema.optional(),

  // camadas (decisões/fases) posteriores à sentença
  camadas: z.array(LayerSchema).optional(),
  notes: z.union([z.string(), NotesSchema]).optional(),
});

function toDateOrNull(s: string | null) {
  if (!s) return null;
  return new Date(`${s}T00:00:00.000Z`);
}

function toDateOrToday(s?: string | null) {
  if (!s) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  return new Date(`${s}T00:00:00.000Z`);
}

function mapTipoToDecisionType(tipo: Layer["tipo"]) {
  switch (tipo) {
    case "SENTENCA":
      return "SENTENCA";
    case "APELACAO":
      return "APELACAO";
    case "RESP":
      return "RESP";
    case "RE":
      return "RE";
    case "HC":
      return "HC";
    case "REVISAO_CRIMINAL":
      return "REVISAO_CRIMINAL";
    default:
      return "OUTRO";
  }
}

function mapDecisionTypeToTipo(type: string): Layer["tipo"] {
  switch (type) {
    case "SENTENCA":
      return "SENTENCA";
    case "APELACAO":
      return "APELACAO";
    case "RESP":
      return "RESP";
    case "RE":
      return "RE";
    case "HC":
      return "HC";
    case "REVISAO_CRIMINAL":
      return "REVISAO_CRIMINAL";
    default:
      return "OUTRO";
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ pid: string }> }) {
  const { pid } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const proc = await prisma.processoCriminal.findFirst({
    where: { id: pid, reference: { userId, status: "ACTIVE" } },
    include: {
      reference: { select: { id: true } },
      crimes: { select: { factDate: true, nature: true, isHediondo: true } },
      decisions: { orderBy: { decisionDate: "asc" }, select: { id: true, type: true, decisionDate: true, source: true } },
    },
  });
  if (!proc) return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 });

  const camadas = (proc.decisions ?? [])
    .filter((d) => d.type !== "SENTENCA")
    .map((d) => {
      const src: any = (d.source as any) ?? {};
      return {
        id: d.id,
        tipo: mapDecisionTypeToTipo(d.type),
        numero: (src.layerNumero as string) ?? "",
        status: (src.layerStatus as string) === "ALTERADA" ? "ALTERADA" : "MANTIDA",
        observacao: (src.layerObs as string) ?? "",
        dataDecisao: d.decisionDate ? d.decisionDate.toISOString().slice(0, 10) : null,
        crimes: Array.isArray(src.layerCrimes) ? src.layerCrimes : [],
        layerDateUnknown: Boolean(src.layerDateUnknown),
      };
    });

  const factCandidates: Date[] = (proc.crimes ?? []).map((c: any) => c.factDate).filter(Boolean);
  const dataFatoReferencia = factCandidates.length
    ? new Date(Math.min(...factCandidates.map((d: Date) => d.getTime())))
    : ((proc as any).fatosBaseAt as Date | null);

  const allProcs = await prisma.processoCriminal.findMany({
    where: { referenceId: proc.referenceId, reference: { userId, status: "ACTIVE" }, NOT: { id: pid } },
    select: {
      id: true,
      number: true,
      transitAtProcesso: true,
      transitAtDefesa: true,
      transitAtAcusacao: true,
      crimes: { select: { nature: true, isHediondo: true } },
    },
  });

  const othersWithMissingTJ = allProcs.some((p: any) => !(p.transitAtProcesso ?? p.transitAtDefesa ?? p.transitAtAcusacao));

  let suggested: "PRIMARIO" | "REINCIDENTE" | null = null;
  let suggestedWhy: string | null = null;
  let reincidenteEspecificoHediondo = false;

  if (!dataFatoReferencia && !((proc as any).fatosBaseNaoSei as boolean)) {
    suggested = null;
    suggestedWhy = "Não foi possível sugerir (falta Data do(s) fato(s) desta condenação).";
  } else if (!dataFatoReferencia && ((proc as any).fatosBaseNaoSei as boolean)) {
    suggested = null;
    suggestedWhy = "Não foi possível sugerir (falta Data do(s) fato(s) desta condenação).";
  } else {
    const fato = dataFatoReferencia as Date;
    const prior = allProcs
      .map((p: any) => {
        const tj = p.transitAtProcesso ?? p.transitAtDefesa ?? p.transitAtAcusacao;
        return tj ? { p, tj } : null;
      })
      .filter(Boolean)
      .filter((x: any) => x.tj.getTime() < fato.getTime());

    if (prior.length) {
      suggested = "REINCIDENTE";
      const one = prior.sort((a: any, b: any) => b.tj.getTime() - a.tj.getTime())[0] as any;
      const ex = one ? `${one.p.number} (TJ ${one.tj.toISOString().slice(0, 10).split("-").reverse().join("/")})` : "";
      suggestedWhy = `Identificamos condenação anterior com trânsito em julgado anterior à data dos fatos desta condenação. Sugere-se ‘Reincidente’.${ex ? ` Ex.: ${ex}.` : ""}`;

      reincidenteEspecificoHediondo = prior.some((x: any) => (x.p.crimes ?? []).some((c: any) => (c.nature && c.nature !== "COMUM") || c.isHediondo));
    } else {
      suggested = "PRIMARIO";
      suggestedWhy = "Não consta condenação anterior com trânsito em julgado anterior à data dos fatos desta condenação. Sugere-se ‘Primário’.";
      reincidenteEspecificoHediondo = false;
    }

    if (othersWithMissingTJ) {
      suggestedWhy = `${suggestedWhy} Há processos sem trânsito informado; a sugestão pode não refletir a realidade.`;
    }
  }

  const eventos = await prisma.processoEvento.findMany({
    where: { processo: { referenceId: proc.referenceId } },
    orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }],
    select: {
      type: true,
      eventDate: true,
      motivo: true,
      cautelarTypes: true,
      cautelarOtherText: true,
      processo: { select: { number: true } },
    },
  });

  const sourcePayload = ((proc.marcosSource as any) ?? {}) as Record<string, any>;
  const recursosSelection = sourcePayload.recursosSelection ?? null;
  const recursosNotes = sourcePayload.recursosNotes ?? null;

  return NextResponse.json({
    ok: true,
    processo: {
      id: proc.id,
      referenceId: proc.referenceId,
      number: proc.number,
      consolidatedEventos: eventos.map((e) => ({
        type: e.type,
        eventDate: e.eventDate.toISOString().slice(0, 10),
        processoNumber: e.processo.number,
        motivo: e.motivo ?? null,
        cautelarTypes: (e.cautelarTypes as any) ?? null,
        cautelarOtherText: (e.cautelarOtherText as any) ?? null,
      })),
      sentencaSaved: !!(proc as any).sentencaSaved,
      includeInCalculations: !!(proc as any).includeInCalculations,
      reincidenciaMode: (proc as any).reincidenciaMode ?? "AUTO",
      reincidenciaStatus: (proc as any).reincidenciaStatus ?? null,
      reincidenciaSuggested: suggested,
      reincidenciaSuggestedWhy: suggestedWhy,
      reincidenteEspecificoHediondo: !!reincidenteEspecificoHediondo,
      dataFatoReferencia: dataFatoReferencia ? dataFatoReferencia.toISOString().slice(0, 10) : null,
      denunciaRecebidaAt: proc.denunciaRecebidaAt ? proc.denunciaRecebidaAt.toISOString().slice(0, 10) : null,
      sentencaAt: proc.sentencaAt ? proc.sentencaAt.toISOString().slice(0, 10) : null,
      fatosBaseAt: (proc as any).fatosBaseAt ? (proc as any).fatosBaseAt.toISOString().slice(0, 10) : null,
      fatosBaseNaoSei: !!(proc as any).fatosBaseNaoSei,
      regimeInicialFixado: (proc as any).regimeInicialFixado ?? null,
      recorrerEmLiberdade: (proc as any).recorrerEmLiberdade ?? null,
      cautelaresAposSentenca: (proc as any).cautelaresAposSentenca ?? null,
      acordaoAt: proc.acordaoAt ? proc.acordaoAt.toISOString().slice(0, 10) : null,
      respAt: proc.respAt ? proc.respAt.toISOString().slice(0, 10) : null,
      reAt: proc.reAt ? proc.reAt.toISOString().slice(0, 10) : null,
      transitAtProcesso: proc.transitAtProcesso ? proc.transitAtProcesso.toISOString().slice(0, 10) : null,
      transitAtAcusacao: proc.transitAtAcusacao ? proc.transitAtAcusacao.toISOString().slice(0, 10) : null,
      transitAtDefesa: proc.transitAtDefesa ? proc.transitAtDefesa.toISOString().slice(0, 10) : null,
      juizoVaraCondenacao: proc.juizoVaraCondenacao ?? "",
      marcosSource: proc.marcosSource ?? {},
      recursosSelection,
      recursosNotes,
      notes: parseProcessNotes(proc.notes),
      camadas,
    },
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ pid: string }> }) {
  const { pid } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const proc = await prisma.processoCriminal.findFirst({
    where: { id: pid, reference: { userId, status: "ACTIVE" } },
    select: { id: true, referenceId: true, marcosSource: true, notes: true },
  });
  if (!proc) return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 });

  const d = parsed.data;
  const marcosSource: any = { ...(((proc.marcosSource as any) ?? {}) as any) };
  const existingNotes = parseProcessNotes(proc.notes);
  const notesPayload = typeof d.notes === "undefined" ? undefined : d.notes;
  const mergedNotes = mergeProcessNotes(existingNotes, notesPayload);
  const notesString = hasProcessNotes(mergedNotes) ? stringifyProcessNotes(mergedNotes) : null;
  const shouldUpdateNotes = typeof notesPayload !== "undefined";

  const mapFonte = {
    denunciaRecebidaAt: d.fonte_denunciaRecebidaAt,
    sentencaAt: d.fonte_sentencaAt,
    dispositivoSentenca: d.fonte_dispositivoSentenca,
    acordaoAt: d.fonte_acordaoAt,
    respAt: d.fonte_respAt,
    reAt: d.fonte_reAt,
    transitAtProcesso: d.fonte_transitAtProcesso,
    transitAtAcusacao: d.fonte_transitAtAcusacao,
    transitAtDefesa: d.fonte_transitAtDefesa,
  } as const;

  for (const [k, v] of Object.entries(mapFonte)) {
    if (typeof v === "undefined") continue;
    marcosSource[k] = (v as string).trim() || null;
  }

  const mapDest = {
    denunciaRecebidaAt: d.fonte_denunciaRecebidaAt_destacar,
    sentencaAt: d.fonte_sentencaAt_destacar,
    dispositivoSentenca: d.fonte_dispositivoSentenca_destacar,
    acordaoAt: d.fonte_acordaoAt_destacar,
    respAt: d.fonte_respAt_destacar,
    reAt: d.fonte_reAt_destacar,
    transitAtProcesso: d.fonte_transitAtProcesso_destacar,
    transitAtAcusacao: d.fonte_transitAtAcusacao_destacar,
    transitAtDefesa: d.fonte_transitAtDefesa_destacar,
  } as const;

  for (const [k, v] of Object.entries(mapDest)) {
    if (typeof v === "undefined") continue;
    marcosSource[`${k}_destacar`] = !!v;
  }

  const recursosSelectionPayload = typeof d.recursosSelection === "undefined" ? undefined : d.recursosSelection?.tipos;
  if (typeof recursosSelectionPayload !== "undefined") {
    marcosSource.recursosSelection = Array.isArray(recursosSelectionPayload) ? recursosSelectionPayload : [];
  }

  if (typeof d.recursosNotes !== "undefined") {
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(d.recursosNotes)) {
      if (typeof v !== "string") continue;
      const trimmed = v.trim();
      if (trimmed) cleaned[k] = trimmed;
    }
    marcosSource.recursosNotes = cleaned;
  }

  await prisma.$transaction(async (tx) => {
    await tx.processoCriminal.update({
      where: { id: pid },
      data: {
        sentencaSaved: typeof d.sentencaSaved === "undefined" ? undefined : !!d.sentencaSaved,
        denunciaRecebidaAt: typeof d.denunciaRecebidaAt === "undefined" ? undefined : toDateOrNull(d.denunciaRecebidaAt),
        sentencaAt: typeof d.sentencaAt === "undefined" ? undefined : toDateOrNull(d.sentencaAt),
        fatosBaseAt: typeof d.fatosBaseAt === "undefined" ? undefined : toDateOrNull(d.fatosBaseAt),
        fatosBaseNaoSei: typeof d.fatosBaseNaoSei === "undefined" ? undefined : !!d.fatosBaseNaoSei,
        regimeInicialFixado: typeof d.regimeInicialFixado === "undefined" ? undefined : d.regimeInicialFixado,
        recorrerEmLiberdade: typeof d.recorrerEmLiberdade === "undefined" ? undefined : d.recorrerEmLiberdade,
        cautelaresAposSentenca: typeof d.cautelaresAposSentenca === "undefined" ? undefined : d.cautelaresAposSentenca,
        acordaoAt: typeof d.acordaoAt === "undefined" ? undefined : toDateOrNull(d.acordaoAt),
        respAt: typeof d.respAt === "undefined" ? undefined : toDateOrNull(d.respAt),
        reAt: typeof d.reAt === "undefined" ? undefined : toDateOrNull(d.reAt),
        transitAtProcesso: typeof d.transitAtProcesso === "undefined" ? undefined : toDateOrNull(d.transitAtProcesso),
        transitAtAcusacao: typeof d.transitAtAcusacao === "undefined" ? undefined : toDateOrNull(d.transitAtAcusacao),
        transitAtDefesa: typeof d.transitAtDefesa === "undefined" ? undefined : toDateOrNull(d.transitAtDefesa),
        juizoVaraCondenacao: typeof d.juizoVaraCondenacao === "undefined" ? undefined : (d.juizoVaraCondenacao.trim() || null),
        includeInCalculations: typeof d.includeInCalculations === "undefined" ? undefined : !!d.includeInCalculations,
        // UI simplificada: ao salvar seleção (Primário/Reincidente), gravamos como MANUAL
        reincidenciaMode: typeof d.reincidenciaStatus === "undefined" ? undefined : "MANUAL",
        reincidenciaStatus: typeof d.reincidenciaStatus === "undefined" ? undefined : d.reincidenciaStatus,
        notes: shouldUpdateNotes ? notesString : undefined,
        marcosSource,
      },
    });

    // Obs.: sem criação automática de eventos. A UI mostrará recomendação de evento quando necessário.

    if (typeof d.camadas !== "undefined") {
      // Mantém SENTENÇA (crimes base no model Crime). Aqui guardamos só camadas posteriores.
      await tx.decision.deleteMany({ where: { processoId: pid, NOT: { type: "SENTENCA" } } });

      for (const camada of d.camadas) {
        if (camada.tipo === "SENTENCA") continue;

        const status = camada.status;
        await tx.decision.create({
          data: {
            processoId: pid,
            type: mapTipoToDecisionType(camada.tipo),
            decisionDate: toDateOrToday(camada.dataDecisao),
            source: {
              layerNumero: camada.numero?.trim() || null,
              layerStatus: status,
              layerObs: camada.observacao?.trim() || null,
              layerCrimes: status === "ALTERADA" ? (camada.crimes ?? []) : [],
              layerDateUnknown: !!camada.dateUnknown,
            },
          },
        });
      }
    }
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: userId,
      targetUserId: null,
      action: "processo.update",
      metadata: { referenceId: proc.referenceId, processoId: pid },
      ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
      userAgent: req.headers.get("user-agent") || null,
    },
  });

  return NextResponse.json({ ok: true });
}
