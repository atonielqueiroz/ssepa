import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const Schema = z.object({
  view: z.enum(["active", "archived"]),
  group: z.enum(["OPEN", "DONE", "ARCHIVED"]),
  orderedIds: z.array(z.string().min(5)).min(1).max(500),
});

function orderForIndex(i: number) {
  // pequenos gaps; menor = topo
  return BigInt(i);
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const { group, orderedIds } = parsed.data;

  // segurança: só reordenar tarefas do próprio usuário
  const owned = await prisma.task.findMany({ where: { userId, id: { in: orderedIds } }, select: { id: true } });
  if (owned.length !== orderedIds.length) return NextResponse.json({ error: "Lista inválida." }, { status: 400 });

  await prisma.$transaction(
    orderedIds.map((id, idx) =>
      prisma.task.update({
        where: { id },
        data:
          group === "OPEN"
            ? { openOrder: orderForIndex(idx) }
            : group === "DONE"
              ? { doneOrder: orderForIndex(idx) }
              : { archivedOrder: orderForIndex(idx) },
      })
    )
  );

  await prisma.auditLog.create({
    data: {
      actorUserId: userId,
      targetUserId: null,
      action: "task.reorder",
      metadata: { group, count: orderedIds.length },
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: req.headers.get("user-agent") || null,
    },
  });

  return NextResponse.json({ ok: true });
}
