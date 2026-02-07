import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const BodySchema = z.object({
  payload: z.string().min(5),
});

const PayloadSchema = z.object({
  source: z.string().optional(),
  capturedAt: z.string().optional(),
  execNumber: z.string().optional(),
  processoNumber: z.string().optional(),
  diasTramitacao: z.number().int().nullable().optional(),
  classeProcessual: z.string().optional(),
  assuntoPrincipal: z.string().optional(),
  nivelSigilo: z.string().optional(),
  comarca: z.string().optional(),
  competencia: z.string().optional(),
  juizo: z.string().optional(),
  juiz: z.string().optional(),
  autuacao: z.string().optional(),
  distribuicao: z.string().optional(),
  executadoNome: z.string().optional(),
});

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  let obj: unknown;
  try {
    obj = JSON.parse(parsed.data.payload);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const p = PayloadSchema.safeParse(obj);
  if (!p.success) {
    return NextResponse.json({ error: "Formato de importação inválido" }, { status: 400 });
  }

  const data = p.data;

  const processNumber = (data.processoNumber || data.execNumber || "").trim();
  const execNumber = (data.execNumber || data.processoNumber || "").trim();
  if (!execNumber) {
    return NextResponse.json({ error: "Número não encontrado no payload" }, { status: 400 });
  }

  const title = `Execução Penal nº ${execNumber}`;

  const ref = await prisma.reference.create({
    data: {
      userId,
      execNumber,
      semExecucaoFormada: false,
      title,
      executadoNome: data.executadoNome || null,
      classeProcessual: data.classeProcessual || null,
      assuntoPrincipal: data.assuntoPrincipal || null,
      nivelSigilo: data.nivelSigilo || null,
      diasTramitacao: data.diasTramitacao ?? null,
      competencia: data.competencia || null,
      juizo: data.juizo || null,
      juiz: data.juiz || null,
      court: data.comarca || null,
      source: {
        import: {
          source: data.source || "SEEU_CONSULTA_PUBLICA",
          capturedAt: data.capturedAt || null,
          raw: data,
        },
      },
      processos: {
        create: {
          number: processNumber || execNumber,
          notes: "Importado do SEEU (consulta pública) — conferir nos autos.",
          source: { import: { source: "SEEU_CONSULTA_PUBLICA", raw: data } },
        },
      },
    },
    include: { processos: { take: 1 } },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: userId,
      targetUserId: null,
      action: "seeu.import",
      metadata: { referenceId: ref.id, execNumber },
      ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
      userAgent: req.headers.get("user-agent") || null,
    },
  });

  return NextResponse.json({ ok: true, referenceId: ref.id });
}
