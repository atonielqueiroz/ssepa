import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const EntityType = z.enum(["SIMULACOES_LIST", "SIMULACAO", "PROCESSO", "INCIDENTES", "EVENTOS"]);
const Color = z.enum(["AMARELO", "VERDE", "VERMELHO", "BRANCO", "AZUL"]);

const CreateSchema = z.object({
  entityType: EntityType,
  entityId: z.string().min(1).max(200),
  color: Color.optional(),
  text: z.string().min(1).max(85),
});

const PatchSchema = z.object({
  id: z.string().min(1),
  color: Color.optional(),
  text: z.string().min(1).max(85).optional(),
});

const DeleteSchema = z.object({
  id: z.string().min(1),
});

export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType");
  const entityId = url.searchParams.get("entityId");
  const parsed = z
    .object({ entityType: EntityType, entityId: z.string().min(1) })
    .safeParse({ entityType, entityId });
  if (!parsed.success) return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });

  const items = await prisma.reminderNote.findMany({
    where: { userId, entityType: parsed.data.entityType, entityId: parsed.data.entityId },
    orderBy: { createdAt: "asc" },
  });

  // limite por página/contexto
  if (items.length > 8) {
    // não bloqueia leitura, apenas sinaliza eventual excesso
  }

  return NextResponse.json({
    ok: true,
    notes: items.map((n) => ({
      id: n.id,
      color: n.color,
      text: n.text,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const existingCount = await prisma.reminderNote.count({
    where: { userId, entityType: parsed.data.entityType, entityId: parsed.data.entityId },
  });
  if (existingCount >= 8) {
    return NextResponse.json({ error: "Limite de 8 lembretes nesta página." }, { status: 400 });
  }

  const n = await prisma.reminderNote.create({
    data: {
      userId,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      color: parsed.data.color ?? "AMARELO",
      text: parsed.data.text.trim(),
    },
  });

  return NextResponse.json({ ok: true, id: n.id });
}

export async function PATCH(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const existing = await prisma.reminderNote.findFirst({ where: { id: parsed.data.id, userId } });
  if (!existing) return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 });

  await prisma.reminderNote.update({
    where: { id: parsed.data.id },
    data: {
      color: typeof parsed.data.color === "undefined" ? undefined : parsed.data.color,
      text: typeof parsed.data.text === "undefined" ? undefined : parsed.data.text.trim(),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = DeleteSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const existing = await prisma.reminderNote.findFirst({ where: { id: parsed.data.id, userId } });
  if (!existing) return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 });

  await prisma.reminderNote.delete({ where: { id: parsed.data.id } });
  return NextResponse.json({ ok: true });
}
