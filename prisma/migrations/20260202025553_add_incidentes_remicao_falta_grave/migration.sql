-- CreateTable
CREATE TABLE "Incidente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "referenceId" TEXT NOT NULL,
    "numero" TEXT,
    "type" TEXT NOT NULL,
    "complemento" TEXT,
    "referenceDate" DATETIME NOT NULL,
    "autuacaoAt" DATETIME,
    "remicaoDias" INTEGER,
    "remicaoStatus" TEXT,
    "faltaGraveFracNum" INTEGER,
    "faltaGraveFracDen" INTEGER,
    "source" JSONB,
    CONSTRAINT "Incidente_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "storageKey" TEXT NOT NULL,
    "referenceId" TEXT,
    "processoId" TEXT,
    "crimeId" TEXT,
    "eventId" TEXT,
    "processoEventoId" TEXT,
    "decisionId" TEXT,
    "incidenteId" TEXT,
    "calcRunId" TEXT,
    "notes" TEXT,
    CONSTRAINT "Attachment_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "ProcessoCriminal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_crimeId_fkey" FOREIGN KEY ("crimeId") REFERENCES "Crime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ReferenceEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_processoEventoId_fkey" FOREIGN KEY ("processoEventoId") REFERENCES "ProcessoEvento" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_incidenteId_fkey" FOREIGN KEY ("incidenteId") REFERENCES "Incidente" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_calcRunId_fkey" FOREIGN KEY ("calcRunId") REFERENCES "CalcRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Attachment" ("calcRunId", "createdAt", "crimeId", "decisionId", "eventId", "filename", "id", "mimeType", "notes", "processoEventoId", "processoId", "referenceId", "sizeBytes", "storageKey") SELECT "calcRunId", "createdAt", "crimeId", "decisionId", "eventId", "filename", "id", "mimeType", "notes", "processoEventoId", "processoId", "referenceId", "sizeBytes", "storageKey" FROM "Attachment";
DROP TABLE "Attachment";
ALTER TABLE "new_Attachment" RENAME TO "Attachment";
CREATE INDEX "Attachment_referenceId_idx" ON "Attachment"("referenceId");
CREATE INDEX "Attachment_processoId_idx" ON "Attachment"("processoId");
CREATE INDEX "Attachment_crimeId_idx" ON "Attachment"("crimeId");
CREATE INDEX "Attachment_eventId_idx" ON "Attachment"("eventId");
CREATE INDEX "Attachment_processoEventoId_idx" ON "Attachment"("processoEventoId");
CREATE INDEX "Attachment_decisionId_idx" ON "Attachment"("decisionId");
CREATE INDEX "Attachment_incidenteId_idx" ON "Attachment"("incidenteId");
CREATE INDEX "Attachment_calcRunId_idx" ON "Attachment"("calcRunId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Incidente_referenceId_idx" ON "Incidente"("referenceId");

-- CreateIndex
CREATE INDEX "Incidente_type_referenceDate_idx" ON "Incidente"("type", "referenceDate");
