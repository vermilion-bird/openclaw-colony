-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "eventCategory" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventDesc" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "targetName" TEXT,
    "result" TEXT NOT NULL,
    "failReason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "extra" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

-- CreateIndex
CREATE INDEX "ActivityLog_eventType_idx" ON "ActivityLog"("eventType");

-- CreateIndex
CREATE INDEX "ActivityLog_result_idx" ON "ActivityLog"("result");

-- CreateIndex
CREATE INDEX "ActivityLog_ipAddress_idx" ON "ActivityLog"("ipAddress");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ActivityLog_userId_eventCategory_createdAt_idx" ON "ActivityLog"("userId", "eventCategory", "createdAt" DESC);
