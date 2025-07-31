-- CreateTable
CREATE TABLE "AuditLog" (
    "AuditLogSid" SERIAL NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT,
    "operation" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy" TEXT,
    "changes" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("AuditLogSid")
);
