import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/rbac";

export default async function AdminUsersPage() {
  await requireAdminUser();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      createdAt: true,
      email: true,
      name: true,
      status: true,
      accountStatus: true,
      googleEnabled: true,
      roles: { select: { role: { select: { key: true } } } },
    },
  });

  return (
    <div className="rounded border bg-white">
      <div className="border-b p-4">
        <div className="text-lg font-semibold">Usuários</div>
        <div className="text-sm text-zinc-600">Últimos 200</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left">
            <tr>
              <th className="p-3">Email</th>
              <th className="p-3">Nome</th>
              <th className="p-3">Roles</th>
              <th className="p-3">Status</th>
              <th className="p-3">Account</th>
              <th className="p-3">Google</th>
              <th className="p-3">Criado</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-3">
                  <Link className="underline" href={`/admin/users/${u.id}`}>
                    {u.email}
                  </Link>
                </td>
                <td className="p-3">{u.name}</td>
                <td className="p-3">
                  {(u.roles || []).map((r) => r.role.key).join(", ") || "—"}
                </td>
                <td className="p-3">{u.status}</td>
                <td className="p-3">{u.accountStatus}</td>
                <td className="p-3">{u.googleEnabled ? "sim" : "não"}</td>
                <td className="p-3">{u.createdAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
