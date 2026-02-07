import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const PatchSchema = z.object({
  text: z.string().min(1).max(8000),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; nid: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id, nid } = await ctx.params;

  const task = await prisma.task.findFirst({ where: { id, userId }, select: { id: true } });
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });

  const exists = await prisma.taskNote.findFirst({ where: { id: nid, taskId: id }, select: { id: true, userId: true, text: true } });
  if (!exists) return NextResponse.json({ error: "Anotação não encontrada" }, { status: 404 });
  if (exists.userId !== userId) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const updated = await prisma.taskNote.update({
    where: { id: nid },
    data: { text: parsed.data.text.trim() },
    select: { id: true, text: true },
  });

  await prisma.task.update({ where: { id }, data: { updatedAt: new Date() } });

  await prisma.auditLog.create({
    data: {
      actorUserId: userId,
      targetUserId: null,
      action: "task.note.update",
      metadata: { taskId: id, noteId: nid, before: { text: exists.text }, after: updated },
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: req.headers.get("user-agent") || null,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string; nid: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id, nid } = await ctx.params;

  const task = await prisma.task.findFirst({ where: { id, userId }, select: { id: true } });
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });

  const exists = await prisma.taskNote.findFirst({ where: { id: nid, taskId: id }, select: { id: true, userId: true, text: true } });
  if (!exists) return NextResponse.json({ error: "Anotação não encontrada" }, { status: 404 });
  if (exists.userId !== userId) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  await prisma.taskNote.delete({ where: { id: nid } });
  await prisma.task.update({ where: { id }, data: { updatedAt: new Date() } });

  await prisma.auditLog.create({
    data: {
      actorUserId: userId,
      targetUserId: null,
      action: "task.note.delete",
      metadata: { taskId: id, noteId: nid },
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: req.headers.get("user-agent") || null,
    },
  });

  return NextResponse.json({ ok: true });
}
