import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/rbac";

export default async function AdminAuditPage() {
  await requireAdminUser();

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      createdAt: true,
      action: true,
      ip: true,
      userAgent: true,
      actor: { select: { email: true } },
      target: { select: { email: true } },
      metadata: true,
    },
  });

  return (
    <div className="rounded border bg-white">
      <div className="border-b p-4">
        <div className="text-lg font-semibold">Auditoria</div>
        <div className="text-sm text-zinc-600">Últimos 200 eventos</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left">
            <tr>
              <th className="p-3">Quando</th>
              <th className="p-3">Ação</th>
              <th className="p-3">Actor</th>
              <th className="p-3">Target</th>
              <th className="p-3">IP</th>
              <th className="p-3">UA</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t align-top">
                <td className="p-3 whitespace-nowrap">{l.createdAt.toISOString()}</td>
                <td className="p-3">
                  <div className="font-medium">{l.action}</div>
                  {l.metadata ? <pre className="mt-1 max-w-[70ch] overflow-x-auto rounded bg-zinc-50 p-2 text-xs">{JSON.stringify(l.metadata, null, 2)}</pre> : null}
                </td>
                <td className="p-3">{l.actor?.email ?? "—"}</td>
                <td className="p-3">{l.target?.email ?? "—"}</td>
                <td className="p-3">{l.ip ?? "—"}</td>
                <td className="p-3 max-w-[40ch] truncate" title={l.userAgent ?? ""}>
                  {l.userAgent ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
