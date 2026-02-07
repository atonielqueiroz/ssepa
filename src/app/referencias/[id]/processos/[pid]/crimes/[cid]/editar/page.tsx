"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Art112Assistant, type Art112AssistantValue, type ProgEspecial112State } from "../../Art112Assistant";

export default function EditarCrimePage() {
  const router = useRouter();
  const params = useParams<{ id: string; pid: string; cid: string }>();
  const referenceId = params.id;
  const processoId = params.pid;
  const crimeId = params.cid;

  const [law, setLaw] = useState("");
  const [article, setArticle] = useState("");
  const [factDate, setFactDate] = useState("");
  // trânsito em julgado é do processo (não do crime)
  const [penaltyYears, setPenaltyYears] = useState(0);
  const [penaltyMonths, setPenaltyMonths] = useState(0);
  const [penaltyDays, setPenaltyDays] = useState(0);

  const [hasViolence, setHasViolence] = useState(false);

  const [nature, setNature] = useState<"COMUM" | "HEDIONDO" | "EQUIPARADO">("COMUM");
  const [equiparadoType, setEquiparadoType] = useState<"TORTURA" | "TRAFICO" | "TERRORISMO" | "">("");

  // Deprecated (compat)
  const [isHediondo, setIsHediondo] = useState(false);

  const [hasResultDeath, setHasResultDeath] = useState(false);
  const [hasOrgCrimLead, setHasOrgCrimLead] = useState(false);
  const [hasMilicia, setHasMilicia] = useState(false);
  const [isFeminicidio, setIsFeminicidio] = useState(false);

  const [art112Sel, setArt112Sel] = useState<Art112AssistantValue>({ mode: "AUTO", inciso: "" });

  // Progressão especial (art. 112, §3º–§4º) é do CASO
  const [refGender, setRefGender] = useState<"MASCULINO" | "FEMININO" | "OUTRO" | null>(null);
  const [refGestante, setRefGestante] = useState(false);
  const [refMaeResp, setRefMaeResp] = useState(false);
  const [refNovoDoloso, setRefNovoDoloso] = useState(false);
  const [hasFaltaGrave, setHasFaltaGrave] = useState(false);

  const [progEspecial, setProgEspecial] = useState<ProgEspecial112State>({
    visible: false,
    enabled: false,
    req_I_semViolencia: false,
    req_II_naoCrimeContraFilho: false,
    req_III_cumpriuUmOitavoRegAnterior: false,
    req_IV_primariaBomComport: false,
    req_V_naoOrgCrim: false,
    revoked: false,
    revokedReasons: [],
    saving: false,
  });

  const [sourceText, setSourceText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    (async () => {
      if (referenceId) {
        const refRes = await fetch(`/api/referencias/${referenceId}`);
        const refData = await refRes.json().catch(() => ({}));
        if (refRes.ok && refData?.reference) {
          const r = refData.reference;
          setRefGender(r.reeducandoGender ?? null);
          setRefGestante(!!r.reeducandaGestante);
          setRefMaeResp(!!r.reeducandaMaeOuResponsavelCriancaOuPcd);
          setRefNovoDoloso(!!r.novoCrimeDoloso);
          setProgEspecial((prev) => ({
            ...prev,
            enabled: !!r.progEspecial112_3_enabled,
            req_I_semViolencia: !!r.progEspecial112_3_req_I_semViolencia,
            req_II_naoCrimeContraFilho: !!r.progEspecial112_3_req_II_naoCrimeContraFilho,
            req_III_cumpriuUmOitavoRegAnterior: !!r.progEspecial112_3_req_III_cumpriuUmOitavoRegAnterior,
            req_IV_primariaBomComport: !!r.progEspecial112_3_req_IV_primariaBomComport,
            req_V_naoOrgCrim: !!r.progEspecial112_3_req_V_naoOrgCrim,
          }));
        }

        const incRes = await fetch(`/api/incidentes?referenceId=${referenceId}`);
        const incData = await incRes.json().catch(() => ({}));
        if (incRes.ok) {
          const hasFG = (incData?.incidentes ?? []).some((i: any) => i.type === "HOMOLOGACAO_FALTA_GRAVE");
          setHasFaltaGrave(!!hasFG);
        }
      }

      const res = await fetch(`/api/processos/${processoId}/crimes/${crimeId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Falha ao carregar crime.");
        setBooting(false);
        return;
      }

      const c = data.crime;
      setLaw(c.law ?? "");
      setArticle(c.article ?? "");
      setFactDate(c.factDate ?? "");
      // trânsito em julgado não é editado no crime
      setPenaltyYears(c.penaltyYears ?? 0);
      setPenaltyMonths(c.penaltyMonths ?? 0);
      setPenaltyDays(c.penaltyDays ?? 0);
      setHasViolence(!!c.hasViolence);
      setIsHediondo(!!c.isHediondo);
      setHasResultDeath(!!c.hasResultDeath);
      setHasOrgCrimLead(!!c.hasOrgCrimLead);
      setHasMilicia(!!c.hasMilicia);
      setIsFeminicidio(!!c.isFeminicidio);

      if (c.nature) setNature(c.nature);
      if (c.equiparadoType) setEquiparadoType(c.equiparadoType);

      if (c.art112ChoiceMode === "MANUAL") {
        setArt112Sel({ mode: "MANUAL", inciso: (c.art112Inciso ?? "I") as any });
      } else {
        setArt112Sel({ mode: "AUTO", inciso: "" });
      }

      setSourceText(c.sourceText ?? "");
      setBooting(false);
    })();
  }, [processoId, crimeId, referenceId]);

  const progEspecialComputed = useMemo(() => {
    const visible = refGender === "FEMININO" && (refGestante || refMaeResp);
    const revokedReasons: string[] = [];
    if (hasFaltaGrave) revokedReasons.push("falta grave registrada");
    if (refNovoDoloso) revokedReasons.push("novo crime doloso");
    const revoked = revokedReasons.length > 0;
    return {
      ...progEspecial,
      visible,
      revoked,
      revokedReasons,
    } as ProgEspecial112State;
  }, [progEspecial, refGender, refGestante, refMaeResp, hasFaltaGrave, refNovoDoloso]);

  async function onSaveProgEspecial() {
    setProgEspecial((p) => ({ ...p, saving: true }));
    const res = await fetch(`/api/referencias/${referenceId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        progEspecial112_3_enabled: progEspecial.enabled,
        progEspecial112_3_req_I_semViolencia: progEspecial.req_I_semViolencia,
        progEspecial112_3_req_II_naoCrimeContraFilho: progEspecial.req_II_naoCrimeContraFilho,
        progEspecial112_3_req_III_cumpriuUmOitavoRegAnterior: progEspecial.req_III_cumpriuUmOitavoRegAnterior,
        progEspecial112_3_req_IV_primariaBomComport: progEspecial.req_IV_primariaBomComport,
        progEspecial112_3_req_V_naoOrgCrim: progEspecial.req_V_naoOrgCrim,
      }),
    });
    setProgEspecial((p) => ({ ...p, saving: false }));
    if (!res.ok) {
      setError("Não foi possível salvar a progressão especial no caso.");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const derivedIsHediondo = nature !== "COMUM";

    const res = await fetch(`/api/processos/${processoId}/crimes/${crimeId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        law,
        article,
        factDate,
        penaltyYears,
        penaltyMonths,
        penaltyDays,
        hasViolence,
        isHediondo: derivedIsHediondo,
        hasResultDeath,
        hasOrgCrimLead,
        hasMilicia,
        isFeminicidio,
        nature,
        equiparadoType: nature === "EQUIPARADO" ? equiparadoType || null : null,
        art112ChoiceMode: art112Sel.mode,
        art112Inciso: art112Sel.mode === "MANUAL" ? art112Sel.inciso : null,
        sourceText,
      }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data?.error ?? "Falha ao salvar alterações.");
      return;
    }

    router.push(`/referencias/${referenceId}/processos/${processoId}`);
  }

  if (booting) {
    return (
      <div>
        <div className="text-sm text-zinc-600">Carregando…</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Editar Crime</h1>
      <div className="mt-2 rounded border bg-zinc-50 p-3 text-sm text-zinc-700">
        <div className="font-medium">Camada: Sentença (condenação originária)</div>
        <div className="mt-1 text-xs text-zinc-600">
          Para registrar alterações em Apelação/REsp/RE/HC/Revisão, use “Editar processo (marcos + recursos)” e ajuste a camada correspondente.
        </div>
      </div>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Lei *</label>
            <input className="mt-1 w-full rounded border px-3 py-2" value={law} onChange={(e) => setLaw(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium">Artigo/Dispositivo *</label>
            <input className="mt-1 w-full rounded border px-3 py-2" value={article} onChange={(e) => setArticle(e.target.value)} required />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Data do fato *</label>
          <input className="mt-1 w-full rounded border px-3 py-2" type="date" value={factDate} onChange={(e) => setFactDate(e.target.value)} required />
          <div className="mt-1 text-xs text-zinc-600">Trânsito em julgado pertence ao processo (marcos), não ao crime.</div>
        </div>

        <div>
          <div className="text-sm font-medium">Pena do crime *</div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <input className="rounded border px-3 py-2" type="number" min={0} value={penaltyYears} onChange={(e) => setPenaltyYears(Number(e.target.value))} placeholder="Anos" />
            <input className="rounded border px-3 py-2" type="number" min={0} max={11} value={penaltyMonths} onChange={(e) => setPenaltyMonths(Number(e.target.value))} placeholder="Meses" />
            <input className="rounded border px-3 py-2" type="number" min={0} max={30} value={penaltyDays} onChange={(e) => setPenaltyDays(Number(e.target.value))} placeholder="Dias" />
          </div>
        </div>

        <div className="grid gap-3 rounded border bg-zinc-50 p-3 text-sm">
          <div className="font-medium">Classificação e campos que impactam o art. 112</div>

          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Natureza do delito *</label>
              <select
                className="mt-1 w-full rounded border bg-white px-3 py-2"
                value={nature}
                onChange={(e) => {
                  const v = e.target.value as any;
                  setNature(v);
                  if (v !== "EQUIPARADO") setEquiparadoType("");
                }}
              >
                <option value="COMUM">Comum (não hediondo/equiparado)</option>
                <option value="HEDIONDO">Hediondo (Lei 8.072/90)</option>
                <option value="EQUIPARADO">Equiparado (CF art. 5º, XLIII)</option>
              </select>
            </div>

            {nature === "EQUIPARADO" ? (
              <div>
                <label className="text-sm font-medium">Tipo de equiparado *</label>
                <select
                  className="mt-1 w-full rounded border bg-white px-3 py-2"
                  value={equiparadoType}
                  onChange={(e) => setEquiparadoType(e.target.value as any)}
                  required
                >
                  <option value="">Selecione…</option>
                  <option value="TORTURA">Tortura</option>
                  <option value="TRAFICO">Tráfico de drogas</option>
                  <option value="TERRORISMO">Terrorismo</option>
                </select>
              </div>
            ) : null}
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={hasViolence} onChange={(e) => setHasViolence(e.target.checked)} /> Com violência ou grave ameaça
          </label>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={hasResultDeath} onChange={(e) => setHasResultDeath(e.target.checked)} /> Resultado morte
          </label>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={hasOrgCrimLead} onChange={(e) => setHasOrgCrimLead(e.target.checked)} /> Comando de organização criminosa p/ hediondo
          </label>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={hasMilicia} onChange={(e) => setHasMilicia(e.target.checked)} /> Milícia privada
          </label>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isFeminicidio} onChange={(e) => setIsFeminicidio(e.target.checked)} /> Feminicídio
          </label>

          <Art112Assistant
            factDate={factDate}
            hasViolence={hasViolence}
            isHediondoOrEquiparado={nature !== "COMUM"}
            hasResultDeath={hasResultDeath}
            hasOrgCrimLead={hasOrgCrimLead}
            hasMilicia={hasMilicia}
            isFeminicidio={isFeminicidio}
            value={art112Sel}
            onChange={setArt112Sel}
            progEspecial={progEspecialComputed}
            onChangeProgEspecial={setProgEspecial}
            onSaveProgEspecial={onSaveProgEspecial}
          />

          <input type="hidden" value={isHediondo ? "1" : "0"} readOnly />
        </div>

        <div>
          <label className="text-sm font-medium">Fonte nos autos *</label>
          <textarea className="mt-1 w-full rounded border px-3 py-2" rows={4} value={sourceText} onChange={(e) => setSourceText(e.target.value)} required />
        </div>

        {error ? (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="flex gap-2">
          <button className="ssepa-btn rounded px-3 py-2 text-sm disabled:opacity-50" disabled={loading} type="submit">
            {loading ? "Salvando…" : "Salvar alterações"}
          </button>
          <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => router.back()}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
