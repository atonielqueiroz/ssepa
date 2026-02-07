import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { redirect } from "next/navigation";
import { AppShell } from "@/app/components/AppShell";
import TaskDetailClient from "./TaskDetailClient";

export default async function TarefaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, profileCompleted: true } });
  if (!user?.profileCompleted) redirect("/completar-cadastro");

  // garantir acesso (sem vazar existência)
  const task = await prisma.task.findFirst({ where: { id, userId }, select: { id: true } });
  if (!task) redirect("/tarefas");

  return (
    <AppShell userName={user?.name ?? undefined}>
      <TaskDetailClient id={id} />
    </AppShell>
  );
}
