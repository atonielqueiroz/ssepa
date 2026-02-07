import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB

function extFromMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  return null;
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {

  const form = await req.formData().catch(() => null);
  const file = form?.get("file") as any;
  if (!file || typeof file.arrayBuffer !== "function") {
    return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });
  }

  const mime = file.type || "";
  const ext = extFromMime(mime);
  if (!ext) {
    return NextResponse.json({ error: "Formato inválido. Use PNG/JPG/WEBP." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande (máx 2MB)." }, { status: 400 });
  }

  const dir = "/var/www/ssepa_uploads/profile";
  await mkdir(dir, { recursive: true });

  const filename = `${userId}-${Date.now()}.${ext}`;
  const abs = path.join(dir, filename);
  await writeFile(abs, buf);

  const url = `/uploads/profile/${filename}`;
  await prisma.user.update({ where: { id: userId }, data: { profilePhotoUrl: url } });

  return NextResponse.json({ ok: true, profilePhotoUrl: url });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[PHOTO_UPLOAD] falha", e);
    return NextResponse.json({ error: "Falha ao processar upload." }, { status: 500 });
  }
}

export async function DELETE() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  await prisma.user.update({ where: { id: userId }, data: { profilePhotoUrl: null } });
  return NextResponse.json({ ok: true });
}
