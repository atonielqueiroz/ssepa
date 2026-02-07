-- AlterTable
ALTER TABLE "User" ADD COLUMN "feedbackWidgetDismissedUntil" DATETIME;

-- CreateTable
CREATE TABLE "FeedbackMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "version" TEXT NOT NULL,
    "screenKey" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "message" TEXT NOT NULL,
    CONSTRAINT "FeedbackMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FeedbackMessage_createdAt_idx" ON "FeedbackMessage"("createdAt");

-- CreateIndex
CREATE INDEX "FeedbackMessage_userId_idx" ON "FeedbackMessage"("userId");

-- CreateIndex
CREATE INDEX "FeedbackMessage_screenKey_idx" ON "FeedbackMessage"("screenKey");
