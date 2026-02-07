import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const PostSchema = z.object({
  message: z.string().min(1).max(4000),
  anonymous: z.boolean().optional(),
  screenKey: z.string().min(1).max(200),
  route: z.string().min(1).max(1000),
  occurredAtIso: z.string().min(10).max(40),
  version: z.string().min(1).max(20),
});

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = PostSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const d = parsed.data;
  const occurredAt = new Date(d.occurredAtIso);

  await prisma.feedbackMessage.create({
    data: {
      userId: d.anonymous ? null : userId,
      anonymous: !!d.anonymous,
      version: d.version,
      screenKey: d.screenKey,
      route: d.route,
      occurredAt,
      message: d.message.trim(),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: userId,
      action: "feedback.create",
      targetUserId: null,
      metadata: { screenKey: d.screenKey },
      ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
      userAgent: req.headers.get("user-agent") || null,
    },
  });

  // Envio por e-mail pode ser acoplado aqui via SMTP/serviço externo.
  // (Sem revelar destinatário ao usuário.)

  return NextResponse.json({ ok: true });
}
