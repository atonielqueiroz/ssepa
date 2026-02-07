-- AlterTable
ALTER TABLE "Reference" ADD COLUMN "activeOrder" BIGINT;
ALTER TABLE "Reference" ADD COLUMN "archivedAt" DATETIME;
ALTER TABLE "Reference" ADD COLUMN "archivedOrder" BIGINT;

-- CreateIndex
CREATE INDEX "Reference_activeOrder_idx" ON "Reference"("activeOrder");

-- CreateIndex
CREATE INDEX "Reference_archivedOrder_idx" ON "Reference"("archivedOrder");

-- CreateIndex
CREATE INDEX "Reference_archivedAt_idx" ON "Reference"("archivedAt");
