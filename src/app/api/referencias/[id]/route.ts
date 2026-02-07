import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const PatchSchema = z.object({
  reviewStatus: z
    .enum([
      "REVISAO_NAO_INICIADA",
      "REVISAO_EM_ANDAMENTO",
      "AGUARDANDO_CONFERENCIA",
      "REVISAO_CONCLUIDA_100",
      "RENUNCIADA",
      "ARQUIVADA",
    ])
    .nullable()
    .optional(),
  execNumber: z.string().optional(),
  executadoNome: z.string().optional(),
  executadoNascimento: z.string().nullable().optional(), // YYYY-MM-DD
  executadoNascimentoSourceText: z.string().optional(),

  reeducandoGender: z.enum(["MASCULINO", "FEMININO", "OUTRO"]).nullable().optional(),
  reeducandaGestante: z.boolean().optional(),
  reeducandaMaeOuResponsavelCriancaOuPcd: z.boolean().optional(),
  novoCrimeDoloso: z.boolean().optional(),

  progEspecial112_3_enabled: z.boolean().optional(),
  progEspecial112_3_req_I_semViolencia: z.boolean().optional(),
  progEspecial112_3_req_II_naoCrimeContraFilho: z.boolean().optional(),
  progEspecial112_3_req_III_cumpriuUmOitavoRegAnterior: z.boolean().optional(),
  progEspecial112_3_req_IV_primariaBomComport: z.boolean().optional(),
  progEspecial112_3_req_V_naoOrgCrim: z.boolean().optional(),

  execRegime: z.enum(["FECHADO", "SEMIABERTO", "ABERTO"]).nullable().optional(),
  execSituacao: z.enum(["PRESO", "FORAGIDO", "SUSPENSA_AGUARDANDO_CAPTURA", "CUMPRINDO", "AGUARDANDO_INICIO", "OUTRO"]).nullable().optional(),
  execMarkerMonitorado: z.boolean().optional(),
  execMarkerRecolhido: z.boolean().optional(),
  execMarkerSoltoCumprindo: z.boolean().optional(),
  execObservacao: z.string().optional(),
  execDestacar: z.boolean().optional(),

  baseDateProgressaoAt: z.string().nullable().optional(), // YYYY-MM-DD
  baseDateProgressaoSourceText: z.string().optional(),

  basePenaCumpridaDays: z.number().int().min(0).nullable().optional(),
  basePenaCumpridaSourceText: z.string().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const ref = await prisma.reference.findFirst({
    where: { id, userId, status: "ACTIVE" },
    select: {
      id: true,
      execNumber: true,
      title: true,
      executadoNome: true,
      executadoNascimento: true,
      executadoNascimentoSourceText: true,
      reeducandoGender: true,
      reeducandaGestante: true,
      reeducandaMaeOuResponsavelCriancaOuPcd: true,
      novoCrimeDoloso: true,
      progEspecial112_3_enabled: true,
      progEspecial112_3_req_I_semViolencia: true,
      progEspecial112_3_req_II_naoCrimeContraFilho: true,
      progEspecial112_3_req_III_cumpriuUmOitavoRegAnterior: true,
      progEspecial112_3_req_IV_primariaBomComport: true,
      progEspecial112_3_req_V_naoOrgCrim: true,
      execRegime: true,
      execSituacao: true,
      execMarkerMonitorado: true,
      execMarkerRecolhido: true,
      execMarkerSoltoCumprindo: true,
      execObservacao: true,
      execDestacar: true,
      baseDateProgressaoAt: true,
      baseDateProgressaoSourceText: true,
      basePenaCumpridaDays: true,
      basePenaCumpridaSourceText: true,
    },
  });
  if (!ref) return NextResponse.json({ error: "Simulação não encontrada" }, { status: 404 });

  // sugestão automática: última prisão (exceto TJ início cumprimento) OU última falta grave
  const [lastPrison, lastFalta] = await Promise.all([
    prisma.processoEvento.findFirst({
      where: {
        processo: { referenceId: id },
        type: {
          in: ["PRISAO_FLAGRANTE", "PRISAO_PREVENTIVA", "PRISAO_TEMPORARIA", "RECAPTURA"],
        },
      },
      orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
      select: { eventDate: true, type: true },
    }),
    prisma.incidente.findFirst({
      where: { referenceId: id, type: "HOMOLOGACAO_FALTA_GRAVE" },
      orderBy: [{ referenceDate: "desc" }, { createdAt: "desc" }],
      select: { referenceDate: true },
    }),
  ]);

  let suggestionAt: Date | null = null;
  let suggestionWhy: string | null = null;
  if (lastPrison?.eventDate && (!lastFalta?.referenceDate || lastPrison.eventDate >= lastFalta.referenceDate)) {
    suggestionAt = lastPrison.eventDate;
    suggestionWhy = "Sugestão: última prisão/recaptura";
  } else if (lastFalta?.referenceDate) {
    suggestionAt = lastFalta.referenceDate;
    suggestionWhy = "Sugestão: última falta grave";
  }

  return NextResponse.json({
    reference: {
      ...ref,
      executadoNascimento: ref.executadoNascimento ? ref.executadoNascimento.toISOString().slice(0, 10) : null,
      baseDateProgressaoAt: ref.baseDateProgressaoAt ? ref.baseDateProgressaoAt.toISOString().slice(0, 10) : null,
      baseDateSuggestionAt: suggestionAt ? suggestionAt.toISOString().slice(0, 10) : null,
      baseDateSuggestionWhy: suggestionWhy,
      basePenaCumpridaDays: typeof (ref as any).basePenaCumpridaDays === "number" ? (ref as any).basePenaCumpridaDays : null,
    },
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const ref = await prisma.reference.findFirst({
    where: { id, userId, status: "ACTIVE" },
    select: { id: true, semExecucaoFormada: true, source: true },
  });
  if (!ref) return NextResponse.json({ error: "Simulação não encontrada" }, { status: 404 });

  const exec = parsed.data.execNumber?.trim();
  const nome = parsed.data.executadoNome?.trim();
  const nasc = typeof parsed.data.executadoNascimento === "string" ? parsed.data.executadoNascimento : null;
  const nascFonte = parsed.data.executadoNascimentoSourceText?.trim();

  const data: any = {};
  if (typeof nome !== "undefined") data.executadoNome = nome || null;

  if (typeof parsed.data.reeducandoGender !== "undefined") data.reeducandoGender = parsed.data.reeducandoGender;
  if (typeof parsed.data.reeducandaGestante !== "undefined") data.reeducandaGestante = parsed.data.reeducandaGestante;
  if (typeof parsed.data.reeducandaMaeOuResponsavelCriancaOuPcd !== "undefined") {
    data.reeducandaMaeOuResponsavelCriancaOuPcd = parsed.data.reeducandaMaeOuResponsavelCriancaOuPcd;
  }
  if (typeof parsed.data.novoCrimeDoloso !== "undefined") data.novoCrimeDoloso = parsed.data.novoCrimeDoloso;

  if (typeof parsed.data.progEspecial112_3_enabled !== "undefined") data.progEspecial112_3_enabled = parsed.data.progEspecial112_3_enabled;
  if (typeof parsed.data.progEspecial112_3_req_I_semViolencia !== "undefined") {
    data.progEspecial112_3_req_I_semViolencia = parsed.data.progEspecial112_3_req_I_semViolencia;
  }
  if (typeof parsed.data.progEspecial112_3_req_II_naoCrimeContraFilho !== "undefined") {
    data.progEspecial112_3_req_II_naoCrimeContraFilho = parsed.data.progEspecial112_3_req_II_naoCrimeContraFilho;
  }
  if (typeof parsed.data.progEspecial112_3_req_III_cumpriuUmOitavoRegAnterior !== "undefined") {
    data.progEspecial112_3_req_III_cumpriuUmOitavoRegAnterior = parsed.data.progEspecial112_3_req_III_cumpriuUmOitavoRegAnterior;
  }
  if (typeof parsed.data.progEspecial112_3_req_IV_primariaBomComport !== "undefined") {
    data.progEspecial112_3_req_IV_primariaBomComport = parsed.data.progEspecial112_3_req_IV_primariaBomComport;
  }
  if (typeof parsed.data.progEspecial112_3_req_V_naoOrgCrim !== "undefined") {
    data.progEspecial112_3_req_V_naoOrgCrim = parsed.data.progEspecial112_3_req_V_naoOrgCrim;
  }

  if (typeof parsed.data.execRegime !== "undefined") data.execRegime = parsed.data.execRegime;
  if (typeof parsed.data.execSituacao !== "undefined") data.execSituacao = parsed.data.execSituacao;
  if (typeof parsed.data.execMarkerMonitorado !== "undefined") data.execMarkerMonitorado = parsed.data.execMarkerMonitorado;
  if (typeof parsed.data.execMarkerRecolhido !== "undefined") data.execMarkerRecolhido = parsed.data.execMarkerRecolhido;
  if (typeof parsed.data.execMarkerSoltoCumprindo !== "undefined") data.execMarkerSoltoCumprindo = parsed.data.execMarkerSoltoCumprindo;
  if (typeof parsed.data.execObservacao !== "undefined") data.execObservacao = parsed.data.execObservacao.trim() || null;
  if (typeof parsed.data.execDestacar !== "undefined") data.execDestacar = parsed.data.execDestacar;

  if (typeof parsed.data.baseDateProgressaoAt !== "undefined") {
    const s = parsed.data.baseDateProgressaoAt;
    data.baseDateProgressaoAt = s ? new Date(`${s}T00:00:00.000Z`) : null;
  }
  if (typeof parsed.data.baseDateProgressaoSourceText !== "undefined") {
    data.baseDateProgressaoSourceText = parsed.data.baseDateProgressaoSourceText.trim() || null;
  }

  if (typeof parsed.data.basePenaCumpridaDays !== "undefined") {
    data.basePenaCumpridaDays = parsed.data.basePenaCumpridaDays;
  }
  if (typeof parsed.data.basePenaCumpridaSourceText !== "undefined") {
    data.basePenaCumpridaSourceText = parsed.data.basePenaCumpridaSourceText.trim() || null;
  }

  if (typeof parsed.data.reviewStatus !== "undefined") {
    const prev = (ref as any).source && typeof (ref as any).source === "object" ? (ref as any).source : {};
    data.source = { ...(prev as any), reviewStatus: parsed.data.reviewStatus };
  }

  if (typeof parsed.data.executadoNascimento !== "undefined") {
    if (!nasc) {
      data.executadoNascimento = null;
    } else {
      // stored as UTC day
      data.executadoNascimento = new Date(`${nasc}T00:00:00.000Z`);
    }
  }
  if (typeof nascFonte !== "undefined") data.executadoNascimentoSourceText = nascFonte || null;

  if (typeof exec !== "undefined") {
    if (ref.semExecucaoFormada) {
      // allow saving, but keep execNumber null when "sem execução formada"
      data.execNumber = null;
    } else {
      if (!exec || exec.length < 5) {
        return NextResponse.json({ error: "Informe um número de execução válido." }, { status: 400 });
      }
      data.execNumber = exec;
    }
  }

  const execTitle = ref.semExecucaoFormada ? "Sem execução formada" : `Execução Penal nº ${data.execNumber ?? exec}`;
  const title = `${execTitle}${(data.executadoNome ?? nome) ? ` — ${data.executadoNome ?? nome}` : ""}`;
  data.title = title;

  await prisma.reference.update({
    where: { id },
    data,
  });

  await prisma.auditLog.create({
    data: { actorUserId: userId, targetUserId: null, ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null, userAgent: req.headers.get("user-agent") || null, action: "reference.update", metadata: { referenceId: id } },
  });

  return NextResponse.json({ ok: true });
}
