"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export function CrimeRowActions({ hrefEdit }: { hrefEdit: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (ref.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="rounded border px-2 py-1 text-xs"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Ações"
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded border bg-white shadow"
        >
          <Link
            role="menuitem"
            className="block px-3 py-2 text-sm hover:bg-zinc-50"
            href={hrefEdit}
            onClick={() => setOpen(false)}
          >
            Editar
          </Link>
        </div>
      ) : null}
    </div>
  );
}
