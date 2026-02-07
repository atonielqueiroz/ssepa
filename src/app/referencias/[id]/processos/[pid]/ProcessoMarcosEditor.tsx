"use client";

import { useEffect, useMemo, useState } from "react";
import type { Layer, LayerCrime, LayerTipo } from "@/lib/processLayers";
import { layerLabel, penaStr } from "@/lib/processLayers";

const RESOURCE_OPTIONS = [
  { tipo: "APELACAO", label: "Apelação Criminal" },
  { tipo: "RESP", label: "REsp" },
  { tipo: "RE", label: "RE" },
  { tipo: "HC", label: "HC" },
  { tipo: "REVISAO_CRIMINAL", label: "Revisão Criminal" },
  { tipo: "OUTRO", label: "Outra ação" },
] as const;

type ResourceTipo = (typeof RESOURCE_OPTIONS)[number]["tipo"];

const RESOURCE_TIPOS: ResourceTipo[] = RESOURCE_OPTIONS.map((opt) => opt.tipo);
const LAYER_TIPOS: LayerTipo[] = ["SENTENCA", ...RESOURCE_TIPOS];
type EditorLayer = Layer & { key: string; dateUnknown?: boolean };

type State = {
  sentencaSaved: boolean;
  camadas: EditorLayer[];
};

function generateLayerKey(tipo: LayerTipo) {
  return `${tipo}-${Math.random().toString(36).slice(2, 6)}-${Date.now()}`;
}

function createLayer(tipo: LayerTipo, overrides?: Partial<EditorLayer>): EditorLayer {
  return {
    key: generateLayerKey(tipo),
    tipo,
    status: "MANTIDA",
    numero: "",
    observacao: "",
    dataDecisao: "",
    crimes: [],
    dateUnknown: false,
    ...(overrides ?? {}),
  };
}

function cloneCrimes(crimes: LayerCrime[]) {
  return crimes.map((c) => ({ ...c }));
}

function formatDateDisplay(value: string | null | undefined) {
  if (!value) return "—";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function ProcessoMarcosEditor({
  processoId,
  baseCrimes,
}: {
  processoId: string;
  baseCrimes: Array<{
    law: string;
    article: string;
    description?: string | null;
    penaltyYears: number;
    penaltyMonths: number;
    penaltyDays: number;
  }>;
}) {
  const baseCrimesLayer: LayerCrime[] = useMemo(
    () =>
      baseCrimes.map((c) => ({
        law: c.law,
        article: c.article,
        description: c.description ?? "",
        penaltyYears: c.penaltyYears,
        penaltyMonths: c.penaltyMonths,
        penaltyDays: c.penaltyDays,
      })),
    [baseCrimes]
  );

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<State>({ sentencaSaved: false, camadas: [] });

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const res = await fetch(`/api/processos/${processoId}`);
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) {
        setError(data?.error ?? "Falha ao carregar recursos.");
        return;
      }
      const processo = data.processo ?? {};
      setState({
        sentencaSaved: !!processo.sentencaSaved,
        camadas: (processo.camadas ?? []).map((camada: any) =>
          createLayer(camada.tipo, {
            numero: camada.numero ?? "",
            status: camada.status,
            observacao: camada.observacao ?? "",
            dataDecisao: camada.dataDecisao ?? "",
            crimes: Array.isArray(camada.crimes) ? camada.crimes : [],
            dateUnknown: Boolean(camada.layerDateUnknown),
          })
        ),
      });
      setError(null);
    })();
  }, [open, processoId]);

  const layersByTipo = useMemo(() => {
    const map = LAYER_TIPOS.reduce<Record<LayerTipo, EditorLayer[]>>((acc, tipo) => {
      acc[tipo] = [];
      return acc;
    }, {} as Record<LayerTipo, EditorLayer[]>);
    for (const layer of state.camadas) {
      if (!map[layer.tipo]) map[layer.tipo] = [];
      map[layer.tipo].push(layer);
    }
    return map;
  }, [state.camadas]);

  const activeTipos = useMemo(
    () => RESOURCE_TIPOS.filter((tipo) => (layersByTipo[tipo]?.length ?? 0) > 0),
    [layersByTipo]
  );

  const registryEntries = useMemo(() => {
    const counts: Record<LayerTipo, number> = LAYER_TIPOS.reduce((acc, tipo) => ({ ...acc, [tipo]: 0 }), {} as Record<LayerTipo, number>);
    return state.camadas.map((layer) => {
      counts[layer.tipo] += 1;
      const suffix = counts[layer.tipo] > 1 ? ` #${counts[layer.tipo]}` : "";
      return {
        key: layer.key,
        label: `${layerLabel(layer.tipo)}${suffix}`,
        date: layer.dataDecisao,
        unknown: !!layer.dateUnknown,
      };
    });
  }, [state.camadas]);

  const missingDates = registryEntries.filter((entry) => !entry.date && !entry.unknown);

  function setLayer(key: string, patch: Partial<EditorLayer>) {
    setState((prev) => ({
      ...prev,
      camadas: prev.camadas.map((layer) => (layer.key === key ? { ...layer, ...patch } : layer)),
    }));
  }

  function setManteve(key: string, manteve: boolean) {
    setState((prev) => ({
      ...prev,
      camadas: prev.camadas.map((layer) => {
        if (layer.key !== key) return layer;
        if (manteve) {
          return { ...layer, status: "MANTIDA", crimes: [] };
        }
        const crimes = layer.crimes && layer.crimes.length ? layer.crimes : cloneCrimes(baseCrimesLayer);
        return { ...layer, status: "ALTERADA", crimes };
      }),
    }));
  }

  function toggleTipo(tipo: ResourceTipo) {
    const active = activeTipos.includes(tipo);
    if (active) {
      setState((prev) => ({
        ...prev,
        camadas: prev.camadas.filter((layer) => layer.tipo !== tipo),
      }));
      return;
    }
    setState((prev) => ({
      ...prev,
      camadas: [...prev.camadas, createLayer(tipo)],
    }));
  }

  function addLayer(tipo: ResourceTipo) {
    setState((prev) => ({
      ...prev,
      camadas: [...prev.camadas, createLayer(tipo)],
    }));
  }

  function removeLayer(key: string) {
    setState((prev) => ({
      ...prev,
      camadas: prev.camadas.filter((layer) => layer.key !== key),
    }));
  }

  function updateCrime(layerKey: string, idx: number, patch: Partial<LayerCrime>) {
    setState((prev) => ({
      ...prev,
      camadas: prev.camadas.map((layer) => {
        if (layer.key !== layerKey) return layer;
        const crimes = (layer.crimes ?? []).map((crime, index) => (index === idx ? { ...crime, ...patch } : crime));
        return { ...layer, crimes };
      }),
    }));
  }

  function removeCrime(layerKey: string, idx: number) {
    setState((prev) => ({
      ...prev,
      camadas: prev.camadas.map((layer) => {
        if (layer.key !== layerKey) return layer;
        const crimes = (layer.crimes ?? []).filter((_, index) => index !== idx);
        return { ...layer, crimes };
      }),
    }));
  }

  function addCrime(layerKey: string) {
    setState((prev) => ({
      ...prev,
      camadas: prev.camadas.map((layer) => {
        if (layer.key !== layerKey) return layer;
        const crimes = [
          ...(layer.crimes ?? []),
          { law: "", article: "", description: "", penaltyYears: 0, penaltyMonths: 0, penaltyDays: 0 },
        ];
        return { ...layer, crimes };
      }),
    }));
  }

  async function saveSelectionAndDetails() {
    setError(null);
    setSaving(true);
    const selected = activeTipos;
    const notas: Record<string, string> = {};
    state.camadas.forEach((layer) => {
      const text = layer.observacao?.trim();
      if (text) {
        notas[layer.tipo] = text;
      }
    });
    const payload = {
      camadas: state.camadas.map((layer) => ({
        tipo: layer.tipo,
        numero: layer.numero?.trim() || undefined,
        status: layer.status,
        observacao: layer.observacao?.trim() || undefined,
        dataDecisao: layer.dateUnknown ? null : layer.dataDecisao || null,
        dateUnknown: !!layer.dateUnknown,
        crimes: layer.status === "ALTERADA" ? layer.crimes ?? [] : [],
      })),
      recursosSelection: { tipos: selected },
      recursosNotes: notas,
    };
    const res = await fetch(`/api/processos/${processoId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data?.error ?? "Falha ao salvar recursos.");
      return;
    }
    window.location.reload();
  }

  const selectionPanel = (
    <details className="rounded border bg-white">
      <summary className="cursor-pointer select-none border-b bg-zinc-50 px-3 py-2 text-sm font-medium">
        Quais recursos/ações houve?
      </summary>
      <div className="p-3 text-sm space-y-4">
        {!state.sentencaSaved ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Primeiro, salve as informações da sentença (mesmo incompleta). Depois você consegue registrar recursos.
          </div>
        ) : null}

        <div className="rounded border bg-zinc-50 p-3 text-sm">
          <div className="font-medium">Recursos disponíveis (multi-select)</div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {RESOURCE_OPTIONS.map((option) => (
              <label key={option.tipo} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={activeTipos.includes(option.tipo)}
                  onChange={() => toggleTipo(option.tipo)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-600">
            Marque os recursos que de fato houve no processo. Cada seleção renderiza blocos organizados para cadastro de detalhes, datas e notas.
          </p>
        </div>

        <div className="rounded border bg-white p-3 text-sm">
          <div className="font-medium">Registro de datas críticas</div>
          {registryEntries.length ? (
            <div className="mt-2 space-y-1 text-xs text-zinc-600">
              {registryEntries.map((entry) => (
                <div key={entry.key}>
                  {entry.label} — {entry.unknown ? "Não consta" : entry.date ? formatDateDisplay(entry.date) : "Pendente"}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-xs text-zinc-500">
              Ainda não há recursos registrados. Marque um tipo para começar.
            </div>
          )}
        </div>

        {activeTipos.length ? (
          <div className="space-y-4">
            {activeTipos.map((tipo) => (
              <div key={tipo} className="rounded border border-zinc-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">
                    {RESOURCE_OPTIONS.find((opt) => opt.tipo === tipo)?.label ?? layerLabel(tipo)}
                  </div>
                  <button
                    type="button"
                    className="rounded border px-2 py-1 text-xs"
                    onClick={() => addLayer(tipo)}
                  >
                    + Mais
                  </button>
                </div>
                <div className="mt-3 space-y-3">
                  {(layersByTipo[tipo] ?? []).map((layer, index) => (
                    <div key={layer.key} className="rounded border border-zinc-200 bg-zinc-50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-semibold">
                          {layerLabel(layer.tipo)}{(layersByTipo[tipo]?.length ?? 0) > 1 ? ` #${index + 1}` : ""}
                        </div>
                        <button
                          type="button"
                          className="text-xs text-red-700"
                          onClick={() => removeLayer(layer.key)}
                        >
                          Remover
                        </button>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <label className="text-xs font-medium text-zinc-700">Número do recurso/ação</label>
                          <input
                            className="mt-1 w-full rounded border px-3 py-2"
                            value={layer.numero ?? ""}
                            onChange={(event) => setLayer(layer.key, { numero: event.target.value })}
                            placeholder="Ex.: 0001234-56.2020.8.00.0000"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-zinc-700">Data da decisão</label>
                          <input
                            className="mt-1 w-full rounded border px-3 py-2"
                            type="date"
                            value={layer.dataDecisao ?? ""}
                            disabled={!!layer.dateUnknown}
                            onChange={(event) => setLayer(layer.key, { dataDecisao: event.target.value })}
                          />
                          <label className="mt-2 flex items-center gap-2 text-xs text-zinc-700">
                            <input
                              type="checkbox"
                              checked={!!layer.dateUnknown}
                              onChange={(event) =>
                                setLayer(layer.key, {
                                  dateUnknown: event.target.checked,
                                  dataDecisao: event.target.checked ? "" : layer.dataDecisao,
                                })
                              }
                            />
                            Não consta / não sei
                          </label>
                          {layer.dateUnknown ? (
                            <p className="mt-1 text-xs text-amber-900">
                              Marcar como “Não consta/não sei” sinaliza pendência documental e impede o campo.
                            </p>
                          ) : !layer.dataDecisao ? (
                            <p className="mt-1 text-xs text-amber-700">
                              Esta data é crítica. Preencha-a ou marque a caixa acima antes de salvar.
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={`rounded border px-3 py-1 text-sm ${layer.status === "MANTIDA" ? "border-[color:var(--ssepa-accent)] bg-[color:var(--ssepa-accent)] text-white" : "bg-white text-zinc-700"}`}
                          onClick={() => setManteve(layer.key, true)}
                        >
                          Não (pena mantida)
                        </button>
                        <button
                          type="button"
                          className={`rounded border px-3 py-1 text-sm ${layer.status === "ALTERADA" ? "border-[color:var(--ssepa-accent)] bg-[color:var(--ssepa-accent)] text-white" : "bg-white text-zinc-700"}`}
                          onClick={() => setManteve(layer.key, false)}
                        >
                          Sim (alterar crimes e pena)
                        </button>
                      </div>

                      <div className="mt-3">
                        <label className="text-xs font-medium text-zinc-700">Observação</label>
                        <input
                          className="mt-1 w-full rounded border px-3 py-2"
                          value={layer.observacao ?? ""}
                          onChange={(event) => setLayer(layer.key, { observacao: event.target.value })}
                          placeholder="Ex.: parcial provimento"
                        />
                      </div>

                      {layer.status === "ALTERADA" ? (
                        <div className="mt-4 rounded border bg-white p-2">
                          <div className="text-xs font-medium text-zinc-700">Crimes/penas nesta camada</div>
                          <div className="mt-2 grid gap-2">
                            {(layer.crimes ?? []).map((crime, crimeIndex) => (
                              <div key={`${layer.key}-${crimeIndex}`} className="rounded border bg-zinc-50 p-2">
                                <div className="grid gap-2 md:grid-cols-[1fr_1fr_2fr_auto]">
                                  <input
                                    className="rounded border px-2 py-1 text-sm"
                                    value={crime.law}
                                    onChange={(event) => updateCrime(layer.key, crimeIndex, { law: event.target.value })}
                                    placeholder="Lei"
                                  />
                                  <input
                                    className="rounded border px-2 py-1 text-sm"
                                    value={crime.article}
                                    onChange={(event) => updateCrime(layer.key, crimeIndex, { article: event.target.value })}
                                    placeholder="Artigo"
                                  />
                                  <input
                                    className="rounded border px-2 py-1 text-sm"
                                    value={crime.description ?? ""}
                                    onChange={(event) => updateCrime(layer.key, crimeIndex, { description: event.target.value })}
                                    placeholder="Descrição curta"
                                  />
                                  <button
                                    type="button"
                                    className="rounded border px-2 py-1 text-xs"
                                    onClick={() => removeCrime(layer.key, crimeIndex)}
                                  >
                                    Remover
                                  </button>
                                </div>
                                <div className="mt-2 grid gap-2 md:grid-cols-3">
                                  <input
                                    className="rounded border px-2 py-1 text-sm"
                                    value={crime.penaltyYears ?? 0}
                                    onChange={(event) =>
                                      updateCrime(layer.key, crimeIndex, { penaltyYears: Number(event.target.value || 0) })
                                    }
                                    placeholder="Anos"
                                    type="number"
                                    min={0}
                                  />
                                  <input
                                    className="rounded border px-2 py-1 text-sm"
                                    value={crime.penaltyMonths ?? 0}
                                    onChange={(event) =>
                                      updateCrime(layer.key, crimeIndex, { penaltyMonths: Number(event.target.value || 0) })
                                    }
                                    placeholder="Meses"
                                    type="number"
                                    min={0}
                                  />
                                  <input
                                    className="rounded border px-2 py-1 text-sm"
                                    value={crime.penaltyDays ?? 0}
                                    onChange={(event) =>
                                      updateCrime(layer.key, crimeIndex, { penaltyDays: Number(event.target.value || 0) })
                                    }
                                    placeholder="Dias"
                                    type="number"
                                    min={0}
                                  />
                                </div>
                                <div className="mt-2 text-[11px] text-zinc-600">pena: {penaStr(crime)}</div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2">
                            <button
                              type="button"
                              className="rounded border px-2 py-1 text-xs"
                              onClick={() => addCrime(layer.key)}
                            >
                              + Crime nesta camada
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-500">
            Nenhum recurso selecionado. Marque uma caixa acima para começar.
          </div>
        )}

        <div className="mt-3">
          <button
            type="button"
            className="ssepa-btn rounded px-3 py-2 text-sm disabled:opacity-50"
            onClick={saveSelectionAndDetails}
            disabled={saving || loading || !state.sentencaSaved}
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
          {missingDates.length ? (
            <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              Pendências: registre a data ou marque “Não consta/não sei” para {missingDates.map((entry) => entry.label).join(", ")}.
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>
        ) : null}
      </div>
    </details>
  );

  return (
    <div className="mt-4 rounded border">
      <button
        type="button"
        className="flex w-full items-center justify-between bg-zinc-50 p-3 text-left text-sm"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="font-medium">Recursos</span>
        <span className="text-xs text-zinc-600">{open ? "Ocultar" : "Editar"}</span>
      </button>
      {open ? (
        <div className="p-3 text-sm">{loading ? <div className="text-sm text-zinc-600">Carregando…</div> : null}{selectionPanel}</div>
      ) : null}
    </div>
  );
}
