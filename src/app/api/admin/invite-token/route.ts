import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";

const Schema = z.object({
  email: z.string().email(),
});

function base64url(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function sha256(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

export async function POST(req: Request) {
  const actor = await getSessionUser();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!actor.roles.includes("MODERATOR") && !actor.roles.includes("ADMIN") && !actor.roles.includes("SUPERADMIN")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const email = parsed.data.email.toLowerCase().trim();

  // rate limit (v1): máximo 5 tokens / hora por actor; máximo 3 tokens / hora por email
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const byActor = await prisma.passwordSetupToken.count({
    where: { createdByUserId: actor.id, createdAt: { gt: oneHourAgo } },
  });
  if (byActor >= 5) return NextResponse.json({ error: "Rate limit: muitos convites nesta hora." }, { status: 429 });

  const byEmail = await prisma.passwordSetupToken.count({
    where: { email, createdAt: { gt: oneHourAgo } },
  });
  if (byEmail >= 3) return NextResponse.json({ error: "Rate limit: muitos convites para este email." }, { status: 429 });

  const token = base64url(randomBytes(32));
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

  await prisma.passwordSetupToken.create({
    data: {
      email,
      tokenHash,
      expiresAt,
      usedAt: null,
      purpose: "ADMIN_INVITE",
      createdByUserId: actor.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: actor.id,
      targetUserId: null,
      action: "admin.invite_token_created",
      metadata: { email },
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: req.headers.get("user-agent") || null,
    },
  });

  const url = `https://app.ssepa.com/definir-senha?nox=${token}`;
  return NextResponse.json({ ok: true, url });
}
