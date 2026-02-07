import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { prisma } from "@/lib/prisma";
import { createSessionCookie } from "@/lib/session";

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  // Importante: atrás de proxy (nginx), req.url pode vir como 0.0.0.0:3000.
  // Para evitar redirecionar o usuário para o host interno, fixamos a origem pública.
  const publicOrigin = "https://app.ssepa.com";

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ error: "Google OAuth não configurado" }, { status: 500 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const publicBase = new URL(publicOrigin);

  const jar = await cookies();
  const expectedState = jar.get("ssepa_oauth_state")?.value;
  const expectedNonce = jar.get("ssepa_oauth_nonce")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/login?e=oauth_state", publicBase));
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/login?e=oauth_token", publicBase));
  }

  const tokenJson = (await tokenRes.json()) as { id_token?: string };
  const idToken = tokenJson.id_token;
  if (!idToken) {
    return NextResponse.redirect(new URL("/login?e=no_id_token", publicBase));
  }

  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
  });

  if (expectedNonce && payload.nonce !== expectedNonce) {
    return NextResponse.redirect(new URL("/login?e=oauth_nonce", publicBase));
  }

  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
  const name = typeof payload.name === "string" ? payload.name : "";
  const sub = typeof payload.sub === "string" ? payload.sub : null; // providerAccountId

  if (!email || !sub) {
    return NextResponse.redirect(new URL("/login?e=no_email", publicBase));
  }

  const userAgent = req.headers.get("user-agent") || null;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  // Create user if needed (note: do NOT import Google picture; profile photo is upload-only)
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: name || email,
        status: "ACTIVE",
        accountStatus: "APROVADO",
        profileCompleted: false,
        googleEnabled: true,
        auditLogsActor: {
          create: {
            action: "user.google_created",
            metadata: { email },
            ip,
            userAgent,
            targetUserId: null,
          },
        },
        roles: {
          create: {
            role: { connect: { key: "USER" } },
          },
        },
      },
    });
  } else {
    // mark Google as enabled
    if (!user.googleEnabled) {
      await prisma.user.update({ where: { id: user.id }, data: { googleEnabled: true } });
    }
  }

  // Link/update account record
  await prisma.account.upsert({
    where: { provider_providerAccountId: { provider: "google", providerAccountId: sub } },
    update: { userId: user.id },
    create: {
      userId: user.id,
      type: "oauth",
      provider: "google",
      providerAccountId: sub,
    },
  });

  await createSessionCookie(user.id, 90);

  // cleanup state cookies
  jar.set("ssepa_oauth_state", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  jar.set("ssepa_oauth_nonce", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });

  return NextResponse.redirect(new URL(user.profileCompleted ? "/referencias" : "/completar-cadastro", publicBase));
}
