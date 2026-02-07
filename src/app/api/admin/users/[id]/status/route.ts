import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";

const VALID = new Set(["RASCUNHO", "ENVIADO", "APROVADO", "INDEFERIDO", "SUSPENSO"]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getSessionUser();
  if (!actor) return NextResponse.redirect(new URL("/login?e=auth", "https://app.ssepa.com"));
  if (!actor.roles.includes("MODERATOR") && !actor.roles.includes("ADMIN") && !actor.roles.includes("SUPERADMIN")) {
    return NextResponse.redirect(new URL("/referencias?e=forbidden", "https://app.ssepa.com"));
  }

  const { id } = await ctx.params;
  const form = await req.formData();
  const accountStatus = String(form.get("accountStatus") || "");
  const reasonRaw = form.get("reason");
  const reason = typeof reasonRaw === "string" ? reasonRaw.slice(0, 300) : null;

  if (!VALID.has(accountStatus)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      accountStatus: accountStatus as "RASCUNHO" | "ENVIADO" | "APROVADO" | "INDEFERIDO" | "SUSPENSO",
      accountStatusReason: reason,
      accountStatusUpdatedAt: new Date(),
      accountStatusUpdatedBy: actor.id,
    },
    select: { id: true, email: true },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: actor.id,
      targetUserId: updated.id,
      action: "admin.user_account_status_updated",
      metadata: { accountStatus, reason },
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: req.headers.get("user-agent") || null,
    },
  });

  return NextResponse.redirect(new URL(`/admin/users/${updated.id}`, "https://app.ssepa.com"));
}
