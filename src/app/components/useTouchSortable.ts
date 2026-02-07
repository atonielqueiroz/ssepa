"use client";

import { useRef, useState } from "react";

export function useTouchSortable<T extends { id: string }>({
  items,
  getRect,
  onReorder,
}: {
  items: T[];
  getRect: (id: string) => DOMRect | null;
  onReorder: (orderedIds: string[]) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const orderDraftRef = useRef<string[] | null>(null);

  function findOverId(clientY: number) {
    for (const it of items) {
      const r = getRect(it.id);
      if (!r) continue;
      const mid = r.top + r.height / 2;
      if (clientY < mid) return it.id;
    }
    return items.length ? items[items.length - 1].id : null;
  }

  function start(e: React.PointerEvent, id: string) {
    setDraggingId(id);
    orderDraftRef.current = items.map((x) => x.id);

    try {
      (e.currentTarget as any).setPointerCapture?.(e.pointerId);
    } catch {}

    let raf = 0;
    let lastOver: string | null = null;

    function onMove(ev: PointerEvent) {
      if (!orderDraftRef.current) return;
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        if (!orderDraftRef.current) return;

        const overId = findOverId(ev.clientY);
        if (!overId) return;
        if (lastOver === overId) return;
        lastOver = overId;

        const list = [...orderDraftRef.current];
        const from = list.indexOf(id);
        const to = list.indexOf(overId);
        if (from < 0 || to < 0 || from === to) return;
        list.splice(from, 1);
        list.splice(to, 0, id);
        orderDraftRef.current = list;
        onReorder(list);
      });
    }

    function onUp() {
      setDraggingId(null);
      orderDraftRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  }

  return { draggingId, start };
}
