import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const CreateSchema = z.object({
  type: z.enum([
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
  ]),
  eventDate: z.string().min(8), // YYYY-MM-DD
  motivo: z.string().optional(),
  sourceText: z.string().optional(),

  // cautelares
  cautelarTypes: z.array(z.string()).optional(),
  cautelarOtherText: z.string().optional(),
  cautelarStart: z.string().nullable().optional(),
  cautelarEnd: z.string().nullable().optional(),

  // se true, NÃO computa na detração
  noDetraction: z.boolean().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ pid: string }> }) {
  const { pid } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const proc = await prisma.processoCriminal.findFirst({
    where: { id: pid, reference: { userId, status: "ACTIVE" } },
    select: { id: true },
  });
  if (!proc) return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 });

  const eventos = await prisma.processoEvento.findMany({
    where: { processoId: pid },
    orderBy: { eventDate: "asc" },
  });

  return NextResponse.json({
    ok: true,
    eventos: eventos.map((e) => ({
      id: e.id,
      type: e.type,
      eventDate: e.eventDate.toISOString().slice(0, 10),
      motivo: e.motivo ?? "",
      sourceText: (e.source as any)?.text ?? "",
      cautelarTypes: (e.cautelarTypes as any) ?? [],
      cautelarOtherText: e.cautelarOtherText ?? "",
      cautelarStart: e.cautelarStart ? e.cautelarStart.toISOString().slice(0, 10) : null,
      cautelarEnd: e.cautelarEnd ? e.cautelarEnd.toISOString().slice(0, 10) : null,
      noDetraction: !!e.noDetraction,
    })),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ pid: string }> }) {
  const { pid } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const proc = await prisma.processoCriminal.findFirst({
    where: { id: pid, reference: { userId, status: "ACTIVE" } },
    select: { id: true, referenceId: true },
  });
  if (!proc) return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const d = parsed.data;

  const evento = await prisma.processoEvento.create({
    data: {
      processoId: pid,
      type: d.type,
      eventDate: new Date(`${d.eventDate}T00:00:00.000Z`),
      motivo: d.motivo?.trim() || null,
      cautelarTypes: d.cautelarTypes ?? undefined,
      cautelarOtherText: d.cautelarOtherText?.trim() || null,
      cautelarStart: d.cautelarStart ? new Date(`${d.cautelarStart}T00:00:00.000Z`) : undefined,
      cautelarEnd: d.cautelarEnd ? new Date(`${d.cautelarEnd}T00:00:00.000Z`) : undefined,
      noDetraction: !!d.noDetraction,
      source: d.sourceText ? { text: d.sourceText } : undefined,
    },
    select: { id: true },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: userId,
      targetUserId: null,
      ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
      userAgent: req.headers.get("user-agent") || null,
      action: "processoEvento.create",
      metadata: { referenceId: proc.referenceId, processoId: pid, eventoId: evento.id },
    },
  });

  return NextResponse.json({ ok: true, id: evento.id });
}
