import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

const SignupSchema = z.object({
  name: z.string().min(3),
  oabNumber: z.string().min(1),
  oabUf: z.string().length(2),
  phone: z.string().min(6),
  email: z.string().email(),
  recoveryEmail: z.string().email(),
  password: z.string().min(8),
  acceptTerms: z.boolean(),
  acceptPrivacy: z.boolean(),
});

const TERMS_V1_TITLE = "Termo de Responsabilidade";
const TERMS_V1_TEXT =
  "As informações e cálculos gerados pelo SSEPA são estimativas. O uso é de responsabilidade do advogado, que deve conferir tudo nos autos antes de utilizar/protocolar. Podem existir erros, imprecisões e divergências.";

async function ensureTermsPublished() {
  // Minimal: ensure version 1 exists and is published.
  const existing = await prisma.termsVersion.findFirst({ where: { version: 1 } });
  if (existing) return existing;

  // simple hash
  const textHash = Buffer.from(TERMS_V1_TEXT).toString("base64");
  return prisma.termsVersion.create({
    data: {
      version: 1,
      title: TERMS_V1_TITLE,
      text: TERMS_V1_TEXT,
      textHash,
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = SignupSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos. Verifique os campos." }, { status: 400 });
  }
  const data = parsed.data;
  if (!data.acceptTerms || !data.acceptPrivacy) {
    return NextResponse.json({ error: "É necessário aceitar o Termo e a Política de Privacidade." }, { status: 400 });
  }

  const email = data.email.toLowerCase().trim();

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: "Email já cadastrado." }, { status: 409 });
  }

  const passwordHash = await hash(data.password, 12);
  const terms = await ensureTermsPublished();

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent") || null;

  const user = await prisma.user.create({
    data: {
      name: data.name,
      oabNumber: data.oabNumber,
      oabUf: data.oabUf.toUpperCase(),
      phone: data.phone,
      email,
      recoveryEmail: data.recoveryEmail,
      passwordHash,
      status: "ACTIVE",
      accountStatus: "APROVADO",
      profileCompleted: true,
      roles: {
        create: {
          role: { connect: { key: "USER" } },
        },
      },
      termsAcceptances: {
        create: {
          termsId: terms.id,
          ip,
          userAgent,
        },
      },
      auditLogsActor: {
        create: {
          action: "user.signup",
          metadata: { email },
          ip,
          userAgent,
        },
      },
    },
  });

  return NextResponse.json({ ok: true, userId: user.id });
}
