import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { hasProcessNotes, mergeProcessNotes, stringifyProcessNotes } from "@/lib/processNotes";

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

const CreateProcessoSchema = z.object({
  referenceId: z.string().min(1),
  number: z.string().min(5),
  notes: z.union([z.string(), NotesSchema]).optional(),

  execRegime: z.enum(["FECHADO", "SEMIABERTO", "ABERTO"]).nullable().optional(),
  execSituacao: z.enum(["PRESO", "FORAGIDO", "SUSPENSA_AGUARDANDO_CAPTURA", "CUMPRINDO", "AGUARDANDO_INICIO"]).nullable().optional(),
  execMarkerMonitorado: z.boolean().optional(),
  execMarkerRecolhido: z.boolean().optional(),
  execMarkerSoltoCumprindo: z.boolean().optional(),
  execObservacao: z.string().optional(),
  execDestacar: z.boolean().optional(),

  denunciaRecebidaAt: z.string().nullable().optional(),
  sentencaAt: z.string().nullable().optional(),
  acordaoAt: z.string().nullable().optional(),
  respAt: z.string().nullable().optional(),
  reAt: z.string().nullable().optional(),
  transitAtProcesso: z.string().nullable().optional(),
  transitAtAcusacao: z.string().nullable().optional(),
  transitAtDefesa: z.string().nullable().optional(),
  juizoVaraCondenacao: z.string().optional(),

  fonte_denunciaRecebidaAt: z.string().optional(),
  fonte_sentencaAt: z.string().optional(),
  fonte_acordaoAt: z.string().optional(),
  fonte_respAt: z.string().optional(),
  fonte_reAt: z.string().optional(),
  fonte_transitAtProcesso: z.string().optional(),
  fonte_transitAtAcusacao: z.string().optional(),
  fonte_transitAtDefesa: z.string().optional(),
});

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = CreateProcessoSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const {
    referenceId,
    number,
    notes,
    execRegime,
    execSituacao,
    execMarkerMonitorado,
    execMarkerRecolhido,
    execMarkerSoltoCumprindo,
    execObservacao,
    execDestacar,
    denunciaRecebidaAt,
    sentencaAt,
    acordaoAt,
    respAt,
    reAt,
    transitAtProcesso,
    transitAtAcusacao,
    transitAtDefesa,
    juizoVaraCondenacao,
    fonte_denunciaRecebidaAt,
    fonte_sentencaAt,
    fonte_acordaoAt,
    fonte_respAt,
    fonte_reAt,
    fonte_transitAtProcesso,
    fonte_transitAtAcusacao,
    fonte_transitAtDefesa,
  } = parsed.data;
  const createdNotesObject = mergeProcessNotes({}, notes);
  const createdNotesString = hasProcessNotes(createdNotesObject) ? stringifyProcessNotes(createdNotesObject) : null;

  const ref = await prisma.reference.findFirst({
    where: { id: referenceId, userId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!ref) return NextResponse.json({ error: "Referência não encontrada" }, { status: 404 });

  function toDateOrNull(s: string | null | undefined) {
    if (!s) return null;
    return new Date(`${s}T00:00:00.000Z`);
  }

  const marcosSource: any = {
    denunciaRecebidaAt: fonte_denunciaRecebidaAt?.trim() || null,
    sentencaAt: fonte_sentencaAt?.trim() || null,
    acordaoAt: fonte_acordaoAt?.trim() || null,
    respAt: fonte_respAt?.trim() || null,
    reAt: fonte_reAt?.trim() || null,
    transitAtProcesso: fonte_transitAtProcesso?.trim() || null,
    transitAtAcusacao: fonte_transitAtAcusacao?.trim() || null,
    transitAtDefesa: fonte_transitAtDefesa?.trim() || null,
  };

  const proc = await prisma.processoCriminal.create({
    data: {
      referenceId,
      number: number.trim(),
      notes: createdNotesString,
      execRegime: execRegime ?? null,
      execSituacao: execSituacao ?? null,
      execMarkerMonitorado: !!execMarkerMonitorado,
      execMarkerRecolhido: !!execMarkerRecolhido,
      execMarkerSoltoCumprindo: !!execMarkerSoltoCumprindo,
      execObservacao: execObservacao?.trim() || null,
      execDestacar: !!execDestacar,
      denunciaRecebidaAt: toDateOrNull(denunciaRecebidaAt),
      sentencaAt: toDateOrNull(sentencaAt),
      acordaoAt: toDateOrNull(acordaoAt),
      respAt: toDateOrNull(respAt),
      reAt: toDateOrNull(reAt),
      transitAtProcesso: toDateOrNull(transitAtProcesso),
      transitAtAcusacao: toDateOrNull(transitAtAcusacao),
      transitAtDefesa: toDateOrNull(transitAtDefesa),
      juizoVaraCondenacao: juizoVaraCondenacao?.trim() || null,
      marcosSource,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: userId,
      targetUserId: null,
      action: "processo.create",
      metadata: { referenceId, processoId: proc.id },
      ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
      userAgent: req.headers.get("user-agent") || null,
    },
  });

  return NextResponse.json({ ok: true, id: proc.id });
}
