import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "crypto";

const prisma = new PrismaClient();

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

async function main() {
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
      await prisma.userRole.create({ data: { userId: user.id, roleId: superadmin.id } });
    }

    console.log(`[SEED] Criado SUPERADMIN: ${email}`);
  }

  // Gera link NOX só se ainda não tiver senha
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.passwordHash) {
    const token = base64url(randomBytes(32));
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    await prisma.passwordSetupToken.create({
      data: {
        email,
        tokenHash,
        expiresAt,
        purpose: "SUPERADMIN_BOOTSTRAP",
        createdByUserId: null,
      },
    });

    console.log(`[NOX] Link (2h, uso único): https://app.ssepa.com/definir-senha?nox=${token}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
