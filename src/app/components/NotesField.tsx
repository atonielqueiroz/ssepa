"use client";

import { AutoTextarea } from "./AutoTextarea";

export function NotesField({
  label,
  value,
  onChange,
  placeholder,
  destacar,
  onToggleDestacar,
  minRows = 2,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  destacar: boolean;
  onToggleDestacar: (v: boolean) => void;
  minRows?: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium">{label}</label>
        <label className="flex items-center gap-2 text-xs text-zinc-700">
          <input type="checkbox" checked={destacar} onChange={(e) => onToggleDestacar(e.target.checked)} /> Destacar
        </label>
      </div>
      <AutoTextarea
        className={
          "mt-1 w-full resize-y rounded border bg-white px-3 py-2 text-sm " +
          (destacar ? "text-red-700" : "text-zinc-900")
        }
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        minRows={minRows}
      />
    </div>
  );
}
