import { prisma } from "@/lib/prisma";
import { createHash, randomBytes } from "crypto";

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

async function ensureRoles() {
  const roles = [
    { key: "USER" as const, name: "Usuário" },
    { key: "MODERATOR" as const, name: "Moderador" },
    { key: "ADMIN" as const, name: "Admin" },
    { key: "SUPERADMIN" as const, name: "Superadmin" },
  ];

  for (const r of roles) {
    await prisma.role.upsert({
      where: { key: r.key },
      update: { name: r.name },
      create: { key: r.key, name: r.name },
    });
  }
}

/**
 * Idempotente:
 * - garante RBAC roles base
 * - garante SUPERADMIN suporte@ssepa.com.br (RBAC relacional)
 * - (se sem senha) cria token NOX (2h, uso único)
 *
 * Observação: em produção, o link NOX sai no log do servidor.
 */
export async function ensureAdminBootstrap() {
  await ensureRoles();

  const email = "suporte@ssepa.com.br";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const user = await prisma.user.create({
      data: {
        email,
        name: "Suporte SSEPA",
        status: "ACTIVE",
        accountStatus: "APROVADO",
        passwordHash: null,
        profileCompleted: true,
      },
    });

    const superadmin = await prisma.role.findUnique({ where: { key: "SUPERADMIN" } });
    if (superadmin) {
      await prisma.userRole.create({
        data: { userId: user.id, roleId: superadmin.id, assignedByUserId: null },
      });
    }

    // eslint-disable-next-line no-console
    console.log(`[BOOTSTRAP] Criado SUPERADMIN: ${email}`);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.passwordHash) return;

  const now = new Date();
  const hasActive = await prisma.passwordSetupToken.findFirst({
    where: {
      email,
      usedAt: null,
      expiresAt: { gt: now },
      purpose: "SUPERADMIN_BOOTSTRAP",
    },
    select: { id: true },
  });
  if (hasActive) return;

  // rate limit: no máximo 3 tokens / 1h para o mesmo email
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await prisma.passwordSetupToken.count({
    where: { email, createdAt: { gt: oneHourAgo } },
  });
  if (recentCount >= 3) return;

  const token = base64url(randomBytes(32));
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

  await prisma.passwordSetupToken.create({
    data: {
      email,
      tokenHash,
      expiresAt,
      usedAt: null,
      purpose: "SUPERADMIN_BOOTSTRAP",
      createdByUserId: null,
    },
  });

  // eslint-disable-next-line no-console
  console.log(`[NOX] Link (2h, uso único): https://app.ssepa.com/definir-senha?nox=${token}`);
}
