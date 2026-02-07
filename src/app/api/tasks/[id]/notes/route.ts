import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const CreateSchema = z.object({
  text: z.string().min(1).max(8000),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;

  const task = await prisma.task.findFirst({ where: { id, userId }, select: { id: true } });
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });

  const notes = await prisma.taskNote.findMany({
    where: { taskId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      text: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ ok: true, notes });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;

  const task = await prisma.task.findFirst({ where: { id, userId }, select: { id: true } });
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const note = await prisma.taskNote.create({
    data: {
      taskId: id,
      userId,
      text: parsed.data.text.trim(),
    },
    select: { id: true },
  });

  await prisma.task.update({ where: { id }, data: { updatedAt: new Date() } });

  await prisma.auditLog.create({
    data: {
      actorUserId: userId,
      targetUserId: null,
      action: "task.note.create",
      metadata: { taskId: id, noteId: note.id },
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: req.headers.get("user-agent") || null,
    },
  });

  return NextResponse.json({ ok: true, id: note.id });
}
