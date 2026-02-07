import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/rbac";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminUser();
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      email: true,
      name: true,
      phone: true,
      oabNumber: true,
      oabUf: true,
      status: true,
      accountStatus: true,
      accountStatusReason: true,
      googleEnabled: true,
      profilePhotoUrl: true,
      roles: { select: { role: { select: { key: true } } } },
    },
  });

  if (!user) {
    return <div className="rounded border bg-white p-4">Usuário não encontrado.</div>;
  }

  const roles = (user.roles || []).map((r) => r.role.key);

  return (
    <div className="space-y-4">
      <div className="rounded border bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">{user.email}</div>
            <div className="text-sm text-zinc-600">ID: {user.id}</div>
          </div>
          <Link className="rounded border px-3 py-2 text-sm" href="/admin/users">
            Voltar
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <div className="text-xs text-zinc-500">Nome</div>
            <div className="font-medium">{user.name}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Roles</div>
            <div className="font-medium">{roles.join(", ") || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Status</div>
            <div className="font-medium">{user.status}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">AccountStatus</div>
            <div className="font-medium">{user.accountStatus}</div>
            {user.accountStatusReason ? <div className="text-sm text-zinc-600">{user.accountStatusReason}</div> : null}
          </div>
          <div>
            <div className="text-xs text-zinc-500">Google</div>
            <div className="font-medium">{user.googleEnabled ? "habilitado" : "não"}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Criado</div>
            <div className="font-medium">{user.createdAt.toISOString()}</div>
          </div>
        </div>

        {user.profilePhotoUrl ? (
          <div className="mt-4">
            <div className="text-xs text-zinc-500">Foto</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={user.profilePhotoUrl} alt="" className="mt-1 h-20 w-20 rounded-full border object-cover" />
          </div>
        ) : null}
      </div>

      <div className="rounded border bg-white p-4">
        <div className="text-sm font-semibold">Ações</div>
        <div className="mt-2 text-sm text-zinc-600">Status/roles via API (v1 simples).</div>

        <div className="mt-3 flex flex-wrap gap-2">
          <form action={`/api/admin/users/${user.id}/status`} method="post">
            <input type="hidden" name="accountStatus" value="SUSPENSO" />
            <input type="hidden" name="reason" value="Suspenso via admin" />
            <button className="rounded border px-3 py-2 text-sm" type="submit">
              Suspender
            </button>
          </form>
          <form action={`/api/admin/users/${user.id}/status`} method="post">
            <input type="hidden" name="accountStatus" value="APROVADO" />
            <input type="hidden" name="reason" value="Aprovado via admin" />
            <button className="rounded border px-3 py-2 text-sm" type="submit">
              Aprovar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
