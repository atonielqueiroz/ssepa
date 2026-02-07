import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      profilePhotoUrl: true,
      googleEnabled: true,
      roles: { select: { role: { select: { key: true } } } },
    },
  });

  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    user: {
      ...user,
      roles: (user.roles || []).map((r) => r.role.key),
    },
  });
}

export async function PATCH(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as any;
  const name = typeof body?.name === "string" ? body.name.trim() : null;

  if (name !== null && name.length < 2) {
    return NextResponse.json({ error: "Nome inválido." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name !== null ? { name } : {}),
    },
    select: {
      name: true,
      email: true,
      profilePhotoUrl: true,
      googleEnabled: true,
      roles: { select: { role: { select: { key: true } } } },
    },
  });

  return NextResponse.json({
    ok: true,
    user: {
      ...user,
      roles: (user.roles || []).map((r) => r.role.key),
    },
  });
}
