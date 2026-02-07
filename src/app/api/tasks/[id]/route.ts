import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const PatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  summary: z.string().max(2000).nullable().optional(),
  status: z.enum(["OPEN", "DONE", "ARCHIVED"]).optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const task = await prisma.task.findFirst({
    where: { id, userId },
    select: { id: true, title: true, summary: true, status: true, createdAt: true, updatedAt: true },
  });

  if (!task) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true, task });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;

  const exists = await prisma.task.findFirst({ where: { id, userId }, select: { id: true, title: true, summary: true, status: true } });
  if (!exists) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const nextStatus = parsed.data.status as any;

  const updated = await prisma.task.update({
    where: { id },
    data: {
      title: typeof parsed.data.title === "string" ? parsed.data.title.trim() : undefined,
      summary: typeof parsed.data.summary === "undefined" ? undefined : (parsed.data.summary ? parsed.data.summary.trim() : null),
      status: nextStatus,

      ...(typeof nextStatus === "string" && nextStatus !== exists.status
        ? nextStatus === "DONE"
          ? { completedAt: new Date(), doneOrder: BigInt(-Date.now()) }
          : nextStatus === "OPEN"
            ? { completedAt: null, openOrder: BigInt(-Date.now()) }
            : nextStatus === "ARCHIVED"
              ? { archivedAt: new Date(), archivedOrder: BigInt(-Date.now()) }
              : {}
        : {}),
    },
    select: { id: true, title: true, summary: true, status: true, completedAt: true, archivedAt: true },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: userId,
      targetUserId: null,
      action: "task.update",
      metadata: { taskId: id, before: exists, after: updated },
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: req.headers.get("user-agent") || null,
    },
  });

  return NextResponse.json({ ok: true, task: updated });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;

  const exists = await prisma.task.findFirst({ where: { id, userId }, select: { id: true, title: true, status: true } });
  if (!exists) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });

  await prisma.task.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      actorUserId: userId,
      targetUserId: null,
      action: "task.delete",
      metadata: { taskId: id, before: exists },
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: req.headers.get("user-agent") || null,
    },
  });

  return NextResponse.json({ ok: true });
}
