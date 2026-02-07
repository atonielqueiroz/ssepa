-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProcessoCriminal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "referenceId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "sentencaSaved" BOOLEAN NOT NULL DEFAULT false,
    "includeInCalculations" BOOLEAN NOT NULL DEFAULT true,
    "denunciaRecebidaAt" DATETIME,
    "sentencaAt" DATETIME,
    "fatosBaseAt" DATETIME,
    "fatosBaseNaoSei" BOOLEAN NOT NULL DEFAULT false,
    "acordaoAt" DATETIME,
    "respAt" DATETIME,
    "reAt" DATETIME,
    "transitAtProcesso" DATETIME,
    "transitAtAcusacao" DATETIME,
    "transitAtDefesa" DATETIME,
    "juizoVaraCondenacao" TEXT,
    "marcosSource" JSONB,
    "execRegime" TEXT,
    "execSituacao" TEXT,
    "execMarkerMonitorado" BOOLEAN NOT NULL DEFAULT false,
    "execMarkerRecolhido" BOOLEAN NOT NULL DEFAULT false,
    "execMarkerSoltoCumprindo" BOOLEAN NOT NULL DEFAULT false,
    "execObservacao" TEXT,
    "execDestacar" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "source" JSONB,
    CONSTRAINT "ProcessoCriminal_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProcessoCriminal" ("acordaoAt", "createdAt", "denunciaRecebidaAt", "execDestacar", "execMarkerMonitorado", "execMarkerRecolhido", "execMarkerSoltoCumprindo", "execObservacao", "execRegime", "execSituacao", "id", "includeInCalculations", "juizoVaraCondenacao", "marcosSource", "notes", "number", "reAt", "referenceId", "respAt", "sentencaAt", "sentencaSaved", "source", "transitAtAcusacao", "transitAtDefesa", "transitAtProcesso", "updatedAt") SELECT "acordaoAt", "createdAt", "denunciaRecebidaAt", "execDestacar", "execMarkerMonitorado", "execMarkerRecolhido", "execMarkerSoltoCumprindo", "execObservacao", "execRegime", "execSituacao", "id", "includeInCalculations", "juizoVaraCondenacao", "marcosSource", "notes", "number", "reAt", "referenceId", "respAt", "sentencaAt", "sentencaSaved", "source", "transitAtAcusacao", "transitAtDefesa", "transitAtProcesso", "updatedAt" FROM "ProcessoCriminal";
DROP TABLE "ProcessoCriminal";
ALTER TABLE "new_ProcessoCriminal" RENAME TO "ProcessoCriminal";
CREATE INDEX "ProcessoCriminal_referenceId_idx" ON "ProcessoCriminal"("referenceId");
CREATE INDEX "ProcessoCriminal_number_idx" ON "ProcessoCriminal"("number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
