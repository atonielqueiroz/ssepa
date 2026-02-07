-- CreateTable
CREATE TABLE "ProcessoEvento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "processoId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL,
    "motivo" TEXT,
    "source" JSONB,
    CONSTRAINT "ProcessoEvento_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "ProcessoCriminal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "calcRunId" TEXT,
    "notes" TEXT,
    CONSTRAINT "Attachment_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "ProcessoCriminal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_crimeId_fkey" FOREIGN KEY ("crimeId") REFERENCES "Crime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ReferenceEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_processoEventoId_fkey" FOREIGN KEY ("processoEventoId") REFERENCES "ProcessoEvento" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_calcRunId_fkey" FOREIGN KEY ("calcRunId") REFERENCES "CalcRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Attachment" ("calcRunId", "createdAt", "crimeId", "decisionId", "eventId", "filename", "id", "mimeType", "notes", "processoId", "referenceId", "sizeBytes", "storageKey") SELECT "calcRunId", "createdAt", "crimeId", "decisionId", "eventId", "filename", "id", "mimeType", "notes", "processoId", "referenceId", "sizeBytes", "storageKey" FROM "Attachment";
DROP TABLE "Attachment";
ALTER TABLE "new_Attachment" RENAME TO "Attachment";
CREATE INDEX "Attachment_referenceId_idx" ON "Attachment"("referenceId");
CREATE INDEX "Attachment_processoId_idx" ON "Attachment"("processoId");
CREATE INDEX "Attachment_crimeId_idx" ON "Attachment"("crimeId");
CREATE INDEX "Attachment_eventId_idx" ON "Attachment"("eventId");
CREATE INDEX "Attachment_processoEventoId_idx" ON "Attachment"("processoEventoId");
CREATE INDEX "Attachment_decisionId_idx" ON "Attachment"("decisionId");
CREATE INDEX "Attachment_calcRunId_idx" ON "Attachment"("calcRunId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ProcessoEvento_processoId_idx" ON "ProcessoEvento"("processoId");

-- CreateIndex
CREATE INDEX "ProcessoEvento_type_eventDate_idx" ON "ProcessoEvento"("type", "eventDate");
