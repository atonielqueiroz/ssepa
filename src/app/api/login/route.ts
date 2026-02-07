import { NextResponse } from "next/server";
import { z } from "zod";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionCookie } from "@/lib/session";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  keepSignedIn: z.boolean().optional(),
});

function externalUrl(req: Request, pathname: string) {
  const h = req.headers;
  const proto = (h.get("x-forwarded-proto") || "http").split(",")[0].trim();
  const host = (h.get("x-forwarded-host") || h.get("host") || new URL(req.url).host).split(",")[0].trim();
  const u = new URL(`${proto}://${host}`);
  u.pathname = pathname;
  return u;
}

export async function POST(req: Request) {
  const ct = req.headers.get("content-type") || "";

  let payload: any = null;
  if (ct.includes("application/json")) {
    payload = await req.json().catch(() => null);
  } else {
    const fd = await req.formData().catch(() => null);
    if (fd) {
      payload = {
        email: String(fd.get("email") ?? ""),
        password: String(fd.get("password") ?? ""),
        keepSignedIn: String(fd.get("keepSignedIn") ?? "") === "1" || String(fd.get("keepSignedIn") ?? "") === "true",
      };
    }
  }

  const parsed = LoginSchema.safeParse(payload);
  if (!parsed.success) {
    if (!ct.includes("application/json")) {
      const u = externalUrl(req, "/login");
      u.searchParams.set("error", "1");
      return NextResponse.redirect(u);
    }
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const password = parsed.data.password;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    if (!ct.includes("application/json")) {
      const u = externalUrl(req, "/login");
      u.searchParams.set("error", "1");
      return NextResponse.redirect(u);
    }
    return NextResponse.json({ error: "Email ou senha inválidos" }, { status: 401 });
  }
  if (user.status !== "ACTIVE") {
    if (!ct.includes("application/json")) {
      const u = externalUrl(req, "/login");
      u.searchParams.set("error", "1");
      return NextResponse.redirect(u);
    }
    return NextResponse.json({ error: "Usuário bloqueado" }, { status: 403 });
  }

  const ok = await compare(password, user.passwordHash);
  if (!ok) {
    if (!ct.includes("application/json")) {
      const u = externalUrl(req, "/login");
      u.searchParams.set("error", "1");
      return NextResponse.redirect(u);
    }
    return NextResponse.json({ error: "Email ou senha inválidos" }, { status: 401 });
  }

  const days = parsed.data.keepSignedIn ? 90 : 1;
  await createSessionCookie(user.id, days);

  if (!ct.includes("application/json")) {
    return NextResponse.redirect(externalUrl(req, "/referencias"));
  }

  return NextResponse.json({ ok: true });
}
