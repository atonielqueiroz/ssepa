import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const PatchSchema = z.object({
  type: z
    .enum([
      "PRISAO_FLAGRANTE",
      "PRISAO_PREVENTIVA",
      "PRISAO_TEMPORARIA",
      "PRISAO_TJ_INICIO_CUMPRIMENTO",
      "SOLTURA_ALVARA",
      "LIBERDADE_SEM_CAUTELAR",
      "LIBERDADE_COM_CAUTELAR",
      "LIBERDADE_PROVISORIA",
      "CAUTELAR_INICIO",
      "CAUTELAR_FIM",
      "FUGA",
      "RECAPTURA",
      "OUTRO",
    ])
    .optional(),
  eventDate: z.string().min(8).optional(),
  motivo: z.string().nullable().optional(),
  sourceText: z.string().nullable().optional(),

  cautelarTypes: z.array(z.string()).optional(),
  cautelarOtherText: z.string().nullable().optional(),
  cautelarStart: z.string().nullable().optional(),
  cautelarEnd: z.string().nullable().optional(),
  noDetraction: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ pid: string; eid: string }> }) {
  const { pid, eid } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const exists = await prisma.processoEvento.findFirst({
    where: { id: eid, processoId: pid, processo: { reference: { userId, status: "ACTIVE" } } },
    select: { id: true, processo: { select: { referenceId: true } } },
  });
  if (!exists) return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const d = parsed.data;

  const updated = await prisma.processoEvento.update({
    where: { id: eid },
    data: {
      type: d.type,
      eventDate: d.eventDate ? new Date(`${d.eventDate}T00:00:00.000Z`) : undefined,
      motivo: typeof d.motivo === "undefined" ? undefined : (d.motivo?.trim() || null),
      cautelarTypes: typeof d.cautelarTypes === "undefined" ? undefined : d.cautelarTypes,
      cautelarOtherText: typeof d.cautelarOtherText === "undefined" ? undefined : (d.cautelarOtherText?.trim() || null),
      cautelarStart: typeof d.cautelarStart === "undefined" ? undefined : (d.cautelarStart ? new Date(`${d.cautelarStart}T00:00:00.000Z`) : null),
      cautelarEnd: typeof d.cautelarEnd === "undefined" ? undefined : (d.cautelarEnd ? new Date(`${d.cautelarEnd}T00:00:00.000Z`) : null),
      noDetraction: typeof d.noDetraction === "undefined" ? undefined : !!d.noDetraction,
      source: typeof d.sourceText === "undefined" ? undefined : (d.sourceText ? { text: d.sourceText } : undefined),
    },
    select: { id: true },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: userId,
      targetUserId: null,
      ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
      userAgent: req.headers.get("user-agent") || null,
      action: "processoEvento.update",
      metadata: { referenceId: exists.processo.referenceId, processoId: pid, eventoId: updated.id },
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ pid: string; eid: string }> }) {
  const { pid, eid } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const exists = await prisma.processoEvento.findFirst({
    where: { id: eid, processoId: pid, processo: { reference: { userId, status: "ACTIVE" } } },
    select: { id: true, processo: { select: { referenceId: true } } },
  });
  if (!exists) return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });

  await prisma.processoEvento.delete({ where: { id: eid } });

  await prisma.auditLog.create({
    data: {
      actorUserId: userId,
      targetUserId: null,
      ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
      userAgent: req.headers.get("user-agent") || null,
      action: "processoEvento.delete",
      metadata: { referenceId: exists.processo.referenceId, processoId: pid, eventoId: eid },
    },
  });

  return NextResponse.json({ ok: true });
}
