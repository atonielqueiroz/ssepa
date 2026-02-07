-- CreateTable
CREATE TABLE "PasswordSetupToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "kind" TEXT NOT NULL,
    "createdByUserId" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "accountStatus" TEXT NOT NULL DEFAULT 'APROVADO',
    "accountStatusReason" TEXT,
    "accountStatusUpdatedAt" DATETIME,
    "accountStatusUpdatedBy" TEXT,
    "name" TEXT NOT NULL,
    "oabNumber" TEXT,
    "oabUf" TEXT,
    "phone" TEXT,
    "imageUrl" TEXT,
    "email" TEXT NOT NULL,
    "recoveryEmail" TEXT,
    "emailVerifiedAt" DATETIME,
    "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'BLUE',
    "feedbackWidgetDismissedUntil" DATETIME
);
INSERT INTO "new_User" ("createdAt", "email", "emailVerifiedAt", "feedbackWidgetDismissedUntil", "id", "imageUrl", "name", "oabNumber", "oabUf", "passwordHash", "phone", "profileCompleted", "recoveryEmail", "role", "status", "theme", "updatedAt") SELECT "createdAt", "email", "emailVerifiedAt", "feedbackWidgetDismissedUntil", "id", "imageUrl", "name", "oabNumber", "oabUf", "passwordHash", "phone", "profileCompleted", "recoveryEmail", "role", "status", "theme", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PasswordSetupToken_tokenHash_key" ON "PasswordSetupToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordSetupToken_email_idx" ON "PasswordSetupToken"("email");

-- CreateIndex
CREATE INDEX "PasswordSetupToken_expiresAt_idx" ON "PasswordSetupToken"("expiresAt");
