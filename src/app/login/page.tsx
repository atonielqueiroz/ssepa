"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { THREADS_POST_URL } from "@/lib/threads";
import { ThreadsEmbed } from "@/app/components/ThreadsEmbed";

const APP_VERSION = "1.0";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // querystring error is parsed client-side to avoid Next build suspense requirements

  const [error, setError] = useState<string | null>(null);
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  const funcionalidades = useMemo(
    () => [
      "Linha do tempo por processo: eventos, decisões e incidentes — e visão consolidada de vários casos",
      "Cálculo semiautomático e manual: progressão comum e especial, vedações e simulações de livramento",
      "Indultos semiautomáticos + dicas objetivas do que pode ser pedido (benefícios e direitos executórios)",
      "Alertas de inconsistências na execução penal + apoio prático com jurisprudência (temas e súmulas)",
      "Atualizado com a LEP e alterações — incl. Lei nº 15.295/2025",
      "Crimes e enquadramentos revisados (últimos anos)",
      "Leis, temas e súmulas na base",
    ],
    []
  );
  const [funcIndex, setFuncIndex] = useState(0);

  // Prefill saved email (we never store password)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ssepa_saved_email");
      if (saved) setEmail(saved);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("error") === "1") setError("Email ou senha inválidos");
      const e = sp.get("e");
      if (e === "google_oauth_not_configured") setError("Login com Google ainda não está configurado.");
      if (e === "oauth_state") setError("Falha no login com Google: estado inválido.");
      if (e === "oauth_token") setError("Falha no login com Google: não foi possível trocar o token.");
      if (e === "oauth_nonce") setError("Falha no login com Google: nonce inválido.");
      if (e === "no_email") setError("Falha no login com Google: conta sem email.");
    } catch {}
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => {
      setFuncIndex((i) => (i + 1) % funcionalidades.length);
    }, 3200);
    return () => window.clearInterval(t);
  }, [funcionalidades.length]);

  useEffect(() => {
    // reinicia o timer após clique (próxima iteração do interval já pega o novo índice)
    // mantendo a rotação automática.
  }, [funcIndex]);

  function onSubmit() {
    setError(null);
    try {
      localStorage.setItem("ssepa_saved_email", email);
    } catch {}
  }

  const outerPadY = "clamp(12px, 2vh, 24px)";
  const outerPadX = "clamp(12px, 2vw, 24px)";

  return (
    <div
      className="min-h-screen overflow-hidden"
      style={{
        background: `linear-gradient(135deg, var(--ssepa-navy), var(--ssepa-teal))`,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: `${outerPadY} ${outerPadX}`,
      }}
    >
      <div
        className="mx-auto w-full max-w-5xl"
        style={{
          maxHeight: `calc(100vh - 2 * ${outerPadY})`,
          display: "flex",
          flexDirection: "column",
          gap: "clamp(10px, 1.6vh, 18px)",
        }}
      >
        {/* Title centered above the two panels */}
        <div className="text-center text-white">
          <div className="mx-auto inline-flex flex-col items-center gap-2">
          </div>

          <div className="mt-3 flex items-end justify-center gap-2">
            <div className="brand text-5xl leading-none md:text-6xl">SSEPA</div>
            <div className="pb-0.5 text-xs text-white/70">v{APP_VERSION}</div>
          </div>
          <div className="mt-1 text-base leading-snug opacity-95 md:text-lg">Sistema de Simulação de Execuções Penais Avançado</div>
        </div>

        {/* Panels */}
        <div className="grid flex-1 content-center gap-4 md:grid-cols-2 md:gap-4">
          <div
            className="ssepa-card-muted flex h-full flex-col rounded-2xl text-white"
            style={{ padding: "clamp(14px, 2.2vh, 24px)", overflow: "hidden" }}
          >
            <div className="flex h-full flex-col">
              <div className="text-sm font-semibold tracking-wide text-white/70">Funcionalidades</div>

              <div className="mt-3" style={{ overflow: "hidden" }}>
                <div
                  className="rounded-xl bg-white/10 text-sm text-white/90 transition-all hover:bg-white/15 hover:ring-1 hover:ring-white/25"
                  style={{
                    transitionDuration: "500ms",
                    padding: "12px",
                    lineHeight: 1.4,
                    height: "calc(2 * 1.4em + 24px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    } as any}
                  >
                    {funcionalidades[funcIndex]}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  {funcionalidades.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setFuncIndex(i)}
                      className={
                        "h-2 w-2 rounded-full focus:outline-none focus:ring-2 focus:ring-white/50 " +
                        (i === funcIndex ? "bg-white/80" : "bg-white/25 hover:bg-white/40")
                      }
                      aria-label={`Ir para item ${i + 1}`}
                      title={`Ir para item ${i + 1}`}
                    />
                  ))}
                </div>
              </div>

              <div className="sr-only">As funcionalidades são apresentadas automaticamente. Passe o mouse para destacar.</div>

              <div className="mt-4 text-center text-sm text-white/85">
                <div>Jusrisprudência Atualizada:</div>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-6">
                  <img src="/logos/stj.svg" alt="STJ" className="h-12 max-h-12 w-auto opacity-90" />
                  <img src="/logos/stf.png" alt="STF" className="h-12 max-h-12 w-auto opacity-90" />
                </div>
              </div>

              <div className="mt-3 w-full max-w-[650px] self-center">
                <ThreadsEmbed url={THREADS_POST_URL} />
              </div>
            </div>

            <div className="flex-1" />
          </div>

          <div
            className="ssepa-card flex h-full flex-col justify-between rounded-2xl shadow-sm"
            style={{ padding: "clamp(14px, 2.2vh, 24px)", overflow: "hidden" }}
          >
            <div>
              <h1 className="text-2xl font-semibold">Entrar</h1>
              <p className="mt-2 text-sm text-zinc-600">Acesse sua conta do SSEPA.</p>

              <div className="mt-6 grid gap-2">
                <a className="ssepa-btn w-full rounded px-3 py-2 text-center text-sm font-medium" href="/api/oauth/google/start">
                  Entrar com Google
                </a>
              </div>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-zinc-200" />
                <div className="text-xs text-zinc-500">ou</div>
                <div className="h-px flex-1 bg-zinc-200" />
              </div>

              <form className="space-y-3" method="post" action="/api/login" onSubmit={onSubmit}>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <input
                    className="mt-1 w-full rounded border px-3 py-2"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Senha</label>
                  <input
                    className="mt-1 w-full rounded border px-3 py-2"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input type="checkbox" checked={keepSignedIn} onChange={(e) => setKeepSignedIn(e.target.checked)} />
                  Manter conectado neste dispositivo
                </label>
                <input type="hidden" name="keepSignedIn" value={keepSignedIn ? "1" : "0"} />
                <div className="text-xs text-zinc-500">
                  O SSEPA não armazena sua senha. Se você marcar esta opção, a sessão ficará ativa por mais tempo.
                </div>

                {error ? <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}

                <button className="ssepa-btn w-full rounded px-3 py-2" type="submit">
                  Entrar
                </button>
              </form>

              <div className="mt-4 text-sm">
                Não tem conta?{" "}
                <Link className="ssepa-link underline" href="/cadastro">
                  Criar conta
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 text-center text-xs text-white/70">v{APP_VERSION} · SSEPA é um simulador. Confira nos autos antes de usar.</div>
      </div>
    </div>
  );
}
