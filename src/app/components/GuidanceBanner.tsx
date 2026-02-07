"use client";

import { useEffect, useState } from "react";

const DISMISSED_KEY = "ssepa_guidance_dismissed";
const SHOW_ONCE_KEY = "ssepa_guidance_show_once";

export function GuidanceBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem(DISMISSED_KEY) === "1";
      const showOnce = window.localStorage.getItem(SHOW_ONCE_KEY) === "1";
      setVisible(showOnce || !dismissed);
    } catch {
      // fallback: show
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function close() {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
      window.localStorage.setItem(SHOW_ONCE_KEY, "0");
    } catch {}
    setVisible(false);
  }

  return (
    <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
      <div className="relative">
        <button
          type="button"
          className="absolute right-0 top-0 rounded border border-amber-200 bg-white px-2 py-1 text-xs text-amber-900 hover:bg-amber-100"
          onClick={close}
          aria-label="Fechar aviso"
          title="Fechar"
        >
          X
        </button>

        <div className="px-8 text-center">
          <div className="font-semibold">Não ignore este aviso!</div>

          <ol className="mt-2 list-decimal pl-5 text-left text-sm text-amber-950/90 md:mx-auto md:max-w-[980px]">
            <li>
              O SSEPA é um sistema <span className="font-semibold">COMPLETO</span> para o advogado/defensor ter controle sobre as execuções penais sob seu patrocínio.
            </li>
            <li className="mt-1">
              As execuções cadastradas ficam salvas para consultas futuras e para geração de simulações com relatórios sobre direitos como progressão de regime,
              livramento condicional, indulto, comutação, prescrições (PPP (R) ou PPE), atualização do atestado de pena com novas remições e outras funcionalidades —
              tudo automatizado conforme as informações lançadas pelo advogado/defensor.
            </li>
            <li className="mt-1">
              Para precisão das simulações, é importante o cadastro minucioso e completo de todas as informações solicitadas pelo sistema. Datas são marcos relevantes:
              não ignore nenhuma. Do contrário, podem surgir inconsistências ou erros.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export function triggerGuidanceBannerOnce() {
  try {
    window.localStorage.setItem(SHOW_ONCE_KEY, "1");
  } catch {}
}
