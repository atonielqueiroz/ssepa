import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";

function base64url(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    // Evita mostrar JSON na tela quando o usuário clica no botão de Google.
    return NextResponse.redirect(new URL("/login?e=google_oauth_not_configured", "https://app.ssepa.com"));
  }

  const state = base64url(randomBytes(24));
  const nonce = base64url(randomBytes(24));

  const jar = await cookies();
  jar.set("ssepa_oauth_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  jar.set("ssepa_oauth_nonce", nonce, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("prompt", "select_account");

  return NextResponse.redirect(url);
}
