import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const Schema = z.object({
  archived: z.boolean(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const ref = await prisma.reference.findFirst({ where: { id, userId, status: "ACTIVE" }, select: { id: true, archivedAt: true } });
  if (!ref) return NextResponse.json({ error: "Execução não encontrada" }, { status: 404 });

  if (parsed.data.archived) {
    await prisma.reference.update({
      where: { id },
      data: {
        archivedAt: new Date(),
        archivedOrder: BigInt(-Date.now()),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: userId,
        targetUserId: null,
        action: "reference.archive",
        metadata: { referenceId: id },
        ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
        userAgent: req.headers.get("user-agent") || null,
      },
    });

    return NextResponse.json({ ok: true });
  }

  // restore (mantém activeOrder original)
  await prisma.reference.update({
    where: { id },
    data: {
      archivedAt: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: userId,
      targetUserId: null,
      action: "reference.unarchive",
      metadata: { referenceId: id },
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: req.headers.get("user-agent") || null,
    },
  });

  return NextResponse.json({ ok: true });
}
