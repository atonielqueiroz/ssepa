import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { art112Fractions } from "@/lib/art112";

const CreateCrimeSchema = z.object({
  processoId: z.string().min(1),
  law: z.string().min(1),
  article: z.string().min(1),
  description: z.string().optional(),
  complement: z.string().optional(),
  factDate: z.string().min(8).optional(),
  penaltyYears: z.number().int().min(0),
  penaltyMonths: z.number().int().min(0).max(11),
  penaltyDays: z.number().int().min(0).max(30),
  transitDate: z.string().min(8).optional(), // deprecated (use marcos do processo)
  hasViolence: z.boolean(),
  isHediondo: z.boolean(),
  hasResultDeath: z.boolean(),
  hasOrgCrimLead: z.boolean(),
  hasMilicia: z.boolean(),
  isFeminicidio: z.boolean(),

  // new (leigo)
  nature: z.enum(["COMUM", "HEDIONDO", "EQUIPARADO"]).optional(),
  equiparadoType: z.enum(["TORTURA", "TRAFICO", "TERRORISMO"]).nullable().optional(),

  // art. 112 override
  art112ChoiceMode: z.enum(["AUTO", "MANUAL"]).optional(),
  art112Inciso: z.string().nullable().optional(),

  sourceText: z.string().min(3),
});

export async function GET(req: Request, { params }: { params: Promise<{ pid: string }> }) {
  const { pid } = await params;
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const last = url.searchParams.get("last");

  if (last === "1") {
    const crime = await prisma.crime.findFirst({
      where: { processoId: pid, processo: { reference: { userId, status: "ACTIVE" } } },
      orderBy: { createdAt: "desc" },
      select: {
        law: true,
        factDate: true,
        transitDate: true,
        hasViolence: true,
        isHediondo: true,
        hasResultDeath: true,
        hasOrgCrimLead: true,
        hasMilicia: true,
        isFeminicidio: true,
        nature: true,
        equiparadoType: true,
        art112ChoiceMode: true,
        art112Inciso: true,
      },
    });

    if (!crime) return NextResponse.json({ ok: true, crime: null });

    return NextResponse.json({
      ok: true,
      crime: {
        law: crime.law,
        factDate: crime.factDate ? crime.factDate.toISOString().slice(0, 10) : null,
        transitDate: crime.transitDate.toISOString().slice(0, 10),
        hasViolence: crime.hasViolence,
        isHediondo: crime.isHediondo,
        hasResultDeath: crime.hasResultDeath,
        hasOrgCrimLead: crime.hasOrgCrimLead,
        hasMilicia: crime.hasMilicia,
        isFeminicidio: crime.isFeminicidio,
        nature: crime.nature,
        equiparadoType: crime.equiparadoType,
        art112ChoiceMode: crime.art112ChoiceMode,
        art112Inciso: crime.art112Inciso,
      },
    });
  }

  return NextResponse.json({ error: "Parâmetro inválido" }, { status: 400 });
}

export async function POST(req: Request, { params }: { params: Promise<{ pid: string }> }) {
  const { pid } = await params;
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = CreateCrimeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  const data = parsed.data;
  if (data.processoId !== pid) {
    return NextResponse.json({ error: "Processo inválido" }, { status: 400 });
  }

  const proc = await prisma.processoCriminal.findFirst({
    where: {
      id: pid,
      reference: { userId, status: "ACTIVE" },
    },
    select: {
      id: true,
      referenceId: true,
      transitAtProcesso: true,
      transitAtAcusacao: true,
      transitAtDefesa: true,
      sentencaAt: true,
      acordaoAt: true,
      fatosBaseAt: true,
      fatosBaseNaoSei: true,
    },
  });
  if (!proc) return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 });

  let factDateObj = data.factDate ? new Date(data.factDate) : null;
  if (!factDateObj && (proc as any).fatosBaseAt && !(proc as any).fatosBaseNaoSei) {
    factDateObj = (proc as any).fatosBaseAt as Date;
  }
  // Trânsito em julgado é marco do PROCESSO (não do crime individual). Para não bloquear o cadastro,
  // quando não houver TJ informado no processo, salvamos um placeholder e o relatório pode alertar.
  let transitDateObj: Date = data.transitDate
    ? new Date(data.transitDate)
    : ((proc.transitAtProcesso ?? proc.transitAtDefesa ?? proc.transitAtAcusacao) as any);

  let transitPlaceholderReason: string | null = null;
  if (!transitDateObj) {
    transitDateObj = (proc.sentencaAt ?? proc.acordaoAt ?? factDateObj ?? new Date()) as Date;
    transitPlaceholderReason = "TJ não informado no processo; usando data da sentença/acórdão/fato como placeholder";
  }

  const fractions = art112Fractions({
    hasViolence: data.hasViolence,
    isHediondoOrEquiparado: (data.nature ?? (data.isHediondo ? "HEDIONDO" : "COMUM")) !== "COMUM",
    hasResultDeath: data.hasResultDeath,
    hasOrgCrimLead: data.hasOrgCrimLead,
    hasMilicia: data.hasMilicia,
    art112ChoiceMode: data.art112ChoiceMode ?? "AUTO",
    art112Inciso: data.art112Inciso ?? null,
    factDate: factDateObj ?? undefined,
  });

  const crime = await prisma.crime.create({
    data: {
      processoId: pid,
      law: data.law,
      article: data.article,
      description: data.description,
      complement: data.complement,
      factDate: factDateObj,
      penaltyYears: data.penaltyYears,
      penaltyMonths: data.penaltyMonths,
      penaltyDays: data.penaltyDays,
      transitDate: transitDateObj,
      hasViolence: data.hasViolence,
      isHediondo: data.isHediondo,
      hasResultDeath: data.hasResultDeath,
      hasOrgCrimLead: data.hasOrgCrimLead,
      hasMilicia: data.hasMilicia,
      isFeminicidio: data.isFeminicidio,

      nature: data.nature ?? (data.isHediondo ? "HEDIONDO" : "COMUM"),
      equiparadoType: data.equiparadoType ?? null,

      art112ChoiceMode: data.art112ChoiceMode ?? "AUTO",
      art112Inciso: data.art112Inciso ?? null,
      art112Summary: data.art112ChoiceMode === "MANUAL" ? (fractions.primario.summary ?? null) : (fractions.primario.summary ?? null),
      art112Basis: fractions.primario.basis ?? undefined,

      source: transitPlaceholderReason ? { text: data.sourceText, transitPlaceholderReason } : { text: data.sourceText },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: userId,
      targetUserId: null,
      action: "crime.create",
      metadata: { referenceId: proc.referenceId, processoId: pid, crimeId: crime.id },
      ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
      userAgent: req.headers.get("user-agent") || null,
    },
  });

  return NextResponse.json({ ok: true, id: crime.id });
}
