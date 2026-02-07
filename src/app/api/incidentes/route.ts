import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const CreateSchema = z.object({
  referenceId: z.string().min(1),
  type: z.enum(["REMICAO", "HOMOLOGACAO_FALTA_GRAVE", "FIXACAO_ALTERACAO_REGIME", "OUTRO"]),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  referenceDate: z.string().min(8),
  autuacaoAt: z.string().nullable().optional(),
  sourceText: z.string().optional(),

  // remição
  remicaoDias: z.number().int().min(0).optional(),
  remicaoStatus: z.enum(["HOMOLOGADA", "NAO_HOMOLOGADA"]).optional(),

  // falta grave (fração)
  fracNum: z.number().int().min(0).optional(),
  fracDen: z.number().int().min(1).optional(),
});

export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const url = new URL(req.url);
  const referenceId = url.searchParams.get("referenceId");
  if (!referenceId) return NextResponse.json({ error: "referenceId obrigatório" }, { status: 400 });

  const ref = await prisma.reference.findFirst({
    where: { id: referenceId, userId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!ref) return NextResponse.json({ error: "Simulação não encontrada" }, { status: 404 });

  const items = await prisma.incidente.findMany({
    where: { referenceId },
    orderBy: [{ referenceDate: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({
    ok: true,
    incidentes: items.map((i) => ({
      id: i.id,
      type: i.type,
      numero: i.numero ?? "",
      complemento: i.complemento ?? "",
      referenceDate: i.referenceDate.toISOString().slice(0, 10),
      autuacaoAt: i.autuacaoAt ? i.autuacaoAt.toISOString().slice(0, 10) : null,
      sourceText: (i.source as any)?.text ?? "",
      remicaoDias: i.remicaoDias ?? null,
      remicaoStatus: i.remicaoStatus ?? null,
      fracNum: i.faltaGraveFracNum ?? null,
      fracDen: i.faltaGraveFracDen ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const d = parsed.data;

  const ref = await prisma.reference.findFirst({
    where: { id: d.referenceId, userId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!ref) return NextResponse.json({ error: "Simulação não encontrada" }, { status: 404 });

  // validações específicas
  if (d.type === "REMICAO") {
    if (typeof d.remicaoDias !== "number") return NextResponse.json({ error: "Informe os dias de remição." }, { status: 400 });
    if (!d.remicaoStatus) return NextResponse.json({ error: "Informe se a remição é homologada ou não homologada." }, { status: 400 });
  }
  if (d.type === "HOMOLOGACAO_FALTA_GRAVE") {
    if (typeof d.fracNum !== "number" || typeof d.fracDen !== "number") {
      return NextResponse.json({ error: "Informe a fração aplicada (ex.: 1/3)." }, { status: 400 });
    }
    if (d.fracNum > d.fracDen) return NextResponse.json({ error: "Fração inválida." }, { status: 400 });
    // limite legal (até 1/3)
    if (d.fracNum / d.fracDen > 1 / 3 + 1e-9) {
      return NextResponse.json({ error: "A perda de remição na falta grave deve ser de até 1/3 (art. 127 da LEP)." }, { status: 400 });
    }
  }

  const item = await prisma.incidente.create({
    data: {
      referenceId: d.referenceId,
      type: d.type,
      numero: d.numero?.trim() || null,
      complemento: d.complemento?.trim() || null,
      referenceDate: new Date(`${d.referenceDate}T00:00:00.000Z`),
      autuacaoAt: d.autuacaoAt ? new Date(`${d.autuacaoAt}T00:00:00.000Z`) : null,
      remicaoDias: d.type === "REMICAO" ? d.remicaoDias! : null,
      remicaoStatus: d.type === "REMICAO" ? d.remicaoStatus! : null,
      faltaGraveFracNum: d.type === "HOMOLOGACAO_FALTA_GRAVE" ? d.fracNum! : null,
      faltaGraveFracDen: d.type === "HOMOLOGACAO_FALTA_GRAVE" ? d.fracDen! : null,
      source: d.sourceText ? { text: d.sourceText } : undefined,
    },
    select: { id: true },
  });

  await prisma.auditLog.create({
    data: { actorUserId: userId, targetUserId: null, ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null, userAgent: req.headers.get("user-agent") || null, action: "incidente.create", metadata: { referenceId: d.referenceId, incidenteId: item.id } },
  });

  return NextResponse.json({ ok: true, id: item.id });
}
