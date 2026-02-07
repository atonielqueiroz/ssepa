"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

function Avatar({ profilePhotoUrl }: { profilePhotoUrl: string }) {
  if (profilePhotoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={profilePhotoUrl} alt="Foto" className="h-10 w-10 rounded-full border object-cover" />;
  }
  return <div className="h-10 w-10 rounded-full border bg-white" />;
}

export default function MinhasInformacoesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadKey, setUploadKey] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/me");
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) {
        setError(data?.error ?? "Falha ao carregar usuário.");
        return;
      }
      setName(data?.user?.name ?? "");
      setEmail(data?.user?.email ?? "");
      setProfilePhotoUrl(data?.user?.profilePhotoUrl ?? "");
    })();
  }, []);

  async function onSave() {
    setError(null);
    setOkMsg(null);
    setSaving(true);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data?.error ?? "Falha ao salvar.");
      return;
    }
    setOkMsg("Salvo.");
  }

  async function onUpload(file: File) {
    setError(null);
    setOkMsg(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/me/photo", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Falha ao enviar foto.");
        return;
      }
      setProfilePhotoUrl(data?.profilePhotoUrl ?? "");
      setOkMsg("Foto atualizada.");
    } finally {
      setUploading(false);
      setUploadKey((k) => k + 1);
    }
  }

  async function onRemovePhoto() {
    setError(null);
    setOkMsg(null);
    const res = await fetch("/api/me/photo", { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "Falha ao remover foto.");
      return;
    }
    setProfilePhotoUrl("");
    setOkMsg("Foto removida.");
  }

  if (loading) return <div className="text-sm text-zinc-600">Carregando…</div>;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Minhas Informações</h1>
        <Link className="rounded border px-3 py-2 text-sm" href="/referencias">
          Voltar
        </Link>
      </div>

      <div className="mt-4 divide-y divide-[var(--ssepa-border)]/60 rounded border bg-white">
        <div className="p-4">
          <div className="flex items-center gap-3">
            <Avatar profilePhotoUrl={profilePhotoUrl} />
            <div className="min-w-0">
              <div className="text-sm font-medium text-zinc-700">Conta</div>
              <div className="text-sm text-zinc-900 truncate">{email}</div>
            </div>
          </div>
        </div>

        <div className="p-4">
          <label className="text-sm font-medium">Nome</label>
          <input className="mt-1 w-full rounded border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="p-4">
          <label className="text-sm font-medium">Foto de perfil (upload)</label>

          {/* Input hidden + botão (mais confiável em webviews/in-app browsers) */}
          <input
            key={uploadKey}
            ref={fileInputRef}
            className="hidden"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              setSelectedFileName(f?.name || "");
              if (f) onUpload(f);
            }}
          />

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded border px-3 py-2 text-sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? "Enviando…" : "Escolher arquivo"}
            </button>
            <div className="text-xs text-zinc-600">{selectedFileName ? selectedFileName : "Nenhum arquivo escolhido"}</div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <button type="button" className="rounded border px-3 py-2 text-sm" onClick={onRemovePhoto} disabled={!profilePhotoUrl}>
              Remover foto
            </button>
          </div>

          <div className="mt-2 text-xs text-zinc-600">Por política, a foto não é importada do Google automaticamente.</div>
          <div className="mt-1 text-xs text-zinc-600">
            Se estiver no navegador interno do Telegram e não abrir o seletor de arquivos, abra no navegador normal:
            <a className="ml-1 underline" href="/minhas-informacoes" target="_blank" rel="noreferrer">
              abrir em nova aba
            </a>
          </div>
        </div>

        <div className="p-4">
          {error ? <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}
          {okMsg ? <div className="mb-3 rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-800">{okMsg}</div> : null}
          <button type="button" className="ssepa-btn rounded px-4 py-2 text-sm" onClick={onSave} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
