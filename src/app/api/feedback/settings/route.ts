import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const PatchSchema = z.object({
  dismissedUntilIso: z.string().nullable(),
});

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { feedbackWidgetDismissedUntil: true },
  });

  return NextResponse.json({
    ok: true,
    settings: {
      dismissedUntil: u?.feedbackWidgetDismissedUntil ? u.feedbackWidgetDismissedUntil.toISOString() : null,
    },
  });
}

export async function PATCH(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const iso = parsed.data.dismissedUntilIso;
  const dt = iso ? new Date(iso) : null;

  await prisma.user.update({
    where: { id: userId },
    data: { feedbackWidgetDismissedUntil: dt },
  });

  await prisma.auditLog.create({
    data: { actorUserId: userId, targetUserId: null, ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null, userAgent: req.headers.get("user-agent") || null, action: "feedbackWidget.update", metadata: { dismissedUntil: iso } },
  });

  return NextResponse.json({ ok: true });
}
