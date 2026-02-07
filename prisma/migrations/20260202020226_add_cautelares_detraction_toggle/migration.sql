-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProcessoEvento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "processoId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL,
    "motivo" TEXT,
    "cautelarTypes" JSONB,
    "cautelarOtherText" TEXT,
    "cautelarStart" DATETIME,
    "cautelarEnd" DATETIME,
    "noDetraction" BOOLEAN NOT NULL DEFAULT false,
    "source" JSONB,
    CONSTRAINT "ProcessoEvento_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "ProcessoCriminal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProcessoEvento" ("createdAt", "eventDate", "id", "motivo", "processoId", "source", "type", "updatedAt") SELECT "createdAt", "eventDate", "id", "motivo", "processoId", "source", "type", "updatedAt" FROM "ProcessoEvento";
DROP TABLE "ProcessoEvento";
ALTER TABLE "new_ProcessoEvento" RENAME TO "ProcessoEvento";
CREATE INDEX "ProcessoEvento_processoId_idx" ON "ProcessoEvento"("processoId");
CREATE INDEX "ProcessoEvento_type_eventDate_idx" ON "ProcessoEvento"("type", "eventDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
