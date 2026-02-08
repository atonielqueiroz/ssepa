import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { formatExecStatus } from "@/lib/executionStatus";

function fmt(d: Date | null | undefined) {
  if (!d) return "—";
  const iso = d.toISOString().slice(0, 10);
  const [y, m, day] = iso.split("-");
  return `${day}/${m}/${y}`;
}

function daysBetween(a: Date, b: Date) {
  const ms = b.getTime() - a.getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function isCustodyStart(t: string) {
  return t.startsWith("PRISAO_") || t === "RECAPTURA";
}

function isCustodyEnd(t: string) {
  return (
    t === "SOLTURA_ALVARA" ||
    t === "LIBERDADE_SEM_CAUTELAR" ||
    t === "LIBERDADE_COM_CAUTELAR" ||
    t === "LIBERDADE_PROVISORIA"
  );
}

function calcDetractionForProcess(eventos: any[]) {
  let detDays = 0;
  let openCustody: Date | null = null;

  for (const e of eventos) {
    if (e.noDetraction) continue;

    if (isCustodyStart(e.type)) {
      if (!openCustody) openCustody = e.eventDate;
    }

    if (isCustodyEnd(e.type)) {
      if (openCustody) {
        detDays += daysBetween(openCustody, e.eventDate);
        openCustody = null;
      }
    }

    if (e.cautelarStart && e.cautelarEnd) {
      detDays += daysBetween(e.cautelarStart, e.cautelarEnd);
    }
  }

  return detDays;
}

function sanitizeText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "?");
}

function wrapText(text: string, maxLength = 90) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (test.length > maxLength) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function buildPdf(lines: string[]) {
  const sanitizedLines = lines.flatMap((line) => wrapText(sanitizeText(line)));
  const contentLines = sanitizedLines
    .map((line, index) => {
      const escaped = line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
      const operator = index === 0 ? "Tj" : "Tj\n0 -16 Td";
      return `(${escaped}) ${operator}`;
    })
    .join("\n");

  const contentStream = `BT\n/F1 11 Tf\n48 780 Td\n${contentLines}\nET`;
  const objects = [
    `<< /Type /Catalog /Pages 2 0 R >>`,
    `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
    `<< /Length ${Buffer.byteLength(contentStream, "utf8")} >>\nstream\n${contentStream}\nendstream`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: referenceId } = await params;
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const ref = await prisma.reference.findFirst({
    where: { id: referenceId, userId, status: "ACTIVE" },
    include: {
      processos: {
        orderBy: { createdAt: "asc" },
        include: {
          eventos: { orderBy: { eventDate: "asc" } },
          crimes: { orderBy: { factDate: "asc" } },
        },
      },
    },
  });

  if (!ref) {
    return NextResponse.json({ error: "Referência não encontrada." }, { status: 404 });
  }

  const execStatus = formatExecStatus({
    execRegime: ref.execRegime,
    execSituacao: ref.execSituacao,
    execMarkerMonitorado: ref.execMarkerMonitorado,
    execMarkerRecolhido: ref.execMarkerRecolhido,
    execMarkerSoltoCumprindo: ref.execMarkerSoltoCumprindo,
    execObservacao: ref.execObservacao,
    execDestacar: ref.execDestacar,
  });

  const processos = ref.processos as any[];
  const processosAtivos = processos.filter((p) => p.includeInCalculations !== false);
  const totalCrimes = processosAtivos.reduce((acc, p) => acc + ((p.crimes?.length as number) ?? 0), 0);
  const totalDetracao = processosAtivos.reduce((acc, p) => acc + calcDetractionForProcess(p.eventos ?? []), 0);

  const lines: string[] = [];
  lines.push("RELATORIO DE CALCULO DE PENA (SSEPA)");
  lines.push(`Execucao: ${ref.title}`);
  lines.push(`Gerado em: ${fmt(new Date())}`);
  lines.push(`Status da execucao: ${execStatus.text}${execStatus.observacao ? ` — ${execStatus.observacao}` : ""}`);
  if (ref.execNumber) lines.push(`Numero da execucao: ${ref.execNumber}`);
  if (ref.executadoNome) lines.push(`Executado: ${ref.executadoNome}`);
  if (ref.executadoNascimento) lines.push(`Nascimento: ${fmt(ref.executadoNascimento)}`);
  lines.push("");
  lines.push("Resumo do calculo (MVP)");
  lines.push(`Processos ativos: ${processosAtivos.length}`);
  lines.push(`Crimes cadastrados: ${totalCrimes}`);
  lines.push(`Detracao registrada (dias): ${totalDetracao}`);
  lines.push("");
  lines.push("Processos vinculados");
  if (processosAtivos.length === 0) {
    lines.push("Nenhum processo ativo para calculo.");
  } else {
    processosAtivos.slice(0, 12).forEach((p, index) => {
      const crimesCount = (p.crimes?.length as number) ?? 0;
      lines.push(`${index + 1}. Processo ${p.number} — crimes: ${crimesCount}.`);
      if (p.denunciaRecebidaAt || p.sentencaAt || p.transitAtProcesso) {
        lines.push(
          `Marcos: denuncia ${fmt(p.denunciaRecebidaAt)} · sentenca ${fmt(p.sentencaAt)} · transito ${fmt(p.transitAtProcesso)}.`
        );
      }
    });
    if (processosAtivos.length > 12) {
      lines.push(`... e mais ${processosAtivos.length - 12} processos.`);
    }
  }
  lines.push("");
  lines.push(
    "Observacao: este relatorio PDF resume as informacoes cadastradas e serve como base para a simulacao auditavel. O motor completo de calculo continua em evolucao."
  );

  const pdfBytes = buildPdf(lines);

  return new NextResponse(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=\"relatorio-${referenceId}.pdf\"`,
    },
  });
}
