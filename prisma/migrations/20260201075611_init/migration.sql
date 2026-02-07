-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "name" TEXT NOT NULL,
    "oabNumber" TEXT NOT NULL,
    "oabUf" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "recoveryEmail" TEXT NOT NULL,
    "emailVerifiedAt" DATETIME,
    "passwordHash" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'BLUE'
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TermsVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "textHash" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "TermsAcceptance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "termsId" TEXT NOT NULL,
    "acceptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "TermsAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TermsAcceptance_termsId_fkey" FOREIGN KEY ("termsId") REFERENCES "TermsVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reference" (
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
    "source" JSONB,
    CONSTRAINT "Reference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcessoCriminal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "referenceId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "notes" TEXT,
    "source" JSONB,
    CONSTRAINT "ProcessoCriminal_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Crime" (
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
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "suspendedAt" DATETIME,
    "suspendedNotes" TEXT,
    "extinctAt" DATETIME,
    "extinctNotes" TEXT,
    "source" JSONB,
    CONSTRAINT "Crime_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "ProcessoCriminal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "processoId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "decisionDate" DATETIME NOT NULL,
    "tribunal" TEXT,
    "number" TEXT,
    "publicationAt" DATETIME,
    "transitAt" DATETIME,
    "notes" TEXT,
    "source" JSONB,
    CONSTRAINT "Decision_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "ProcessoCriminal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CrimeChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decisionId" TEXT NOT NULL,
    "op" TEXT NOT NULL,
    "baseCrimeId" TEXT,
    "fields" JSONB NOT NULL,
    CONSTRAINT "CrimeChange_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReferenceEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "referenceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "complemento" TEXT,
    "referenceDate" DATETIME NOT NULL,
    "status" TEXT,
    "notes" TEXT,
    "source" JSONB,
    CONSTRAINT "ReferenceEvent_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attachment" (
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
    "decisionId" TEXT,
    "calcRunId" TEXT,
    "notes" TEXT,
    CONSTRAINT "Attachment_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "ProcessoCriminal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_crimeId_fkey" FOREIGN KEY ("crimeId") REFERENCES "Crime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ReferenceEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_calcRunId_fkey" FOREIGN KEY ("calcRunId") REFERENCES "CalcRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CalcRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referenceId" TEXT NOT NULL,
    "name" TEXT,
    "inputs" JSONB NOT NULL,
    "outputs" JSONB NOT NULL,
    "appliedTeses" JSONB,
    "appliedRules" JSONB,
    "notes" TEXT,
    CONSTRAINT "CalcRun_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JurisTese" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "publishedAt" DATETIME,
    "theme" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "ementaText" TEXT NOT NULL,
    "highlights" JSONB,
    "references" JSONB,
    "isBeneficial" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "JurisRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teseId" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "params" JSONB NOT NULL,
    CONSTRAINT "JurisRule_teseId_fkey" FOREIGN KEY ("teseId") REFERENCES "JurisTese" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "TermsVersion_version_key" ON "TermsVersion"("version");

-- CreateIndex
CREATE INDEX "TermsAcceptance_userId_idx" ON "TermsAcceptance"("userId");

-- CreateIndex
CREATE INDEX "TermsAcceptance_termsId_idx" ON "TermsAcceptance"("termsId");

-- CreateIndex
CREATE INDEX "Reference_userId_idx" ON "Reference"("userId");

-- CreateIndex
CREATE INDEX "ProcessoCriminal_referenceId_idx" ON "ProcessoCriminal"("referenceId");

-- CreateIndex
CREATE INDEX "ProcessoCriminal_number_idx" ON "ProcessoCriminal"("number");

-- CreateIndex
CREATE INDEX "Crime_processoId_idx" ON "Crime"("processoId");

-- CreateIndex
CREATE INDEX "Crime_factDate_idx" ON "Crime"("factDate");

-- CreateIndex
CREATE INDEX "Decision_processoId_idx" ON "Decision"("processoId");

-- CreateIndex
CREATE INDEX "Decision_type_decisionDate_idx" ON "Decision"("type", "decisionDate");

-- CreateIndex
CREATE INDEX "CrimeChange_decisionId_idx" ON "CrimeChange"("decisionId");

-- CreateIndex
CREATE INDEX "CrimeChange_baseCrimeId_idx" ON "CrimeChange"("baseCrimeId");

-- CreateIndex
CREATE INDEX "ReferenceEvent_referenceId_idx" ON "ReferenceEvent"("referenceId");

-- CreateIndex
CREATE INDEX "ReferenceEvent_type_referenceDate_idx" ON "ReferenceEvent"("type", "referenceDate");

-- CreateIndex
CREATE INDEX "Attachment_referenceId_idx" ON "Attachment"("referenceId");

-- CreateIndex
CREATE INDEX "Attachment_processoId_idx" ON "Attachment"("processoId");

-- CreateIndex
CREATE INDEX "Attachment_crimeId_idx" ON "Attachment"("crimeId");

-- CreateIndex
CREATE INDEX "Attachment_eventId_idx" ON "Attachment"("eventId");

-- CreateIndex
CREATE INDEX "Attachment_decisionId_idx" ON "Attachment"("decisionId");

-- CreateIndex
CREATE INDEX "Attachment_calcRunId_idx" ON "Attachment"("calcRunId");

-- CreateIndex
CREATE INDEX "CalcRun_referenceId_idx" ON "CalcRun"("referenceId");

-- CreateIndex
CREATE INDEX "JurisTese_theme_idx" ON "JurisTese"("theme");

-- CreateIndex
CREATE UNIQUE INDEX "JurisTese_theme_version_key" ON "JurisTese"("theme", "version");

-- CreateIndex
CREATE INDEX "JurisRule_teseId_idx" ON "JurisRule"("teseId");

-- CreateIndex
CREATE INDEX "JurisRule_ruleType_idx" ON "JurisRule"("ruleType");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
