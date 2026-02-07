import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
});

function topOrder() {
  // menor = mais no topo
  return BigInt(-Date.now());
}

export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const u = new URL(req.url);
  const view = u.searchParams.get("view") || "active"; // active|archived

  const whereStatus = view === "archived" ? "ARCHIVED" : undefined;

  const tasks = await prisma.task.findMany({
    where: {
      userId,
      ...(view === "archived" ? { status: "ARCHIVED" } : { status: { not: "ARCHIVED" } }),
    },
    orderBy:
      view === "archived"
        ? [{ archivedOrder: "asc" }, { archivedAt: "desc" }, { updatedAt: "desc" }]
        : [{ openOrder: "asc" }, { doneOrder: "asc" }, { updatedAt: "desc" }],
    select: { id: true, title: true, status: true, updatedAt: true, completedAt: true, archivedAt: true },
    take: view === "archived" ? 400 : 200,
  });

  return NextResponse.json({ ok: true, tasks });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const task = await prisma.task.create({
    data: {
      userId,
      title: parsed.data.title.trim(),
      summary: null,
      status: "OPEN",
      openOrder: topOrder(),
      doneOrder: null,
      archivedOrder: null,
      completedAt: null,
      archivedAt: null,
    },
    select: { id: true },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: userId,
      targetUserId: null,
      action: "task.create",
      metadata: { taskId: task.id },
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: req.headers.get("user-agent") || null,
    },
  });

  return NextResponse.json({ ok: true, id: task.id });
}
