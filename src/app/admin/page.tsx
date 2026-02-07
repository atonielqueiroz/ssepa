import Link from "next/link";
import { requireAdminUser } from "@/lib/rbac";

export default async function AdminHomePage() {
  const user = await requireAdminUser();

  return (
    <div className="rounded border bg-white p-4">
      <div className="text-sm text-zinc-600">Autenticado como</div>
      <div className="mt-1 font-medium">{user.email}</div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Link className="rounded border p-3 hover:bg-zinc-50" href="/admin/users">
          <div className="font-medium">Usuários</div>
          <div className="text-sm text-zinc-600">Listar, ver detalhes e gerenciar status/roles.</div>
        </Link>
        <Link className="rounded border p-3 hover:bg-zinc-50" href="/admin/audit">
          <div className="font-medium">Auditoria</div>
          <div className="text-sm text-zinc-600">Últimas ações relevantes do sistema.</div>
        </Link>
        <Link className="rounded border p-3 hover:bg-zinc-50" href="/admin/settings">
          <div className="font-medium">Configurações</div>
          <div className="text-sm text-zinc-600">Convites/admin tokens e bootstrap.</div>
        </Link>
      </div>
    </div>
  );
}
