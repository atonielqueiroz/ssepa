"use client";

import { useEffect, useRef, useState } from "react";

export function Topbar({ userName }: { userName?: string }) {
  const [name, setName] = useState(userName ?? "");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/me", { method: "GET" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const n = data?.user?.name;
      const img = data?.user?.profilePhotoUrl;
      const rr = Array.isArray(data?.user?.roles) ? data.user.roles : [];
      if (typeof n === "string" && !name) setName(n);
      if (typeof img === "string") setProfilePhotoUrl(img);
      if (rr.length) setRoles(rr);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as any)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  async function onLogout() {
    const ok = window.confirm("Deseja sair do sistema?");
    if (!ok) return;

    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="ssepa-topbar">
      <div className="flex items-center justify-between px-6 py-4" style={{ maxWidth: "var(--ssepa-container-max)", margin: "0 auto" }}>
        <a className="flex items-center gap-3" href="/referencias">
          <div className="flex items-baseline gap-3">
            <div className="brand text-2xl leading-none">SSEPA</div>
            <div className="text-sm opacity-90">— Sistema de Simulação de Execuções Penais Avançado</div>
          </div>
        </a>

        <div className="relative flex items-center gap-3 text-sm opacity-95" ref={menuRef}>
          <button
            type="button"
            className="flex items-center gap-2 px-2 py-1 text-left text-xs text-white hover:bg-white/10"
            onClick={() => setMenuOpen((v) => !v)}
            title="Menu do usuário"
          >
            {profilePhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profilePhotoUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
            ) : (
              <div className="h-6 w-6 rounded-full bg-white/10" />
            )}
            <div className="max-w-[28ch] truncate" title={name}>
              {name}
            </div>
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded border border-white/20 bg-white text-sm text-zinc-900 shadow-lg">
              <a className="block px-3 py-2 hover:bg-zinc-50" href="/minhas-informacoes">
                Minhas Informações
              </a>
              {roles.includes("SUPERADMIN") || roles.includes("MODERATOR") || roles.includes("ADMIN") ? (
                <a className="block px-3 py-2 hover:bg-zinc-50" href="/admin">
                  Painel administrativo
                </a>
              ) : null}
              <button type="button" className="block w-full px-3 py-2 text-left hover:bg-zinc-50" onClick={onLogout}>
                Sair
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
