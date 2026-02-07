-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Crime" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "processoId" TEXT NOT NULL,
    "law" TEXT NOT NULL,
    "article" TEXT NOT NULL,
    "description" TEXT,
    "complement" TEXT,
    "factDate" DATETIME NOT NULL,
    "penaltyYears" INTEGER NOT NULL,
    "penaltyMonths" INTEGER NOT NULL,
    "penaltyDays" INTEGER NOT NULL,
    "transitDate" DATETIME NOT NULL,
    "hasViolence" BOOLEAN NOT NULL,
    "isHediondo" BOOLEAN NOT NULL,
    "hasResultDeath" BOOLEAN NOT NULL,
    "hasOrgCrimLead" BOOLEAN NOT NULL,
    "hasMilicia" BOOLEAN NOT NULL,
    "isFeminicidio" BOOLEAN NOT NULL,
    "nature" TEXT NOT NULL DEFAULT 'COMUM',
    "equiparadoType" TEXT,
    "art112ChoiceMode" TEXT NOT NULL DEFAULT 'AUTO',
    "art112Inciso" TEXT,
    "art112Summary" TEXT,
    "art112Basis" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "suspendedAt" DATETIME,
    "suspendedNotes" TEXT,
    "extinctAt" DATETIME,
    "extinctNotes" TEXT,
    "source" JSONB,
    CONSTRAINT "Crime_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "ProcessoCriminal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Crime" ("article", "complement", "createdAt", "description", "extinctAt", "extinctNotes", "factDate", "hasMilicia", "hasOrgCrimLead", "hasResultDeath", "hasViolence", "id", "isFeminicidio", "isHediondo", "law", "penaltyDays", "penaltyMonths", "penaltyYears", "processoId", "source", "status", "suspendedAt", "suspendedNotes", "transitDate", "updatedAt") SELECT "article", "complement", "createdAt", "description", "extinctAt", "extinctNotes", "factDate", "hasMilicia", "hasOrgCrimLead", "hasResultDeath", "hasViolence", "id", "isFeminicidio", "isHediondo", "law", "penaltyDays", "penaltyMonths", "penaltyYears", "processoId", "source", "status", "suspendedAt", "suspendedNotes", "transitDate", "updatedAt" FROM "Crime";
DROP TABLE "Crime";
ALTER TABLE "new_Crime" RENAME TO "Crime";
CREATE INDEX "Crime_processoId_idx" ON "Crime"("processoId");
CREATE INDEX "Crime_factDate_idx" ON "Crime"("factDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
