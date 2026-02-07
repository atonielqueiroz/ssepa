import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { redirect } from "next/navigation";
import { AppShell } from "@/app/components/AppShell";
import TarefasClient from "./TarefasClient";

export default async function TarefasPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, profileCompleted: true } });
  if (!user?.profileCompleted) redirect("/completar-cadastro");

  return (
    <AppShell userName={user?.name ?? undefined}>
      <TarefasClient />
    </AppShell>
  );
}
