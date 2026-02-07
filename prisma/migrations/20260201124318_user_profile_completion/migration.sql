-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "name" TEXT NOT NULL,
    "oabNumber" TEXT,
    "oabUf" TEXT,
    "phone" TEXT,
    "email" TEXT NOT NULL,
    "recoveryEmail" TEXT,
    "emailVerifiedAt" DATETIME,
    "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'BLUE'
);
INSERT INTO "new_User" ("createdAt", "email", "emailVerifiedAt", "id", "name", "oabNumber", "oabUf", "passwordHash", "phone", "recoveryEmail", "role", "status", "theme", "updatedAt") SELECT "createdAt", "email", "emailVerifiedAt", "id", "name", "oabNumber", "oabUf", "passwordHash", "phone", "recoveryEmail", "role", "status", "theme", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
