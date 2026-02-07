"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Art112Assistant, type Art112AssistantValue, type ProgEspecial112State } from "../Art112Assistant";

function normalizeLawFromText(text: string) {
  const t = (text || "").toLowerCase();
  if (t.includes("11.343") || t.includes("lei 11343") || t.includes("lei nº 11.343")) return "Lei 11.343/06";
  if (t.includes("10.826") || t.includes("lei 10826")) return "Lei 10.826/03";
  if (t.includes("8.072") || t.includes("lei 8072")) return "Lei 8.072/90";
  if (t.includes("codigo penal") || t.includes("código penal") || t.includes("\ncp") || t.includes(" cp")) return "CP";
  return "CP";
}

function inferDescriptionFromText(law: string, article: string) {
  const a = article.replace(/\s+/g, " ").toLowerCase();
  if (law.includes("11.343") && a.includes("art. 33")) return "Tráfico";
  if (law.includes("11.343") && a.includes("art. 35")) return "Associação para o tráfico";
  return "";
}

function extractArticlesFromDispositivo(text: string) {
  const law = normalizeLawFromText(text);
  const re = /(art\.?|artigo)\s*(\d+[a-z]?)\s*([^\n;]*)/gi;
  const out: Array<{ law: string; article: string; description?: string }> = [];
  for (const m of text.matchAll(re)) {
    const num = m[2];
    const tail = (m[3] || "").trim();
    const tailStop = tail.split(/(?=\bart\.?\b|\bartigo\b)/i)[0].trim();
    let piece = `art. ${num}`;
    const qual = tailStop.match(/^(?:,?\s*(?:§\s*\d+º?|inc\.?\s*[ivxlcdm]+|inciso\s*[ivxlcdm]+|[ivxlcdm]+|caput|par\.?\s*único|paragrafo\s*único|parágrafo\s*único|al[ií]nea\s*[a-z]))+/i);
    if (qual?.[0]) piece += " " + qual[0].trim().replace(/^,\s*/, "").replace(/\s+/g, " ");
    const cc = tailStop.match(/c\/c\s*(?:art\.?|artigo)\s*\d+[a-z]?(?:\s*,\s*(?:§\s*\d+º?|inc\.?\s*[ivxlcdm]+|[ivxlcdm]+))?/gi);
    if (cc?.length) {
      const ccNorm = cc
        .map((s) => s.replace(/c\/c\s*/i, "").replace(/artigo/gi, "art.").replace(/\s+/g, " ").trim())
        .map((s) => s.replace(/^art\./i, "art."));
      piece += " c/c " + ccNorm.join(" c/c ");
    }
    piece = piece.replace(/\s+,/g, ",").replace(/\s+/g, " ").trim();
    if (!out.some((x) => x.article.toLowerCase() === piece.toLowerCase())) {
      const description = inferDescriptionFromText(law, piece);
      out.push({ law, article: piece, description: description || undefined });
    }
  }
  return out;
}

export default function NovoCrimePage() {
  const router = useRouter();
  const params = useParams<{ id: string; pid: string }>();
  const referenceId = params.id;
  const processoId = params.pid;

  const [law, setLaw] = useState("Código Penal");
  const [article, setArticle] = useState("");
  const [description, setDescription] = useState("");
  const [factDate, setFactDate] = useState("");
  const [processFatosBaseAt, setProcessFatosBaseAt] = useState<string | null>(null);
  const [processFatosNaoSei, setProcessFatosNaoSei] = useState(false);
  const [transitDate, setTransitDate] = useState("");
  const [penaltyYears, setPenaltyYears] = useState(0);
  const [penaltyMonths, setPenaltyMonths] = useState(0);
  const [penaltyDays, setPenaltyDays] = useState(0);

  const [hasViolence, setHasViolence] = useState(false);

  // Natureza do delito (para leigos)
  const [nature, setNature] = useState<"COMUM" | "HEDIONDO" | "EQUIPARADO">("COMUM");
  const [equiparadoType, setEquiparadoType] = useState<"TORTURA" | "TRAFICO" | "TERRORISMO" | "">("");

  // Deprecated (mantido para compatibilidade); será derivado de "nature"
  const [isHediondo, setIsHediondo] = useState(false);

  const [hasResultDeath, setHasResultDeath] = useState(false);
  const [hasOrgCrimLead, setHasOrgCrimLead] = useState(false);
  const [hasMilicia, setHasMilicia] = useState(false);
  const [isFeminicidio, setIsFeminicidio] = useState(false);

  const [art112Sel, setArt112Sel] = useState<Art112AssistantValue>({ mode: "AUTO", inciso: "" });

  // Progressão especial (art. 112, §3º–§4º) é do CASO, não do crime.
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
  const [prefillInfo, setPrefillInfo] = useState<string | null>(null);
  const [dispositivoSugestoes, setDispositivoSugestoes] = useState<Array<{ law: string; article: string; description?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Prefill from querystring (pré-cadastro do dispositivo) — evita useSearchParams() no build
    try {
      const sp = new URLSearchParams(window.location.search);
      const qLaw = sp.get("law");
      const qArt = sp.get("article");
      const qDesc = sp.get("desc");
      if (qLaw) setLaw(qLaw);
      if (qArt) setArticle(qArt);
      if (qDesc) setDescription(qDesc);
      if (qLaw || qArt || qDesc) setPrefillInfo("Pré-cadastro: lei/artigo/descrição preenchidos a partir do dispositivo. Complete pena/data do fato e demais campos.");
    } catch {}

    (async () => {
      if (!referenceId) return;
      // Carrega perfil do caso (progressão especial)
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

      // Falta grave (para revogação §4º)
      const incRes = await fetch(`/api/incidentes?referenceId=${referenceId}`);
      const incData = await incRes.json().catch(() => ({}));
      if (incRes.ok) {
        const hasFG = (incData?.incidentes ?? []).some((i: any) => i.type === "HOMOLOGACAO_FALTA_GRAVE");
        setHasFaltaGrave(!!hasFG);
      }

      // Base do processo (data do(s) fato(s))
      const procRes = await fetch(`/api/processos/${processoId}`);
      const procData = await procRes.json().catch(() => ({}));
      if (procRes.ok && procData?.processo) {
        setProcessFatosBaseAt(procData.processo.fatosBaseAt ?? null);
        setProcessFatosNaoSei(!!procData.processo.fatosBaseNaoSei);
        if (!factDate && !procData.processo.fatosBaseNaoSei && procData.processo.fatosBaseAt) {
          setFactDate(procData.processo.fatosBaseAt);
        }
      }

      // Sugestões automáticas do dispositivo (para cadastro de crimes)
      try {
        const ms = procData?.processo?.marcosSource ?? {};
        const raw = typeof ms.dispositivoSentenca === "string" ? ms.dispositivoSentenca : (ms.dispositivoSentenca?.text ?? "");
        const sugestoes = raw ? extractArticlesFromDispositivo(String(raw)) : [];
        setDispositivoSugestoes(sugestoes);

        const sp2 = new URLSearchParams(window.location.search);
        const hasQuery2 = !!(sp2.get("law") || sp2.get("article") || sp2.get("desc"));
        if (!hasQuery2 && !article && sugestoes.length) {
          const first = sugestoes[0];
          setLaw(first.law);
          setArticle(first.article);
          if (first.description) setDescription(first.description);
          setPrefillInfo("Sugestão: lei/artigo/descrição preenchidos automaticamente a partir do dispositivo. Se necessário, ajuste ou clique em ‘Limpar’. ");
        }
      } catch {}

      const res = await fetch(`/api/processos/${processoId}/crimes?last=1`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const c = data?.crime;
      if (!c) return;

      // Prefill common repeated fields for same process
      if (!factDate) setFactDate(c.factDate ?? "");
      if (!transitDate) setTransitDate(c.transitDate ?? "");
      if (law === "Código Penal" && c.law) setLaw(c.law);

      // Optional: also prefill common flags
      setHasViolence(!!c.hasViolence);
      setIsHediondo(!!c.isHediondo);
      setHasResultDeath(!!c.hasResultDeath);
      setHasOrgCrimLead(!!c.hasOrgCrimLead);
      setHasMilicia(!!c.hasMilicia);
      setIsFeminicidio(!!c.isFeminicidio);

      // Try to prefill nature from old boolean
      if (c.isHediondo) setNature("HEDIONDO");

      setPrefillInfo("Pré-preenchido com base no último crime cadastrado neste processo.");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceId, processoId]);

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
      // não bloqueia; apenas avisa no topo
      setPrefillInfo("Não foi possível salvar a progressão especial no caso. Tente novamente.");
    } else {
      setPrefillInfo("Progressão especial salva no caso.");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const derivedIsHediondo = nature !== "COMUM";

    const res = await fetch(`/api/processos/${processoId}/crimes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        processoId,
        law,
        article,
        description: description.trim() || null,
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
      setError(data?.error ?? "Falha ao salvar crime.");
      return;
    }

    router.push(`/referencias/${referenceId}/processos/${processoId}`);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Novo Crime (condenação individualizada)</h1>
      <div className="mt-2 rounded border bg-zinc-50 p-3 text-sm text-zinc-700">
        <div className="font-medium">Camada: Sentença (condenação originária)</div>
        <div className="mt-1 text-xs text-zinc-600">
          Para registrar crimes/penas alterados em Apelação/REsp/RE/HC/Revisão, use “Editar processo (marcos + recursos)” e ajuste a camada correspondente.
        </div>
      </div>
      <p className="mt-2 text-sm text-zinc-600">
        Preencha pena por crime e marque os campos Sim/Não obrigatórios. Sempre registre a fonte nos autos.
      </p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        {prefillInfo ? (
          <div className="rounded border bg-zinc-50 p-2 text-sm text-zinc-700">{prefillInfo}</div>
        ) : null}

        {dispositivoSugestoes.length ? (
          <div className="rounded border bg-white p-2 text-sm">
            <div className="text-xs font-medium text-zinc-700">Sugestões do dispositivo</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {dispositivoSugestoes.slice(0, 8).map((sug, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="rounded border bg-white px-2 py-1 text-xs hover:bg-zinc-50"
                  onClick={() => {
                    setLaw(sug.law);
                    setArticle(sug.article);
                    setDescription(sug.description ?? "");
                  }}
                >
                  {sug.article}
                </button>
              ))}
              <button
                type="button"
                className="rounded border bg-white px-2 py-1 text-xs hover:bg-zinc-50"
                onClick={() => {
                  setLaw("Código Penal");
                  setArticle("");
                  setDescription("");
                }}
              >
                Limpar
              </button>
            </div>
          </div>
        ) : null}
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
          <label className="text-sm font-medium">Descrição curta (opcional)</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Tráfico (causa de aumento art. 40, III)"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Data do fato{processFatosNaoSei ? " (não informado)" : " *"}</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            type="date"
            value={factDate}
            onChange={(e) => setFactDate(e.target.value)}
            required={!processFatosNaoSei}
          />
          {processFatosNaoSei ? (
            <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              Atenção: sem a data dos fatos, o SSEPA terá limitações. Isso pode dificultar a análise de direitos e impedir o auxílio do sistema no enquadramento dos percentuais para progressão de regime e livramento condicional.
            </div>
          ) : null}
          <div className="mt-1 text-xs text-zinc-600">Trânsito em julgado pertence ao processo (marcos), não ao crime.</div>
          {processFatosBaseAt && !processFatosNaoSei ? (
            <div className="mt-1 text-xs text-zinc-600">Padrão do processo: {processFatosBaseAt.split("-").reverse().join("/")} (você pode alterar por crime).</div>
          ) : null}
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
              <div className="mt-1 text-xs text-zinc-600">
                Se for equiparado, a explicação citará a CF art. 5º, XLIII e a Lei 8.072/90 quando houver previsão.
              </div>
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

          {/* hidden compat state; keep checkbox derivation consistent */}
          <input type="hidden" value={isHediondo ? "1" : "0"} readOnly />
        </div>

        <div>
          <label className="text-sm font-medium">Fonte nos autos *</label>
          <textarea
            className="mt-1 w-full rounded border px-3 py-2"
            rows={4}
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Mov/seq/evento, arquivo e página. Ex.: mov. 417, SENT1, p. 11-12"
            required
          />
        </div>

        {error ? (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="flex gap-2">
          <button className="ssepa-btn rounded px-3 py-2 text-sm disabled:opacity-50" disabled={loading} type="submit">
            {loading ? "Salvando…" : "Salvar"}
          </button>
          <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => router.back()}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
