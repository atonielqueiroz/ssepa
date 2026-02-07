"use client";

import { useState } from "react";

const BOOKMARKLET = `javascript:(()=>{try{const t=(s)=>{const el=document.querySelector(s);return el?el.textContent.trim():""};const num=t('span:has(> span)')||document.title;const header=document.body.innerText;const out={
  source:"SEEU_CONSULTA_PUBLICA",
  capturedAt:new Date().toISOString(),
  // The user should paste the exec/process number manually if not detected
  execNumber:"",
  processoNumber:(document.querySelector('span[style*="color"]')?.textContent||"").trim(),
  diasTramitacao:(()=>{const m=document.body.innerText.match(/\((\d+)\s+dia\(s\) em tramita/);return m?parseInt(m[1],10):null})(),
  classeProcessual:(()=>{const m=document.body.innerText.match(/Classe Processual:\s*([^\n]+)/i);return m?m[1].trim():""})(),
  assuntoPrincipal:(()=>{const m=document.body.innerText.match(/Assunto Principal:\s*([^\n]+)/i);return m?m[1].trim():""})(),
  nivelSigilo:(()=>{const m=document.body.innerText.match(/Nível de Sigilo:\s*([^\n]+)/i);return m?m[1].trim():""})(),
  comarca:(()=>{const m=document.body.innerText.match(/Comarca\/Subseção:\s*([^\n]+)/i);return m?m[1].trim():""})(),
  competencia:(()=>{const m=document.body.innerText.match(/Competência:\s*([^\n]+)/i);return m?m[1].trim():""})(),
  juizo:(()=>{const m=document.body.innerText.match(/Juízo:\s*([^\n]+)/i);return m?m[1].trim():""})(),
  juiz:(()=>{const m=document.body.innerText.match(/Juiz:\s*([^\n]+)/i);return m?m[1].trim():""})(),
  autuacao:(()=>{const m=document.body.innerText.match(/Autuação:\s*([^\n]+)/i);return m?m[1].trim():""})(),
  distribuicao:(()=>{const m=document.body.innerText.match(/Distribuição:\s*([^\n]+)/i);return m?m[1].trim():""})(),
  executadoNome:(()=>{const m=document.body.innerText.match(/Executado\s+[\s\S]*?\n([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]+)\n/i);return m?m[1].trim():""})(),
};
navigator.clipboard.writeText(JSON.stringify(out,null,2));alert('SSEPA: dados copiados para a área de transferência. Cole no SSEPA.');}catch(e){alert('SSEPA: falhou ao capturar. '+e);}})();`;

export default function ImportarSEEUPage() {
  const [payload, setPayload] = useState("");
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onImport() {
    setError(null);
    if (!agree) {
      setError("Você precisa concordar com a declaração de uso responsável.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/import/seeu", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data?.error ?? "Falha ao importar.");
      return;
    }

    window.location.href = `/referencias/${data.referenceId}`;
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Importar do SEEU (consulta pública)</h1>
      <p className="mt-2 text-sm text-zinc-700">
        Por causa de CAPTCHA e regras de privacidade do SEEU, a importação é <b>assistida</b>:
        você acessa o SEEU, resolve o CAPTCHA, e o SSEPA importa apenas os dados exibidos.
      </p>

      <div className="mt-6 rounded border p-4">
        <div className="font-medium">Passo a passo</div>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-700">
          <li>Abra o SEEU Consulta Pública e localize o processo.</li>
          <li>Na página do processo (Informações Gerais / Partes), execute o bookmarklet abaixo.</li>
          <li>Ele copia um JSON para a área de transferência. Cole no campo “Dados copiados”.</li>
          <li>Clique em Importar.</li>
        </ol>

        <div className="mt-4">
          <div className="text-sm font-medium">Bookmarklet (arraste para a barra de favoritos)</div>
          <a
            className="ssepa-btn mt-2 inline-block rounded px-3 py-2 text-sm"
            href={BOOKMARKLET}
          >
            SSEPA: Capturar dados do SEEU
          </a>
          <p className="mt-2 text-xs text-zinc-600">
            Dica: você pode também copiar o link do botão e criar um favorito manualmente.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <label className="text-sm font-medium">Dados copiados (JSON)</label>
        <textarea
          className="mt-1 w-full rounded border px-3 py-2 font-mono text-xs"
          rows={12}
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          placeholder="Cole aqui o JSON copiado pelo bookmarklet…"
        />
      </div>

      <label className="mt-4 flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>
          Declaro que tenho legitimidade para acessar este processo no SEEU e usarei os dados
          apenas para finalidades legais de acompanhamento da execução penal, conferindo informações
          e evitando uso indevido.
        </span>
      </label>

      {error ? (
        <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <button
        className="ssepa-btn mt-4 rounded px-3 py-2 text-sm disabled:opacity-50"
        disabled={loading}
        onClick={onImport}
      >
        {loading ? "Importando…" : "Importar"}
      </button>
    </div>
  );
}
