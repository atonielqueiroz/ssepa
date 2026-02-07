"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ConsiderarNosCalculosToggle({
  processoId,
  initial,
}: {
  processoId: string;
  initial: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState(!!initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setError(null);
    setV(next);
    setSaving(true);

    const res = await fetch(`/api/processos/${processoId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ includeInCalculations: next }),
    });

    const data = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      // rollback
      setV(!next);
      const msg = data?.error ? String(data.error) : `Não foi possível salvar. (HTTP ${res.status})`;
      setError(msg);
      return;
    }

    // Atualiza server components (sem reload total)
    router.refresh();
  }

  return (
    <div
      className=""
      onClick={(e) => {
        // não colapsar/expandir o <summary>
        e.stopPropagation();
      }}
    >
      <label className="flex items-center gap-2 text-xs text-zinc-700">
        <input
          type="checkbox"
          checked={v}
          disabled={saving}
          onChange={(e) => toggle(e.target.checked)}
          style={{ accentColor: "rgb(2 132 199)" }}
        />
        <span>Considerar nos cálculos</span>
      </label>
      {error ? <div className="mt-1 text-[11px] text-red-700">{error}</div> : null}
    </div>
  );
}
