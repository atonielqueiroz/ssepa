import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { art112Fractions } from "@/lib/art112";

const PatchCrimeSchema = z.object({
  law: z.string().min(1).optional(),
  article: z.string().min(1).optional(),
  description: z.string().optional(),
  complement: z.string().optional(),
  factDate: z.string().min(8).optional(),
  penaltyYears: z.number().int().min(0).optional(),
  penaltyMonths: z.number().int().min(0).max(11).optional(),
  penaltyDays: z.number().int().min(0).max(30).optional(),
  transitDate: z.string().min(8).optional(),
  hasViolence: z.boolean().optional(),
  isHediondo: z.boolean().optional(),
  hasResultDeath: z.boolean().optional(),
  hasOrgCrimLead: z.boolean().optional(),
  hasMilicia: z.boolean().optional(),
  isFeminicidio: z.boolean().optional(),

  nature: z.enum(["COMUM", "HEDIONDO", "EQUIPARADO"]).optional(),
  equiparadoType: z.enum(["TORTURA", "TRAFICO", "TERRORISMO"]).nullable().optional(),

  art112ChoiceMode: z.enum(["AUTO", "MANUAL"]).optional(),
  art112Inciso: z.string().nullable().optional(),

  sourceText: z.string().min(3).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ pid: string; cid: string }> }) {
  const { pid, cid } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const crime = await prisma.crime.findFirst({
    where: { id: cid, processoId: pid, processo: { reference: { userId, status: "ACTIVE" } } },
    select: {
      id: true,
      processoId: true,
      law: true,
      article: true,
      description: true,
      complement: true,
      factDate: true,
      transitDate: true,
      penaltyYears: true,
      penaltyMonths: true,
      penaltyDays: true,
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
      source: true,
    },
  });

  if (!crime) return NextResponse.json({ error: "Crime não encontrado" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    crime: {
      ...crime,
      factDate: crime.factDate ? crime.factDate.toISOString().slice(0, 10) : null,
      transitDate: crime.transitDate.toISOString().slice(0, 10),
      sourceText: (crime.source as any)?.text ?? "",
    },
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ pid: string; cid: string }> }) {
  const { pid, cid } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = PatchCrimeSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const exists = await prisma.crime.findFirst({
    where: { id: cid, processoId: pid, processo: { reference: { userId, status: "ACTIVE" } } },
    select: { id: true, processo: { select: { referenceId: true } } },
  });
  if (!exists) return NextResponse.json({ error: "Crime não encontrado" }, { status: 404 });

  const data = parsed.data;

  const current = await prisma.crime.findUnique({
    where: { id: cid },
    select: {
      factDate: true,
      hasViolence: true,
      isHediondo: true,
      hasResultDeath: true,
      hasOrgCrimLead: true,
      hasMilicia: true,
      nature: true,
      art112ChoiceMode: true,
      art112Inciso: true,
    },
  });

  const nextFactDate = data.factDate ? new Date(data.factDate) : current?.factDate;
  const nextHasViolence = data.hasViolence ?? current?.hasViolence ?? false;
  const nextNature = data.nature ?? current?.nature ?? (data.isHediondo ?? current?.isHediondo ? "HEDIONDO" : "COMUM");
  const nextHasResultDeath = data.hasResultDeath ?? current?.hasResultDeath ?? false;
  const nextHasOrgCrimLead = data.hasOrgCrimLead ?? current?.hasOrgCrimLead ?? false;
  const nextHasMilicia = data.hasMilicia ?? current?.hasMilicia ?? false;
  const nextChoiceMode = data.art112ChoiceMode ?? current?.art112ChoiceMode ?? "AUTO";
  const nextInciso = data.art112Inciso ?? current?.art112Inciso ?? null;

  const fractions = art112Fractions({
    hasViolence: nextHasViolence,
    isHediondoOrEquiparado: nextNature !== "COMUM",
    hasResultDeath: nextHasResultDeath,
    hasOrgCrimLead: nextHasOrgCrimLead,
    hasMilicia: nextHasMilicia,
    art112ChoiceMode: nextChoiceMode,
    art112Inciso: nextInciso,
    factDate: nextFactDate ?? undefined,
  });

  const updated = await prisma.crime.update({
    where: { id: cid },
    data: {
      law: data.law,
      article: data.article,
      description: data.description,
      complement: data.complement,
      factDate: data.factDate ? new Date(data.factDate) : undefined,
      transitDate: data.transitDate ? new Date(data.transitDate) : undefined,
      penaltyYears: data.penaltyYears,
      penaltyMonths: data.penaltyMonths,
      penaltyDays: data.penaltyDays,
      hasViolence: data.hasViolence,
      isHediondo: data.isHediondo,
      hasResultDeath: data.hasResultDeath,
      hasOrgCrimLead: data.hasOrgCrimLead,
      hasMilicia: data.hasMilicia,
      isFeminicidio: data.isFeminicidio,

      nature: data.nature,
      equiparadoType: data.equiparadoType,

      art112ChoiceMode: data.art112ChoiceMode,
      art112Inciso: data.art112Inciso,
      art112Summary: fractions.primario.summary ?? null,
      art112Basis: fractions.primario.basis ?? undefined,

      source: data.sourceText ? { text: data.sourceText } : undefined,
    },
    select: { id: true },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: userId,
      targetUserId: null,
      action: "crime.update",
      metadata: { referenceId: exists.processo.referenceId, processoId: pid, crimeId: updated.id },
      ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
      userAgent: req.headers.get("user-agent") || null,
    },
  });

  return NextResponse.json({ ok: true, id: updated.id });
}
