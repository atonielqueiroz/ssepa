-- AlterTable
ALTER TABLE "ProcessoCriminal" ADD COLUMN "acordaoAt" DATETIME;
ALTER TABLE "ProcessoCriminal" ADD COLUMN "denunciaRecebidaAt" DATETIME;
ALTER TABLE "ProcessoCriminal" ADD COLUMN "juizoVaraCondenacao" TEXT;
ALTER TABLE "ProcessoCriminal" ADD COLUMN "marcosSource" JSONB;
ALTER TABLE "ProcessoCriminal" ADD COLUMN "reAt" DATETIME;
ALTER TABLE "ProcessoCriminal" ADD COLUMN "respAt" DATETIME;
ALTER TABLE "ProcessoCriminal" ADD COLUMN "sentencaAt" DATETIME;
ALTER TABLE "ProcessoCriminal" ADD COLUMN "transitAtAcusacao" DATETIME;
ALTER TABLE "ProcessoCriminal" ADD COLUMN "transitAtDefesa" DATETIME;
ALTER TABLE "ProcessoCriminal" ADD COLUMN "transitAtProcesso" DATETIME;

-- AlterTable
ALTER TABLE "Reference" ADD COLUMN "executadoNascimento" DATETIME;
ALTER TABLE "Reference" ADD COLUMN "executadoNascimentoSourceText" TEXT;
