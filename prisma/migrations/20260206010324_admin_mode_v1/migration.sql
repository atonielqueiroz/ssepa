/*
  Warnings:

  - You are about to drop the column `userId` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `kind` on the `PasswordSetupToken` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - Added the required column `actorUserId` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `purpose` to the `PasswordSetupToken` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedByUserId" TEXT,
    CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Seed roles (RBAC v1)
INSERT INTO "Role" ("id", "key", "name") VALUES
  (lower(hex(randomblob(16))), 'USER', 'Usuário'),
  (lower(hex(randomblob(16))), 'MODERATOR', 'Moderador'),
  (lower(hex(randomblob(16))), 'ADMIN', 'Admin'),
  (lower(hex(randomblob(16))), 'SUPERADMIN', 'Superadmin');

-- Migrate legacy User.role enum -> UserRole join
INSERT INTO "UserRole" ("id", "userId", "roleId", "assignedByUserId")
SELECT lower(hex(randomblob(16))), u."id", r."id", NULL
FROM "User" u
JOIN "Role" r ON r."key" = u."role";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AuditLog" ("id", "createdAt", "actorUserId", "targetUserId", "action", "metadata")
SELECT "id", "createdAt", "userId", NULL, "action", "metadata" FROM "AuditLog";
DROP TABLE "AuditLog";
ALTER TABLE "new_AuditLog" RENAME TO "AuditLog";
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");
CREATE INDEX "AuditLog_targetUserId_idx" ON "AuditLog"("targetUserId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE TABLE "new_PasswordSetupToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "purpose" TEXT NOT NULL,
    "createdByUserId" TEXT
);
INSERT INTO "new_PasswordSetupToken" ("id", "createdAt", "email", "tokenHash", "expiresAt", "usedAt", "purpose", "createdByUserId")
SELECT "id", "createdAt", "email", "tokenHash", "expiresAt", "usedAt", "kind", "createdByUserId" FROM "PasswordSetupToken";
DROP TABLE "PasswordSetupToken";
ALTER TABLE "new_PasswordSetupToken" RENAME TO "PasswordSetupToken";
CREATE UNIQUE INDEX "PasswordSetupToken_tokenHash_key" ON "PasswordSetupToken"("tokenHash");
CREATE INDEX "PasswordSetupToken_email_idx" ON "PasswordSetupToken"("email");
CREATE INDEX "PasswordSetupToken_expiresAt_idx" ON "PasswordSetupToken"("expiresAt");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "accountStatus" TEXT NOT NULL DEFAULT 'APROVADO',
    "accountStatusReason" TEXT,
    "accountStatusUpdatedAt" DATETIME,
    "accountStatusUpdatedBy" TEXT,
    "name" TEXT NOT NULL,
    "oabNumber" TEXT,
    "oabUf" TEXT,
    "phone" TEXT,
    "googleEnabled" BOOLEAN NOT NULL DEFAULT false,
    "profilePhotoUrl" TEXT,
    "email" TEXT NOT NULL,
    "recoveryEmail" TEXT,
    "emailVerifiedAt" DATETIME,
    "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'BLUE',
    "feedbackWidgetDismissedUntil" DATETIME
);
INSERT INTO "new_User" ("accountStatus", "accountStatusReason", "accountStatusUpdatedAt", "accountStatusUpdatedBy", "createdAt", "email", "emailVerifiedAt", "feedbackWidgetDismissedUntil", "id", "name", "oabNumber", "oabUf", "passwordHash", "phone", "profileCompleted", "recoveryEmail", "status", "theme", "updatedAt", "profilePhotoUrl")
SELECT "accountStatus", "accountStatusReason", "accountStatusUpdatedAt", "accountStatusUpdatedBy", "createdAt", "email", "emailVerifiedAt", "feedbackWidgetDismissedUntil", "id", "name", "oabNumber", "oabUf", "passwordHash", "phone", "profileCompleted", "recoveryEmail", "status", "theme", "updatedAt", "imageUrl" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

-- CreateIndex
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");
