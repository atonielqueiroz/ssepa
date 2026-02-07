import Link from "next/link";
import { requireAdminUser, isSuperadmin } from "@/lib/rbac";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminUser();

  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500">Admin</div>
          <div className="text-2xl font-semibold">SSEPA Admin</div>
        </div>
        <Link className="rounded border px-3 py-2 text-sm" href="/referencias">
          Voltar ao app
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link className="rounded border bg-white px-3 py-2 text-sm" href="/admin">
          Início
        </Link>
        <Link className="rounded border bg-white px-3 py-2 text-sm" href="/admin/users">
          Usuários
        </Link>
        <Link className="rounded border bg-white px-3 py-2 text-sm" href="/admin/audit">
          Auditoria
        </Link>
        {isSuperadmin(user) ? (
          <Link className="rounded border bg-white px-3 py-2 text-sm" href="/admin/settings">
            Configurações
          </Link>
        ) : null}
      </div>

      {children}
    </div>
  );
}
