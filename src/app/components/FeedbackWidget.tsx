"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { APP_VERSION } from "@/lib/version";

const THANKS_MS = 180_000;

export function FeedbackWidget() {
  const pathname = usePathname();

  // Excluir HOME (no projeto, é /login)
  const isHome = pathname === "/login" || pathname === "/";

  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [thanksUntil, setThanksUntil] = useState<number | null>(null);

  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // autogrow
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [text, open]);

  // timer: Obrigado. -> Sugerir/Elogiar
  useEffect(() => {
    if (!thanksUntil) return;
    const remaining = Math.max(0, thanksUntil - Date.now());
    if (remaining <= 0) {
      setThanksUntil(null);
      return;
    }
    const t = window.setTimeout(() => setThanksUntil(null), remaining);
    return () => window.clearTimeout(t);
  }, [thanksUntil]);

  function buttonLabel() {
    if (thanksUntil && Date.now() < thanksUntil) return "Obrigado.";
    return "Sugerir alterações";
  }

  function onOpen() {
    setOpen(true);
    setError(null);
    setTimeout(() => taRef.current?.focus(), 0);
  }

  function onClose() {
    setOpen(false);
    setError(null);
  }

  async function onSend() {
    if (!text.trim()) return;
    setSending(true);
    setError(null);

    const payload = {
      message: text,
      anonymous: false,
      screenKey: pathname || "(unknown)",
      route: window.location.href,
      occurredAtIso: new Date().toISOString(),
      version: `v${APP_VERSION}`,
    };

    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSending(false);

    if (!res.ok) {
      setError("Não foi possível enviar agora.");
      return;
    }

    setText("");
    setOpen(false);
    setThanksUntil(Date.now() + THANKS_MS);
  }

  if (isHome) return null;

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={onOpen}
          className="fixed bottom-4 right-4 rounded-full border border-[color:#4f6766]/30 bg-[color:#4f6766] px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-[color:#4f6766]/90"
          style={{ zIndex: 60 }}
        >
          {buttonLabel()}
        </button>
      ) : null}

      {open ? (
        <div
          className="fixed bottom-4 right-4 w-[360px] max-w-[92vw] overflow-hidden rounded-2xl border bg-white shadow-lg"
          style={{ zIndex: 70 }}
        >
          <div className="flex items-start justify-between gap-3 border-b border-[color:#4f6766]/15 bg-[color:#fbfaf1] px-3 py-2">
            <div className="text-xs font-medium text-[color:#4f6766]">Sugira alterações nesta página</div>
            <button type="button" className="rounded px-2 py-1 text-xs text-[color:#4f6766] hover:bg-[color:#4f6766]/10" onClick={onClose}>
              X
            </button>
          </div>

          <div className="p-3">
            <textarea
              ref={taRef}
              className="w-full resize-none rounded border px-3 py-2 text-sm"
              placeholder="Escreva aqui…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
            />

            <div className="mt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded bg-[color:#4f6766] px-3 py-2 text-xs font-medium text-white hover:bg-[color:#4f6766]/90 disabled:opacity-50"
                disabled={sending || !text.trim()}
                onClick={onSend}
                title="Assunto fixo: SUGESTÔES SSEPA"
              >
                {sending ? "Enviando…" : "Enviar"}
              </button>
            </div>

            {error ? <div className="mt-2 text-xs text-red-700">{error}</div> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
