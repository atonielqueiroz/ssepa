export type FieldNote = {
  text?: string;
  highlight?: boolean;
};

export interface ProcessoNotes {
  general?: string;
  dataFatos?: FieldNote;
  denuncia?: FieldNote;
  sentenca?: FieldNote;
  dispositivo?: FieldNote;
  regime?: FieldNote;
  transitProcesso?: FieldNote;
  transitAcusacao?: FieldNote;
  transitDefesa?: FieldNote;
}

type FieldNoteKey = Exclude<keyof ProcessoNotes, 'general'>;


export function parseProcessNotes(raw?: string | null): ProcessoNotes {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as ProcessoNotes;
    }
  } catch (error) {
    // ignore
  }
  return { general: raw };
}

export function stringifyProcessNotes(notes: ProcessoNotes): string {
  return JSON.stringify(notes);
}

export function hasProcessNotes(notes: ProcessoNotes): boolean {
  for (const key of Object.keys(notes)) {
    const value = notes[key as keyof ProcessoNotes];
    if (typeof value === "string") {
      if (value.trim()) return true;
    } else if (value && typeof value === "object") {
      if ((value.text ?? "").trim() || typeof value.highlight === "boolean") return true;
    }
  }
  return false;
}

export function mergeProcessNotes(existing: ProcessoNotes, patch?: string | ProcessoNotes): ProcessoNotes {
  if (!patch) return { ...existing };
  const result: ProcessoNotes = { ...existing };

  function mergeField(field: FieldNoteKey, patchValue?: FieldNote) {
    if (!patchValue) return;
    const current = result[field] as FieldNote | undefined;
    const next = {
      ...(current ?? {}),
      ...(patchValue ?? {}),
    };
    if (!next.text && !next.highlight) {
      delete result[field];
      return;
    }
    result[field] = next;
  }

  if (typeof patch === "string") {
    if (patch.trim()) {
      result.general = patch;
    }
    return result;
  }

  if (patch.general !== undefined) {
    result.general = patch.general;
  }
  mergeField("dataFatos", patch.dataFatos);
  mergeField("denuncia", patch.denuncia);
  mergeField("sentenca", patch.sentenca);
  mergeField("dispositivo", patch.dispositivo);
  mergeField("regime", patch.regime);
  mergeField("transitProcesso", patch.transitProcesso);
  mergeField("transitAcusacao", patch.transitAcusacao);
  mergeField("transitDefesa", patch.transitDefesa);

  return result;
}
