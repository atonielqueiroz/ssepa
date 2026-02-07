import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, timingSafeEqual } from "crypto";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

const Schema = z.object({
  token: z.string().min(20),
  password: z.string().min(10),
});

function sha256(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const token = parsed.data.token;
  const tokenHash = sha256(token);

  const row = await prisma.passwordSetupToken.findUnique({ where: { tokenHash } });
  if (!row) return NextResponse.json({ error: "Token inválido." }, { status: 400 });

  if (row.usedAt) return NextResponse.json({ error: "Token já utilizado." }, { status: 400 });
  if (row.expiresAt.getTime() < Date.now()) return NextResponse.json({ error: "Token expirado." }, { status: 400 });

  // Defesa extra: timing-safe compare (mesmo já usando findUnique)
  const a = Buffer.from(row.tokenHash);
  const b = Buffer.from(tokenHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "Token inválido." }, { status: 400 });

  const passwordHash = await hash(parsed.data.password, 10);

  await prisma.$transaction([
    prisma.user.update({ where: { email: row.email }, data: { passwordHash } }),
    prisma.passwordSetupToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ]);

  return NextResponse.json({ ok: true });
}
