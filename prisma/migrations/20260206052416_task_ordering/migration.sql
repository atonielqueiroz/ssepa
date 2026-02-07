-- AlterTable
ALTER TABLE "Task" ADD COLUMN "archivedAt" DATETIME;
ALTER TABLE "Task" ADD COLUMN "archivedOrder" BIGINT;
ALTER TABLE "Task" ADD COLUMN "completedAt" DATETIME;
ALTER TABLE "Task" ADD COLUMN "doneOrder" BIGINT;
ALTER TABLE "Task" ADD COLUMN "openOrder" BIGINT;

-- CreateIndex
CREATE INDEX "Task_openOrder_idx" ON "Task"("openOrder");

-- CreateIndex
CREATE INDEX "Task_doneOrder_idx" ON "Task"("doneOrder");

-- CreateIndex
CREATE INDEX "Task_archivedOrder_idx" ON "Task"("archivedOrder");
