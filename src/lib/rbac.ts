import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { redirect } from "next/navigation";

export type RoleKey = "USER" | "MODERATOR" | "ADMIN" | "SUPERADMIN";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  status: string;
  accountStatus: string;
  roles: RoleKey[];
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      accountStatus: true,
      roles: { select: { role: { select: { key: true } } } },
    },
  });
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    accountStatus: user.accountStatus,
    roles: user.roles.map((r) => r.role.key) as RoleKey[],
  };
}

export function hasRole(user: Pick<SessionUser, "roles"> | null | undefined, role: RoleKey) {
  return Boolean(user?.roles?.includes(role));
}

export function isAdmin(user: Pick<SessionUser, "roles"> | null | undefined) {
  // ADMIN = legado, mas consideramos MODERATOR como admin operacional (acesso ao painel)
  return hasRole(user, "ADMIN") || hasRole(user, "MODERATOR") || hasRole(user, "SUPERADMIN");
}

export function isModerator(user: Pick<SessionUser, "roles"> | null | undefined) {
  return hasRole(user, "MODERATOR") || hasRole(user, "SUPERADMIN");
}

export function isSuperadmin(user: Pick<SessionUser, "roles"> | null | undefined) {
  return hasRole(user, "SUPERADMIN");
}

export async function requireAdminUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login?e=auth");
  if (!isAdmin(user)) redirect("/referencias?e=forbidden");
  return user;
}

export async function requireSuperadminUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login?e=auth");
  if (!isSuperadmin(user)) redirect("/admin?e=forbidden");
  return user;
}
