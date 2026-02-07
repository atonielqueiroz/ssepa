"use client";

export function TaskTabsInline({
  leftLabel,
  leftActive,
  onLeft,
  rightLabel,
  rightActive,
  onRight,
}: {
  leftLabel: string;
  leftActive: boolean;
  onLeft: () => void;
  rightLabel: string;
  rightActive: boolean;
  onRight: () => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded border bg-white">
      <button
        type="button"
        className={
          "px-3 py-1 text-[11px] uppercase tracking-wide " +
          (leftActive ? "bg-[color:var(--ssepa-accent)] text-white" : "bg-[color:var(--ssepa-surface-2)] text-zinc-700 hover:bg-white")
        }
        style={{ borderRight: "1px solid var(--ssepa-border)" }}
        onClick={onLeft}
      >
        {leftLabel}
      </button>
      <button
        type="button"
        className={
          "px-3 py-1 text-[11px] uppercase tracking-wide " +
          (rightActive ? "bg-[color:var(--ssepa-accent)] text-white" : "bg-[color:var(--ssepa-surface-2)] text-zinc-700 hover:bg-white")
        }
        onClick={onRight}
      >
        {rightLabel}
      </button>
    </div>
  );
}
