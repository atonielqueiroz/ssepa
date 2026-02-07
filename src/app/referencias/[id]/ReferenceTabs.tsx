"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Counts = {
  processos: number;
  eventos: number;
  incidentes: number;
};

function Tab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        "inline-flex items-center rounded-t border px-4 py-2 text-sm " +
        (active
          ? "border-b-0 border-[color:var(--ssepa-accent)] bg-[color:var(--ssepa-accent)] font-medium text-white"
          : "border-b bg-[color:var(--ssepa-surface-2)] text-zinc-700 hover:bg-white")
      }
      style={{ borderColor: active ? "var(--ssepa-accent)" : "var(--ssepa-border)" }}
    >
      {label}
    </Link>
  );
}

export function ReferenceTabs({ referenceId, counts }: { referenceId: string; counts: Counts }) {
  const pathname = usePathname();

  const isProcessDetail =
    pathname.startsWith(`/referencias/${referenceId}/processos/`) && !pathname.startsWith(`/referencias/${referenceId}/processos/novo`);

  if (isProcessDetail) {
    const match = pathname.match(`/referencias/${referenceId}/processos/([^/]+)`);
    const pid = match?.[1];
    const editHref = pid ? `/referencias/${referenceId}/processos/${pid}` : pathname;
    const tabs = [
      { key: "inicio", href: `/referencias`, label: "Início" },
      { key: "editar", href: editHref, label: "Editar Processo" },
      { key: "voltar", href: `/referencias/${referenceId}`, label: "Voltar" },
    ];

    return (
      <div className="ssepa-panel rounded">
        <div className="ssepa-panel-header flex flex-wrap gap-1 px-2 pt-2">
          {tabs.map((t) => (
            <Tab key={t.key} href={t.href} label={t.label} active={t.key === "editar"} />
          ))}
        </div>
      </div>
    );
  }

  const tabs = [
    { key: "inicio", href: `/referencias`, label: "Início" },
    { key: "processos", href: `/referencias/${referenceId}`, label: `Processos Criminais (${counts.processos})` },
    { key: "eventos", href: `/referencias/${referenceId}/eventos`, label: `Eventos (${counts.eventos})` },
    { key: "incidentes", href: `/referencias/${referenceId}/incidentes`, label: `Incidentes (${counts.incidentes})` },
    { key: "relatorio", href: `/referencias/${referenceId}/relatorio`, label: "Relatório" },
  ];

  function isActive(href: string) {
    // "Início" navega para /referencias e nunca fica ativo (as abas não existem nessa tela).
    if (href === "/referencias") return false;

    if (href === `/referencias/${referenceId}`) {
      return pathname === href || pathname.startsWith(`${href}/processos`);
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="ssepa-panel rounded">
      <div className="ssepa-panel-header flex flex-wrap gap-1 px-2 pt-2">
        {tabs.map((t) => (
          <Tab key={t.key} href={t.href} label={t.label} active={isActive(t.href)} />
        ))}
      </div>
    </div>
  );
}
