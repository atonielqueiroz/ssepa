-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Reference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "execNumber" TEXT,
    "semExecucaoFormada" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "court" TEXT,
    "city" TEXT,
    "stateUf" TEXT,
    "notes" TEXT,
    "executadoNome" TEXT,
    "executadoNascimento" DATETIME,
    "executadoNascimentoSourceText" TEXT,
    "classeProcessual" TEXT,
    "assuntoPrincipal" TEXT,
    "nivelSigilo" TEXT,
    "diasTramitacao" INTEGER,
    "autuacaoAt" DATETIME,
    "distribuicaoAt" DATETIME,
    "competencia" TEXT,
    "juizo" TEXT,
    "juiz" TEXT,
    "reeducandoGender" TEXT,
    "reeducandaGestante" BOOLEAN NOT NULL DEFAULT false,
    "reeducandaMaeOuResponsavelCriancaOuPcd" BOOLEAN NOT NULL DEFAULT false,
    "novoCrimeDoloso" BOOLEAN NOT NULL DEFAULT false,
    "progEspecial112_3_enabled" BOOLEAN NOT NULL DEFAULT false,
    "progEspecial112_3_req_I_semViolencia" BOOLEAN NOT NULL DEFAULT false,
    "progEspecial112_3_req_II_naoCrimeContraFilho" BOOLEAN NOT NULL DEFAULT false,
    "progEspecial112_3_req_III_cumpriuUmOitavoRegAnterior" BOOLEAN NOT NULL DEFAULT false,
    "progEspecial112_3_req_IV_primariaBomComport" BOOLEAN NOT NULL DEFAULT false,
    "progEspecial112_3_req_V_naoOrgCrim" BOOLEAN NOT NULL DEFAULT false,
    "source" JSONB,
    CONSTRAINT "Reference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Reference" ("assuntoPrincipal", "autuacaoAt", "city", "classeProcessual", "competencia", "court", "createdAt", "diasTramitacao", "distribuicaoAt", "execNumber", "executadoNascimento", "executadoNascimentoSourceText", "executadoNome", "id", "juiz", "juizo", "nivelSigilo", "notes", "semExecucaoFormada", "source", "stateUf", "status", "title", "updatedAt", "userId") SELECT "assuntoPrincipal", "autuacaoAt", "city", "classeProcessual", "competencia", "court", "createdAt", "diasTramitacao", "distribuicaoAt", "execNumber", "executadoNascimento", "executadoNascimentoSourceText", "executadoNome", "id", "juiz", "juizo", "nivelSigilo", "notes", "semExecucaoFormada", "source", "stateUf", "status", "title", "updatedAt", "userId" FROM "Reference";
DROP TABLE "Reference";
ALTER TABLE "new_Reference" RENAME TO "Reference";
CREATE INDEX "Reference_userId_idx" ON "Reference"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
