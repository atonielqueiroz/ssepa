import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const CompleteSchema = z.object({
  oabNumber: z.string().min(1),
  oabUf: z.string().length(2),
  phone: z.string().min(6),
  recoveryEmail: z.string().email(),
  acceptTerms: z.boolean(),
  acceptPrivacy: z.boolean(),
});

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = CompleteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  if (!parsed.data.acceptTerms || !parsed.data.acceptPrivacy) {
    return NextResponse.json({ error: "É necessário aceitar o Termo e a Política." }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent") || null;

  // Ensure terms v1 exists (same as signup)
  let terms = await prisma.termsVersion.findFirst({ where: { version: 1 } });
  if (!terms) {
    const text =
      "As informações e cálculos gerados pelo SSEPA são estimativas. O uso é de responsabilidade do advogado, que deve conferir tudo nos autos antes de utilizar/protocolar. Podem existir erros, imprecisões e divergências.";
    terms = await prisma.termsVersion.create({
      data: {
        version: 1,
        title: "Termo de Responsabilidade",
        text,
        textHash: Buffer.from(text).toString("base64"),
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      oabNumber: parsed.data.oabNumber,
      oabUf: parsed.data.oabUf.toUpperCase(),
      phone: parsed.data.phone,
      recoveryEmail: parsed.data.recoveryEmail,
      profileCompleted: true,
      termsAcceptances: {
        create: {
          termsId: terms.id,
          ip,
          userAgent,
        },
      },
      auditLogsActor: {
        create: {
          action: "user.complete_profile",
          ip,
          userAgent,
        },
      },
    },
  });

  return NextResponse.json({ ok: true });
}
