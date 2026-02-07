import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const PatchSchema = z.object({
  type: z.enum(["REMICAO", "HOMOLOGACAO_FALTA_GRAVE", "FIXACAO_ALTERACAO_REGIME", "OUTRO"]).optional(),
  numero: z.string().nullable().optional(),
  complemento: z.string().nullable().optional(),
  referenceDate: z.string().min(8).optional(),
  autuacaoAt: z.string().nullable().optional(),
  sourceText: z.string().nullable().optional(),

  remicaoDias: z.number().int().min(0).nullable().optional(),
  remicaoStatus: z.enum(["HOMOLOGADA", "NAO_HOMOLOGADA"]).nullable().optional(),

  fracNum: z.number().int().min(0).nullable().optional(),
  fracDen: z.number().int().min(1).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ iid: string }> }) {
  const { iid } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const exists = await prisma.incidente.findFirst({
    where: { id: iid, reference: { userId, status: "ACTIVE" } },
    select: { id: true, referenceId: true, type: true },
  });
  if (!exists) return NextResponse.json({ error: "Incidente não encontrado" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const d = parsed.data;

  const nextType = d.type ?? exists.type;

  // validações específicas
  if (nextType === "REMICAO") {
    const dias = d.remicaoDias;
    const st = d.remicaoStatus;
    if (typeof dias !== "undefined" && dias === null) return NextResponse.json({ error: "Informe os dias de remição." }, { status: 400 });
    if (typeof st !== "undefined" && st === null) return NextResponse.json({ error: "Informe o status (homologada/não homologada)." }, { status: 400 });
  }

  if (nextType === "HOMOLOGACAO_FALTA_GRAVE") {
    const n = d.fracNum;
    const den = d.fracDen;
    if (typeof n !== "undefined" && n === null) return NextResponse.json({ error: "Informe a fração." }, { status: 400 });
    if (typeof den !== "undefined" && den === null) return NextResponse.json({ error: "Informe a fração." }, { status: 400 });
    if (typeof n === "number" && typeof den === "number") {
      if (n / den > 1 / 3 + 1e-9) {
        return NextResponse.json({ error: "A perda de remição na falta grave deve ser de até 1/3 (art. 127 da LEP)." }, { status: 400 });
      }
    }
  }

  await prisma.incidente.update({
    where: { id: iid },
    data: {
      type: d.type,
      numero: typeof d.numero === "undefined" ? undefined : (d.numero?.trim() || null),
      complemento: typeof d.complemento === "undefined" ? undefined : (d.complemento?.trim() || null),
      referenceDate: d.referenceDate ? new Date(`${d.referenceDate}T00:00:00.000Z`) : undefined,
      autuacaoAt: typeof d.autuacaoAt === "undefined" ? undefined : (d.autuacaoAt ? new Date(`${d.autuacaoAt}T00:00:00.000Z`) : null),
      remicaoDias: typeof d.remicaoDias === "undefined" ? undefined : d.remicaoDias,
      remicaoStatus: typeof d.remicaoStatus === "undefined" ? undefined : d.remicaoStatus,
      faltaGraveFracNum: typeof d.fracNum === "undefined" ? undefined : d.fracNum,
      faltaGraveFracDen: typeof d.fracDen === "undefined" ? undefined : d.fracDen,
      source: typeof d.sourceText === "undefined" ? undefined : (d.sourceText ? { text: d.sourceText } : undefined),
    },
  });

  await prisma.auditLog.create({
    data: { actorUserId: userId, targetUserId: null, ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null, userAgent: req.headers.get("user-agent") || null, action: "incidente.update", metadata: { referenceId: exists.referenceId, incidenteId: iid } },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ iid: string }> }) {
  const { iid } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const exists = await prisma.incidente.findFirst({
    where: { id: iid, reference: { userId, status: "ACTIVE" } },
    select: { id: true, referenceId: true },
  });
  if (!exists) return NextResponse.json({ error: "Incidente não encontrado" }, { status: 404 });

  await prisma.incidente.delete({ where: { id: iid } });

  await prisma.auditLog.create({
    data: { actorUserId: userId, targetUserId: null, ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null, userAgent: req.headers.get("user-agent") || null, action: "incidente.delete", metadata: { referenceId: exists.referenceId, incidenteId: iid } },
  });

  return NextResponse.json({ ok: true });
}
